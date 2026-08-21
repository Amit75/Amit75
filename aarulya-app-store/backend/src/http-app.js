import { randomUUID } from 'node:crypto';

const JSON_LIMIT_BYTES = 1024 * 1024;
const PUBLIC_GET = new Set(['/api/v1/catalog']);

function writeJson(response, status, payload, requestId) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': status >= 400 ? 'no-store' : 'private, max-age=0',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'x-request-id': requestId
  });
  response.end(body);
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > JSON_LIMIT_BYTES) {
      const error = new Error('request-body-too-large');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    const error = new Error('invalid-json-object');
    error.status = 400;
    throw error;
  }
}

function bearerToken(request) {
  const value = request.headers.authorization;
  if (!value || !value.startsWith('Bearer ')) return null;
  const token = value.slice(7).trim();
  return token.length >= 24 ? token : null;
}

function routeMatch(pathname, pattern) {
  const names = [];
  const source = pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  const match = pathname.match(new RegExp(`^${source}$`));
  if (!match) return null;
  return Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
}

function requireIdempotency(request) {
  const key = request.headers['idempotency-key'];
  if (!key || String(key).length < 16 || String(key).length > 200) {
    const error = new Error('valid-idempotency-key-required');
    error.status = 400;
    throw error;
  }
  return String(key);
}

export function createHttpHandler({
  service,
  authenticate = async () => null,
  releaseRepository = null,
  allowedOrigins = []
} = {}) {
  if (!service) throw new Error('store-service-required');
  const origins = new Set(allowedOrigins);

  return async function handler(request, response) {
    const requestId = String(request.headers['x-request-id'] || randomUUID());
    try {
      const url = new URL(request.url, 'https://aarulya.invalid');
      const pathname = url.pathname;
      const method = request.method || 'GET';
      const origin = request.headers.origin;

      if (origin && !origins.has(origin)) {
        const error = new Error('origin-not-allowed');
        error.status = 403;
        throw error;
      }

      if (method === 'GET' && pathname === '/health') {
        return writeJson(response, 200, { status: 'ok', service: 'aarulya-store-api' }, requestId);
      }

      if (method === 'GET' && pathname === '/api/v1/catalog') {
        const result = service.listCatalog({
          category: url.searchParams.get('category'),
          query: url.searchParams.get('q') || '',
          limit: url.searchParams.get('limit') || 50,
          offset: url.searchParams.get('offset') || 0
        });
        return writeJson(response, 200, result, requestId);
      }

      const appParams = method === 'GET' ? routeMatch(pathname, '/api/v1/apps/:appId') : null;
      if (appParams) return writeJson(response, 200, service.getApp(appParams.appId), requestId);

      if (method === 'POST' && pathname === '/api/v1/actions/resolve') {
        const body = await readJson(request);
        return writeJson(response, 200, { actions: service.resolveAction(body.query) }, requestId);
      }

      const token = bearerToken(request);
      const identity = token ? await authenticate(token, { requestId, pathname, method }) : null;
      if (!identity?.actorId) {
        const error = new Error('authentication-required');
        error.status = 401;
        throw error;
      }
      const context = Object.freeze({
        actorId: identity.actorId,
        authorizedOwner: identity.roles?.includes('owner') === true,
        requestId
      });

      if (method === 'POST' && pathname === '/api/v1/downloads/authorize') {
        if (!releaseRepository) {
          const error = new Error('release-repository-not-configured');
          error.status = 503;
          throw error;
        }
        const body = await readJson(request);
        const idempotencyKey = requireIdempotency(request);
        const release = await releaseRepository.getReleaseForDownload(body.appId, body.versionCode, context);
        const catalogManifest = await releaseRepository.getCurrentCatalogManifest(context);
        const result = service.authorizeDownload(
          { ...context, idempotencyKey },
          {
            release,
            catalogManifest,
            packageKillSwitch: await releaseRepository.isPackageDownloadDisabled(release.packageId),
            globalKillSwitch: await releaseRepository.isGlobalDownloadDisabled()
          }
        );
        return writeJson(response, 201, result, requestId);
      }

      if (method === 'POST' && pathname === '/api/v1/installs/report') {
        if (!releaseRepository) {
          const error = new Error('release-repository-not-configured');
          error.status = 503;
          throw error;
        }
        requireIdempotency(request);
        const body = await readJson(request);
        const candidate = await releaseRepository.getReleaseByPackageAndVersion(body.packageId, body.versionCode, context);
        const catalogManifest = await releaseRepository.getCurrentCatalogManifest(context);
        const receipt = service.reportInstall(context, {
          installed: body.installed || null,
          candidate,
          downloadedSha256: body.downloadedSha256,
          catalogManifest,
          deviceId: body.deviceId
        });
        return writeJson(response, 201, receipt, requestId);
      }

      if (method === 'POST' && pathname === '/api/v1/jobs') {
        const body = await readJson(request);
        const idempotencyKey = requireIdempotency(request);
        const job = service.createJob(context, { ...body, idempotencyKey });
        return writeJson(response, 201, job, requestId);
      }

      const jobParams = method === 'GET' ? routeMatch(pathname, '/api/v1/jobs/:jobId') : null;
      if (jobParams) return writeJson(response, 200, service.getJob(context, jobParams.jobId), requestId);

      const transitionParams = method === 'POST'
        ? routeMatch(pathname, '/api/v1/jobs/:jobId/:action')
        : null;
      if (transitionParams && ['pause', 'resume', 'cancel'].includes(transitionParams.action)) {
        requireIdempotency(request);
        const target = transitionParams.action === 'pause'
          ? 'paused'
          : transitionParams.action === 'resume'
            ? 'queued'
            : 'cancelled';
        const job = service.transitionJob(context, transitionParams.jobId, target, { source: 'user-api' });
        return writeJson(response, 200, job, requestId);
      }

      return writeJson(response, 404, { error: 'route-not-found', requestId }, requestId);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      const code = status >= 500 ? 'internal-server-error' : String(error.code || error.message || 'request-failed');
      return writeJson(response, status, {
        error: code,
        requestId,
        ...(status < 500 && error.details ? { details: error.details } : {})
      }, requestId);
    }
  };
}
