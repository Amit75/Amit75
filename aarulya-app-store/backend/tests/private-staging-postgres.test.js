import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = new URL('../../deploy/start-private-postgres.sh', import.meta.url);
const getScript = () => readFile(source, 'utf8');

test('private staging postgres cannot connect to Cloud or expose host ports', async () => {
  const s = await getScript();
  assert.match(s, /podman network exists "\$NETWORK"/);
  assert.match(s, /podman network inspect "\$NETWORK" --format '\{\{\.Internal\}\}'/);
  assert.match(s, /podman container exists "\$PREVIEW"/);
  assert.match(s, /--network "\$NETWORK"/);
  assert.match(s, /--network-alias "aarulya-store-staging-db"/);
  assert.match(s, /database-port-published/);
  assert.doesNotMatch(s, /--publish|--network[ =]host|--privileged|docker exec|docker compose|cloud-nonprod-postgres/);
});

test('private database image and password are isolated, pinned and least privileged', async () => {
  const s = await getScript();
  assert.match(s, /postgres:17\.10-bookworm@sha256:[a-f0-9]{64}/);
  assert.match(s, /--pull=never/);
  assert.match(s, /--user 999:999/);
  assert.match(s, /--cap-drop=ALL/);
  assert.match(s, /--read-only/);
  assert.match(s, /--security-opt=no-new-privileges/);
  assert.match(s, /--auth-host=scram-sha-256/);
  assert.match(s, /openssl rand -hex 32 > "\$PASSWORD_FILE"/);
  assert.match(s, /chmod 600 "\$PASSWORD_FILE"/);
  assert.match(s, /podman secret create "\$DB_SECRET" "\$PASSWORD_FILE"/);
  assert.match(s, /--secret "\$DB_SECRET,type=mount,target=\/run\/secrets\/postgres-password,uid=999,gid=999,mode=0400"/);
  assert.doesNotMatch(s, /--mount "type=bind,src=\$PASSWORD_FILE/);
  assert.match(s, /--volume "\$DB_VOLUME:\/var\/lib\/postgresql\/data:U"/);
  assert.doesNotMatch(s, /POSTGRES_PASSWORD=[^_]|\btrust\b|--env-file/);
});

test('private DB startup fails closed and disclaims migration or production acceptance', async () => {
  const s = await getScript();
  assert.match(s, /database-container-already-exists/);
  assert.match(s, /database-volume-already-exists/);
  assert.match(s, /database-password-file-already-exists/);
  assert.match(s, /CREATED_VOLUME/);
  assert.match(s, /CREATED_SECRET/);
  assert.match(s, /database-podman-secret-already-exists/);
  assert.match(s, /CREATED_CONTAINER/);
  assert.match(s, /CREATED_PASSWORD/);
  assert.match(s, /staging-postgres-not-ready/);
  assert.match(s, /DB_MIGRATIONS_EXECUTED=false/);
  assert.match(s, /STORE_AUTHENTICATED_API_STARTED=false/);
  assert.match(s, /CLOUD_MANAGED_STAGING_ACCEPTANCE=false/);
  assert.match(s, /PRODUCTION_MUTATION=NONE/);
});
