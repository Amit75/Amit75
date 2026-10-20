import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_STATIC_ROOT = '/app/storefront';
const DEFAULT_API_ORIGIN = 'http://aarulya-aarulya-store-api:8080';
const DEFAULT_ALLOWED_HOSTS = Object.freeze(['store.aarulya.com']);

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
});

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function securityHeaders() {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self' https://identity.aarulya.com; connect-src 'self' https://api.store.aarulya.com; img-src 'self' data:; style-src 'self'; script-src 'self'",
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY'
  };
}

function normalizedHost(value) {
  return String(value || '').trim().toLowerCase().replace(/:\d+$/, '');
}

function allowedHostSet(value) {
  const list = String(value || '')
    .split(',')
    .map((item) => normalizedHost(item))
    .filter(Boolean);
  const hosts = list.length ? list : DEFAULT_ALLOWED_HOSTS;
  for (const host of hosts) {
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(host)) {
      throw new Error('valid-edge-allowed-host-required');
    }
  }
  return new Set(hosts);
}

function trustedApiOrigin(value) {
  const parsed = new URL(String(value || DEFAULT_API_ORIGIN));
  if (parsed.protocol !== 'http:' || parsed.hostname !== 'aarulya-aarulya-store-api' || parsed.port !== '8080') {
    throw new Error('canonical-internal-store-api-origin-required');
  }
  return parsed.origin;
}

function staticCandidate(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    throw fail('invalid-path-encoding', 400);
  }
  if (decoded.includes('\0') || decoded.includes('\\')) throw fail('invalid-static-path', 400);
  let relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative === 'install') relative = 'install/index.html';
  const candidate = resolve(root, relative);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (candidate !== root && !candidate.startsWith(prefix)) throw fail('static-path-escape-denied', 403);
  return candidate;
}

async function readBoundedBody(request, maximum = 64 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > maximum) throw fail('request-body-too-large', 413);
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

function copyProxyHeader(source, target, name) {
  const value = source.get(name);
  if (value) target[name] = value;
}

export function createCloudStagingEdgeHandler({
  staticRoot = DEFAULT_STATIC_ROOT,
  apiOrigin = DEFAULT_API_ORIGIN,
  allowedHosts = DEFAULT_ALLOWED_HOSTS,
  fetchImpl = globalThis.fetch
} = {}) {
  const root = resolve(staticRoot);
  const api = trustedApiOrigin(apiOrigin);
  const hosts = allowedHosts instanceof Set ? allowedHosts : new Set(allowedHosts);
  if (typeof fetchImpl !== 'function') throw new Error('edge-fetch-required');

  return async function handler(request, response) {
    try {
      const url = new URL(request.url, 'http://edge.internal');
      if (url.pathname === '/health') {
        const body = JSON.stringify({ status: 'ok', service: 'aarulya-store-cloud-staging-edge' });
        response.writeHead(200, {
          ...securityHeaders(),
          'content-type': 'application/json; charset=utf-8',
          'content-length': Buffer.byteLength(body)
        });
        response.end(body);
        return;
      }

      const host = normalizedHost(request.headers?.host);
      if (!hosts.has(host)) throw fail('untrusted-store-host', 421);

      if (url.pathname === '/auth' || url.pathname.startsWith('/auth/')) {
        const method = String(request.method || 'GET').toUpperCase();
        if (!['GET', 'HEAD', 'POST'].includes(method)) throw fail('auth-method-not-allowed', 405);
        const body = method === 'POST' ? await readBoundedBody(request) : null;
        const target = new URL(url.pathname + url.search, api);
        const upstream = await fetchImpl(target, {
          method,
          redirect: 'manual',
          cache: 'no-store',
          headers: {
            accept: String(request.headers?.accept || 'application/json'),
            ...(request.headers?.cookie ? { cookie: String(request.headers.cookie) } : {}),
            ...(request.headers?.origin ? { origin: String(request.headers.origin) } : {}),
            ...(request.headers?.['content-type'] ? { 'content-type': String(request.headers['content-type']) } : {}),
            host: 'store.aarulya.com',
            'x-forwarded-proto': 'https'
          },
          ...(body ? { body } : {})
        });
        if (upstream.status >= 500) throw fail('store-auth-upstream-failed', 502);
        const headers = securityHeaders();
        for (const name of ['content-type', 'cache-control', 'location', 'set-cookie']) {
          copyProxyHeader(upstream.headers, headers, name);
        }
        const raw = Buffer.from(await upstream.arrayBuffer());
        if (raw.length > 256 * 1024) throw fail('store-auth-response-too-large', 502);
        headers['content-length'] = String(raw.length);
        response.writeHead(upstream.status, headers);
        if (method === 'HEAD') response.end();
        else response.end(raw);
        return;
      }

      const method = String(request.method || 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method)) throw fail('static-method-not-allowed', 405);
      let candidate = staticCandidate(root, url.pathname);
      let info = await stat(candidate).catch(() => null);
      if (!info?.isFile()) {
        candidate = resolve(root, 'index.html');
        info = await stat(candidate).catch(() => null);
      }
      if (!info?.isFile()) throw fail('storefront-not-found', 404);
      if (info.size > 5 * 1024 * 1024) throw fail('static-file-too-large', 413);
      const body = await readFile(candidate);
      response.writeHead(200, {
        ...securityHeaders(),
        'cache-control': extname(candidate) === '.html' ? 'no-store' : 'public, max-age=3600',
        'content-type': MIME[extname(candidate).toLowerCase()] || 'application/octet-stream',
        'content-length': String(body.length)
      });
      if (method === 'HEAD') response.end();
      else response.end(body);
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      const body = JSON.stringify({
        error: status >= 500 ? 'internal-server-error' : String(error.code || error.message || 'edge-request-failed')
      });
      response.writeHead(status, {
        ...securityHeaders(),
        'content-type': 'application/json; charset=utf-8',
        'content-length': Buffer.byteLength(body)
      });
      response.end(body);
    }
  };
}

export function startCloudStagingEdge(env = process.env) {
  const port = Number(env.PORT || 8083);
  const host = String(env.HOST || '0.0.0.0');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('valid-edge-port-required');
  if (host !== '0.0.0.0' && host !== '127.0.0.1' && host !== '::1') throw new Error('valid-edge-bind-required');
  const handler = createCloudStagingEdgeHandler({
    staticRoot: env.AARULYA_STOREFRONT_ROOT || DEFAULT_STATIC_ROOT,
    apiOrigin: env.AARULYA_STORE_INTERNAL_API_ORIGIN || DEFAULT_API_ORIGIN,
    allowedHosts: allowedHostSet(env.AARULYA_EDGE_ALLOWED_HOSTS)
  });
  const server = createServer(handler);
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxRequestsPerSocket = 100;
  server.listen(port, host, () => {
    console.log('Aarulya Store cloud staging edge listening on ' + host + ':' + port);
  });
  return server;
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked && invoked === fileURLToPath(import.meta.url)) startCloudStagingEdge();
