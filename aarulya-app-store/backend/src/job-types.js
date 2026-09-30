export const EXECUTABLE_JOB_TYPES = Object.freeze([
  'store-maintenance.expire-download-grants',
  'store-maintenance.expire-auth-revocations',
  'store-maintenance.prune-update-checks'
]);

const TYPES = new Set(EXECUTABLE_JOB_TYPES);

export function isExecutableJobType(value) {
  return TYPES.has(String(value || ''));
}
