import { evaluateSecurityEvidence } from './security-policy.js';
import { evaluateSovereignAssurance } from './sovereign-assurance.js';
import { evaluateAttestationSet } from './attestation-policy.js';

const PUBLISHABLE_STATUSES = new Set(['review', 'published']);
const HTTPS = /^https:\/\//i;
const SHA256 = /^[a-f0-9]{64}$/i;
const COMMIT_SHA = /^[a-f0-9]{40,64}$/i;
const PACKAGE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/;

export const STORE_RELEASE_MODE = Object.freeze({
  firstPartyOnly: true,
  publisher: 'Aarulya',
  importedApkResigningAllowed: false,
  thirdPartySubmissionEnabled: false,
  securityEvidenceRequired: true,
  sovereignAssuranceRequired: true,
  signedAttestationsRequired: true,
  publishOnSecurityWarning: false,
  publishOnAssuranceWarning: false,
  publishOnAttestationWarning: false
});

function requireAarulyaOwnership(app, errors) {
  if (app.publisher !== STORE_RELEASE_MODE.publisher) errors.push('aarulya-publisher-required');
  if (app.releaseChannel !== 'first-party') errors.push('first-party-release-channel-required');
  if (app.sourceOwnership !== 'aarulya-owned') errors.push('aarulya-source-ownership-required');
  if (app.importedOrResignedApk === true) errors.push('imported-or-resigned-apk-prohibited');
  if (!COMMIT_SHA.test(app.sourceCommitSha || '')) errors.push('source-commit-proof-required');
  if (!SHA256.test(app.sourceArchiveSha256 || '')) errors.push('source-archive-hash-required');
  if (!SHA256.test(app.assetManifestSha256 || '')) errors.push('asset-manifest-hash-required');
  if (!SHA256.test(app.sbomSha256 || '')) errors.push('sbom-hash-required');
  if (!app.signingKeyId || app.signingKeyId.length < 12) errors.push('aarulya-signing-key-id-required');
  if (app.signingOwner !== STORE_RELEASE_MODE.publisher) errors.push('aarulya-signing-owner-required');
  if (app.buildProvenance !== 'verified') errors.push('verified-build-provenance-required');
  if (app.reproducibleBuildReview !== 'passed') errors.push('reproducible-build-review-required');
}

function requireOperationalReadiness(app, errors) {
  if (app.vulnerabilityDisclosurePolicy !== 'published') errors.push('vulnerability-disclosure-policy-required');
  if (app.securityContact !== 'verified') errors.push('verified-security-contact-required');
  if (app.incidentResponsePlan !== 'approved') errors.push('approved-incident-response-plan-required');
  if (app.rollbackPlan !== 'tested') errors.push('tested-rollback-plan-required');
  if (app.backupRestorePlanRequired && app.backupRestoreTest !== 'passed') errors.push('backup-restore-test-required');
  if (app.telemetryReview !== 'passed') errors.push('telemetry-review-required');
  if (app.releaseNotesSecurityImpactReview !== 'passed') errors.push('security-impact-review-required');
}

export function validateRelease(app) {
  const errors = [];

  if (!app || typeof app !== 'object') return { valid: false, errors: ['release-required'] };
  if (!PACKAGE_ID.test(app.packageId || '')) errors.push('invalid-package-id');
  if (!/^\d+(\.\d+){1,3}$/.test(app.versionName || '')) errors.push('invalid-version-name');
  if (!Number.isInteger(app.versionCode) || app.versionCode <= 0) errors.push('invalid-version-code');
  if (!HTTPS.test(app.apkUrl || '')) errors.push('secure-apk-url-required');
  if (!SHA256.test(app.sha256 || '')) errors.push('sha256-required');
  if (!HTTPS.test(app.privacyPolicyUrl || '')) errors.push('privacy-policy-required');
  if (!app.signerFingerprint || app.signerFingerprint.length < 32) errors.push('signer-fingerprint-required');
  if (app.malwareScan !== 'passed') errors.push('malware-scan-not-passed');
  if (app.copyrightReview !== 'passed') errors.push('copyright-review-not-passed');
  if (app.permissionsReview !== 'passed') errors.push('permissions-review-not-passed');
  if (app.dataSafetyReview !== 'passed') errors.push('data-safety-review-not-passed');
  if (app.dynamicSecurityTest !== 'passed') errors.push('dynamic-security-test-not-passed');
  if (app.penetrationTestRequired && app.penetrationTest !== 'passed') errors.push('penetration-test-not-passed');
  if (app.childDirected && app.childSafetyReview !== 'passed') errors.push('child-safety-review-not-passed');
  if (!PUBLISHABLE_STATUSES.has(app.status)) errors.push('release-not-in-review-or-published');

  if (STORE_RELEASE_MODE.firstPartyOnly) requireAarulyaOwnership(app, errors);
  requireOperationalReadiness(app, errors);

  const security = evaluateSecurityEvidence(app);
  if (!security.valid) errors.push(...security.errors);

  const assurance = evaluateSovereignAssurance(app);
  if (!assurance.valid) errors.push(...assurance.errors);

  const attestations = evaluateAttestationSet({
    ...app,
    sovereignAssuranceTier: assurance.tier
  });
  if (!attestations.valid) errors.push(...attestations.errors);

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze([...new Set(errors)]),
    securityProfiles: security.profiles,
    missingSecurityEvidence: security.missingEvidence,
    sovereignAssuranceTier: assurance.tier,
    sovereignAssuranceTarget: assurance.target,
    signedAttestationCount: attestations.attestationCount,
    signedAttestationTypes: attestations.types
  });
}

export function canDownload(app) {
  const validation = validateRelease(app);
  return Object.freeze({
    allowed: app?.status === 'published' && validation.valid,
    reasons: validation.errors,
    securityProfiles: validation.securityProfiles,
    sovereignAssuranceTier: validation.sovereignAssuranceTier,
    signedAttestationCount: validation.signedAttestationCount
  });
}

export function verifyUpdateCompatibility(installed, candidate) {
  if (!installed || !candidate) return { allowed: false, reason: 'metadata-required' };
  if (installed.packageId !== candidate.packageId) return { allowed: false, reason: 'package-id-mismatch' };
  if (installed.signerFingerprint !== candidate.signerFingerprint) return { allowed: false, reason: 'signer-mismatch' };
  if (installed.signingKeyId !== candidate.signingKeyId) return { allowed: false, reason: 'signing-key-id-mismatch' };
  if (installed.publisher !== candidate.publisher) return { allowed: false, reason: 'publisher-mismatch' };
  if (candidate.versionCode <= installed.versionCode) return { allowed: false, reason: 'version-not-newer' };
  if (candidate.revoked === true) return { allowed: false, reason: 'candidate-release-revoked' };
  const validation = validateRelease(candidate);
  if (!validation.valid) return { allowed: false, reason: 'candidate-release-invalid', details: validation.errors };
  return {
    allowed: true,
    reason: 'verified-aarulya-sovereign-update',
    securityProfiles: validation.securityProfiles,
    sovereignAssuranceTier: validation.sovereignAssuranceTier,
    signedAttestationCount: validation.signedAttestationCount
  };
}
