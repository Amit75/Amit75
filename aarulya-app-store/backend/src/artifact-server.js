import { createHash, timingSafeEqual } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { basename, resolve, sep } from 'node:path';
import { createPostgresPool, closePostgresPool } from './postgres.js';
import { PostgreSqlArtifactRepository } from './artifact-repository.js';

const mode = String(process.env.AARULYA_ARTIFACT_MODE || '').toLowerCase();
const downloadsMode = mode === 'downloads';
const evidenceMode = mode === 'evidence';
if (!downloadsMode && !evidenceMode) throw new Error('artifact-mode-downloads-or-evidence-required');
if (process.env.NODE_ENV !== 'production') throw new Error('artifact-service-production-only');

const expectedOrigin = downloadsMode
  ? 'https://downloads.store.aarulya.com'
  : 'https://evidence.store.aarulya.com';
const publicOrigin = String(process.env.AARULYA_PUBLIC_ORIGIN || '').replace(/\/$/, '');
if (publicOrigin !== expectedOrigin) throw new Error('canonical-artifact-origin-mismatch');

const root = resolve(String(process.env.AARULYA_ARTIFACT_ROOT || ''));
if (!process.env.AARULYA_ARTIFACT_ROOT || root === '/') throw new Error('private-artifact-root-required');
const host = process.env.HOST || '127.0.0.1';
if (host !== '127.0.0.1' && host !== '::1') throw new Error('artifact-service-loopback-bind-required');
const port = Number(process.env.PORT || (downloadsMode ? 8081 : 8082));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('valid-artifact-port-required');

const pool = downloadsMode ? createPostgresPool({
  ...process.env,
  AARULYA_DATABASE_APP_NAME: 'aarulya-store-downloads'
}) : null;
const artifactRepository = pool ? new PostgreSqlArtifactRepository(pool) : null;

function headers(extra = {}) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-resource-policy': 'same-site',
    ...extra
  };
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, headers({
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  }));
  response.end(body);
}

function safePath(objectKey) {
  const normalized = String(objectKey || '').replaceAll('\\', '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('../') || normalized.includes('/./')) {
    throw new Error('unsafe-artifact-object-key');
  }
  const target = resolve(root, normalized);
  if (target !== root && !target.startsWith(`${root}${sep}`)) throw new Error('artifact-path-escape');
  return target;
}

function bearer(request) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(request.headers.authorization || ''));
  if (!match) return null;
  return match[1];
}

async function fileDigest(path) {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function streamFile(response, path, metadata, cacheControl) {
  const stat = await fs.stat(path);
  if (!stat.isFile()) throw Object.assign(new Error('artifact-not-regular-file'), { status: 404 });
  if (metadata.expectedSize != null && stat.size !== metadata.expectedSize) {
    throw Object.assign(new Error('artifact-size-mismatch'), { status: 503 });
  }
  const actualDigest = await fileDigest(path);
  const expected = Buffer.from(metadata.sha256, 'hex');
  const actual = Buffer.from(actualDigest, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw Object.assign(new Error('artifact-digest-mismatch'), { status: 503 });
  }

  response.writeHead(200, headers({
    'content-type': metadata.contentType,
    'content-length': stat.size,
    'content-disposition': `attachment; filename="${basename(metadata.filename)}"`,
    'cache-control': cacheControl,
    'x-aarulya-sha256': actualDigest,
    ...(metadata.packageId ? { 'x-aarulya-package-id': metadata.packageId } : {}),
    ...(metadata.versionCode ? { 'x-aarulya-version-code': String(metadata.versionCode) } : {})
  }));
  createReadStream(path).pipe(response);
}

async function handleDownload(request, response, pathname) {
  const match = /^\/v1\/grants\/([0-9a-f-]{36})\/apk$/i.exec(pathname);
  if (!match || request.method !== 'GET') return false;
  const token = bearer(request);
  if (!token) throw Object.assign(new Error('download-token-required'), { status: 401 });
  const grant = await artifactRepository.consumeGrant(match[1], token);
  const path = safePath(grant.objectKey);
  await streamFile(response, path, {
    sha256: grant.apkSha256,
    expectedSize: grant.apkSizeBytes,
    contentType: 'application/vnd.android.package-archive',
    filename: `${grant.packageId}-${grant.versionCode}.apk`,
    packageId: grant.packageId,
    versionCode: grant.versionCode
  }, 'private, no-store');
  return true;
}

async function handleEvidence(request, response, pathname) {
  const match = /^\/v1\/reports\/([a-f0-9]{64})\.json$/i.exec(pathname);
  if (!match || request.method !== 'GET') return false;
  const digest = match[1].toLowerCase();
  const path = safePath(`reports/${digest}.json`);
  await streamFile(response, path, {
    sha256: digest,
    expectedSize: null,
    contentType: 'application/json; charset=utf-8',
    filename: `${digest}.json`
  }, 'public, max-age=31536000, immutable');
  return true;
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, expectedOrigin);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(response, 200, { status: 'ok', service: `aarulya-store-${mode}` });
    }
    const handled = downloadsMode
      ? await handleDownload(request, response, url.pathname)
      : await handleEvidence(request, response, url.pathname);
    if (!handled) json(response, 404, { error: 'artifact-not-found' });
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error?.stack || String(error));
    json(response, status, { error: status >= 500 ? 'artifact-service-failure' : String(error.message) });
  }
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;
server.maxRequestsPerSocket = 20;
server.listen(port, host, () => console.log(`Aarulya ${mode} service listening on ${host}:${port}`));

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; stopping ${mode} service.`);
  server.close(async () => {
    if (pool) await closePostgresPool(pool);
  });
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
