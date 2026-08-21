const PASSED = 'passed';

export const SECURITY_PROFILES = Object.freeze({
  baseline: Object.freeze({
    label: 'Aarulya secure baseline',
    requiredEvidence: Object.freeze([
      'threatModel',
      'permissionReview',
      'privacyDataMap',
      'secretScan',
      'dependencyScan',
      'staticAnalysis',
      'sbomGenerated',
      'releaseBuildHardened',
      'cleartextTrafficDisabled',
      'certificateValidationReview',
      'secureLoggingReview',
      'backupAndExportReview',
      'incidentResponseOwner'
    ])
  }),
  'offline-low': Object.freeze({
    label: 'Offline utility',
    requiredEvidence: Object.freeze([
      'networkNotRequiredOrJustified',
      'localDataMinimized',
      'sensitiveLocalDataEncrypted',
      'temporaryDataCleanup',
      'dangerousPermissionsAbsentOrJustified'
    ])
  }),
  'content-medium': Object.freeze({
    label: 'Documents and media',
    requiredEvidence: Object.freeze([
      'contentUriHandlingReview',
      'mimeAndFileValidation',
      'malformedFileResilience',
      'temporaryDataCleanup',
      'metadataExposureReview',
      'exportDestinationConfirmation'
    ])
  }),
  'account-medium': Object.freeze({
    label: 'Account and cloud service',
    requiredEvidence: Object.freeze([
      'secureTokenStorage',
      'sessionRevocation',
      'rateLimitReview',
      'serverAuthorizationReview',
      'accountRecoveryReview',
      'auditTrailReview'
    ])
  }),
  'child-high': Object.freeze({
    label: 'Child and family safety',
    requiredEvidence: Object.freeze([
      'noPersonalizedAdsForChildren',
      'noOpenStrangerChat',
      'noPreciseLocationForChildren',
      'parentalGateReview',
      'childDataMinimization',
      'ageAppropriateContentReview',
      'childDeletionWorkflow'
    ])
  }),
  'finance-critical': Object.freeze({
    label: 'Finance and payment critical',
    requiredEvidence: Object.freeze([
      'strongAuthentication',
      'stepUpForSensitiveActions',
      'serverSideTransactionAuthorization',
      'noRawPaymentCredentialStorage',
      'immutableAuditTrail',
      'fraudAndAbuseControls',
      'reconciliationControls',
      'securityIncidentKillSwitch'
    ])
  }),
  'security-critical': Object.freeze({
    label: 'Browser and safety critical',
    requiredEvidence: Object.freeze([
      'untrustedInputIsolation',
      'strictUrlCanonicalization',
      'safeExternalIntentHandling',
      'certificateErrorNoBypass',
      'securityRuleUpdateSigning',
      'falsePositiveAppealWorkflow'
    ])
  }),
  'store-critical': Object.freeze({
    label: 'App store and installer critical',
    requiredEvidence: Object.freeze([
      'signedCatalogManifest',
      'signedReleaseManifest',
      'apkHashVerifiedBeforeInstall',
      'signerContinuityVerified',
      'antiRollbackEnforced',
      'revocationListSupported',
      'stagedRolloutSupported',
      'remoteDownloadKillSwitch',
      'securityTransparencyRecord'
    ])
  })
});

const OFFLINE_CATEGORIES = new Set(['Daily Tools', 'Language']);
const CONTENT_CATEGORIES = new Set(['Documents', 'Photo & Video', 'Books & Learning', 'Entertainment']);
const ACCOUNT_CATEGORIES = new Set(['AI & Productivity', 'Business', 'Cloud & Files', 'Internet']);
const CHILD_CATEGORIES = new Set(['Kids & Family', 'Education', 'Games']);
const FINANCE_CATEGORIES = new Set(['Finance']);
const SECURITY_CATEGORIES = new Set(['Safety', 'Internet']);

function unique(values) {
  return [...new Set(values)];
}

export function inferSecurityProfiles(app = {}) {
  const profiles = ['baseline'];
  const category = app.category || '';

  if (OFFLINE_CATEGORIES.has(category)) profiles.push('offline-low');
  if (CONTENT_CATEGORIES.has(category)) profiles.push('content-medium');
  if (ACCOUNT_CATEGORIES.has(category)) profiles.push('account-medium');
  if (CHILD_CATEGORIES.has(category) || app.childDirected) profiles.push('child-high');
  if (FINANCE_CATEGORIES.has(category) || app.id === 'aarupay') profiles.push('finance-critical');
  if (SECURITY_CATEGORIES.has(category) || app.id === 'sentinel' || app.id === 'aaru-browser') profiles.push('security-critical');
  if (app.id === 'aarulya-store' || app.isStoreInstaller === true) profiles.push('store-critical');

  return unique(profiles);
}

function evidencePassed(evidence, key) {
  const value = evidence?.[key];
  return value === true || value === PASSED || (typeof value === 'string' && value.startsWith('verified:'));
}

export function getRequiredSecurityEvidence(app = {}) {
  const profiles = inferSecurityProfiles(app);
  return Object.freeze(unique(profiles.flatMap((profile) => SECURITY_PROFILES[profile].requiredEvidence)));
}

export function evaluateSecurityEvidence(app = {}) {
  const profiles = inferSecurityProfiles(app);
  const requiredEvidence = getRequiredSecurityEvidence(app);
  const evidence = app.securityEvidence || {};
  const missing = requiredEvidence.filter((key) => !evidencePassed(evidence, key));

  const declaredPermissions = Array.isArray(app.declaredPermissions) ? app.declaredPermissions : [];
  const permissionJustifications = app.permissionJustifications || {};
  const unjustifiedPermissions = declaredPermissions.filter((permission) => {
    const justification = permissionJustifications[permission];
    return typeof justification !== 'string' || justification.trim().length < 12;
  });

  const errors = missing.map((key) => `security-evidence-missing:${key}`);
  if (unjustifiedPermissions.length) {
    errors.push(`unjustified-permissions:${unjustifiedPermissions.join(',')}`);
  }
  if (app.embeddedSecretsDetected === true) errors.push('embedded-secrets-detected');
  if (app.knownCriticalVulnerabilities > 0) errors.push('known-critical-vulnerabilities-present');
  if (app.cleartextTrafficEnabled === true) errors.push('cleartext-traffic-prohibited');
  if (app.debuggableRelease === true) errors.push('debuggable-release-prohibited');
  if (app.testOrDemoCredentialsPresent === true) errors.push('test-or-demo-credentials-prohibited');

  return Object.freeze({
    valid: errors.length === 0,
    profiles: Object.freeze(profiles),
    requiredEvidence,
    missingEvidence: Object.freeze(missing),
    unjustifiedPermissions: Object.freeze(unjustifiedPermissions),
    errors: Object.freeze(errors)
  });
}

export function publicSecuritySummary(app = {}) {
  const result = evaluateSecurityEvidence(app);
  return Object.freeze({
    profiles: result.profiles.map((profile) => SECURITY_PROFILES[profile].label),
    releaseEligible: result.valid,
    permissionCount: Array.isArray(app.declaredPermissions) ? app.declaredPermissions.length : 0,
    dataCollection: app.dataCollectionSummary || 'Not yet declared',
    networkUse: app.networkUseSummary || 'Not yet declared',
    lastSecurityReview: app.lastSecurityReview || null
  });
}
