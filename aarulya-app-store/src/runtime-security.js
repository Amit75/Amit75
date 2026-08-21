const PASS_VALUES = new Set(['passed', 'verified', 'approved', true]);

const CRITICAL_IDS = new Set([
  'aarulya-store',
  'aarupay',
  'sentinel',
  'aaru-browser',
  'cloud',
  'owner-os',
  'password-vault',
  'backup'
]);

const ACCOUNT_CATEGORIES = new Set(['AI & Productivity', 'Business', 'Cloud & Files', 'Finance', 'Internet', 'Safety']);
const CHILD_CATEGORIES = new Set(['Games', 'Education', 'Kids & Family']);
const CONTENT_CATEGORIES = new Set(['Documents', 'Photo & Video', 'Books & Learning', 'Entertainment']);

export const RUNTIME_SECURITY_CONSTITUTION = Object.freeze({
  trustClientForAuthorization: false,
  deviceIntegrityAsSoleControl: false,
  certificateErrorBypassAllowed: false,
  unsignedRemoteConfigurationAllowed: false,
  plaintextSensitiveStorageAllowed: false,
  longLivedAccessTokensAllowed: false,
  sensitiveDataInLogsAllowed: false,
  productionDebugEndpointsAllowed: false,
  hiddenMasterPasswordAllowed: false,
  failOpenOnSecurityControlError: false
});

function passed(value) {
  return PASS_VALUES.has(value) || (typeof value === 'string' && value.startsWith('verified:'));
}

function requireCheck(errors, condition, code) {
  if (!condition) errors.push(code);
}

function inferRuntimeTier(app = {}) {
  if (app.isStoreInstaller === true || CRITICAL_IDS.has(app.id)) return 'critical';
  if (ACCOUNT_CATEGORIES.has(app.category) || app.childDirected === true) return 'high';
  return 'standard';
}

function evaluatePlatformHardening(evidence, errors) {
  requireCheck(errors, passed(evidence.releaseDebugDisabled), 'runtime:release-debug-disabled-required');
  requireCheck(errors, passed(evidence.productionDebugEndpointsAbsent), 'runtime:production-debug-endpoints-prohibited');
  requireCheck(errors, passed(evidence.exportedComponentsReview), 'runtime:exported-components-review-required');
  requireCheck(errors, passed(evidence.intentAndDeepLinkValidation), 'runtime:intent-deeplink-validation-required');
  requireCheck(errors, passed(evidence.safePendingIntentConfiguration), 'runtime:safe-pending-intent-required');
  requireCheck(errors, passed(evidence.webviewHardeningOrNotUsed), 'runtime:webview-hardening-required');
  requireCheck(errors, passed(evidence.nativeLibraryHardeningOrNotUsed), 'runtime:native-library-hardening-required');
  requireCheck(errors, passed(evidence.accessibilityServiceAbuseReview), 'runtime:accessibility-abuse-review-required');
  requireCheck(errors, passed(evidence.overlayTapjackingProtection), 'runtime:tapjacking-protection-required');
}

function evaluateDataProtection(evidence, tier, errors) {
  requireCheck(errors, passed(evidence.sensitiveDataEncryptedAtRest), 'runtime:sensitive-data-encryption-required');
  requireCheck(errors, passed(evidence.hardwareBackedKeyStorageOrDocumentedFallback), 'runtime:hardware-backed-key-storage-required');
  requireCheck(errors, passed(evidence.keyRotationAndRevocation), 'runtime:key-rotation-revocation-required');
  requireCheck(errors, passed(evidence.backupExclusionOrEncryptedBackup), 'runtime:backup-protection-required');
  requireCheck(errors, passed(evidence.clipboardProtection), 'runtime:clipboard-protection-required');
  requireCheck(errors, passed(evidence.notificationRedaction), 'runtime:notification-redaction-required');
  requireCheck(errors, passed(evidence.crashAndAnalyticsRedaction), 'runtime:crash-analytics-redaction-required');
  requireCheck(errors, passed(evidence.temporaryFileSecureCleanup), 'runtime:temporary-file-cleanup-required');
  requireCheck(errors, passed(evidence.screenshotPolicyReviewed), 'runtime:screenshot-policy-review-required');
  if (tier === 'critical') {
    requireCheck(errors, passed(evidence.sensitiveScreensProtected), 'runtime:sensitive-screen-protection-required');
    requireCheck(errors, passed(evidence.memoryExposureReview), 'runtime:memory-exposure-review-required');
  }
}

function evaluateNetworkAndConfiguration(evidence, errors) {
  requireCheck(errors, passed(evidence.tlsOnly), 'runtime:tls-only-required');
  requireCheck(errors, passed(evidence.systemTrustValidationNoBypass), 'runtime:certificate-bypass-prohibited');
  requireCheck(errors, passed(evidence.networkSecurityConfigurationReviewed), 'runtime:network-security-config-review-required');
  requireCheck(errors, passed(evidence.signedRemoteConfiguration), 'runtime:signed-remote-configuration-required');
  requireCheck(errors, passed(evidence.remoteConfigRollbackProtection), 'runtime:remote-config-rollback-protection-required');
  requireCheck(errors, passed(evidence.apiSchemaAndResponseValidation), 'runtime:api-schema-validation-required');
  requireCheck(errors, passed(evidence.retryBackoffAndCircuitBreaker), 'runtime:network-resilience-controls-required');
  requireCheck(errors, passed(evidence.dnsAndEndpointAllowlistReview), 'runtime:endpoint-allowlist-review-required');
}

function evaluateIdentityAndAuthorization(evidence, tier, errors) {
  requireCheck(errors, passed(evidence.serverSideAuthorization), 'runtime:server-side-authorization-required');
  requireCheck(errors, passed(evidence.shortLivedAccessTokens), 'runtime:short-lived-access-tokens-required');
  requireCheck(errors, passed(evidence.refreshTokenRotationAndReuseDetection), 'runtime:refresh-token-rotation-required');
  requireCheck(errors, passed(evidence.secureSessionRevocation), 'runtime:session-revocation-required');
  requireCheck(errors, passed(evidence.accountRecoveryAbuseReview), 'runtime:account-recovery-review-required');
  requireCheck(errors, passed(evidence.sensitiveActionReauthentication), 'runtime:sensitive-action-reauthentication-required');
  requireCheck(errors, passed(evidence.noHardcodedOrSharedMasterCredential), 'runtime:master-credential-prohibited');
  if (tier !== 'standard') {
    requireCheck(errors, passed(evidence.mfaOrEquivalentForPrivilegedAccounts), 'runtime:privileged-mfa-required');
    requireCheck(errors, passed(evidence.sessionRiskEvaluation), 'runtime:session-risk-evaluation-required');
  }
}

function evaluateCompromiseResistance(evidence, tier, errors) {
  requireCheck(errors, passed(evidence.integritySignalsAreAdvisoryNotSoleAuth), 'runtime:integrity-signal-policy-required');
  requireCheck(errors, passed(evidence.rootHookDebugSignalsMonitored), 'runtime:compromise-signal-monitoring-required');
  requireCheck(errors, passed(evidence.tamperResponseFailSafe), 'runtime:tamper-response-required');
  requireCheck(errors, passed(evidence.runtimeFeatureKillSwitch), 'runtime:feature-kill-switch-required');
  requireCheck(errors, passed(evidence.securityEventAuditTrail), 'runtime:security-audit-trail-required');
  requireCheck(errors, passed(evidence.clockAndReplayResistance), 'runtime:replay-resistance-required');
  if (tier === 'critical') {
    requireCheck(errors, passed(evidence.runtimeApplicationSelfProtectionReviewed), 'runtime:critical-rasp-review-required');
    requireCheck(errors, passed(evidence.compromisedDeviceRestrictedMode), 'runtime:compromised-device-restricted-mode-required');
  }
}

function evaluateContentSafety(app, evidence, errors) {
  if (CONTENT_CATEGORIES.has(app.category)) {
    requireCheck(errors, passed(evidence.untrustedFileParsingIsolated), 'runtime:untrusted-file-isolation-required');
    requireCheck(errors, passed(evidence.fileTypeMagicAndSizeValidation), 'runtime:file-validation-required');
    requireCheck(errors, passed(evidence.malformedContentFuzzed), 'runtime:malformed-content-fuzzing-required');
  }
  if (CHILD_CATEGORIES.has(app.category) || app.childDirected === true) {
    requireCheck(errors, passed(evidence.childModeCannotBeBypassed), 'runtime:child-mode-bypass-protection-required');
    requireCheck(errors, passed(evidence.openStrangerContactDisabled), 'runtime:child-stranger-contact-prohibited');
    requireCheck(errors, passed(evidence.childSensitiveActionsParentGated), 'runtime:child-parental-gate-required');
  }
}

export function evaluateRuntimeSecurity(app = {}) {
  const tier = inferRuntimeTier(app);
  const evidence = app.runtimeSecurityEvidence || {};
  const errors = [];

  evaluatePlatformHardening(evidence, errors);
  evaluateDataProtection(evidence, tier, errors);
  evaluateNetworkAndConfiguration(evidence, errors);
  evaluateIdentityAndAuthorization(evidence, tier, errors);
  evaluateCompromiseResistance(evidence, tier, errors);
  evaluateContentSafety(app, evidence, errors);

  if (app.failOpenOnSecurityControlError === true) errors.push('runtime:fail-open-prohibited');
  if (app.sensitiveDataInLogs === true) errors.push('runtime:sensitive-data-in-logs-prohibited');
  if (app.unencryptedSensitiveLocalStorage === true) errors.push('runtime:plaintext-sensitive-storage-prohibited');
  if (app.certificateValidationBypassPresent === true) errors.push('runtime:certificate-validation-bypass-prohibited');

  return Object.freeze({
    valid: errors.length === 0,
    tier,
    errors: Object.freeze([...new Set(errors)])
  });
}
