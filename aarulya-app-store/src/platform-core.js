export const AARULYA_PLATFORM = Object.freeze({
  name: 'Aarulya Store Platform',
  publisher: 'Aarulya',
  mode: 'first-party-sovereign',
  catalogOnly: false,
  installationSupported: true,
  updateManagementSupported: true,
  permanentTaskExecutionSupported: true,
  ownApiRequired: true,
  ownDatabaseRequired: true,
  failClosed: true
});

export const PLATFORM_SERVICES = Object.freeze({
  identity: Object.freeze({
    purpose: 'Accounts, devices, sessions, passkeys, parental and owner roles',
    owns: ['users', 'devices', 'sessions', 'consents', 'role_bindings'],
    requiredControls: ['mfa-for-sensitive-roles', 'session-revocation', 'device-binding', 'risk-based-step-up']
  }),
  catalog: Object.freeze({
    purpose: 'Apps, versions, categories, screenshots, Trust Receipts and discovery metadata',
    owns: ['apps', 'app_versions', 'release_manifests', 'store_listings', 'trust_receipts'],
    requiredControls: ['signed-catalog', 'immutable-version-records', 'publisher-verification']
  }),
  distribution: Object.freeze({
    purpose: 'Signed download links, resumable APK delivery, hash checks, staged updates and rollback',
    owns: ['download_tokens', 'download_events', 'rollouts', 'revocations', 'safe_versions'],
    requiredControls: ['short-lived-download-url', 'apk-hash-verification', 'signer-continuity', 'anti-rollback']
  }),
  actions: Object.freeze({
    purpose: 'Intent routing, instant tools, full-app workflows and reusable capabilities',
    owns: ['capabilities', 'action_routes', 'action_runs', 'action_receipts'],
    requiredControls: ['explicit-user-intent', 'sandbox-boundary', 'least-privilege-capability', 'auditable-result']
  }),
  jobs: Object.freeze({
    purpose: 'Permanent and scheduled work with durable retries, worker leases and idempotency',
    owns: ['jobs', 'job_attempts', 'worker_leases', 'job_events', 'dead_letters'],
    requiredControls: ['idempotency-key', 'lease-expiry', 'bounded-retry', 'dead-letter-review', 'cancel-and-pause']
  }),
  files: Object.freeze({
    purpose: 'User files, generated outputs, encrypted storage and retention lifecycle',
    owns: ['objects', 'object_versions', 'retention_rules', 'deletion_receipts'],
    requiredControls: ['encryption-at-rest', 'per-user-access-control', 'malware-scan', 'secure-delete-workflow']
  }),
  notifications: Object.freeze({
    purpose: 'Download, update, task, security and account notifications',
    owns: ['notification_preferences', 'notification_events', 'delivery_receipts'],
    requiredControls: ['consent', 'rate-limits', 'security-message-integrity', 'quiet-hours']
  }),
  security: Object.freeze({
    purpose: 'Risk engine, abuse detection, transparency, revocation and incident controls',
    owns: ['risk_signals', 'security_events', 'transparency_entries', 'incident_actions'],
    requiredControls: ['append-only-audit', 'kill-switch', 'tamper-alerting', 'separation-of-duties']
  }),
  analytics: Object.freeze({
    purpose: 'Privacy-preserving product quality, reliability and fair Top Charts',
    owns: ['aggregated_metrics', 'quality_metrics', 'ranking_inputs'],
    requiredControls: ['data-minimization', 'no-secret-logging', 'fraud-filtering', 'retention-limits']
  })
});

export const SERVICE_BOUNDARY_RULES = Object.freeze({
  sharedDatabaseWithoutOwnership: false,
  directCrossServiceTableWrites: false,
  serviceToServiceAuthenticationRequired: true,
  leastPrivilegeDatabaseRolesRequired: true,
  immutableSecurityAuditRequired: true,
  userDataExportAndDeletionRequired: true,
  hiddenGlobalAdminCredentialAllowed: false,
  clientAuthoritativeSecurityDecisionAllowed: false
});

export function validatePlatformComponent(component = {}) {
  const errors = [];
  if (!component.id || !PLATFORM_SERVICES[component.id]) errors.push('unknown-platform-service');
  if (!component.apiVersion) errors.push('api-version-required');
  if (!component.databaseRole) errors.push('least-privilege-database-role-required');
  if (component.directCrossServiceTableWrites === true) errors.push('cross-service-table-write-prohibited');
  if (component.acceptsUnauthenticatedInternalTraffic === true) errors.push('unauthenticated-internal-traffic-prohibited');
  if (component.containsMasterCredential === true) errors.push('master-credential-prohibited');
  if (component.failOpenOnSecurityError === true) errors.push('fail-open-prohibited');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
