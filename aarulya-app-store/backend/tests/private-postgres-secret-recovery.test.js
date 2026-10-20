import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const startPath = fileURLToPath(new URL('../../deploy/start-private-postgres.sh', import.meta.url));
const recoveryPath = fileURLToPath(new URL('../../deploy/recover-created-private-postgres.sh', import.meta.url));

test('staging Postgres mounts secrets under a writable isolated tmpfs, not inline env', async () => {
  const s = await readFile(startPath, 'utf8');
  assert.match(s, /--read-only/);
  assert.match(s, /--tmpfs \/run\/secrets:rw,nosuid,nodev,noexec,mode=0755,size=1m/);
  assert.match(s, /--secret "\$DB_SECRET,type=mount,target=\/run\/secrets\/postgres-password,uid=999,gid=999,mode=0400"/);
  assert.match(s, /POSTGRES_PASSWORD_FILE=\/run\/secrets\/postgres-password/);
  assert.doesNotMatch(s, /--publish|--privileged|docker exec|docker compose/);
  execFileSync('bash', ['-n', startPath], { stdio: 'pipe' });
});

test('recovery rejects initialized data and validates readonly secret before container removal', async () => {
  const s = await readFile(recoveryPath, 'utf8');
  assert.match(s, /s\.get\("Status"\)=="created"/);
  assert.match(s, /UNINITIALIZED_VOLUME=PASS/);
  assert.match(s, /-ec 'test -z "\$\(ls -A \/var\/lib\/postgresql\/data\)"/);
  assert.match(s, /SECRET_READONLY_MOUNT_SMOKE=PASS/);
  assert.match(s, /--tmpfs \/run\/secrets:rw,nosuid,nodev,noexec,mode=0755,size=1m/);
  assert.ok(s.indexOf('echo "SECRET_READONLY_MOUNT_SMOKE=PASS"') < s.indexOf('podman rm "$DB"'));
  assert.match(s, /podman rm "\$DB"/);
  assert.doesNotMatch(s, /podman volume rm|podman secret rm|rm -f "\$PASSFILE"|--publish|--privileged/);
  execFileSync('bash', ['-n', recoveryPath], { stdio: 'pipe' });
});

test('recovery does not claim full staging or production readiness', async () => {
  const s = await readFile(recoveryPath, 'utf8');
  assert.match(s, /DB_MIGRATIONS_EXECUTED=false/);
  assert.match(s, /AUTHENTICATED_API_STARTED=false/);
  assert.match(s, /CLOUD_MANAGED_STAGING_ACCEPTANCE=false/);
  assert.match(s, /PUBLIC_RELEASE=false/);
  assert.match(s, /PRODUCTION_MUTATION=NONE/);
});
