#!/usr/bin/env bash
# Non-production Aaru Store DB only. Does not connect to AARULYA Cloud's Postgres.
set -Eeuo pipefail
umask 077

BASE="/home/admin1/.local/share/aarulya-store-staging"
SECRET_DIR="$BASE/secrets"
PASSWORD_FILE="$SECRET_DIR/postgres-password"
DB_NAME="aarulya_store_staging"
DB_USER="aarulya_store_staging"
DB_CONTAINER="aarulya-store-private-db"
DB_SECRET="aarulya-store-private-postgres-password"
DB_VOLUME="aarulya-store-private-db-data"
NETWORK="aarulya-store-private-preview-v1"
PREVIEW="aarulya-store-private-preview-edge"
IMAGE="docker.io/library/postgres:17.10-bookworm@sha256:9b18b78397054fce88a9552e9d5a3ad5bb7fd258c5b3cc1c5028e46373d6ea8f"
CREATED_VOLUME=false
CREATED_CONTAINER=false
CREATED_SECRET=false
CREATED_PASSWORD=false
PHASE="preflight"

fail() { printf 'STAGING_DATABASE=BLOCKED\nREASON=%s\n' "$1" >&2; exit 2; }
cleanup() {
  rc=$?
  if ((rc != 0)); then
    # Once Podman has created the DB container, preserve volume/secret and
    # credentials for safe diagnosis; never delete partially initialized data.
    if podman container exists "$DB_CONTAINER" 2>/dev/null; then
      printf 'STAGING_PARTIAL_RESOURCES_PRESERVED=true\n'
      printf 'MANUAL_REVIEW_REQUIRED=true\n'
    else
      if [[ "$CREATED_VOLUME" == true ]]; then
        podman volume rm "$DB_VOLUME" >/dev/null 2>&1 || true
      fi
      if [[ "$CREATED_SECRET" == true ]]; then
        podman secret rm "$DB_SECRET" >/dev/null 2>&1 || true
      fi
      if [[ "$CREATED_PASSWORD" == true ]]; then
        rm -f -- "$PASSWORD_FILE"
      fi
    fi
  fi
  printf 'FINAL_EXIT_CODE=%s\nLAST_PHASE=%s\nPRODUCTION_MUTATION=NONE\n' "$rc" "$PHASE"
}
trap cleanup EXIT

for c in podman openssl timeout install stat grep head; do
  command -v "$c" >/dev/null 2>&1 || fail "missing-command:$c"
done
[[ "$(id -un)" == admin1 && "$(id -u)" != 0 ]] || fail "admin1-rootless-identity-required"
[[ "$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null)" == true ]] || fail "rootless-podman-required"

podman network exists "$NETWORK" || fail "private-network-not-found"
[[ "$(podman network inspect "$NETWORK" --format '{{.Internal}}')" == true ]] || fail "network-not-internal"
podman container exists "$PREVIEW" || fail "store-private-preview-not-found"
[[ "$(podman inspect "$PREVIEW" --format '{{.State.Running}}')" == true ]] || fail "store-private-preview-not-running"

if podman container exists "$DB_CONTAINER"; then fail "database-container-already-exists"; fi
if podman volume exists "$DB_VOLUME"; then fail "database-volume-already-exists"; fi
if podman secret exists "$DB_SECRET"; then fail "database-podman-secret-already-exists"; fi
if [[ -e "$PASSWORD_FILE" ]]; then fail "database-password-file-already-exists"; fi

if [[ -e "$SECRET_DIR" ]]; then
  [[ -d "$SECRET_DIR" && ! -L "$SECRET_DIR" ]] || fail "unsafe-secret-directory"
fi
if [[ -e "$BASE" ]]; then
  [[ -d "$BASE" && ! -L "$BASE" ]] || fail "unsafe-staging-base"
fi

PHASE="pull-pinned-postgresql"
# The pinned image was used in the Aarulya Store GitHub acceptance CI.
timeout 180 podman pull --quiet "$IMAGE" >/dev/null
printf 'POSTGRES_IMAGE_DIGEST_PIN=PASS\n'

PHASE="local-credential"
install -d -m 700 "$BASE" "$SECRET_DIR"
[[ "$(stat -c '%a' "$SECRET_DIR")" == 700 ]] || fail "secret-directory-mode-invalid"
openssl rand -hex 32 > "$PASSWORD_FILE"
CREATED_PASSWORD=true
chmod 600 "$PASSWORD_FILE"
[[ "$(stat -c '%a' "$PASSWORD_FILE")" == 600 ]] || fail "secret-file-mode-invalid"
printf 'STAGING_DATABASE_CREDENTIAL=CREATED_SERVER_ONLY\n'

PHASE="podman-secret"
# Podman delivers this staging-only secret mounted for uid 999, without
# exposing the 0600 host file to a different user or to container inspect.
podman secret create "$DB_SECRET" "$PASSWORD_FILE" >/dev/null
CREATED_SECRET=true

PHASE="dedicated-volume"
podman volume create "$DB_VOLUME" >/dev/null
CREATED_VOLUME=true

PHASE="launch-internal-postgresql"
# No -p option: the DB has no host or public TCP listener.
# The named volume is dedicated to this disposable staging database.
podman run --detach --pull=never \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  --network-alias "aarulya-store-staging-db" \
  --restart=no \
  --read-only \
  --user 999:999 \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,mode=1777,size=32m \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --pids-limit=128 \
  --memory=1024m \
  --cpus=1 \
  --env "POSTGRES_USER=$DB_USER" \
  --env "POSTGRES_DB=$DB_NAME" \
  --env "POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password" \
  --env "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256" \
  --secret "$DB_SECRET,type=mount,target=/run/secrets/postgres-password,uid=999,gid=999,mode=0400" \
  --volume "$DB_VOLUME:/var/lib/postgresql/data:U" \
  "$IMAGE" >/dev/null
CREATED_CONTAINER=true

PHASE="verify-private-database"
[[ "$(podman inspect "$DB_CONTAINER" --format '{{.HostConfig.NetworkMode}}')" == "$NETWORK" ]] \
  || fail "wrong-database-network"
[[ -z "$(podman port "$DB_CONTAINER")" ]] || fail "database-port-published"
READY=false
for i in {1..40}; do
  if podman exec "$DB_CONTAINER" pg_isready -q -U "$DB_USER" -d "$DB_NAME" 2>/dev/null; then
    READY=true
    break
  fi
  sleep 1
done
[[ "$READY" == true ]] || fail "staging-postgres-not-ready"

# Query through the container's own Unix socket; no host port or credentials in stdout.
IDENTITY="$(podman exec "$DB_CONTAINER" psql -X -q -tA -U "$DB_USER" -d "$DB_NAME" \
  -c 'SELECT current_database()')"
[[ "$IDENTITY" == "$DB_NAME" ]] || fail "wrong-staging-database"
PG_VERSION="$(podman exec "$DB_CONTAINER" psql -X -q -tA -U "$DB_USER" -d "$DB_NAME" \
  -c 'SHOW server_version_num')"
[[ "$PG_VERSION" == 17* ]] || fail "wrong-postgres-major-version"

printf 'AARULYA_STORE_PRIVATE_DB=PASS\n'
printf 'DATABASE=%s\nCONTAINER=%s\nNETWORK=%s\n' "$DB_NAME" "$DB_CONTAINER" "$NETWORK"
printf 'DATABASE_HOST_PORTS=NONE\n'
printf 'STAGING_DB_OWNER=ISOLATED\n'
printf 'DB_MIGRATIONS_EXECUTED=false\n'
printf 'STORE_AUTHENTICATED_API_STARTED=false\n'
printf 'PRODUCTION_CUSTOMER_DATA_USED=false\n'
printf 'CLOUD_MANAGED_STAGING_ACCEPTANCE=false\n'
printf 'PUBLIC_RELEASE=false\n'
