import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebAuthHandler, createWebSessionCodec } from '../src/web-session-auth.js';

const NOW = 1_800_000_000_000;
const SECRET = 's'.repeat(64);

function responseCapture() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(body = '') { this.body += body; }
  };
}

function request(url, { method = 'GET', cookie = '', origin = '' } = {}) {
  return { url, method, headers: { ...(cookie ? { cookie } : {}), ...(origin ? { origin } : {}) } };
}

function cookieValue(setCookie, name) {
  const values = Array.isArray(setCookie) ? setCookie : [setCookie];
  const match = values.find((value) => String(value).startsWith(name + '='));
  return String(match || '').split(';')[0];
}

function handler({ revoked = [] } = {}) {
  return createWebAuthHandler({
    env: {
      NODE_ENV: 'test',
      AARULYA_OIDC_ISSUER: 'https://identity.aarulya.com',
      AARULYA_WEB_OIDC_CLIENT_ID: 'aarulya-store-web',
      AARULYA_WEB_OIDC_REDIRECT_URI: 'https://store.aarulya.com/auth/callback',
      AARULYA_WEB_SESSION_KEY: SECRET
    },
    now: () => NOW,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ access_token: 'a'.repeat(64), token_type: 'Bearer', expires_in: 300 })
    }),
    authenticate: async () => ({
      actorId: '00000000-0000-4000-8000-000000000001',
      externalSubject: 'user-subject-0001',
      sessionId: 'session-id-0001',
      tokenId: 'token-id-0001',
      roles: ['user', 'developer'],
      scopes: ['store:read', 'store:download'],
      stepUpVerified: true,
      expiresAt: Math.floor(NOW / 1000) + 300
    }),
    storeRepository: {
      getAccountOverview: async (_userId, currentSessionId) => ({
        devices: [],
        sessions: [{ sessionId: currentSessionId, current: true }],
        installs: [],
        updates: []
      }),
      revokeOwnedSession: async ({ sessionId }) => ({ revoked: true, sessionId }),
      listDeveloperSubmissions: async () => [],
      createDeveloperSubmission: async () => ({
        id: '00000000-0000-4000-8000-000000000099',
        state: 'draft'
      }),
      submitDeveloperSubmission: async ({ submissionId }) => ({
        id: submissionId,
        state: 'submitted'
      })
    },
    revokeCurrentSession: async (identity) => { revoked.push(identity.sessionId); }
  });
}

test('web session codec is authenticated, bounded and rejects tampering', () => {
  const codec = createWebSessionCodec(SECRET, { now: () => NOW });
  const sealed = codec.seal({ purpose: 'web-session', accessToken: 'a'.repeat(64) }, 300);
  const opened = codec.open(sealed);
  assert.equal(opened.purpose, 'web-session');
  assert.equal(opened.expiresAt, Math.floor(NOW / 1000) + 300);
  const tampered = sealed.split('.');
  tampered[3] = (tampered[3].startsWith('A') ? 'B' : 'A') + tampered[3].slice(1);
  assert.throws(() => codec.open(tampered.join('.')), /web-session-envelope-invalid/);
});

test('web PKCE flow keeps verifier HttpOnly and never returns bearer token to browser JSON', async () => {
  const web = handler();
  const start = responseCapture();
  await web(request('/auth/start'), start);
  assert.equal(start.status, 302);
  assert.match(start.headers.location, /^https:\/\/identity\.aarulya\.com\/authorize\?/);
  assert.match(String(start.headers['set-cookie']), /__Host-aarulya_store_oauth=/);
  assert.match(String(start.headers['set-cookie']), /HttpOnly/);
  const oauthCookie = cookieValue(start.headers['set-cookie'], '__Host-aarulya_store_oauth');
  const state = new URL(start.headers.location).searchParams.get('state');

  const callback = responseCapture();
  await web(request('/auth/callback?code=' + 'c'.repeat(32) + '&state=' + encodeURIComponent(state), { cookie: oauthCookie }), callback);
  assert.equal(callback.status, 302);
  const sessionCookie = cookieValue(callback.headers['set-cookie'], '__Host-aarulya_store_session');
  assert.ok(sessionCookie);

  const status = responseCapture();
  await web(request('/auth/session', { cookie: sessionCookie }), status);
  assert.equal(status.status, 200);
  const json = JSON.parse(status.body);
  assert.equal(json.signedIn, true);
  assert.equal(json.account.developerAccess, true);
  assert.equal(JSON.stringify(json).includes('a'.repeat(64)), false);
});

test('same-origin logout revokes the verified current server session and clears cookies', async () => {
  const revoked = [];
  const web = handler({ revoked });
  const codec = createWebSessionCodec(SECRET, { now: () => NOW });
  const sealed = codec.seal({ purpose: 'web-session', accessToken: 'a'.repeat(64) }, 300);
  const logout = responseCapture();
  await web(request('/auth/logout', {
    method: 'POST',
    origin: 'https://store.aarulya.com',
    cookie: '__Host-aarulya_store_session=' + sealed
  }), logout);
  assert.equal(logout.status, 204);
  assert.deepEqual(revoked, ['session-id-0001']);
  assert.match(String(logout.headers['set-cookie']), /Max-Age=0/);
});


test('web account overview and developer portal require encrypted signed-in session', async () => {
  const web = handler();
  const codec = createWebSessionCodec(SECRET, { now: () => NOW });
  const sealed = codec.seal({ purpose: 'web-session', accessToken: 'a'.repeat(64) }, 300);
  const cookie = '__Host-aarulya_store_session=' + sealed;

  const account = responseCapture();
  await web(request('/auth/account/overview', { cookie }), account);
  assert.equal(account.status, 200);
  assert.equal(JSON.parse(account.body).sessions[0].current, true);

  const developer = responseCapture();
  await web(request('/auth/developer/submissions', { cookie }), developer);
  assert.equal(developer.status, 200);
  assert.deepEqual(JSON.parse(developer.body).submissions, []);
});
