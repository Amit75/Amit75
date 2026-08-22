import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicationService } from '../src/publication-service.js';

const NOW = 1_800_000_000_000;
const NOW_SECONDS = Math.floor(NOW / 1000);

function identity(overrides = {}) {
  return {
    actorId: '00000000-0000-4000-8000-000000000001',
    externalSubject: 'owner-subject-0001',
    authorizedOwner: true,
    roles: ['owner'],
    scopes: ['store:release:publish'],
    stepUpVerified: true,
    sessionId: 'owner-session-0001',
    tokenId: 'owner-token-0001',
    authenticationTime: NOW_SECONDS - 60,
    issuedAt: NOW_SECONDS - 30,
    expiresAt: NOW_SECONDS + 300,
    ...overrides
  };
}

function service() {
  const calls = [];
  return {
    calls,
    publication: createPublicationService({
      now: () => NOW,
      publicationRepository: {
        async publish(input) {
          calls.push(input);
          return { publicationReceiptId: 'receipt-0001' };
        }
      }
    })
  };
}

test('publishes only with recent owner step-up and bound token', async () => {
  const fixture = service();
  const result = await fixture.publication.publish(identity(), {
    appId: 'aarulya-store',
    versionCode: 1,
    requestId: 'publication-request-0001',
    reason: 'Privately verified first-party Store release.'
  });
  assert.equal(result.publicationReceiptId, 'receipt-0001');
  assert.equal(fixture.calls.length, 1);
  assert.equal(fixture.calls[0].actorSubject, 'owner-subject-0001');
});

test('rejects stale or missing step-up authentication', async () => {
  const fixture = service();
  await assert.rejects(
    fixture.publication.publish(identity({ authenticationTime: NOW_SECONDS - 301 }), {}),
    (error) => error.code === 'recent-owner-step-up-required'
  );
  await assert.rejects(
    fixture.publication.publish(identity({ authenticationTime: null }), {}),
    (error) => error.code === 'recent-owner-step-up-required'
  );
  assert.equal(fixture.calls.length, 0);
});

test('rejects token not bound to step-up or expiring too soon', async () => {
  const fixture = service();
  await assert.rejects(
    fixture.publication.publish(identity({ issuedAt: NOW_SECONDS - 120 }), {}),
    (error) => error.code === 'publication-token-binding-invalid'
  );
  await assert.rejects(
    fixture.publication.publish(identity({ expiresAt: NOW_SECONDS + 20 }), {}),
    (error) => error.code === 'publication-token-expiring-too-soon'
  );
  assert.equal(fixture.calls.length, 0);
});
