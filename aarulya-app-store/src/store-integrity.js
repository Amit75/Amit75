const SHA256 = /^[a-f0-9]{64}$/i;
const FINGERPRINT = /^[a-f0-9:]{32,}$/i;
const HTTPS = /^https:\/\//i;

export const STORE_INTEGRITY_MODE = Object.freeze({
  unsignedCatalogAllowed: false,
  unsignedReleaseManifestAllowed: false,
  signerChangeAllowedWithoutRecovery: false,
  downgradeAllowed: false,
  revokedReleaseInstallAllowed: false,
  hashMismatchInstallAllowed: false
});

export function validateCatalogManifest(manifest = {}) {
  const errors = [];
  if (!manifest.catalogVersion || !Number.isInteger(manifest.catalogVersion)) errors.push('catalog-version-required');
  if (!manifest.generatedAt || Number.isNaN(Date.parse(manifest.generatedAt))) errors.push('catalog-generated-at-required');
  if (!manifest.expiresAt || Number.isNaN(Date.parse(manifest.expiresAt))) errors.push('catalog-expiry-required');
  if (!SHA256.test(manifest.payloadSha256 || '')) errors.push('catalog-payload-hash-required');
  if (!manifest.signature || manifest.signature.length < 64) errors.push('catalog-signature-required');
  if (!manifest.signingKeyId || manifest.signingKeyId.length < 12) errors.push('catalog-signing-key-id-required');
  if (manifest.publisher !== 'Aarulya') errors.push('catalog-publisher-mismatch');
  if (manifest.signatureVerification !== 'passed') errors.push('catalog-signature-not-verified');
  if (manifest.transparencyRecord !== 'verified') errors.push('catalog-transparency-record-required');

  const expires = Date.parse(manifest.expiresAt || '');
  if (Number.isFinite(expires) && expires <= Date.now()) errors.push('catalog-manifest-expired');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateReleaseManifest(release = {}) {
  const errors = [];
  if (!release.packageId) errors.push('package-id-required');
  if (!Number.isInteger(release.versionCode) || release.versionCode <= 0) errors.push('version-code-required');
  if (!HTTPS.test(release.apkUrl || '')) errors.push('https-apk-url-required');
  if (!SHA256.test(release.apkSha256 || release.sha256 || '')) errors.push('apk-sha256-required');
  if (!FINGERPRINT.test(release.signerFingerprint || '')) errors.push('signer-fingerprint-required');
  if (!release.signingKeyId || release.signingKeyId.length < 12) errors.push('signing-key-id-required');
  if (release.publisher !== 'Aarulya') errors.push('release-publisher-mismatch');
  if (release.manifestSignatureVerification !== 'passed') errors.push('release-manifest-signature-not-verified');
  if (release.revoked === true) errors.push('release-revoked');
  if (release.malwareScan !== 'passed') errors.push('release-malware-scan-not-passed');
  if (release.securityReview !== 'passed') errors.push('release-security-review-not-passed');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function verifyInstallCandidate({ installed = null, candidate = {}, downloadedSha256 = '', catalogManifest = {} } = {}) {
  const errors = [];
  const catalog = validateCatalogManifest(catalogManifest);
  const release = validateReleaseManifest(candidate);
  errors.push(...catalog.errors, ...release.errors);

  const expectedHash = candidate.apkSha256 || candidate.sha256 || '';
  if (!SHA256.test(downloadedSha256) || downloadedSha256.toLowerCase() !== expectedHash.toLowerCase()) {
    errors.push('downloaded-apk-hash-mismatch');
  }

  if (installed) {
    if (installed.packageId !== candidate.packageId) errors.push('package-id-mismatch');
    if (installed.publisher !== candidate.publisher) errors.push('publisher-mismatch');
    if (installed.signingKeyId !== candidate.signingKeyId) errors.push('signing-key-id-mismatch');
    if (installed.signerFingerprint !== candidate.signerFingerprint) errors.push('signer-fingerprint-mismatch');
    if (candidate.versionCode <= installed.versionCode) errors.push('downgrade-or-same-version-prohibited');
  }

  if (candidate.minimumStoreVersionCode && candidate.currentStoreVersionCode < candidate.minimumStoreVersionCode) {
    errors.push('store-version-too-old');
  }

  return Object.freeze({ allowed: errors.length === 0, errors: Object.freeze([...new Set(errors)]) });
}

export function canServeDownload({ release = {}, globalKillSwitch = false, packageKillSwitch = false } = {}) {
  if (globalKillSwitch) return { allowed: false, reason: 'global-download-kill-switch-active' };
  if (packageKillSwitch) return { allowed: false, reason: 'package-download-kill-switch-active' };
  if (release.revoked === true) return { allowed: false, reason: 'release-revoked' };
  const validation = validateReleaseManifest(release);
  return validation.valid
    ? { allowed: true, reason: 'verified-release' }
    : { allowed: false, reason: 'release-integrity-failed', details: validation.errors };
}
