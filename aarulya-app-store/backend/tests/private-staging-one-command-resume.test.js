import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const path = fileURLToPath(new URL('../../deploy/resume-private-store-and-db.sh', import.meta.url));

test('one-command recovery retains rootless, loopback and exact-image constraints', async () => {
  const s = await readFile(path, 'utf8');
  execFileSync('bash', ['-n', path], {stdio:'pipe'});
  assert.match(s, /Rootless|rootless-podman-required/i);
  assert.match(s, /expected_image=.*AARULYA_STORE_STAGING_BACKEND_IMAGE/);
  assert.match(s, /preview-image-mismatch/);
  assert.match(s, /preview-exposure-mismatch/);
  assert.match(s, /preview-network-mismatch/);
  assert.match(s, /store-preview-host-filter-failed/);
  assert.match(s, /store-preview-restart-failed/);
  assert.match(s, /store-loopback-port-in-use/);
  assert.match(s, /STORE_PRIVATE_PREVIEW=PASS/);
  assert.doesNotMatch(s, /podman rm|podman volume rm|podman secret rm|docker exec|sudo |--publish|--privileged|--network=host|systemctl/);
});

test('one-command recovery chooses created-only DB recovery without deleting old data', async () => {
  const s = await readFile(path, 'utf8');
  assert.match(s, /case "\$db_state" in[\s\S]*running\)[\s\S]*created\)/);
  assert.match(s, /bash "\$BASE_DIR\/recover-created-private-postgres.sh"/);
  assert.match(s, /bash "\$BASE_DIR\/start-private-postgres.sh"/);
  assert.match(s, /partial-db-resources-without-container-require-manual-review/);
  assert.match(s, /stopped-db-needs-manual-review-do-not-remove-volume/);
  assert.match(s, /DATABASE_HOST_PORTS=NONE/);
  assert.match(s, /CLOUD_MANAGED_STAGING_ACCEPTANCE=false/);
  assert.match(s, /PUBLIC_DNS_CHANGED=false/);
  assert.match(s, /PRODUCTION_MUTATION=NONE/);
  assert.doesNotMatch(s, /POSTGRES_PASSWORD=[^_]|--publish|podman rm|podman secret rm|podman volume rm/);
});
