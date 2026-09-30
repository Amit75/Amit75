import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readSecret } from './secrets.js';

const STORE_ORIGIN = 'https://store.aarulya.com';
const IDENTITY_ORIGIN = 'https://identity.aarulya.com';
const SESSION_COOKIE = '__Host-aarulya_store_session';
const OAUTH_COOKIE = '__Host-aarulya_store_oauth';
const AAD = Buffer.from('aarulya-store-web-session-v1', 'utf8');
const AUTH_TTL_SECONDS = 600;
const MAX_SESSION_SECONDS = 3600;
const WEB_SCOPES = Object.freeze(['store:read','store:download','store:install','store:updates','store:jobs']);

function webError(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function securityHeaders() {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer'
  };
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), part.slice(index + 1)];
  }));
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAge))}; Secure; HttpOnly; SameSite=Lax`;
}

function clearCookie(name) {
  return cookie(name, '', 0);
}

function writeJson(response, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    ...securityHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    ...extraHeaders
  });
  response.end(body);
}

function redirect(response, location, setCookies = []) {
  response.writeHead(302, {
    ...securityHeaders(),
    location,
    ...(setCookies.length ? { 'set-cookie': setCookies } : {})
  });
  response.end();
}

function equalSecret(left, right) {
  const a = Buffer.from(String(left), 'utf8');
  const b = Buffer.from(String(right), 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

function keyFromSecret(secret) {
  const material = Buffer.from(String(secret || ''), 'utf8');
  if (material.length < 32 || material.length > 256) throw new Error('web-session-key-32-to-256-bytes-required');
  return createHash('sha256').update(material).digest();
}

export function createWebSessionCodec(secret, { now = () => Date.now() } = {}) {
  const key = keyFromSecret(secret);
  return Object.freeze({
    seal(payload, lifetimeSeconds) {
      const lifetime = Math.max(60, Math.min(Number(lifetimeSeconds) || 0, MAX_SESSION_SECONDS));
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(AAD);
      const plaintext = Buffer.from(JSON.stringify({
        ...payload,
        issuedAt: Math.floor(now() / 1000),
        expiresAt: Math.floor(now() / 1000) + lifetime
      }), 'utf8');
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
    },
    open(value) {
      const parts = String(value || '').split('.');
      if (parts.length !== 4 || parts[0] !== 'v1') throw webError('web-session-envelope-invalid', 401);
      try {
        const iv = Buffer.from(parts[1], 'base64url');
        const tag = Buffer.from(parts[2], 'base64url');
        const encrypted = Buffer.from(parts[3], 'base64url');
        if (iv.length !== 12 || tag.length !== 16 || encrypted.length > 16 * 1024) throw new Error();
        const decipher = createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(AAD);
        decipher.setAuthTag(tag);
        const parsed = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8'));
        const nowSeconds = Math.floor(now() / 1000);
        if (!Number.isFinite(parsed.expiresAt) || parsed.expiresAt <= nowSeconds) throw webError('web-session-expired', 401);
        return Object.freeze(parsed);
      } catch (error) {
        if (error?.code) throw error;
        throw webError('web-session-envelope-invalid', 401);
      }
    }
  });
}

function configFromEnvironment(env) {
  const identity = new URL(String(env.AARULYA_OIDC_ISSUER || ''));
  if (identity.origin !== IDENTITY_ORIGIN || identity.pathname !== '/') throw new Error('canonical-web-identity-origin-required');
  const clientId = String(env.AARULYA_WEB_OIDC_CLIENT_ID || '').trim();
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(clientId)) throw new Error('valid-web-oidc-client-id-required');
  const redirectUri = String(env.AARULYA_WEB_OIDC_REDIRECT_URI || '').trim();
  if (redirectUri !== `${STORE_ORIGIN}/auth/callback`) throw new Error('canonical-web-oidc-redirect-required');
  return Object.freeze({ identityOrigin: identity.origin, clientId, redirectUri });
}

async function exchangeCode({ fetchImpl, config, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code,
    code_verifier: verifier
  });
  const response = await fetchImpl(`${config.identityOrigin}/token`, {
    method: 'POST',
    redirect: 'manual',
    cache: 'no-store',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body
  });
  if (response.status >= 300 && response.status < 400) throw webError('identity-redirect-prohibited', 502);
  const contentType = String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  const raw = await response.text();
  if (raw.length > 256 * 1024) throw webError('identity-response-too-large', 502);
  if (!response.ok || contentType !== 'application/json') throw webError('identity-token-exchange-failed', 401);
  let json;
  try { json = JSON.parse(raw); } catch { throw webError('identity-invalid-json-response', 502); }
  const accessToken = String(json.access_token || '');
  const expiresIn = Number(json.expires_in);
  if (!json.token_type || !String(json.token_type).toLowerCase().startsWith('bearer')) throw webError('bearer-token-required', 401);
  if (accessToken.length < 32 || accessToken.length > 3072) throw webError('web-access-token-size-invalid', 401);
  if (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > MAX_SESSION_SECONDS) throw webError('web-token-expiry-invalid', 401);
  return Object.freeze({ accessToken, expiresIn });
}

export function createWebAuthHandler({
  authenticate,
  revokeCurrentSession,
  storeRepository,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => Date.now()
} = {}) {
  if (typeof authenticate !== 'function') throw new Error('web-auth-authenticator-required');
  if (typeof revokeCurrentSession !== 'function') throw new Error('web-auth-session-revoker-required');
  if (!storeRepository) throw new Error('web-auth-store-repository-required');
  if (typeof fetchImpl !== 'function') throw new Error('web-auth-fetch-required');
  const config = configFromEnvironment(env);
  const secret = readSecret({
    env,
    directName: 'AARULYA_WEB_SESSION_KEY',
    fileName: 'AARULYA_WEB_SESSION_KEY_FILE',
    minimumBytes: 32,
    maximumBytes: 256
  });
  const codec = createWebSessionCodec(secret, { now });

  async function readJsonBody(request) {
    const contentType = String(request.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (contentType !== 'application/json') throw webError('application-json-required', 415);
    const chunks = [];
    let total = 0;
    for await (const chunk of request) {
      total += chunk.length;
      if (total > 64 * 1024) throw webError('request-body-too-large', 413);
      chunks.push(chunk);
    }
    if (!chunks.length) return {};
    try {
      const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      throw webError('invalid-json-object', 400);
    }
  }

  function requireSameOriginMutation(request) {
    const origin = String(request.headers?.origin || '').replace(/\/$/, '');
    if (origin !== STORE_ORIGIN) throw webError('same-origin-mutation-required', 403);
  }

  function requireDeveloper(identity) {
    if (!(identity.roles || []).some((role) => ['owner','developer','publisher'].includes(role))) {
      throw webError('developer-role-required', 403);
    }
  }

  async function verifiedIdentity(session) {
    if (!session?.accessToken) throw webError('web-session-required', 401);
    return authenticate({ headers: { authorization: `Bearer ${session.accessToken}` } }, { scopes: ['store:read'] });
  }

  return async function webAuthHandler(request, response) {
    try {
      const url = new URL(request.url, STORE_ORIGIN);
      const method = String(request.method || 'GET').toUpperCase();
      const cookies = parseCookies(request.headers?.cookie || '');

      if (method === 'GET' && url.pathname === '/auth/start') {
        const state = randomBytes(32).toString('base64url');
        const verifier = randomBytes(64).toString('base64url');
        const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url');
        const transaction = codec.seal({ state, verifier, purpose: 'oidc-pkce' }, AUTH_TTL_SECONDS);
        const authorize = new URL('/authorize', config.identityOrigin);
        authorize.searchParams.set('client_id', config.clientId);
        authorize.searchParams.set('redirect_uri', config.redirectUri);
        authorize.searchParams.set('response_type', 'code');
        authorize.searchParams.set('scope', WEB_SCOPES.join(' '));
        authorize.searchParams.set('state', state);
        authorize.searchParams.set('code_challenge', challenge);
        authorize.searchParams.set('code_challenge_method', 'S256');
        return redirect(response, authorize.toString(), [cookie(OAUTH_COOKIE, transaction, AUTH_TTL_SECONDS)]);
      }

      if (method === 'GET' && url.pathname === '/auth/callback') {
        if (url.searchParams.has('error')) throw webError('identity-provider-error', 401);
        const code = String(url.searchParams.get('code') || '');
        const state = String(url.searchParams.get('state') || '');
        if (code.length < 16 || code.length > 4096 || state.length < 32 || state.length > 256) throw webError('invalid-oidc-callback', 400);
        const transaction = codec.open(cookies[OAUTH_COOKIE]);
        if (transaction.purpose !== 'oidc-pkce' || !equalSecret(transaction.state, state)) throw webError('oidc-state-invalid', 401);
        if (typeof transaction.verifier !== 'string' || transaction.verifier.length < 43 || transaction.verifier.length > 128) {
          throw webError('oidc-verifier-invalid', 401);
        }
        const token = await exchangeCode({ fetchImpl, config, code, verifier: transaction.verifier });
        const identity = await verifiedIdentity(token);
        const bounded = Math.min(token.expiresIn, Math.max(60, Number(identity.expiresAt) - Math.floor(now() / 1000)));
        const session = codec.seal({ accessToken: token.accessToken, purpose: 'web-session' }, bounded);
        return redirect(response, STORE_ORIGIN + '/?signed-in=1', [
          clearCookie(OAUTH_COOKIE),
          cookie(SESSION_COOKIE, session, bounded)
        ]);
      }

      if (method === 'GET' && url.pathname === '/auth/session') {
        if (!cookies[SESSION_COOKIE]) return writeJson(response, 200, { signedIn: false });
        let session;
        try { session = codec.open(cookies[SESSION_COOKIE]); } catch {
          return writeJson(response, 200, { signedIn: false }, { 'set-cookie': clearCookie(SESSION_COOKIE) });
        }
        if (session.purpose !== 'web-session') throw webError('web-session-purpose-invalid', 401);
        const identity = await verifiedIdentity(session);
        const roles = [...(identity.roles || [])];
        const scopes = [...(identity.scopes || [])];
        return writeJson(response, 200, {
          signedIn: true,
          account: {
            roles,
            scopes,
            ownerAccess: roles.includes('owner'),
            developerAccess: roles.some((role) => ['owner','developer','publisher'].includes(role)),
            stepUpVerified: identity.stepUpVerified === true,
            expiresAt: identity.expiresAt
          }
        });
      }

      if (method === 'GET' && url.pathname === '/auth/account/overview') {
        const session = codec.open(cookies[SESSION_COOKIE]);
        const identity = await verifiedIdentity(session);
        return writeJson(response, 200,
          await storeRepository.getAccountOverview(identity.actorId, identity.sessionId));
      }

      const revokeOwnedMatch = method === 'POST'
        ? url.pathname.match(/^\/auth\/account\/sessions\/([^/]+)\/revoke$/)
        : null;
      if (revokeOwnedMatch) {
        requireSameOriginMutation(request);
        const session = codec.open(cookies[SESSION_COOKIE]);
        const identity = await verifiedIdentity(session);
        return writeJson(response, 200, await storeRepository.revokeOwnedSession({
          userId: identity.actorId,
          sessionId: decodeURIComponent(revokeOwnedMatch[1])
        }));
      }

      if (method === 'GET' && url.pathname === '/auth/developer/submissions') {
        const session = codec.open(cookies[SESSION_COOKIE]);
        const identity = await verifiedIdentity(session);
        requireDeveloper(identity);
        return writeJson(response, 200, {
          submissions: await storeRepository.listDeveloperSubmissions(identity.actorId)
        });
      }

      if (method === 'POST' && url.pathname === '/auth/developer/submissions') {
        requireSameOriginMutation(request);
        const session = codec.open(cookies[SESSION_COOKIE]);
        const identity = await verifiedIdentity(session);
        requireDeveloper(identity);
        const body = await readJsonBody(request);
        return writeJson(response, 201, await storeRepository.createDeveloperSubmission({
          userId: identity.actorId,
          appName: body.appName,
          packageId: body.packageId,
          category: body.category,
          privacyPolicyUrl: body.privacyPolicyUrl,
          ownershipEvidenceUrl: body.ownershipEvidenceUrl
        }));
      }

      const submitMatch = method === 'POST'
        ? url.pathname.match(/^\/auth\/developer\/submissions\/([0-9a-f-]{36})\/submit$/i)
        : null;
      if (submitMatch) {
        requireSameOriginMutation(request);
        const session = codec.open(cookies[SESSION_COOKIE]);
        const identity = await verifiedIdentity(session);
        requireDeveloper(identity);
        return writeJson(response, 200, await storeRepository.submitDeveloperSubmission({
          userId: identity.actorId,
          submissionId: submitMatch[1]
        }));
      }

      if (method === 'POST' && url.pathname === '/auth/logout') {
        requireSameOriginMutation(request);
        if (cookies[SESSION_COOKIE]) {
          try {
            const session = codec.open(cookies[SESSION_COOKIE]);
            const identity = await verifiedIdentity(session);
            await revokeCurrentSession(identity);
          } catch (error) {
            if (error?.status && error.status < 500 && error.code !== 'web-session-expired') throw error;
          }
        }
        response.writeHead(204, { ...securityHeaders(), 'set-cookie': [clearCookie(SESSION_COOKIE), clearCookie(OAUTH_COOKIE)] });
        response.end();
        return;
      }

      return writeJson(response, 404, { error: 'auth-route-not-found' });
    } catch (error) {
      const status = Number.isInteger(error.status) ? error.status : 500;
      const code = status >= 500 ? 'internal-server-error' : String(error.code || error.message || 'auth-request-failed');
      return writeJson(response, status, { error: code });
    }
  };
}
