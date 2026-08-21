export const JOB_STATES = Object.freeze([
  'queued',
  'scheduled',
  'leased',
  'running',
  'waiting-user',
  'waiting-external',
  'paused',
  'retrying',
  'succeeded',
  'failed',
  'cancelled',
  'dead-lettered'
]);

const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'dead-lettered']);

export const JOB_TRANSITIONS = Object.freeze({
  queued: ['leased', 'paused', 'cancelled'],
  scheduled: ['queued', 'paused', 'cancelled'],
  leased: ['running', 'queued', 'cancelled'],
  running: ['succeeded', 'retrying', 'waiting-user', 'waiting-external', 'failed', 'cancelled'],
  'waiting-user': ['queued', 'paused', 'cancelled', 'failed'],
  'waiting-external': ['queued', 'retrying', 'cancelled', 'failed'],
  paused: ['queued', 'scheduled', 'cancelled'],
  retrying: ['queued', 'dead-lettered', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
  'dead-lettered': []
});

export const DURABLE_JOB_POLICY = Object.freeze({
  databaseIsSourceOfTruth: true,
  inMemoryOnlyJobsAllowed: false,
  idempotencyKeyRequired: true,
  immutableEventHistoryRequired: true,
  workerLeaseRequired: true,
  heartbeatRequired: true,
  boundedRetryRequired: true,
  exponentialBackoffRequired: true,
  deadLetterReviewRequired: true,
  userPauseCancelRequired: true,
  duplicateSideEffectsAllowed: false,
  humanApprovalForSensitiveActions: true,
  clientCalculatedFinalStateAllowed: false
});

export function validateJobDefinition(job = {}) {
  const errors = [];
  if (!job.id || String(job.id).length < 16) errors.push('job-id-required');
  if (!job.ownerId) errors.push('job-owner-required');
  if (!job.type) errors.push('job-type-required');
  if (!job.idempotencyKey || String(job.idempotencyKey).length < 16) errors.push('idempotency-key-required');
  if (!JOB_STATES.includes(job.state)) errors.push('invalid-job-state');
  if (!Number.isInteger(job.maxAttempts) || job.maxAttempts < 1 || job.maxAttempts > 20) errors.push('bounded-max-attempts-required');
  if (!job.createdAt || Number.isNaN(Date.parse(job.createdAt))) errors.push('created-at-required');
  if (job.sensitive === true && job.approvalPolicy !== 'explicit-user-or-authorized-owner') errors.push('sensitive-action-approval-required');
  if (job.payloadContainsSecrets === true) errors.push('raw-secret-payload-prohibited');
  if (job.unboundedExecution === true) errors.push('unbounded-execution-prohibited');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function canTransition(from, to) {
  return JOB_TRANSITIONS[from]?.includes(to) === true;
}

export function validateLease(lease = {}, now = Date.now()) {
  const errors = [];
  if (!lease.jobId) errors.push('lease-job-required');
  if (!lease.workerId) errors.push('lease-worker-required');
  if (!lease.token || String(lease.token).length < 24) errors.push('unguessable-lease-token-required');
  if (!lease.expiresAt || Number.isNaN(Date.parse(lease.expiresAt))) errors.push('lease-expiry-required');
  if (Number.isFinite(Date.parse(lease.expiresAt)) && Date.parse(lease.expiresAt) <= now) errors.push('lease-expired');
  if (lease.workerIdentityVerified !== true) errors.push('verified-worker-identity-required');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function shouldRetry({ attempt = 0, maxAttempts = 1, errorClass = 'unknown', cancelled = false } = {}) {
  if (cancelled || attempt >= maxAttempts) return false;
  return new Set(['timeout', 'rate-limit', 'temporary-network', 'dependency-unavailable']).has(errorClass);
}

export function terminalState(state) {
  return TERMINAL.has(state);
}
