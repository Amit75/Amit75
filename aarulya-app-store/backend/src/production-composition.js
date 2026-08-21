import { createBearerAuthenticator } from './auth-adapter.js';
import { createOidcAccessTokenVerifier, oidcConfigurationFromEnvironment } from './oidc-verifier.js';
import { createPostgresPool, closePostgresPool } from './postgres.js';
import { PostgreSqlIdentityRepository } from './identity-repository.js';
import { PostgreSqlStoreRepository } from './postgres-store-repository.js';
import { PostgreSqlJobRepository } from './postgres-job-repository.js';
import { PostgreSqlReleaseEnvelopeRepository } from './release-envelope-repository.js';
import { createPersistentStoreService } from './persistent-store-service.js';

export function createProductionComposition({ env = process.env, catalog } = {}) {
  if (env.NODE_ENV !== 'production') throw new Error('production-composition-requires-production-environment');
  const pool = createPostgresPool(env);
  const identityRepository = new PostgreSqlIdentityRepository(pool);
  const storeRepository = new PostgreSqlStoreRepository(pool, {
    downloadOrigin: 'https://downloads.store.aarulya.com'
  });
  const jobRepository = new PostgreSqlJobRepository(pool);
  const releaseEnvelopeRepository = new PostgreSqlReleaseEnvelopeRepository(pool);
  const oidc = createOidcAccessTokenVerifier(oidcConfigurationFromEnvironment(env));
  const bearer = createBearerAuthenticator({
    verifyAccessToken: oidc.verifyAccessToken,
    trustedIssuer: oidc.trustedIssuer,
    requiredAudience: oidc.requiredAudience,
    revokedTokenLookup: (tokenId) => storeRepository.isTokenRevoked(tokenId),
    revokedSessionLookup: (sessionId) => storeRepository.isSessionRevoked(sessionId)
  });

  const authenticate = async (request, requirements) => {
    const verified = await bearer(request, requirements);
    const internalUserId = await identityRepository.resolveUser(verified.actorId);
    return Object.freeze({
      ...verified,
      actorId: internalUserId,
      externalSubject: verified.actorId
    });
  };

  const service = createPersistentStoreService({
    catalog,
    storeRepository,
    jobRepository
  });

  return Object.freeze({
    pool,
    identityRepository,
    storeRepository,
    jobRepository,
    releaseEnvelopeRepository,
    service,
    authenticate,
    async close() {
      await closePostgresPool(pool);
    }
  });
}
