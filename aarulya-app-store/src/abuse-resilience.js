const PASS_VALUES = new Set(['passed', 'verified', 'approved', true]);
const USER_CONTENT_CATEGORIES = new Set(['AI & Productivity', 'Business', 'Cloud & Files', 'Games', 'Education', 'Entertainment']);
const HIGH_VALUE_IDS = new Set(['aarulya-store', 'aarupay', 'owner-os', 'cloud', 'sentinel', 'password-vault', 'backup']);

export const ABUSE_RESILIENCE_CONSTITUTION = Object.freeze({
  trustDeviceAttestationAlone: false,
  unlimitedAuthenticationAttemptsAllowed: false,
  replayableSensitiveRequestsAllowed: false,
  clientCalculatedEntitlementsAllowed: false,
  hiddenAdminEndpointsAllowed: false,
  childOpenChatAllowed: false,
  irreversibleAutomatedEnforcementAllowed: false
});

function passed(value) {
  return PASS_VALUES.has(value) || (typeof value === 'string' && value.startsWith('verified:'));
}

function requireCheck(errors, condition, code) {
  if (!condition) errors.push(code);
}

function inferAbuseTier(app = {}) {
  if (app.isStoreInstaller === true || HIGH_VALUE_IDS.has(app.id)) return 'critical';
  if (app.accountsEnabled === true || USER_CONTENT_CATEGORIES.has(app.category)) return 'high';
  return 'standard';
}

export function evaluateAbuseResilience(app = {}) {
  const evidence = app.abuseResilienceEvidence || {};
  const tier = inferAbuseTier(app);
  const errors = [];

  requireCheck(errors, passed(evidence.serverEnforcedRateLimits), 'abuse:server-rate-limits-required');
  requireCheck(errors, passed(evidence.authenticationThrottleAndLockoutSafety), 'abuse:authentication-throttle-required');
  requireCheck(errors, passed(evidence.replayProtection), 'abuse:replay-protection-required');
  requireCheck(errors, passed(evidence.idempotencyForSensitiveMutations), 'abuse:idempotency-required');
  requireCheck(errors, passed(evidence.serverCalculatedEntitlementsAndBalances), 'abuse:server-calculated-entitlements-required');
  requireCheck(errors, passed(evidence.objectLevelAuthorizationTests), 'abuse:object-authorization-tests-required');
  requireCheck(errors, passed(evidence.massAssignmentProtection), 'abuse:mass-assignment-protection-required');
  requireCheck(errors, passed(evidence.antiAutomationControls), 'abuse:anti-automation-controls-required');
  requireCheck(errors, passed(evidence.deviceIntegrityIsRiskSignalOnly), 'abuse:device-integrity-signal-policy-required');
  requireCheck(errors, passed(evidence.accountTakeoverDetection), 'abuse:account-takeover-detection-required');
  requireCheck(errors, passed(evidence.sessionAnomalyDetection), 'abuse:session-anomaly-detection-required');
  requireCheck(errors, passed(evidence.safeRecoveryAndSupportVerification), 'abuse:safe-recovery-verification-required');
  requireCheck(errors, passed(evidence.privilegedActionAuditTrail), 'abuse:privileged-audit-trail-required');
  requireCheck(errors, passed(evidence.adminSurfaceInventoryAndAccessReview), 'abuse:admin-surface-review-required');
  requireCheck(errors, passed(evidence.abuseReportingAndAppealProcess), 'abuse:report-and-appeal-process-required');
  requireCheck(errors, passed(evidence.falsePositiveMonitoring), 'abuse:false-positive-monitoring-required');

  if (tier !== 'standard') {
    requireCheck(errors, passed(evidence.riskBasedStepUp), 'abuse:risk-based-step-up-required');
    requireCheck(errors, passed(evidence.velocityAndGraphSignals), 'abuse:velocity-graph-signals-required');
    requireCheck(errors, passed(evidence.multiAccountAndCollusionReview), 'abuse:multi-account-collusion-review-required');
    requireCheck(errors, passed(evidence.remoteSessionRevocation), 'abuse:remote-session-revocation-required');
  }

  if (tier === 'critical') {
    requireCheck(errors, passed(evidence.transactionOrReleaseFourEyesControl), 'abuse:critical-four-eyes-control-required');
    requireCheck(errors, passed(evidence.independentFraudRuleChangeApproval), 'abuse:fraud-rule-change-approval-required');
    requireCheck(errors, passed(evidence.realTimeKillSwitchAndContainment), 'abuse:real-time-containment-required');
    requireCheck(errors, passed(evidence.redTeamAbuseCases), 'abuse:red-team-abuse-cases-required');
  }

  if (app.userGeneratedContent === true || app.openCommunityFeatures === true) {
    requireCheck(errors, passed(evidence.contentReportingBlockingAndModeration), 'abuse:ugc-report-block-moderation-required');
    requireCheck(errors, passed(evidence.groomingHarassmentAndDoxxingControls), 'abuse:community-harm-controls-required');
    requireCheck(errors, passed(evidence.moderationAuditAndAppeal), 'abuse:moderation-audit-appeal-required');
  }

  if (app.childDirected === true) {
    requireCheck(errors, passed(evidence.noOpenStrangerChatForChildren), 'abuse:child-open-stranger-chat-prohibited');
    requireCheck(errors, passed(evidence.parentControlledSocialFeatures), 'abuse:child-social-parent-controls-required');
    requireCheck(errors, passed(evidence.childSafeReportingFlow), 'abuse:child-safe-reporting-required');
  }

  if (app.unlimitedLoginAttempts === true) errors.push('abuse:unlimited-login-attempts-prohibited');
  if (app.clientCalculatedBalanceOrEntitlement === true) errors.push('abuse:client-calculated-balance-prohibited');
  if (app.hiddenAdminEndpointPresent === true) errors.push('abuse:hidden-admin-endpoint-prohibited');
  if (app.irreversibleAutomatedEnforcementWithoutAppeal === true) errors.push('abuse:unappealable-automated-enforcement-prohibited');

  return Object.freeze({
    valid: errors.length === 0,
    tier,
    errors: Object.freeze([...new Set(errors)])
  });
}
