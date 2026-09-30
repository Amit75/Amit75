import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOwnershipEvidence } from '../../src/ownership-evidence.js';
import { evaluateMobileHardening } from '../../src/mobile-hardening.js';
import { buildReleaseEvidenceReport } from '../../src/release-evidence-report.js';

const DIGEST = 'a'.repeat(64);

function ownershipEvidence(type) {
  return {
    type,
    subjectApkSha256: DIGEST,
    issuerId: `issuer-${type}`,
    issuerRole: 'independent-reviewer',
    keyId: `key-${type}-123456`,
    evidenceUrl: `https://evidence.aarulya.example/${type}`,
    evidenceSha256: Buffer.from(type).toString('hex').padEnd(64, '0').slice(0, 64),
    issuedAt: new Date(Date.now() - 60_000).toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    signatureVerification: 'passed',
    result: 'passed'
  };
}

const ownershipTypes = [
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
];

test('ownership gate rejects copied or re-signed APKs', () => {
  const result = evaluateOwnershipEvidence({
    publisher: 'Aarulya',
    packageId: 'com.aarulya.photoeditor',
    sourceOwnership: 'aarulya-owned',
    importedOrResignedApk: true,
    copiedSourceDetected: false,
    copiedAssetDetected: false,
    unknownLicenseCount: 0,
    unapprovedGeneratedAssetCount: 0,
    sourceCommitSha: 'b'.repeat(40),
    sourceArchiveSha256: 'c'.repeat(64),
    assetManifestSha256: 'd'.repeat(64),
    sbomSha256: 'e'.repeat(64),
    sha256: DIGEST,
    assetInventoryComplete: true,
    allContributorsRightsCleared: true,
    thirdPartyComponentsApproved: true,
    nameTrademarkReview: 'passed',
    ownershipEvidence: ownershipTypes.map(ownershipEvidence)
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('ownership:imported-or-resigned-apk-prohibited'));
});

test('APK hardening rejects debug build and embedded production secrets', () => {
  const result = evaluateMobileHardening({
    releaseBuild: false,
    debuggable: true,
    testOnly: false,
    cleartextTrafficAllowed: false,
    embeddedProductionSecretCount: 2,
    unsafeExportedComponentCount: 0,
    unsafeWebViewBridgeCount: 0,
    untrustedDynamicCodeLoading: false,
    sensitiveBackupEnabled: false,
    clientAuthoritativeSecurityDecision: false,
    clientCalculatedPrivilegedResult: false,
    mobileHardeningEvidence: {}
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('apk-hardening:release-build-required'));
  assert.ok(result.errors.includes('apk-hardening:debuggable-must-be-false'));
  assert.ok(result.errors.includes('apk-hardening:embedded-production-secrets-prohibited'));
});

test('final evidence report stays blocked without executed tests and frozen evidence', () => {
  const report = buildReleaseEvidenceReport({
    id: 'photo-editor',
    name: 'Aarulya Photo Editor',
    publisher: 'Aarulya',
    packageId: 'com.aarulya.photoeditor',
    versionName: '1.0.0',
    versionCode: 1,
    sha256: DIGEST,
    testExecutionStatus: 'not-run',
    reportEvidenceFrozen: false,
    releaseDecision: 'pending'
  });
  assert.equal(report.reportReady, false);
  assert.equal(report.releaseEligible, false);
  assert.ok(report.blockers.length > 0);
});
