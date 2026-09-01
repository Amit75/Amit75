const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const API_POLICY = Object.freeze({
  basePath: '/api/v1',
  httpsOnly: true,
  requestIdRequired: true,
  idempotencyRequiredForMutations: true,
  serviceAuthenticationRequired: true,
  userAuthorizationRequired: true,
  denyUnknownFieldsForSensitiveActions: true,
  schemaValidationRequired: true,
  auditSensitiveActions: true,
  exposeStackTraces: false,
  returnSecrets: false
});

export const API_RESOURCES = Object.freeze([
  { method: 'GET', path: '/catalog', auth: 'optional', purpose: 'Signed catalog metadata' },
  { method: 'GET', path: '/apps/:appId', auth: 'optional', purpose: 'App details and Trust Receipt' },
  { method: 'POST', path: '/downloads/authorize', auth: 'required', purpose: 'Short-lived verified APK download authorization', idempotent: true },
  { method: 'POST', path: '/installs/report', auth: 'required', purpose: 'Verified installation receipt', idempotent: true },
  { method: 'GET', path: '/updates', auth: 'required', purpose: 'Eligible signed updates for a device' },
  { method: 'POST', path: '/actions/resolve', auth: 'optional', purpose: 'Resolve user intent to a mini-tool or full app' },
  { method: 'POST', path: '/actions/run', auth: 'required', purpose: 'Start a sandboxed action run', idempotent: true },
  { method: 'GET', path: '/actions/runs/:runId', auth: 'required', purpose: 'Read action result and receipt' },
  { method: 'POST', path: '/jobs', auth: 'required', purpose: 'Create permanent, scheduled or background work', idempotent: true },
  { method: 'GET', path: '/jobs/:jobId', auth: 'required', purpose: 'Read durable job state' },
  { method: 'POST', path: '/jobs/:jobId/pause', auth: 'required', purpose: 'Pause future job execution', idempotent: true },
  { method: 'POST', path: '/jobs/:jobId/resume', auth: 'required', purpose: 'Resume paused work', idempotent: true },
  { method: 'POST', path: '/jobs/:jobId/cancel', auth: 'required', purpose: 'Cancel pending work', idempotent: true },
  { method: 'GET', path: '/me/apps', auth: 'required', purpose: 'Installed and owned Aarulya apps' },
  { method: 'GET', path: '/me/privacy', auth: 'required', purpose: 'Cross-app consent and data controls' },
  { method: 'POST', path: '/me/export', auth: 'required', purpose: 'Create a user data export job', idempotent: true },
  { method: 'POST', path: '/me/delete', auth: 'required-step-up', purpose: 'Start verified deletion workflow', idempotent: true }
]);

export function validateApiRequest(request = {}) {
  const errors = [];
  if (!METHODS.has(request.method)) errors.push('unsupported-http-method');
  if (!request.path || !request.path.startsWith(API_POLICY.basePath)) errors.push('versioned-api-path-required');
  if (!request.requestId || String(request.requestId).length < 16) errors.push('request-id-required');
  if (request.method !== 'GET' && !request.idempotencyKey) errors.push('idempotency-key-required');
  if (request.transportSecure !== true) errors.push('https-required');
  if (request.schemaValidation !== 'passed') errors.push('schema-validation-required');
  if (request.authorizationDecision !== 'allowed') errors.push('authorization-required');
  if (request.containsRawSecret === true) errors.push('raw-secret-in-request-prohibited');
  if (request.clientClaimsPrivilegedRole === true) errors.push('client-asserted-privilege-prohibited');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function safeErrorResponse(code, requestId) {
  return Object.freeze({
    error: String(code || 'request-failed'),
    requestId: String(requestId || ''),
    retryable: false
  });
}
