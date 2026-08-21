import { evaluateOwnershipEvidence } from './ownership-evidence.js';
import { evaluateSecurityEvidence } from './security-policy.js';
import { evaluateSovereignAssurance } from './sovereign-assurance.js';
import { evaluateAttestationSet } from './attestation-policy.js';
import { evaluateRuntimeSecurity } from './runtime-security.js';
import { evaluatePrivacy } from './privacy-policy.js';
import { evaluateAbuseResilience } from './abuse-resilience.js';

const SHA256 = /^[a-f0-9]{64}$/i;

function summarizeSection(name, result) {
  return Object.freeze({
    name,
    passed: result?.valid === true,
    errors: Object.freeze([...(result?.errors || [])])
  });
}

export function buildReleaseEvidenceReport(app = {}, options = {}) {
  const ownership = evaluateOwnershipEvidence(app);
  const security = evaluateSecurityEvidence(app);
  const assurance = evaluateSovereignAssurance(app);
  const attestations = evaluateAttestationSet({ ...app, sovereignAssuranceTier: assurance.tier });
  const runtime = evaluateRuntimeSecurity(app);
  const privacy = evaluatePrivacy(app);
  const abuse = evaluateAbuseResilience(app);

  const sections = Object.freeze([
    summarizeSection('ownership-and-originality', ownership),
    summarizeSection('application-security', security),
    summarizeSection('sovereign-supply-chain', assurance),
    summarizeSection('signed-attestations', attestations),
    summarizeSection('runtime-security', runtime),
    summarizeSection('privacy-and-data-protection', privacy),
    summarizeSection('abuse-and-fraud-resilience', abuse)
  ]);

  const blockers = Object.freeze(sections.flatMap((section) => section.errors));
  const apkDigest = app.sha256 || app.apkSha256 || '';
  const reportReady = sections.every((section) => section.passed)
    && SHA256.test(apkDigest)
    && app.testExecutionStatus === 'passed'
    && app.testReportSha256 && SHA256.test(app.testReportSha256)
    && app.releaseDecision === 'approved'
    && app.reportEvidenceFrozen === true;

  return Object.freeze({
    schemaVersion: 1,
    reportId: options.reportId || null,
    generatedAt: options.generatedAt || null,
    publisher: app.publisher || null,
    appId: app.id || null,
    appName: app.name || null,
    packageId: app.packageId || null,
    versionName: app.versionName || null,
    versionCode: app.versionCode || null,
    apkSha256: apkDigest || null,
    signerFingerprint: app.signerFingerprint || null,
    signingKeyId: app.signingKeyId || null,
    sourceCommitSha: app.sourceCommitSha || null,
    sourceArchiveSha256: app.sourceArchiveSha256 || null,
    assetManifestSha256: app.assetManifestSha256 || null,
    sbomSha256: app.sbomSha256 || null,
    testReportSha256: app.testReportSha256 || null,
    ownershipEvidenceCount: ownership.evidenceCount,
    signedAttestationCount: attestations.attestationCount,
    assuranceTier: assurance.tier,
    sections,
    reportReady,
    releaseEligible: reportReady,
    blockers,
    reportSignatureRequired: true,
    transparencyPublicationRequired: true,
    statement: reportReady
      ? 'All mandatory evidence is complete and bound to this exact APK digest.'
      : 'This release is not ready. Missing or failed evidence remains.'
  });
}

export function validateSignedReport(report = {}) {
  const errors = [];
  if (!report.reportReady || !report.releaseEligible) errors.push('report:not-release-eligible');
  if (!report.reportId || String(report.reportId).length < 16) errors.push('report:id-required');
  if (!report.generatedAt || Number.isNaN(Date.parse(report.generatedAt))) errors.push('report:generated-at-required');
  if (!SHA256.test(report.apkSha256 || '')) errors.push('report:apk-digest-required');
  if (!SHA256.test(report.reportSha256 || '')) errors.push('report:self-digest-required');
  if (!report.reportSignature || String(report.reportSignature).length < 64) errors.push('report:signature-required');
  if (!report.reportSigningKeyId || String(report.reportSigningKeyId).length < 12) errors.push('report:signing-key-id-required');
  if (report.signatureVerification !== 'passed') errors.push('report:signature-not-verified');
  if (report.transparencyInclusion !== 'verified') errors.push('report:transparency-inclusion-required');
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
