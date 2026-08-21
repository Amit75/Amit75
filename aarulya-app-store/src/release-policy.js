const PUBLISHABLE_STATUSES = new Set(['review', 'published']);
const HTTPS = /^https:\/\//i;
const SHA256 = /^[a-f0-9]{64}$/i;
const PACKAGE_ID = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/;

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
  if (app.childDirected && app.childSafetyReview !== 'passed') errors.push('child-safety-review-not-passed');
  if (!PUBLISHABLE_STATUSES.has(app.status)) errors.push('release-not-in-review-or-published');

  return { valid: errors.length === 0, errors };
}

export function canDownload(app) {
  const validation = validateRelease(app);
  return {
    allowed: app?.status === 'published' && validation.valid,
    reasons: validation.errors
  };
}

export function verifyUpdateCompatibility(installed, candidate) {
  if (!installed || !candidate) return { allowed: false, reason: 'metadata-required' };
  if (installed.packageId !== candidate.packageId) return { allowed: false, reason: 'package-id-mismatch' };
  if (installed.signerFingerprint !== candidate.signerFingerprint) return { allowed: false, reason: 'signer-mismatch' };
  if (candidate.versionCode <= installed.versionCode) return { allowed: false, reason: 'version-not-newer' };
  const validation = validateRelease(candidate);
  if (!validation.valid) return { allowed: false, reason: 'candidate-release-invalid', details: validation.errors };
  return { allowed: true, reason: 'verified-update' };
}
