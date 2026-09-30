const SHA256 = /^[a-f0-9]{64}$/i;
const HTTPS = /^https:\/\//i;

export const REQUIRED_ATTESTATION_TYPES = Object.freeze([
  'source-review',
  'slsa-build-provenance',
  'independent-rebuild',
  'sbom',
  'dependency-scan',
  'secret-scan',
  'static-analysis',
  'dynamic-analysis',
  'masvs-verification',
  'privacy-review',
  'release-approval',
  'rollback-readiness'
]);

export const CRITICAL_ATTESTATION_TYPES = Object.freeze([
  'independent-penetration-test',
  'red-team-exercise',
  'key-compromise-recovery',
  'disaster-recovery-drill',
  'break-glass-drill'
]);

const MAX_AGE_DAYS = Object.freeze({
  'source-review': 30,
  'slsa-build-provenance': 7,
  'independent-rebuild': 7,
  sbom: 7,
  'dependency-scan': 7,
  'secret-scan': 7,
  'static-analysis': 7,
  'dynamic-analysis': 14,
  'masvs-verification': 30,
  'privacy-review': 90,
  'release-approval': 7,
  'rollback-readiness': 90,
  'independent-penetration-test': 90,
  'red-team-exercise': 180,
  'key-compromise-recovery': 180,
  'disaster-recovery-drill': 180,
  'break-glass-drill': 180
});

function isValidDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function unique(values) {
  return [...new Set(values)];
}

function validateOne(attestation, expectedArtifactDigest, now) {
  const errors = [];
  if (!attestation || typeof attestation !== 'object') return ['attestation-object-required'];
  if (!REQUIRED_ATTESTATION_TYPES.includes(attestation.type) && !CRITICAL_ATTESTATION_TYPES.includes(attestation.type)) {
    errors.push('attestation-type-not-allowed');
  }
  if (!SHA256.test(attestation.subjectSha256 || '')) errors.push('attestation-subject-sha256-required');
  if (expectedArtifactDigest && attestation.subjectSha256?.toLowerCase() !== expectedArtifactDigest.toLowerCase()) {
    errors.push(`attestation-subject-mismatch:${attestation.type || 'unknown'}`);
  }
  if (!attestation.issuerId || attestation.issuerId.length < 8) errors.push('attestation-issuer-id-required');
  if (!attestation.issuerRole || attestation.issuerRole.length < 4) errors.push('attestation-issuer-role-required');
  if (!attestation.keyId || attestation.keyId.length < 12) errors.push('attestation-key-id-required');
  if (!isValidDate(attestation.issuedAt)) errors.push('attestation-issued-at-required');
  if (!isValidDate(attestation.expiresAt)) errors.push('attestation-expiry-required');
  if (!HTTPS.test(attestation.evidenceUrl || '')) errors.push('attestation-evidence-url-required');
  if (!SHA256.test(attestation.evidenceSha256 || '')) errors.push('attestation-evidence-sha256-required');
  if (attestation.signatureVerification !== 'passed') errors.push('attestation-signature-not-verified');
  if (attestation.transparencyInclusion !== 'verified') errors.push('attestation-transparency-inclusion-required');
  if (!attestation.transparencyLogId || attestation.transparencyLogId.length < 12) errors.push('attestation-transparency-log-id-required');
  if (!attestation.inclusionProof || attestation.inclusionProof.length < 32) errors.push('attestation-inclusion-proof-required');
  if (attestation.result !== 'passed') errors.push(`attestation-result-not-passed:${attestation.type || 'unknown'}`);

  const issuedAt = Date.parse(attestation.issuedAt || '');
  const expiresAt = Date.parse(attestation.expiresAt || '');
  if (Number.isFinite(issuedAt) && issuedAt > now + 5 * 60 * 1000) errors.push('attestation-issued-in-future');
  if (Number.isFinite(expiresAt) && expiresAt <= now) errors.push(`attestation-expired:${attestation.type || 'unknown'}`);
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && expiresAt <= issuedAt) errors.push('attestation-invalid-validity-window');

  const maxAgeDays = MAX_AGE_DAYS[attestation.type];
  if (maxAgeDays && Number.isFinite(issuedAt) && now - issuedAt > maxAgeDays * 86400000) {
    errors.push(`attestation-too-old:${attestation.type}`);
  }
  return errors;
}

function requireSeparation(attestations, errors) {
  const byType = new Map(attestations.map((item) => [item.type, item]));
  const builder = byType.get('slsa-build-provenance')?.issuerId;
  const sourceReviewer = byType.get('source-review')?.issuerId;
  const releaseApprover = byType.get('release-approval')?.issuerId;
  const rebuildVerifier = byType.get('independent-rebuild')?.issuerId;
  const pentester = byType.get('independent-penetration-test')?.issuerId;

  if (builder && sourceReviewer && builder === sourceReviewer) errors.push('attestation-separation:builder-cannot-be-source-reviewer');
  if (builder && releaseApprover && builder === releaseApprover) errors.push('attestation-separation:builder-cannot-be-release-approver');
  if (builder && rebuildVerifier && builder === rebuildVerifier) errors.push('attestation-separation:independent-rebuilder-required');
  if (sourceReviewer && releaseApprover && sourceReviewer === releaseApprover) errors.push('attestation-separation:source-reviewer-cannot-be-sole-release-approver');
  if (pentester && builder && pentester === builder) errors.push('attestation-separation:independent-pentester-required');

  const approvalAttestations = attestations.filter((item) => item.type === 'release-approval');
  const approvalIssuers = unique(approvalAttestations.map((item) => item.issuerId).filter(Boolean));
  if (approvalIssuers.length < 2) errors.push('attestation-separation:two-distinct-release-approvers-required');
}

export function evaluateAttestationSet(app = {}) {
  const attestations = Array.isArray(app.securityAttestations) ? app.securityAttestations : [];
  const expectedArtifactDigest = app.sha256 || app.apkSha256 || '';
  const now = Date.now();
  const errors = [];

  if (!SHA256.test(expectedArtifactDigest)) errors.push('attestation-set:artifact-sha256-required');
  if (!attestations.length) errors.push('attestation-set:signed-attestations-required');

  attestations.forEach((attestation) => {
    errors.push(...validateOne(attestation, expectedArtifactDigest, now));
  });

  const types = new Set(attestations.filter((item) => item?.result === 'passed').map((item) => item.type));
  REQUIRED_ATTESTATION_TYPES.forEach((type) => {
    if (!types.has(type)) errors.push(`attestation-set:missing:${type}`);
  });

  const tier = app.sovereignAssuranceTier || (app.isStoreInstaller ? 'critical' : 'standard');
  if (tier === 'critical') {
    CRITICAL_ATTESTATION_TYPES.forEach((type) => {
      if (!types.has(type)) errors.push(`attestation-set:missing-critical:${type}`);
    });
  }

  requireSeparation(attestations, errors);

  const evidenceDigests = attestations.map((item) => item?.evidenceSha256).filter(Boolean);
  if (new Set(evidenceDigests).size !== evidenceDigests.length) {
    errors.push('attestation-set:duplicate-evidence-digest');
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(unique(errors)),
    attestationCount: attestations.length,
    types: Object.freeze([...types])
  });
}
