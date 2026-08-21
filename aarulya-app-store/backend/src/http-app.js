import { randomUUID } from 'node:crypto';

const JSON_LIMIT_BYTES = 1024 * 1024;
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const ALLOWED_METHODS = 'GET,POST,OPTIONS';
const ALLOWED_HEADERS = 'authorization,content-type,idempotency-key,x-request-id';

function securityHeaders(requestId) {
  return {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'cross-origin-resource-policy': 'same-site',
    'x-request-id': requestId
  };
}

function writeJson(response, status, payload, requestId, origin = null) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...securityHeaders(requestId),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': status >= 400 ? 'no-store' : 'private, no-store',
    ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {})
  });
  response.end(body);
}

function requestIdFor(request) {
  const supplied = String(request.headers['x-request-id'] || '');
  return REQUEST_ID.test(supplied) ? supplied : randomUUID();
}

async function readJson(request) {
  const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    const error = new Error('application-json-required');
    error.status = 415;
    throw error;
  }
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
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    const error = new Error('invalid-json-object');
    error.status = 400;
    throw error;
  }
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
  const key = String(request.headers['idempotency-key'] || '');
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(key)) {
    const error = new Error('valid-idempotency-key-required');
    error.status = 400;
    throw error;
  }
  return key;
}

function requirementsFor(method, pathname) {
  if (method === 'GET' && (pathname === '/api/v1/catalog' || pathname.startsWith('/api/v1/apps/'))) return { scopes: ['store:read'] };
  if (method === 'POST' && pathname === '/api/v1/actions/resolve') return { scopes: ['store:read'] };
  if (method === 'POST' && pathname === '/api/v1/downloads/authorize') return { scopes: ['store:download'] };
  if (method === 'POST' && pathname === '/api/v1/installs/report') return { scopes: ['store:install'] };
  if (method === 'POST' && pathname === '/api/v1/updates/check') return { scopes: ['store:updates'] };
  if (pathname.startsWith('/api/v1/jobs')) return { scopes: ['store:jobs'] };
  return { scopes: ['store:read'] };
}

export function createHttpHandler({
  service,
  authenticate,
  releaseRepository,
  releaseEnvelopeRepository,
  allowedOrigins = []
} = {}) {
  if (!service) throw new Error('store-service-required');
  if (typeof authenticate !== 'function') throw new Error('store-authenticator-required');
  if (!releaseRepository) throw new Error('release-repository-required');
  if (!releaseEnvelopeRepository) throw new Error('release-envelope-repository-required');
  const origins = new Set(allowedOrigins);

  return async function handler(request, response) {
    const requestId = requestIdFor(request);
    let acceptedOrigin = null;
    try {
      const url = new URL(request.url, 'https://api.store.aarulya.com');
      const pathname = url.pathname;
      const method = String(request.method || 'GET').toUpperCase();
      const origin = request.headers.origin ? String(request.headers.origin).replace(/\/$/, '') : null;

      if (origin) {
        if (!origins.has(origin)) {
          const error = new Error('origin-not-allowed');
          error.status = 403;
          throw error;
        }
        acceptedOrigin = origin;
      }

      if (method === 'OPTIONS') {
        if (!acceptedOrigin) {
          const error = new Error('cors-origin-required');
          error.status = 403;
          throw error;
        }
        response.writeHead(204, {
          ...securityHeaders(requestId),
          'access-control-allow-origin': acceptedOrigin,
          'access-control-allow-methods': ALLOWED_METHODS,
          'access-control-allow-headers': ALLOWED_HEADERS,
          'access-control-max-age': '600',
          vary: 'Origin'
        });
        response.end();
        return;
      }

      if (method === 'GET' && pathname === '/health') {
        return writeJson(response, 200, { status: 'ok', service: 'aarulya-store-api' }, requestId, acceptedOrigin);
      }

      const identity = await authenticate(request, requirementsFor(method, pathname));
      if (!identity?.actorId) {
        const error = new Error('authentication-required');
        error.status = 401;
        throw error;
      }
      const context = Object.freeze({
        actorId: identity.actorId,
        externalSubject: identity.externalSubject || null,
        sessionId: identity.sessionId,
        deviceId: identity.deviceId,
        authorizedOwner: identity.authorizedOwner === true,
        requestId
      });

      if (method === 'GET' && pathname === '/api/v1/catalog') {
        const result = await service.listCatalog({
          category: url.searchParams.get('category'),
          query: url.searchParams.get('q') || '',
          limit: url.searchParams.get('limit') || 50,
          offset: url.searchParams.get('offset') || 0
        });
        return writeJson(response, 200, result, requestId, acceptedOrigin);
      }

      const releaseParams = method === 'GET'
        ? routeMatch(pathname, '/api/v1/apps/:appId/releases/latest')
        : null;
      if (releaseParams) {
        const versionCode = url.searchParams.get('versionCode');
        const envelope = await releaseEnvelopeRepository.getLatestForApp(
          releaseParams.appId,
          versionCode == null ? null : Number(versionCode)
        );
        return writeJson(response, 200, envelope, requestId, acceptedOrigin);
      }

      const appParams = method === 'GET' ? routeMatch(pathname, '/api/v1/apps/:appId') : null;
      if (appParams) return writeJson(response, 200, await service.getApp(appParams.appId), requestId, acceptedOrigin);

      if (method === 'POST' && pathname === '/api/v1/actions/resolve') {
        const body = await readJson(request);
        return writeJson(response, 200, { actions: await service.resolveAction(body.query) }, requestId, acceptedOrigin);
      }

      if (method === 'POST' && pathname === '/api/v1/downloads/authorize') {
        const body = await readJson(request);
        const idempotencyKey = requireIdempotency(request);
        const release = await releaseRepository.getReleaseForDownload(body.appId, body.versionCode, context);
        const catalogManifest = await releaseRepository.getCurrentCatalogManifest(context);
        const result = await service.authorizeDownload(
          { ...context, idempotencyKey },
          {
            release,
            catalogManifest,
            packageKillSwitch: await releaseRepository.isPackageDownloadDisabled(release.packageId),
            globalKillSwitch: await releaseRepository.isGlobalDownloadDisabled()
          }
        );
        return writeJson(response, 201, result, requestId, acceptedOrigin);
      }

      if (method === 'POST' && pathname === '/api/v1/installs/report') {
        const body = await readJson(request);
        const idempotencyKey = requireIdempotency(request);
        const candidate = await releaseRepository.getReleaseByPackageAndVersion(body.packageId, body.versionCode, context);
        const catalogManifest = await releaseRepository.getCurrentCatalogManifest(context);
        const receipt = await service.reportInstall(context, {
          installed: body.installed || null,
          candidate,
          downloadedSha256: body.downloadedSha256,
          catalogManifest,
          deviceId: body.deviceId,
          idempotencyKey
        });
        return writeJson(response, 201, receipt, requestId, acceptedOrigin);
      }

      if (method === 'POST' && pathname === '/api/v1/updates/check') {
        const body = await readJson(request);
        return writeJson(response, 200, await service.checkUpdate(context, body), requestId, acceptedOrigin);
      }

      if (method === 'POST' && pathname === '/api/v1/jobs') {
        const body = await readJson(request);
        const idempotencyKey = requireIdempotency(request);
        return writeJson(response, 201, await service.createJob(context, { ...body, idempotencyKey }), requestId, acceptedOrigin);
      }

      const jobParams = method === 'GET' ? routeMatch(pathname, '/api/v1/jobs/:jobId') : null;
      if (jobParams) return writeJson(response, 200, await service.getJob(context, jobParams.jobId), requestId, acceptedOrigin);

      const transitionParams = method === 'POST' ? routeMatch(pathname, '/api/v1/jobs/:jobId/:action') : null;
      if (transitionParams && ['pause', 'resume', 'cancel'].includes(transitionParams.action)) {
        requireIdempotency(request);
        const target = transitionParams.action === 'pause' ? 'paused' : transitionParams.action === 'resume' ? 'queued' : 'cancelled';
        return writeJson(response, 200, await service.transitionJob(context, transitionParams.jobId, target, { source: 'user-api' }), requestId, acceptedOrigin);
      }

      return writeJson(response, 404, { error: 'route-not-found', requestId }, requestId, acceptedOrigin);
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      const code = status >= 500 ? 'internal-server-error' : String(error.code || error.message || 'request-failed');
      if (status >= 500) console.error({ requestId, error: error?.stack || String(error) });
      return writeJson(response, status, {
        error: code,
        requestId,
        ...(status < 500 && error.details ? { details: error.details } : {})
      }, requestId, acceptedOrigin);
    }
  };
}
