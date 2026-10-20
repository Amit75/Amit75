import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const deploymentScript = new URL('../../deploy/start-private-postgres.sh', import.meta.url);

test('Postgres tmpfs options are Podman-compatible without uid/gid overrides', async () => {
  const script = await readFile(deploymentScript, 'utf8');
  const mounts = script.split('\n').filter((line) => line.includes('--tmpfs '));
  assert.equal(mounts.length, 3, 'expected /tmp, PostgreSQL socket and secret-mount tmpfs');
  assert.ok(mounts.some((line) => line.includes('/run/secrets:rw,nosuid,nodev,noexec,mode=0755,size=1m')), 'read-only rootfs requires writable secret mountpoint');
  assert.ok(mounts.some((line) => line.includes('/var/run/postgresql:')));
  for (const line of mounts) {
    assert.doesNotMatch(line, /(?:[:,])(?:uid|gid)=\d+/, 'Podman tmpfs cannot use uid/gid mount overrides');
  }
  assert.match(script, /--tmpfs \/var\/run\/postgresql:rw,nosuid,nodev,mode=1777,size=32m/);
  assert.match(script, /--user 999:999/);
  assert.match(script, /--secret "\$DB_SECRET,type=mount,target=\/run\/secrets\/postgres-password,uid=999,gid=999,mode=0400"/);
});

test('database staging remains private, isolated and fail closed', async () => {
  const script = await readFile(deploymentScript, 'utf8');
  assert.match(script, /podman network inspect "\$NETWORK"/);
  assert.match(script, /--network "\$NETWORK"/);
  assert.match(script, /--read-only/);
  assert.match(script, /--cap-drop=ALL/);
  assert.match(script, /--security-opt=no-new-privileges/);
  assert.match(script, /--pull=never/);
  assert.match(script, /--auth-host=scram-sha-256/);
  assert.match(script, /database-port-published/);
  assert.doesNotMatch(script, /--publish\b|(?:^|\s)-p\s+\d+:/m);
  assert.doesNotMatch(script, /--privileged|--network[ =]host/);
  assert.match(script, /STAGING_PARTIAL_RESOURCES_PRESERVED=true/);
  assert.match(script, /MANUAL_REVIEW_REQUIRED=true/);
});
