import { createRemoteJWKSet, jwtVerify } from 'jose';

const ALLOWED_ALGORITHMS = Object.freeze(['EdDSA', 'ES256', 'PS256', 'RS256']);

function required(name, value) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(`${name}-required`);
  return normalized;
}

function httpsUrl(name, value) {
  const parsed = new URL(required(name, value));
  if (parsed.protocol !== 'https:') throw new Error(`${name}-https-required`);
  return parsed;
}

export function createOidcAccessTokenVerifier({
  issuer,
  audience,
  jwksUri,
  algorithms = ALLOWED_ALGORITHMS,
  clockTolerance = 60
} = {}) {
  const trustedIssuer = required('oidc-issuer', issuer).replace(/\/$/, '');
  const requiredAudience = required('oidc-audience', audience);
  const trustedJwksUri = httpsUrl('oidc-jwks-uri', jwksUri);
  const allowed = [...new Set(algorithms)].filter((algorithm) => ALLOWED_ALGORITHMS.includes(algorithm));
  if (allowed.length === 0) throw new Error('oidc-allowed-algorithm-required');

  const keySet = createRemoteJWKSet(trustedJwksUri, {
    cooldownDuration: 30_000,
    cacheMaxAge: 10 * 60 * 1000,
    timeoutDuration: 5_000
  });

  return Object.freeze({
    trustedIssuer,
    requiredAudience,

    async verifyAccessToken(token) {
      const result = await jwtVerify(token, keySet, {
        issuer: trustedIssuer,
        audience: requiredAudience,
        algorithms: allowed,
        clockTolerance: Math.max(0, Math.min(Number(clockTolerance) || 0, 300)),
        requiredClaims: ['sub', 'exp', 'iat', 'jti', 'sid']
      });

      const algorithm = String(result.protectedHeader.alg || '');
      return Object.freeze({
        signatureValid: true,
        algorithmAllowed: allowed.includes(algorithm),
        algorithm,
        keyId: result.protectedHeader.kid ? String(result.protectedHeader.kid) : null,
        claims: Object.freeze({ ...result.payload })
      });
    }
  });
}

export function oidcConfigurationFromEnvironment(env = process.env) {
  return Object.freeze({
    issuer: required('AARULYA_OIDC_ISSUER', env.AARULYA_OIDC_ISSUER),
    audience: required('AARULYA_OIDC_AUDIENCE', env.AARULYA_OIDC_AUDIENCE),
    jwksUri: required('AARULYA_OIDC_JWKS_URI', env.AARULYA_OIDC_JWKS_URI),
    algorithms: String(env.AARULYA_OIDC_ALGORITHMS || 'EdDSA,ES256,PS256,RS256')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    clockTolerance: Number(env.AARULYA_OIDC_CLOCK_TOLERANCE_SECONDS || 60)
  });
}
