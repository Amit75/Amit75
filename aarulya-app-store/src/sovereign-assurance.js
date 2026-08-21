const PASSED = new Set(['passed', 'verified', 'approved', true]);

export const SOVEREIGN_ASSURANCE_TARGET = Object.freeze({
  securityModel: 'zero-trust-every-artifact',
  minimumSlsaBuildLevel: 3,
  minimumSlsaSourceLevel: 3,
  criticalSlsaSourceLevel: 4,
  minimumIndependentBuilders: 2,
  minimumReleaseApprovers: 2,
  minimumTransparencyWitnesses: 2,
  rootKeyMode: 'offline-threshold',
  releaseSigningMode: 'hardware-backed',
  reproducibleBuildRequired: true,
  immutableTransparencyRequired: true,
  selfApprovalAllowed: false,
  longLivedCiSecretsAllowed: false
});

export const TRUST_ROLE_POLICY = Object.freeze({
  root: Object.freeze({ threshold: 3, totalKeys: 5, offline: true, hardwareBacked: true }),
  targets: Object.freeze({ threshold: 2, totalKeys: 3, online: true, hardwareBacked: true }),
  snapshot: Object.freeze({ threshold: 1, totalKeys: 2, online: true, hardwareBacked: true }),
  timestamp: Object.freeze({ threshold: 1, totalKeys: 2, online: true, shortLived: true })
});

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

const HIGH_RISK_CATEGORIES = new Set([
  'Finance',
  'Safety',
  'Internet',
  'Cloud & Files',
  'Business',
  'Kids & Family'
]);

function passed(value) {
  return PASSED.has(value) || (typeof value === 'string' && value.startsWith('verified:'));
}

function integerAtLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

export function inferAssuranceTier(app = {}) {
  if (app.isStoreInstaller === true || CRITICAL_IDS.has(app.id)) return 'critical';
  if (app.childDirected === true || HIGH_RISK_CATEGORIES.has(app.category)) return 'high';
  return 'standard';
}

function requireCheck(errors, condition, code) {
  if (!condition) errors.push(code);
}

function evaluateStandards(evidence, tier, errors) {
  requireCheck(errors, passed(evidence.owaspMasvsArchitectureReview), 'assurance:masvs-architecture-review-required');
  requireCheck(errors, passed(evidence.owaspMasvsChecklist), 'assurance:masvs-checklist-required');
  requireCheck(errors, passed(evidence.owaspMastgTesting), 'assurance:mastg-testing-required');
  requireCheck(errors, passed(evidence.nistSsdfAssessment), 'assurance:nist-ssdf-assessment-required');
  requireCheck(errors, passed(evidence.threatModelReviewed), 'assurance:reviewed-threat-model-required');
  requireCheck(errors, passed(evidence.privacyThreatModelReviewed), 'assurance:privacy-threat-model-required');
  if (tier !== 'standard') {
    requireCheck(errors, passed(evidence.independentSecurityReview), 'assurance:independent-security-review-required');
  }
  if (tier === 'critical') {
    requireCheck(errors, passed(evidence.independentPenetrationTest), 'assurance:independent-penetration-test-required');
    requireCheck(errors, passed(evidence.redTeamExercise), 'assurance:red-team-exercise-required');
  }
}

function evaluateSourceAndReview(evidence, tier, errors) {
  const requiredSourceLevel = tier === 'critical'
    ? SOVEREIGN_ASSURANCE_TARGET.criticalSlsaSourceLevel
    : SOVEREIGN_ASSURANCE_TARGET.minimumSlsaSourceLevel;

  requireCheck(errors, integerAtLeast(evidence.slsaSourceLevel, requiredSourceLevel), `assurance:slsa-source-level-${requiredSourceLevel}-required`);
  requireCheck(errors, passed(evidence.protectedBranchEnforced), 'assurance:protected-branch-required');
  requireCheck(errors, passed(evidence.signedCommitsOrEquivalent), 'assurance:signed-source-revisions-required');
  requireCheck(errors, integerAtLeast(evidence.sourceReviewApprovals, 2), 'assurance:two-party-source-review-required');
  requireCheck(errors, evidence.selfApprovalUsed !== true, 'assurance:self-approval-prohibited');
  requireCheck(errors, passed(evidence.reviewPolicyEnforcedByPlatform), 'assurance:platform-enforced-review-policy-required');
  requireCheck(errors, passed(evidence.changeIntentRecorded), 'assurance:change-intent-record-required');
}

function evaluateBuild(evidence, errors) {
  requireCheck(errors, integerAtLeast(evidence.slsaBuildLevel, SOVEREIGN_ASSURANCE_TARGET.minimumSlsaBuildLevel), 'assurance:slsa-build-level-3-required');
  requireCheck(errors, passed(evidence.hermeticBuild), 'assurance:hermetic-build-required');
  requireCheck(errors, passed(evidence.ephemeralIsolatedBuilder), 'assurance:ephemeral-isolated-builder-required');
  requireCheck(errors, passed(evidence.pinnedBuildInputs), 'assurance:pinned-build-inputs-required');
  requireCheck(errors, passed(evidence.builderIdentityVerified), 'assurance:builder-identity-verification-required');
  requireCheck(errors, passed(evidence.signedProvenance), 'assurance:signed-provenance-required');
  requireCheck(errors, passed(evidence.provenancePolicyVerified), 'assurance:provenance-policy-verification-required');
  requireCheck(errors, passed(evidence.reproducibleBuild), 'assurance:reproducible-build-required');
  requireCheck(errors, integerAtLeast(evidence.independentBuilderCount, SOVEREIGN_ASSURANCE_TARGET.minimumIndependentBuilders), 'assurance:two-independent-builders-required');
  requireCheck(errors, passed(evidence.independentBuildDigestMatch), 'assurance:independent-build-digest-match-required');
  requireCheck(errors, evidence.longLivedCiSecretsPresent !== true, 'assurance:long-lived-ci-secrets-prohibited');
  requireCheck(errors, passed(evidence.shortLivedWorkloadIdentity), 'assurance:short-lived-workload-identity-required');
  requireCheck(errors, passed(evidence.buildNetworkPolicyEnforced), 'assurance:build-network-policy-required');
}

function evaluateDependencies(evidence, tier, errors) {
  requireCheck(errors, passed(evidence.lockfileVerified), 'assurance:verified-lockfile-required');
  requireCheck(errors, passed(evidence.dependencyAllowlistPassed), 'assurance:dependency-allowlist-required');
  requireCheck(errors, passed(evidence.sbomComplete), 'assurance:complete-sbom-required');
  requireCheck(errors, passed(evidence.sbomSigned), 'assurance:signed-sbom-required');
  requireCheck(errors, passed(evidence.licensePolicyPassed), 'assurance:license-policy-required');
  requireCheck(errors, passed(evidence.maliciousPackageReview), 'assurance:malicious-package-review-required');
  requireCheck(errors, Number(evidence.knownCriticalVulnerabilities || 0) === 0, 'assurance:critical-vulnerability-zero-required');
  requireCheck(errors, Number(evidence.knownHighVulnerabilitiesOutsideSla || 0) === 0, 'assurance:high-vulnerability-sla-required');
  requireCheck(errors, passed(evidence.dependencyFreshnessPolicy), 'assurance:dependency-freshness-policy-required');
  if (tier !== 'standard') {
    requireCheck(errors, passed(evidence.fuzzTesting), 'assurance:fuzz-testing-required');
  }
}

function evaluateTrustRoot(evidence, errors) {
  requireCheck(errors, passed(evidence.offlineRootKeys), 'assurance:offline-root-keys-required');
  requireCheck(errors, passed(evidence.hardwareBackedSigningKeys), 'assurance:hardware-backed-signing-required');
  requireCheck(errors, evidence.rootThreshold === TRUST_ROLE_POLICY.root.threshold, 'assurance:root-threshold-3-of-5-required');
  requireCheck(errors, evidence.rootTotalKeys === TRUST_ROLE_POLICY.root.totalKeys, 'assurance:five-root-keys-required');
  requireCheck(errors, evidence.targetsThreshold >= TRUST_ROLE_POLICY.targets.threshold, 'assurance:targets-threshold-required');
  requireCheck(errors, passed(evidence.separatedSigningRoles), 'assurance:separated-signing-roles-required');
  requireCheck(errors, passed(evidence.keyCustodianSeparation), 'assurance:key-custodian-separation-required');
  requireCheck(errors, passed(evidence.keyRotationPlanTested), 'assurance:key-rotation-test-required');
  requireCheck(errors, passed(evidence.keyCompromiseRecoveryTested), 'assurance:key-compromise-recovery-test-required');
  requireCheck(errors, passed(evidence.signingCeremonyRecorded), 'assurance:recorded-signing-ceremony-required');
}

function evaluateUpdateSecurity(evidence, errors) {
  requireCheck(errors, passed(evidence.tufStyleRoleSeparation), 'assurance:update-role-separation-required');
  requireCheck(errors, passed(evidence.rollbackProtection), 'assurance:rollback-protection-required');
  requireCheck(errors, passed(evidence.freezeAttackProtection), 'assurance:freeze-attack-protection-required');
  requireCheck(errors, passed(evidence.mixAndMatchProtection), 'assurance:mix-and-match-protection-required');
  requireCheck(errors, passed(evidence.fastForwardAttackProtection), 'assurance:fast-forward-protection-required');
  requireCheck(errors, passed(evidence.metadataExpiryEnforced), 'assurance:metadata-expiry-required');
  requireCheck(errors, passed(evidence.delegatedTargetsRestricted), 'assurance:restricted-delegated-targets-required');
  requireCheck(errors, passed(evidence.revocationPropagationTested), 'assurance:revocation-propagation-test-required');
}

function evaluateTransparency(evidence, errors) {
  requireCheck(errors, passed(evidence.immutableTransparencyLog), 'assurance:immutable-transparency-log-required');
  requireCheck(errors, passed(evidence.transparencyInclusionProof), 'assurance:transparency-inclusion-proof-required');
  requireCheck(errors, integerAtLeast(evidence.transparencyWitnessCount, SOVEREIGN_ASSURANCE_TARGET.minimumTransparencyWitnesses), 'assurance:two-transparency-witnesses-required');
  requireCheck(errors, passed(evidence.releaseAttestationSigned), 'assurance:signed-release-attestation-required');
  requireCheck(errors, passed(evidence.verificationSummaryAttestation), 'assurance:verification-summary-attestation-required');
}

function evaluateOperations(evidence, tier, errors) {
  requireCheck(errors, integerAtLeast(evidence.releaseApprovals, SOVEREIGN_ASSURANCE_TARGET.minimumReleaseApprovers), 'assurance:two-person-release-approval-required');
  requireCheck(errors, passed(evidence.releaseApproversIndependent), 'assurance:independent-release-approvers-required');
  requireCheck(errors, passed(evidence.stagedRolloutWithHealthGates), 'assurance:staged-rollout-health-gates-required');
  requireCheck(errors, passed(evidence.automaticRollbackTested), 'assurance:automatic-rollback-test-required');
  requireCheck(errors, passed(evidence.revocationDrillPassed), 'assurance:revocation-drill-required');
  requireCheck(errors, passed(evidence.disasterRecoveryDrillPassed), 'assurance:disaster-recovery-drill-required');
  requireCheck(errors, passed(evidence.securityMonitoringActive), 'assurance:security-monitoring-required');
  requireCheck(errors, passed(evidence.tamperAlertingActive), 'assurance:tamper-alerting-required');
  requireCheck(errors, passed(evidence.vulnerabilitySlaEnforced), 'assurance:vulnerability-sla-required');
  if (tier === 'critical') {
    requireCheck(errors, passed(evidence.breakGlassExercisePassed), 'assurance:break-glass-exercise-required');
    requireCheck(errors, integerAtLeast(evidence.releaseApprovals, 3), 'assurance:three-release-approvals-required-for-critical');
  }
}

export function evaluateSovereignAssurance(app = {}) {
  const tier = inferAssuranceTier(app);
  const evidence = app.sovereignAssuranceEvidence || {};
  const errors = [];

  evaluateStandards(evidence, tier, errors);
  evaluateSourceAndReview(evidence, tier, errors);
  evaluateBuild(evidence, errors);
  evaluateDependencies(evidence, tier, errors);
  evaluateTrustRoot(evidence, errors);
  evaluateUpdateSecurity(evidence, errors);
  evaluateTransparency(evidence, errors);
  evaluateOperations(evidence, tier, errors);

  return Object.freeze({
    valid: errors.length === 0,
    tier,
    target: SOVEREIGN_ASSURANCE_TARGET,
    errors: Object.freeze([...new Set(errors)])
  });
}
