import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoreService } from '../src/store-service.js';

const APK_SHA = 'a'.repeat(64);
const FINGERPRINT = 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

function release() {
  return {
    packageId: 'com.aarulya.testapp',
    versionCode: 1,
    apkUrl: 'https://objects.aarulya.example/apps/testapp/1.apk',
    apkSha256: APK_SHA,
    signerFingerprint: FINGERPRINT,
    signingKeyId: 'aarulya-key-test-001',
    publisher: 'Aarulya',
    manifestSignatureVerification: 'passed',
    malwareScan: 'passed',
    securityReview: 'passed',
    ownershipEvidenceReview: 'passed',
    mobileHardeningReview: 'passed',
    androidPermissionPrivacyReview: 'passed',
    publicationGateStatus: 'passed',
    finalEvidenceReportSha256: 'e'.repeat(64),
    finalEvidenceReportSignatureVerification: 'passed',
    finalEvidenceReportTransparencyInclusion: 'verified',
    revoked: false
  };
}

function catalogManifest() {
  return {
    catalogVersion: 1,
    generatedAt: '2026-08-21T00:00:00.000Z',
    expiresAt: '2099-08-21T00:00:00.000Z',
    payloadSha256: 'b'.repeat(64),
    signature: 'c'.repeat(128),
    signingKeyId: 'aarulya-catalog-key-001',
    publisher: 'Aarulya',
    signatureVerification: 'passed',
    transparencyRecord: 'verified'
  };
}

function service() {
  let sequence = 0;
  return createStoreService({
    catalog: [{
      id: 'testapp',
      name: 'Test App',
      category: 'Daily Tools',
      description: 'Safe test listing',
      age: 'Everyone',
      packageId: 'com.aarulya.testapp',
      status: 'published',
      publisher: 'Aarulya'
    }],
    now: () => Date.parse('2026-08-21T12:00:00.000Z'),
    issueId: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
    issueSecret: () => `secure-download-token-${String(++sequence).padStart(24, '0')}`
  });
}

const context = Object.freeze({
  actorId: 'user-000000000001',
  requestId: 'request-000000000001'
});

test('catalog returns public fields and supports search', () => {
  const result = service().listCatalog({ query: 'safe', limit: 10 });
  assert.equal(result.total, 1);
  assert.equal(result.apps[0].id, 'testapp');
  assert.equal('apkUrl' in result.apps[0], false);
});

test('download grant is short-lived, actor-bound and single-use', () => {
  const store = service();
  const authorized = store.authorizeDownload(context, {
    release: release(),
    catalogManifest: catalogManifest()
  });
  assert.ok(authorized.token.length >= 24);

  const consumed = store.consumeDownloadGrant(context, authorized.token);
  assert.equal(consumed.actorId, context.actorId);
  assert.equal(consumed.packageId, 'com.aarulya.testapp');
  assert.ok(consumed.consumedAt);

  assert.throws(
    () => store.consumeDownloadGrant(context, authorized.token),
    (error) => error.code === 'download-grant-already-consumed'
  );
});

test('download authorization fails without final evidence', () => {
  const store = service();
  const unsafe = release();
  unsafe.androidPermissionPrivacyReview = 'failed';
  assert.throws(
    () => store.authorizeDownload(context, {
      release: unsafe,
      catalogManifest: catalogManifest()
    }),
    (error) => error.code === 'release-integrity-failed'
  );
});

test('install receipt is created only after catalog, hash and signer verification', () => {
  const store = service();
  const receipt = store.reportInstall(context, {
    candidate: release(),
    downloadedSha256: APK_SHA,
    catalogManifest: catalogManifest(),
    deviceId: 'device-000000000001'
  });
  assert.equal(receipt.apkSha256, APK_SHA);
  assert.equal(receipt.signingKeyId, 'aarulya-key-test-001');

  assert.throws(
    () => store.reportInstall(context, {
      candidate: release(),
      downloadedSha256: 'd'.repeat(64),
      catalogManifest: catalogManifest(),
      deviceId: 'device-000000000001'
    }),
    (error) => error.code === 'install-verification-failed'
  );
});

test('durable jobs are idempotent and keep immutable event history', () => {
  const store = service();
  const input = {
    type: 'photo-resize',
    idempotencyKey: 'idem-0000000000000001',
    payload: { targetKb: 50 },
    maxAttempts: 3
  };
  const first = store.createJob(context, input);
  const duplicate = store.createJob(context, input);
  assert.equal(duplicate.id, first.id);

  const paused = store.transitionJob(context, first.id, 'paused');
  assert.equal(paused.state, 'paused');
  const resumed = store.transitionJob(context, first.id, 'queued');
  assert.equal(resumed.state, 'queued');
  const cancelled = store.transitionJob(context, first.id, 'cancelled');
  assert.equal(cancelled.state, 'cancelled');

  const view = store.getJob(context, first.id);
  assert.equal(view.events.length, 4);
  assert.deepEqual(view.events.map((event) => event.type), [
    'job-created',
    'job-transition',
    'job-transition',
    'job-transition'
  ]);

  assert.throws(
    () => store.transitionJob(context, first.id, 'queued'),
    (error) => error.code === 'job-already-terminal'
  );
});

test('job ownership prevents cross-user access', () => {
  const store = service();
  const job = store.createJob(context, {
    type: 'document-convert',
    idempotencyKey: 'idem-0000000000000002',
    payload: {},
    maxAttempts: 2
  });
  assert.throws(
    () => store.getJob({ actorId: 'other-user', requestId: 'request-000000000002' }, job.id),
    (error) => error.code === 'job-owner-mismatch'
  );
});
