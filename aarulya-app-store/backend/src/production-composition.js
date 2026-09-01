import { createBearerAuthenticator } from './auth-adapter.js';
import { createOidcAccessTokenVerifier, oidcConfigurationFromEnvironment } from './oidc-verifier.js';
import { createPostgresPool, closePostgresPool } from './postgres.js';
import { readSecret } from './secrets.js';
import { PostgreSqlIdentityRepository } from './identity-repository.js';
import { IdempotentPostgreSqlStoreRepository } from './idempotent-store-repository.js';
import { PostgreSqlJobRepository } from './postgres-job-repository.js';
import { PostgreSqlReleaseEnvelopeRepository } from './release-envelope-repository.js';
import { PostgreSqlPublicationRepository } from './publication-repository.js';
import { createPublicationService } from './publication-service.js';
import { createPersistentStoreService } from './persistent-store-service.js';

export function createProductionComposition({ env = process.env, catalog } = {}) {
  if (env.NODE_ENV !== 'production') throw new Error('production-composition-requires-production-environment');
  const pool = createPostgresPool(env);
  const publisherDatabaseUrlFile = String(env.AARULYA_PUBLISHER_DATABASE_URL_FILE || '').trim();
  if (!publisherDatabaseUrlFile) throw new Error('publisher-database-url-file-required');
  const publisherPool = createPostgresPool({
    ...env,
    AARULYA_DATABASE_URL: '',
    AARULYA_DATABASE_URL_FILE: publisherDatabaseUrlFile,
    AARULYA_DATABASE_APP_NAME: 'aarulya-store-publisher',
    AARULYA_DATABASE_POOL_MAX: '2'
  });
  const downloadTokenHmacKey = readSecret({
    env,
    directName: 'AARULYA_DOWNLOAD_TOKEN_HMAC_KEY',
    fileName: 'AARULYA_DOWNLOAD_TOKEN_HMAC_KEY_FILE',
    minimumBytes: 32,
    maximumBytes: 256
  });

  const identityRepository = new PostgreSqlIdentityRepository(pool);
  const storeRepository = new IdempotentPostgreSqlStoreRepository(pool, {
    downloadOrigin: 'https://downloads.store.aarulya.com',
    downloadTokenHmacKey
  });
  const jobRepository = new PostgreSqlJobRepository(pool);
  const releaseEnvelopeRepository = new PostgreSqlReleaseEnvelopeRepository(pool);
  const publicationRepository = new PostgreSqlPublicationRepository(publisherPool);
  const publicationService = createPublicationService({ publicationRepository });
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
    publisherPool,
    identityRepository,
    storeRepository,
    jobRepository,
    releaseEnvelopeRepository,
    publicationRepository,
    publicationService,
    service,
    authenticate,
    async close() {
      await Promise.all([
        closePostgresPool(pool),
        closePostgresPool(publisherPool)
      ]);
    }
  });
}
