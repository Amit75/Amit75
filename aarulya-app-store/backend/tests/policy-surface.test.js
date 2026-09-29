import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('storefront exposes a fail-closed pre-launch policy pack', () => {
  const index = read('../../index.html');
  for (const path of [
    '/policies/privacy.html',
    '/policies/terms.html',
    '/policies/support.html',
    '/policies/pricing.html'
  ]) {
    assert.ok(index.includes(path), 'missing storefront policy link: ' + path);
  }

  const privacy = read('../../policies/privacy.html');
  const terms = read('../../policies/terms.html');
  const support = read('../../policies/support.html');
  const pricing = read('../../policies/pricing.html');

  for (const page of [privacy, terms, support, pricing]) {
    assert.match(page, /data-policy-state="prelaunch-draft"/);
    assert.match(page, /not an active production policy/i);
    assert.doesNotMatch(page, /<script\b/i);
  }

  assert.match(privacy, /Advertising is disabled for the initial release/i);
  assert.match(privacy, /Analytics are disabled/i);
  assert.match(terms, /Third-party app submissions are disabled/i);
  assert.match(terms, /silent installation is not provided/i);
  assert.match(support, /No contractual SLA is active/i);
  assert.match(pricing, /no live payment collection/i);
});

test('commercial readiness records policy source as partial, never as launch approval', () => {
  const manifest = JSON.parse(read('../../../commercial-readiness/product-readiness.v1.json'));
  assert.equal(manifest.gates.privacyPack, 'PARTIAL');
  assert.equal(manifest.gates.legalTerms, 'PARTIAL');
  assert.equal(manifest.gates.pricingBilling, 'PARTIAL');
  assert.equal(manifest.gates.supportSLA, 'PARTIAL');
  assert.equal(manifest.sourcePolicyPack?.activationState, 'PRELAUNCH_DRAFT');
  assert.equal(manifest.sourcePolicyPack?.requiresLegalReview, true);
  assert.equal(manifest.launchFlags.indiaCommercial, false);
  assert.equal(manifest.launchFlags.internationalCommercial, false);
  assert.equal(manifest.launchFlags.livePayments, false);
  assert.equal(manifest.launchFlags.publicProduction, false);
});
