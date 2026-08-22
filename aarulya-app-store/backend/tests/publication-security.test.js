import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createPublicationService } from '../src/publication-service.js';

function ownerIdentity(overrides = {}) {
  return {
    actorId: '00000000-0000-4000-8000-000000000001',
    externalSubject: 'owner@aarulya.com',
    sessionId: 'session-00000001',
    tokenId: 'token-00000001',
    roles: ['owner'],
    scopes: ['store:release:publish'],
    authorizedOwner: true,
    stepUpVerified: true,
    ...overrides
  };
}

function service() {
  const calls = [];
  return {
    calls,
    value: createPublicationService({
      publicationRepository: {
        async publish(input) {
          calls.push(input);
          return { publicationReceiptId: 'receipt-1', ...input };
        }
      }
    })
  };
}

test('release publication rejects a non-owner identity', async () => {
  const { value } = service();
  await assert.rejects(
    value.publish(ownerIdentity({ roles: [], authorizedOwner: false }), {
      appId: 'aarulya-store', versionCode: 1, requestId: 'request-000000000001', reason: 'Initial verified private release'
    }),
    (error) => error.code === 'owner-role-required'
  );
});

test('release publication rejects owner without step-up authentication', async () => {
  const { value } = service();
  await assert.rejects(
    value.publish(ownerIdentity({ stepUpVerified: false }), {
      appId: 'aarulya-store', versionCode: 1, requestId: 'request-000000000002', reason: 'Initial verified private release'
    }),
    (error) => error.code === 'owner-step-up-authentication-required'
  );
});

test('release publication rejects owner without narrow publication scope', async () => {
  const { value } = service();
  await assert.rejects(
    value.publish(ownerIdentity({ scopes: ['store:read'] }), {
      appId: 'aarulya-store', versionCode: 1, requestId: 'request-000000000003', reason: 'Initial verified private release'
    }),
    (error) => error.code === 'release-publication-scope-required'
  );
});

test('authorized step-up owner passes only normalized publication fields to repository', async () => {
  const { value, calls } = service();
  await value.publish(ownerIdentity(), {
    appId: 'aarulya-store',
    versionCode: 1,
    requestId: 'request-000000000004',
    reason: 'Initial verified private release',
    privateKey: 'must-never-be-forwarded'
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0]).sort(), [
    'actorSubject', 'appId', 'reason', 'requestId', 'versionCode'
  ]);
  assert.equal('privateKey' in calls[0], false);
});

test('database publication guard requires risk-tier approvals and critical evidence', async () => {
  const sql = await readFile(new URL('../sql/0008_release_approvals_and_risk_tiers.sql', import.meta.url), 'utf8');
  assert.match(sql, /approval_threshold := CASE/);
  assert.match(sql, /WHEN app_risk_tier = 'critical' THEN 3/);
  assert.match(sql, /independent-security-reviewer/);
  assert.match(sql, /independent-penetration-test/);
  assert.match(sql, /red-team-exercise/);
  assert.match(sql, /key-compromise-recovery/);
  assert.match(sql, /disaster-recovery-drill/);
  assert.match(sql, /break-glass-drill/);
});

test('Android release build requires external signing material and pinned trust roots', async () => {
  const build = await readFile(new URL('../../android-store/app/build.gradle.kts', import.meta.url), 'utf8');
  assert.match(build, /AARULYA_ANDROID_SIGNING_STORE_FILE/);
  assert.match(build, /AARULYA_ANDROID_SIGNING_STORE_PASSWORD/);
  assert.match(build, /AARULYA_ANDROID_SIGNING_KEY_ALIAS/);
  assert.match(build, /AARULYA_ANDROID_SIGNING_KEY_PASSWORD/);
  assert.match(build, /signing material must remain outside the repository/);
  assert.match(build, /TRUSTED_RELEASE_KEY_FINGERPRINTS/);
  assert.match(build, /enableV1Signing = false/);
  assert.match(build, /enableV2Signing = true/);
  assert.match(build, /enableV3Signing = true/);
});
