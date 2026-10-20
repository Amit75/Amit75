import assert from 'node:assert/strict';
import test from 'node:test';
import { createBearerAuthenticator } from '../src/auth-adapter.js';

const NOW = 1_800_000_000_000;
const NOW_SECONDS = Math.floor(NOW / 1000);
const TOKEN = 't'.repeat(64);

function request() {
  return { headers: { authorization: `Bearer ${TOKEN}` } };
}

function claims(overrides = {}) {
  return {
    iss: 'https://identity.aarulya.com',
    aud: 'aarulya-store-api',
    sub: 'user-subject-0001',
    exp: NOW_SECONDS + 300,
    nbf: NOW_SECONDS - 30,
    iat: NOW_SECONDS - 30,
    auth_time: NOW_SECONDS - 45,
    jti: 'token-id-0001',
    sid: 'session-id-0001',
    scope: 'store:read store:download store:install store:updates store:jobs',
    roles: ['user'],
    amr: ['passkey'],
    ...overrides
  };
}

function authenticator(overrides = {}) {
  return createBearerAuthenticator({
    verifyAccessToken: async () => ({
      signatureValid: true,
      algorithmAllowed: true,
      claims: claims(overrides.claims)
    }),
    trustedIssuer: 'https://identity.aarulya.com',
    requiredAudience: 'aarulya-store-api',
    now: () => NOW,
    revokedTokenLookup: async () => overrides.revokedToken === true,
    revokedSessionLookup: async () => overrides.revokedSession === true
  });
}

test('accepts signed scoped token with session and passkey step-up', async () => {
  const identity = await authenticator()(request(), {
    scopes: ['store:download'],
    stepUp: true
  });
  assert.equal(identity.actorId, 'user-subject-0001');
  assert.equal(identity.sessionId, 'session-id-0001');
  assert.equal(identity.stepUpVerified, true);
  assert.equal(identity.issuedAt, NOW_SECONDS - 30);
  assert.equal(identity.expiresAt, NOW_SECONDS + 300);
});

test('rejects wrong issuer, missing scope and expired tokens', async () => {
  await assert.rejects(
    authenticator({ claims: { iss: 'https://attacker.example' } })(request()),
    (error) => error.code === 'token-issuer-invalid'
  );
  await assert.rejects(
    authenticator()(request(), { scopes: ['owner:release'] }),
    (error) => error.code === 'required-scope-missing'
  );
  await assert.rejects(
    authenticator({ claims: { exp: NOW_SECONDS - 120 } })(request()),
    (error) => error.code === 'token-expired'
  );
});

test('rejects future, inverted and overlong token lifetimes', async () => {
  await assert.rejects(
    authenticator({ claims: { iat: NOW_SECONDS + 120 } })(request()),
    (error) => error.code === 'token-issued-in-future'
  );
  await assert.rejects(
    authenticator({ claims: { iat: NOW_SECONDS, exp: NOW_SECONDS - 1 } })(request()),
    (error) => error.code === 'token-lifetime-invalid'
  );
  await assert.rejects(
    authenticator({ claims: { iat: NOW_SECONDS - 30, exp: NOW_SECONDS + 7200 } })(request()),
    (error) => error.code === 'token-lifetime-invalid'
  );
  await assert.rejects(
    authenticator({ claims: { auth_time: NOW_SECONDS + 120 } })(request()),
    (error) => error.code === 'authentication-time-invalid'
  );
});

test('rejects revoked token or session before API access', async () => {
  await assert.rejects(
    authenticator({ revokedToken: true })(request()),
    (error) => error.code === 'token-revoked'
  );
  await assert.rejects(
    authenticator({ revokedSession: true })(request()),
    (error) => error.code === 'session-revoked'
  );
});
