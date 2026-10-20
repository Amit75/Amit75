const SHA256 = /^[a-f0-9]{64}$/i;
const COMMIT_SHA = /^[a-f0-9]{40,64}$/i;
const PACKAGE_ID = /^com\.aarulya(?:\.[a-z][a-z0-9_]*){1,}$/;
const HTTPS = /^https:\/\//i;

export const REQUIRED_OWNERSHIP_EVIDENCE = Object.freeze([
  'source-origin',
  'repository-history',
  'package-namespace',
  'signing-identity-ownership',
  'asset-origin-manifest',
  'third-party-license-inventory',
  'name-and-trademark-review',
  'contributor-rights-assignment',
  'build-provenance',
  'copyright-review'
]);

export const OWNERSHIP_POLICY = Object.freeze({
  publisher: 'Aarulya',
  packageNamespace: 'com.aarulya',
  importedApkAllowed: false,
  copiedSourceAllowed: false,
  copiedVisualAssetsAllowed: false,
  unknownLicenseAllowed: false,
  unapprovedGeneratedAssetAllowed: false,
  unsignedEvidenceAllowed: false,
  evidenceBoundToApkDigest: true,
  completeAssetInventoryRequired: true,
  contributorRightsRequired: true
});

function unique(values) {
  return [...new Set(values)];
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateEvidenceItem(item, expectedApkDigest, now) {
  const errors = [];
  if (!item || typeof item !== 'object') return ['ownership:evidence-object-required'];
  if (!REQUIRED_OWNERSHIP_EVIDENCE.includes(item.type)) errors.push('ownership:evidence-type-not-allowed');
  if (!SHA256.test(item.subjectApkSha256 || '')) errors.push(`ownership:${item.type || 'unknown'}:apk-digest-required`);
  if (expectedApkDigest && item.subjectApkSha256?.toLowerCase() !== expectedApkDigest.toLowerCase()) {
    errors.push(`ownership:${item.type || 'unknown'}:apk-digest-mismatch`);
  }
  if (!item.issuerId || String(item.issuerId).length < 8) errors.push(`ownership:${item.type || 'unknown'}:issuer-required`);
  if (!item.issuerRole || String(item.issuerRole).length < 4) errors.push(`ownership:${item.type || 'unknown'}:issuer-role-required`);
  if (!item.keyId || String(item.keyId).length < 12) errors.push(`ownership:${item.type || 'unknown'}:signing-key-required`);
  if (!HTTPS.test(item.evidenceUrl || '')) errors.push(`ownership:${item.type || 'unknown'}:evidence-url-required`);
  if (!SHA256.test(item.evidenceSha256 || '')) errors.push(`ownership:${item.type || 'unknown'}:evidence-digest-required`);
  if (!validDate(item.issuedAt)) errors.push(`ownership:${item.type || 'unknown'}:issued-at-required`);
  if (!validDate(item.expiresAt)) errors.push(`ownership:${item.type || 'unknown'}:expiry-required`);
  if (item.signatureVerification !== 'passed') errors.push(`ownership:${item.type || 'unknown'}:signature-not-verified`);
  if (item.result !== 'passed') errors.push(`ownership:${item.type || 'unknown'}:result-not-passed`);

  const issuedAt = Date.parse(item.issuedAt || '');
  const expiresAt = Date.parse(item.expiresAt || '');
  if (Number.isFinite(issuedAt) && issuedAt > now + 300000) errors.push(`ownership:${item.type || 'unknown'}:issued-in-future`);
  if (Number.isFinite(expiresAt) && expiresAt <= now) errors.push(`ownership:${item.type || 'unknown'}:evidence-expired`);
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt) && expiresAt <= issuedAt) {
    errors.push(`ownership:${item.type || 'unknown'}:invalid-validity-window`);
  }
  return errors;
}

export function evaluateOwnershipEvidence(app = {}) {
  const errors = [];
  const expectedApkDigest = app.sha256 || app.apkSha256 || '';
  const evidence = Array.isArray(app.ownershipEvidence) ? app.ownershipEvidence : [];
  const now = Date.now();

  if (app.publisher !== OWNERSHIP_POLICY.publisher) errors.push('ownership:publisher-must-be-aarulya');
  if (!PACKAGE_ID.test(app.packageId || '')) errors.push('ownership:aarulya-package-namespace-required');
  if (app.sourceOwnership !== 'aarulya-owned') errors.push('ownership:source-must-be-aarulya-owned');
  if (app.importedOrResignedApk === true) errors.push('ownership:imported-or-resigned-apk-prohibited');
  if (app.copiedSourceDetected === true) errors.push('ownership:copied-source-detected');
  if (app.copiedAssetDetected === true) errors.push('ownership:copied-asset-detected');
  if (app.unknownLicenseCount > 0) errors.push('ownership:unknown-license-present');
  if (app.unapprovedGeneratedAssetCount > 0) errors.push('ownership:unapproved-generated-asset-present');
  if (!COMMIT_SHA.test(app.sourceCommitSha || '')) errors.push('ownership:source-commit-required');
  if (!SHA256.test(app.sourceArchiveSha256 || '')) errors.push('ownership:source-archive-digest-required');
  if (!SHA256.test(app.assetManifestSha256 || '')) errors.push('ownership:asset-manifest-digest-required');
  if (!SHA256.test(app.sbomSha256 || '')) errors.push('ownership:sbom-digest-required');
  if (!SHA256.test(expectedApkDigest)) errors.push('ownership:apk-digest-required');
  if (app.assetInventoryComplete !== true) errors.push('ownership:complete-asset-inventory-required');
  if (app.allContributorsRightsCleared !== true) errors.push('ownership:contributor-rights-not-cleared');
  if (app.thirdPartyComponentsApproved !== true) errors.push('ownership:third-party-components-not-approved');
  if (app.nameTrademarkReview !== 'passed') errors.push('ownership:name-trademark-review-required');

  evidence.forEach((item) => errors.push(...validateEvidenceItem(item, expectedApkDigest, now)));
  const passedTypes = new Set(evidence.filter((item) => item?.result === 'passed').map((item) => item.type));
  REQUIRED_OWNERSHIP_EVIDENCE.forEach((type) => {
    if (!passedTypes.has(type)) errors.push(`ownership:missing-evidence:${type}`);
  });

  const evidenceDigests = evidence.map((item) => item?.evidenceSha256).filter(Boolean);
  if (new Set(evidenceDigests).size !== evidenceDigests.length) errors.push('ownership:duplicate-evidence-digest');

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(unique(errors)),
    requiredTypes: REQUIRED_OWNERSHIP_EVIDENCE,
    presentTypes: Object.freeze([...passedTypes]),
    evidenceCount: evidence.length
  });
}
