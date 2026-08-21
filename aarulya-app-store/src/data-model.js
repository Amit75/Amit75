export const DATABASE_POLICY = Object.freeze({
  engineTarget: 'PostgreSQL',
  sourceOfTruth: 'Aarulya-owned database',
  encryptionAtRestRequired: true,
  encryptedBackupsRequired: true,
  pointInTimeRecoveryRequired: true,
  rowLevelAuthorizationRequired: true,
  leastPrivilegeRolesRequired: true,
  immutableAuditTrailRequired: true,
  productionDataInDevelopmentAllowed: false,
  sharedMasterDatabaseCredentialAllowed: false,
  hardDeleteWithoutReceiptAllowed: false
});

export const DATA_DOMAINS = Object.freeze({
  identity: ['users', 'user_profiles', 'devices', 'sessions', 'passkeys', 'consents', 'role_bindings'],
  store: ['apps', 'app_versions', 'store_listings', 'screenshots', 'release_manifests', 'trust_receipts'],
  distribution: ['download_tokens', 'download_receipts', 'install_receipts', 'rollouts', 'revocations', 'safe_versions'],
  actions: ['capabilities', 'action_routes', 'action_runs', 'action_inputs', 'action_outputs', 'action_receipts'],
  jobs: ['jobs', 'job_attempts', 'worker_leases', 'job_events', 'dead_letters'],
  files: ['objects', 'object_versions', 'object_grants', 'retention_rules', 'deletion_receipts'],
  privacy: ['data_inventory', 'consent_history', 'export_requests', 'deletion_requests', 'retention_exceptions'],
  security: ['risk_signals', 'security_events', 'revoked_credentials', 'incident_actions', 'transparency_entries'],
  discovery: ['verified_metrics', 'quality_metrics', 'ranking_snapshots', 'sponsored_placements', 'fraud_exclusions']
});

export const DATA_CLASSIFICATION = Object.freeze({
  public: Object.freeze({ encryption: 'transport', logging: 'allowed-with-integrity' }),
  internal: Object.freeze({ encryption: 'transport-and-rest', logging: 'minimized' }),
  personal: Object.freeze({ encryption: 'transport-and-rest', logging: 'redacted', access: 'owner-and-purpose-bound' }),
  sensitive: Object.freeze({ encryption: 'field-level-or-equivalent', logging: 'prohibited', access: 'step-up-and-audited' }),
  secret: Object.freeze({ storage: 'dedicated-secret-manager-or-hardware', database: 'prohibited', logging: 'prohibited' })
});

export const RETENTION_RULES = Object.freeze({
  downloadTokens: 'minutes',
  activeSessions: 'until-expiry-or-revocation',
  jobEventHistory: 'policy-bound-auditable',
  securityAudit: 'long-lived-tamper-evident',
  temporaryToolInputs: 'delete-after-result-or-short-expiry',
  generatedFiles: 'user-controlled-with-expiry-option',
  childData: 'minimum-required-shortest-practical',
  deletedAccountData: 'erase-or-irreversibly-anonymize-after-legal-hold-check'
});

export function validateDataAccess(access = {}) {
  const errors = [];
  if (!access.actorId) errors.push('actor-required');
  if (!access.purpose) errors.push('purpose-required');
  if (!access.domain || !DATA_DOMAINS[access.domain]) errors.push('known-data-domain-required');
  if (!access.resourceOwnerId) errors.push('resource-owner-required');
  if (access.authorizationDecision !== 'allowed') errors.push('authorization-required');
  if (access.leastPrivilegeRole !== true) errors.push('least-privilege-role-required');
  if (access.crossUserAccess === true && access.stepUpVerified !== true) errors.push('cross-user-step-up-required');
  if (access.secretReadFromDatabase === true) errors.push('database-secret-storage-prohibited');
  if (access.auditRecorded !== true) errors.push('audit-record-required');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateDeletionReceipt(receipt = {}) {
  const errors = [];
  if (!receipt.requestId) errors.push('deletion-request-id-required');
  if (!receipt.subjectId) errors.push('deletion-subject-required');
  if (!receipt.completedAt || Number.isNaN(Date.parse(receipt.completedAt))) errors.push('completion-time-required');
  if (!Array.isArray(receipt.deletedDomains) || receipt.deletedDomains.length === 0) errors.push('deleted-domains-required');
  if (receipt.backupExpiryConfirmed !== true) errors.push('backup-expiry-confirmation-required');
  if (receipt.legalHoldChecked !== true) errors.push('legal-hold-check-required');
  if (!receipt.receiptSignature || String(receipt.receiptSignature).length < 64) errors.push('signed-deletion-receipt-required');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
