function forbidden(code) {
  const error = new Error(code);
  error.code = code;
  error.status = 403;
  return error;
}

function hasScope(identity, scope) {
  return Array.isArray(identity?.scopes) && identity.scopes.includes(scope);
}

export function createPublicationService({
  publicationRepository,
  now = () => Date.now(),
  maximumStepUpAgeSeconds = 300
} = {}) {
  if (!publicationRepository || typeof publicationRepository.publish !== 'function') {
    throw new Error('publication-repository-required');
  }
  const maxAge = Math.max(60, Math.min(Number(maximumStepUpAgeSeconds) || 300, 900));

  return Object.freeze({
    async publish(identity, input = {}) {
      if (!identity?.actorId || !identity.externalSubject) throw forbidden('authenticated-publication-identity-required');
      if (identity.authorizedOwner !== true || !Array.isArray(identity.roles) || !identity.roles.includes('owner')) {
        throw forbidden('owner-role-required');
      }
      if (identity.stepUpVerified !== true) throw forbidden('owner-step-up-authentication-required');
      if (!hasScope(identity, 'store:release:publish')) throw forbidden('release-publication-scope-required');
      if (!identity.sessionId || !identity.tokenId) throw forbidden('bound-owner-session-required');

      const nowSeconds = Math.floor(now() / 1000);
      const authenticationTime = Number(identity.authenticationTime);
      const issuedAt = Number(identity.issuedAt);
      const expiresAt = Number(identity.expiresAt);
      if (!Number.isFinite(authenticationTime)) throw forbidden('recent-owner-step-up-required');
      if (authenticationTime > nowSeconds || nowSeconds - authenticationTime > maxAge) {
        throw forbidden('recent-owner-step-up-required');
      }
      if (!Number.isFinite(issuedAt) || issuedAt > nowSeconds || issuedAt < authenticationTime) {
        throw forbidden('publication-token-binding-invalid');
      }
      if (!Number.isFinite(expiresAt) || expiresAt <= nowSeconds + 30) {
        throw forbidden('publication-token-expiring-too-soon');
      }

      return publicationRepository.publish({
        appId: input.appId,
        versionCode: input.versionCode,
        requestId: input.requestId,
        actorSubject: identity.externalSubject,
        reason: input.reason
      });
    }
  });
}
