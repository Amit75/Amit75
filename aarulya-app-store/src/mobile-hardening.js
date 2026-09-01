const PASSED = new Set(['passed', 'verified', 'approved', true]);

function passed(value) {
  return PASSED.has(value) || (typeof value === 'string' && value.startsWith('verified:'));
}

function requireCheck(errors, condition, code) {
  if (!condition) errors.push(code);
}

export const APK_HARDENING_POLICY = Object.freeze({
  clientIsTrustedAuthority: false,
  embeddedProductionSecretsAllowed: false,
  cleartextTrafficAllowed: false,
  exportedComponentsByDefaultAllowed: false,
  debugBuildReleaseAllowed: false,
  backupOfSensitiveDataAllowed: false,
  dynamicCodeFromUntrustedSourceAllowed: false,
  unsafeWebViewBridgesAllowed: false,
  certificateValidationBypassAllowed: false,
  rootDetectionAsSoleControlAllowed: false,
  obfuscationAsSoleControlAllowed: false,
  serverSideAuthorizationRequired: true,
  hardwareBackedKeyStoragePreferred: true,
  tamperSignalsRequiredForCriticalApps: true,
  secureUpdateContinuityRequired: true
});

export function evaluateMobileHardening(app = {}) {
  const evidence = app.mobileHardeningEvidence || {};
  const errors = [];
  const critical = app.isStoreInstaller === true || app.securityCritical === true;

  requireCheck(errors, app.releaseBuild === true, 'apk-hardening:release-build-required');
  requireCheck(errors, app.debuggable === false, 'apk-hardening:debuggable-must-be-false');
  requireCheck(errors, app.testOnly === false, 'apk-hardening:test-only-must-be-false');
  requireCheck(errors, app.cleartextTrafficAllowed === false, 'apk-hardening:cleartext-traffic-prohibited');
  requireCheck(errors, app.embeddedProductionSecretCount === 0, 'apk-hardening:embedded-production-secrets-prohibited');
  requireCheck(errors, app.unsafeExportedComponentCount === 0, 'apk-hardening:unsafe-exported-components-prohibited');
  requireCheck(errors, app.unsafeWebViewBridgeCount === 0, 'apk-hardening:unsafe-webview-bridge-prohibited');
  requireCheck(errors, app.untrustedDynamicCodeLoading === false, 'apk-hardening:untrusted-dynamic-code-prohibited');
  requireCheck(errors, app.sensitiveBackupEnabled === false, 'apk-hardening:sensitive-backup-prohibited');
  requireCheck(errors, app.clientAuthoritativeSecurityDecision === false, 'apk-hardening:client-authority-prohibited');
  requireCheck(errors, app.clientCalculatedPrivilegedResult === false, 'apk-hardening:client-privileged-result-prohibited');

  requireCheck(errors, passed(evidence.manifestSecurityReview), 'apk-hardening:manifest-security-review-required');
  requireCheck(errors, passed(evidence.componentExposureReview), 'apk-hardening:component-exposure-review-required');
  requireCheck(errors, passed(evidence.networkSecurityConfigReview), 'apk-hardening:network-security-config-review-required');
  requireCheck(errors, passed(evidence.certificateValidationTest), 'apk-hardening:certificate-validation-test-required');
  requireCheck(errors, passed(evidence.secureStorageTest), 'apk-hardening:secure-storage-test-required');
  requireCheck(errors, passed(evidence.keystoreUsageReview), 'apk-hardening:keystore-usage-review-required');
  requireCheck(errors, passed(evidence.secretExtractionTest), 'apk-hardening:secret-extraction-test-required');
  requireCheck(errors, passed(evidence.reverseEngineeringResistanceReview), 'apk-hardening:reverse-engineering-resistance-review-required');
  requireCheck(errors, passed(evidence.codeObfuscationVerified), 'apk-hardening:code-obfuscation-verification-required');
  requireCheck(errors, passed(evidence.nativeLibraryHardening), 'apk-hardening:native-library-hardening-required');
  requireCheck(errors, passed(evidence.intentAndDeepLinkValidation), 'apk-hardening:intent-deeplink-validation-required');
  requireCheck(errors, passed(evidence.fileProviderAndUriReview), 'apk-hardening:file-uri-review-required');
  requireCheck(errors, passed(evidence.webViewSecurityReview), 'apk-hardening:webview-security-review-required');
  requireCheck(errors, passed(evidence.loggingAndCrashRedaction), 'apk-hardening:logging-redaction-required');
  requireCheck(errors, passed(evidence.sessionAndTokenBinding), 'apk-hardening:session-token-binding-required');
  requireCheck(errors, passed(evidence.replayProtectionTest), 'apk-hardening:replay-protection-test-required');
  requireCheck(errors, passed(evidence.serverAuthorizationTest), 'apk-hardening:server-authorization-test-required');
  requireCheck(errors, passed(evidence.offlineTamperBehaviorTest), 'apk-hardening:offline-tamper-behavior-test-required');
  requireCheck(errors, passed(evidence.updateSignatureContinuityTest), 'apk-hardening:update-signature-continuity-test-required');
  requireCheck(errors, passed(evidence.rollbackAttackTest), 'apk-hardening:rollback-attack-test-required');
  requireCheck(errors, passed(evidence.maliciousInputFuzzing), 'apk-hardening:malicious-input-fuzzing-required');
  requireCheck(errors, passed(evidence.deviceIntegrityRiskHandling), 'apk-hardening:device-integrity-risk-handling-required');
  requireCheck(errors, passed(evidence.failClosedSecurityTest), 'apk-hardening:fail-closed-security-test-required');

  if (critical) {
    requireCheck(errors, passed(evidence.antiTamperSignalsVerified), 'apk-hardening:anti-tamper-signals-required');
    requireCheck(errors, passed(evidence.runtimeHookingDetectionReview), 'apk-hardening:runtime-hooking-review-required');
    requireCheck(errors, passed(evidence.emulatorAndInstrumentationRiskHandling), 'apk-hardening:instrumentation-risk-handling-required');
    requireCheck(errors, passed(evidence.hardwareBackedKeyAttestation), 'apk-hardening:hardware-backed-key-attestation-required');
    requireCheck(errors, passed(evidence.independentReverseEngineeringAssessment), 'apk-hardening:independent-reverse-engineering-assessment-required');
  }

  return Object.freeze({
    valid: errors.length === 0,
    tier: critical ? 'critical' : 'standard',
    errors: Object.freeze([...new Set(errors)]),
    policy: APK_HARDENING_POLICY
  });
}
