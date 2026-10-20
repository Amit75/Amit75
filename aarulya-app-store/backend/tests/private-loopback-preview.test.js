import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const src = new URL('../../deploy/start-loopback-private-preview.sh', import.meta.url);
const documentation = new URL('../../docs/LOOPBACK_PRIVATE_PREVIEW.md', import.meta.url);

test('loopback preview pins exact source and image digest', async () => {
  const s = await readFile(src, 'utf8');
  assert.match(s, /EXPECTED_HEAD="a007331b09572bb6932cc4df439102ecd9b8145e"/);
  assert.match(s, /exact-head-mismatch/);
  assert.match(s, /immutable-image-id-mismatch/);
  assert.match(s, /image-revision-mismatch/);
  assert.match(s, /image-record-head-mismatch/);
  assert.match(s, /rootless-podman-required/);
});

test('loopback preview is offline, bounded and cannot replace existing services', async () => {
  const s = await readFile(src, 'utf8');
  assert.match(s, /podman network create --internal/);
  assert.match(s, /--publish "127\.0\.0\.1:\$PORT:8083\/tcp"/);
  assert.match(s, /--pull=never/);
  assert.match(s, /--read-only/);
  assert.match(s, /--cap-drop=ALL/);
  assert.match(s, /--security-opt=no-new-privileges/);
  assert.match(s, /--user 10001:10001/);
  assert.match(s, /preview-container-already-exists-no-implicit-replacement/);
  assert.match(s, /preview-network-already-exists-no-implicit-replacement/);
  assert.doesNotMatch(s, /--privileged|--network[ =]host|--replace|docker compose up|sudo|0\.0\.0\.0:\$PORT:8083/);
});

test('loopback preview fails closed on readiness, cross-host access and records its limits', async () => {
  const s = await readFile(src, 'utf8');
  assert.match(s, /private-preview-health-unavailable/);
  assert.match(s, /storefront-homepage-unavailable/);
  assert.match(s, /foreign-host-not-denied/);
  assert.match(s, /public-port-mapping-detected/);
  assert.match(s, /POSTGRES_STARTED=false/);
  assert.match(s, /AUTHENTICATED_API_STARTED=false/);
  assert.match(s, /CLOUD_MANAGED_STAGING_ACCEPTANCE=false/);
  assert.match(s, /PUBLIC_DNS_CHANGED=false/);
  assert.match(s, /CREATED_CONTAINER/);
  assert.match(s, /CREATED_NETWORK/);
  const doc = await readFile(documentation, 'utf8');
  assert.match(doc, /NOT.*Cloud-managed staging acceptance/i);
  assert.match(doc, /not.*evidence.*authenticated Store API/i);
});
