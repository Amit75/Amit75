function forbidden(code) {
  const error = new Error(code);
  error.code = code;
  error.status = 403;
  return error;
}

function hasScope(identity, scope) {
  return Array.isArray(identity?.scopes) && identity.scopes.includes(scope);
}

export function createPublicationService({ publicationRepository } = {}) {
  if (!publicationRepository || typeof publicationRepository.publish !== 'function') {
    throw new Error('publication-repository-required');
  }

  return Object.freeze({
    async publish(identity, input = {}) {
      if (!identity?.actorId || !identity.externalSubject) throw forbidden('authenticated-publication-identity-required');
      if (identity.authorizedOwner !== true || !Array.isArray(identity.roles) || !identity.roles.includes('owner')) {
        throw forbidden('owner-role-required');
      }
      if (identity.stepUpVerified !== true) throw forbidden('owner-step-up-authentication-required');
      if (!hasScope(identity, 'store:release:publish')) throw forbidden('release-publication-scope-required');
      if (!identity.sessionId || !identity.tokenId) throw forbidden('bound-owner-session-required');

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
