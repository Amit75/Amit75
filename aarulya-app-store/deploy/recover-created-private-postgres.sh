#!/usr/bin/env bash
# Recover only the unstarted, failed Aaru Store staging PostgreSQL container.
# Preserve the existing private data volume and secret; no Cloud/production changes.
set -Eeuo pipefail
umask 077

DB=aarulya-store-private-db
VOL=aarulya-store-private-db-data
SECRET=aarulya-store-private-postgres-password
NET=aarulya-store-private-preview-v1
PREVIEW=aarulya-store-private-preview-edge
BASE=/home/admin1/.local/share/aarulya-store-staging
PASSFILE="$BASE/secrets/postgres-password"
IMAGE="docker.io/library/postgres:17.10-bookworm@sha256:9b18b78397054fce88a9552e9d5a3ad5bb7fd258c5b3cc1c5028e46373d6ea8f"
DB_NAME=aarulya_store_staging
DB_USER=aarulya_store_staging
PHASE=preflight

fail() { printf 'STORE_DB_RECOVERY=BLOCKED\nREASON=%s\n' "$1" >&2; exit 2; }
finish() {
  rc=$?
  printf 'FINAL_EXIT_CODE=%s\nLAST_PHASE=%s\nPRODUCTION_MUTATION=NONE\n' "$rc" "$PHASE"
}
trap finish EXIT

for cmd in podman python3 curl grep timeout sleep stat; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing-command:$cmd"
done

[[ "$(id -un)" == admin1 && "$(id -u)" -ne 0 ]] || fail "rootless-admin1-required"
[[ "$(podman info --format '{{.Host.Security.Rootless}}')" == true ]] || fail "rootless-podman-required"
podman container exists "$DB" || fail "failed-db-container-not-found"
podman volume exists "$VOL" || fail "private-db-volume-missing"
podman secret exists "$SECRET" || fail "private-db-secret-missing"
[[ -f "$PASSFILE" && ! -L "$PASSFILE" ]] || fail "secret-file-missing-or-symlink"
[[ "$(stat -c %a "$PASSFILE")" == 600 ]] || fail "secret-file-permissions-invalid"
[[ "$(stat -c %a "$BASE/secrets")" == 700 ]] || fail "secret-directory-permissions-invalid"
[[ "$(podman inspect "$PREVIEW" --format '{{.State.Running}}' 2>/dev/null)" == true ]] \
  || fail "private-preview-not-running"
[[ "$(podman network inspect "$NET" --format '{{.Internal}}' 2>/dev/null)" == true ]] \
  || fail "private-network-not-internal"
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:18940/health \
  | grep -q '"service":"aarulya-store-cloud-staging-edge"' \
  || fail "private-preview-unhealthy"

podman inspect "$DB" | python3 -c '
import json, sys
x=json.load(sys.stdin)[0]
c=x.get("Config") or {}
h=x.get("HostConfig") or {}
s=x.get("State") or {}
n=x.get("NetworkSettings") or {}
m=x.get("Mounts") or []
e=c.get("Env") or []
def require(value, label):
    if not value: raise SystemExit("BLOCKED="+label)
require(s.get("Status")=="created" and not s.get("Running"), "db-not-in-created-state")
require(c.get("User")=="999:999", "unexpected-db-user")
require(h.get("ReadonlyRootfs") is True, "db-rootfs-not-readonly")
require(not h.get("PortBindings"), "db-port-mapped-to-host")
require("aarulya-store-private-preview-v1" in (n.get("Networks") or {}), "db-not-on-private-network")
require(any(z.get("Name")=="aarulya-store-private-db-data" and z.get("Destination")=="/var/lib/postgresql/data" for z in m), "db-volume-mismatch")
require("POSTGRES_DB=aarulya_store_staging" in e, "wrong-db-name")
require("POSTGRES_USER=aarulya_store_staging" in e, "wrong-db-user")
require(not any(z.startswith("POSTGRES_PASSWORD=") for z in e), "inline-db-secret-found")
print("FAILED_CONTAINER_IDENTITY=PASS")
'

old_id="$(podman inspect "$DB" --format '{{.Image}}' | sed 's/^sha256://')"
image_id="$(podman image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null | sed 's/^sha256://')"
[[ -n "$image_id" && "$old_id" == "$image_id" ]] || fail "db-image-identity-mismatch"

PHASE=verify-volume
# Fail closed when the volume contains *any* data.
timeout 60 podman run --rm --pull=never --network=none \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --user 999:999 \
  --volume "$VOL:/var/lib/postgresql/data:ro" \
  --entrypoint /bin/sh "$IMAGE" \
  -ec 'test -z "$(ls -A /var/lib/postgresql/data)"' \
  || fail "existing-staging-volume-is-not-empty"
echo "UNINITIALIZED_VOLUME=PASS"

PHASE=smoke-secret-mount
# Validate read-only secret support in a disposable, network-disabled container.
timeout 60 podman run --rm --pull=never --network=none \
  --read-only --cap-drop=ALL --security-opt=no-new-privileges \
  --user 999:999 \
  --tmpfs /run/secrets:rw,nosuid,nodev,noexec,mode=0755,size=1m \
  --secret "$SECRET,type=mount,target=/run/secrets/postgres-password,uid=999,gid=999,mode=0400" \
  --entrypoint /bin/sh "$IMAGE" \
  -ec 'test -s /run/secrets/postgres-password && test -r /run/secrets/postgres-password' \
  || fail "secret-mount-smoke-blocked-original-preserved"
echo "SECRET_READONLY_MOUNT_SMOKE=PASS"

PHASE=replace-only-failed-created-container
# Remove metadata of this verified, never-started DB container only.
# Never remove the named volume, secret, or password file.
podman rm "$DB" >/dev/null
echo "FAILED_CREATED_CONTAINER_REPLACED=true"
echo "ORIGINAL_VOLUME_AND_SECRET_PRESERVED=true"

PHASE=launch-staging-postgresql
timeout 120 podman run --detach --pull=never \
  --name "$DB" \
  --network "$NET" \
  --network-alias aarulya-store-staging-db \
  --restart=no \
  --read-only --user 999:999 \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,mode=1777,size=32m \
  --tmpfs /run/secrets:rw,nosuid,nodev,noexec,mode=0755,size=1m \
  --cap-drop=ALL --security-opt=no-new-privileges \
  --pids-limit=128 --memory=1024m --cpus=1 \
  --env "POSTGRES_USER=$DB_USER" \
  --env "POSTGRES_DB=$DB_NAME" \
  --env "POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password" \
  --env "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256" \
  --secret "$SECRET,type=mount,target=/run/secrets/postgres-password,uid=999,gid=999,mode=0400" \
  --volume "$VOL:/var/lib/postgresql/data:U" \
  "$IMAGE" >/dev/null

PHASE=verify-postgresql
[[ -z "$(podman port "$DB")" ]] || fail "database-host-port-present"
[[ "$(podman inspect "$DB" --format '{{.State.Running}}')" == true ]] || fail "database-not-running"
READY=false
for i in {1..60}; do
  if podman exec "$DB" pg_isready -q -U "$DB_USER" -d "$DB_NAME" 2>/dev/null; then
    READY=true
    break
  fi
  sleep 1
done
[[ "$READY" == true ]] || fail "private-postgres-not-ready"
identity="$(podman exec "$DB" psql -X -qAt -U "$DB_USER" -d "$DB_NAME" -c 'SELECT current_database()')"
[[ "$identity" == "$DB_NAME" ]] || fail "database-identity-invalid"
pgmajor="$(podman exec "$DB" psql -X -qAt -U "$DB_USER" -d "$DB_NAME" -c 'SHOW server_version_num')"
[[ "$pgmajor" == 17* ]] || fail "unexpected-postgres-version"

printf 'AARULYA_STORE_PRIVATE_DB=PASS\n'
printf 'DATABASE_HOST_PORTS=NONE\n'
printf 'DB_MIGRATIONS_EXECUTED=false\n'
printf 'AUTHENTICATED_API_STARTED=false\n'
printf 'CLOUD_MANAGED_STAGING_ACCEPTANCE=false\n'
printf 'PUBLIC_RELEASE=false\n'
