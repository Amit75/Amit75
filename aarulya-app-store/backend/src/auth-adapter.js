const BEARER = /^Bearer\s+([^\s]+)$/i;

function unauthorized(code = 'authentication-required') {
  const error = new Error(code);
  error.code = code;
  error.status = 401;
  return error;
}

function forbidden(code = 'authorization-denied') {
  const error = new Error(code);
  error.code = code;
  error.status = 403;
  return error;
}

function stringArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string') return value.split(/\s+/).filter(Boolean);
  return [];
}

function audienceMatches(actual, expected) {
  if (!expected) return true;
  const values = Array.isArray(actual) ? actual : [actual];
  return values.includes(expected);
}

function hasStepUp(claims = {}) {
  const amr = stringArray(claims.amr).map((value) => value.toLowerCase());
  const acr = String(claims.acr || '').toLowerCase();
  return amr.some((value) => ['mfa', 'otp', 'hwk', 'swk', 'passkey', 'webauthn'].includes(value))
    || ['aal2', 'aal3', 'urn:aarulya:aal2', 'urn:aarulya:aal3'].includes(acr);
}

export function parseBearerToken(headers = {}) {
  const raw = headers.authorization || headers.Authorization || '';
  const match = BEARER.exec(String(raw));
  if (!match || match[1].length < 32 || match[1].length > 8192) throw unauthorized('valid-bearer-token-required');
  return match[1];
}

export function createBearerAuthenticator({
  verifyAccessToken,
  trustedIssuer,
  requiredAudience,
  now = () => Date.now(),
  clockSkewSeconds = 60,
  maximumTokenLifetimeSeconds = 3600,
  revokedSessionLookup = async () => false,
  revokedTokenLookup = async () => false
} = {}) {
  if (typeof verifyAccessToken !== 'function') throw new TypeError('verifyAccessToken function is required');
  if (!trustedIssuer || !requiredAudience) throw new TypeError('trustedIssuer and requiredAudience are required');

  return async function authenticate(request, requirements = {}) {
    const token = parseBearerToken(request.headers || {});
    const verification = await verifyAccessToken(token);
    if (!verification || verification.signatureValid !== true) throw unauthorized('token-signature-invalid');
    if (verification.algorithmAllowed !== true) throw unauthorized('token-algorithm-not-allowed');

    const claims = verification.claims || {};
    const nowSeconds = Math.floor(now() / 1000);
    const skew = Math.max(0, Math.min(Number(clockSkewSeconds) || 0, 300));
    const maximumLifetime = Math.max(300, Math.min(Number(maximumTokenLifetimeSeconds) || 3600, 86_400));
    const issuedAt = Number(claims.iat);
    const expiresAt = Number(claims.exp);
    const authenticationTime = Number(claims.auth_time);

    if (claims.iss !== trustedIssuer) throw unauthorized('token-issuer-invalid');
    if (!audienceMatches(claims.aud, requiredAudience)) throw unauthorized('token-audience-invalid');
    if (!claims.sub || String(claims.sub).length < 8) throw unauthorized('token-subject-required');
    if (!Number.isFinite(issuedAt)) throw unauthorized('token-issued-at-required');
    if (issuedAt > nowSeconds + skew) throw unauthorized('token-issued-in-future');
    if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds - skew) throw unauthorized('token-expired');
    if (expiresAt <= issuedAt || expiresAt - issuedAt > maximumLifetime) throw unauthorized('token-lifetime-invalid');
    if (Number.isFinite(Number(claims.nbf)) && Number(claims.nbf) > nowSeconds + skew) throw unauthorized('token-not-yet-valid');
    if (Number.isFinite(authenticationTime) && authenticationTime > nowSeconds + skew) {
      throw unauthorized('authentication-time-invalid');
    }
    if (!claims.jti || String(claims.jti).length < 8) throw unauthorized('token-id-required');
    if (!claims.sid || String(claims.sid).length < 8) throw unauthorized('session-id-required');
    if (await revokedTokenLookup(String(claims.jti))) throw unauthorized('token-revoked');
    if (await revokedSessionLookup(String(claims.sid))) throw unauthorized('session-revoked');

    const scopes = new Set(stringArray(claims.scope || claims.scp));
    const requiredScopes = stringArray(requirements.scopes);
    const missingScopes = requiredScopes.filter((scope) => !scopes.has(scope));
    if (missingScopes.length) throw forbidden('required-scope-missing');
    if (requirements.stepUp === true && !hasStepUp(claims)) throw forbidden('step-up-authentication-required');

    return Object.freeze({
      actorId: String(claims.sub),
      sessionId: String(claims.sid),
      tokenId: String(claims.jti),
      deviceId: claims.device_id ? String(claims.device_id) : null,
      roles: Object.freeze(stringArray(claims.roles)),
      scopes: Object.freeze([...scopes]),
      stepUpVerified: hasStepUp(claims),
      authorizedOwner: stringArray(claims.roles).includes('owner'),
      issuedAt,
      expiresAt,
      authenticationTime: Number.isFinite(authenticationTime) ? authenticationTime : null
    });
  };
}

export function requireRole(identity, role) {
  if (!identity || !Array.isArray(identity.roles) || !identity.roles.includes(role)) {
    throw forbidden('required-role-missing');
  }
  return true;
}
