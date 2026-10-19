#!/usr/bin/env bash
# Deploys a dedicated, rootless, non-public PostgreSQL for Aaru Store private staging.
# Does not register workloads with Aarulya Cloud, run migrations, or alter production.
set -Eeuo pipefail
umask 077

IMAGE_TAG="docker.io/library/postgres:16-bookworm"
NET="aarulya-store-staging-db-net-v1"
DB_CONTAINER="aarulya-store-staging-postgres-v1"
VOLUME="aarulya-store-staging-pgdata-v1"
SECRET="aarulya-store-staging-db-admin-password-v1"
STAGING_DIR="$HOME/.local/share/aarulya-store/private-staging-db"
PASSFILE="$STAGING_DIR/admin-password"
RECEIPT="$STAGING_DIR/database-receipt.env"
DB_NAME="aarulya_store_staging"
DB_USER="aarulya_store_staging_admin"
PHASE="preflight"

fail() {
  echo "STAGING_POSTGRES=BLOCKED" >&2
  echo "BLOCKER=$1" >&2
  exit 2
}
finish() {
  local rc="$?"
  echo "===== FINAL RESULT ====="
  echo "FINAL_EXIT_CODE=$rc"
  echo "LAST_PHASE=$PHASE"
  echo "PRODUCTION_MUTATION=NONE"
  echo "STORE_MIGRATION=NOT_EXECUTED"
  echo "PUBLIC_DATABASE_PORT=NONE"
}
trap finish EXIT

for cmd in podman openssl curl ss grep mkdir chmod sleep; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing-command:$cmd"
done
[[ "$(id -un)" == admin1 && "$(id -u)" -ne 0 ]] || fail "nonroot-admin1-required"
[[ "$(podman info --format '{{.Host.Security.Rootless}}')" == true ]] || fail "rootless-podman-required"

# Require an already-healthy, dedicated edge; never mutate or replace it.
[[ "$(podman inspect aarulya-store-private-preview-edge --format '{{.State.Running}}' 2>/dev/null)" == true ]] \
  || fail "private-preview-not-running"
[[ "$(podman network inspect aarulya-store-private-preview-v1 --format '{{.Internal}}' 2>/dev/null)" == true ]] \
  || fail "preview-network-is-not-internal"
curl --noproxy '*' -fsS --max-time 5 http://127.0.0.1:18940/health |
  grep -q '"service":"aarulya-store-cloud-staging-edge"' \
  || fail "private-preview-health-check-failed"

# Never silently reuse/overwrite even partially provisioned resources.
podman container exists "$DB_CONTAINER" && fail "staging-db-container-already-exists"
podman network exists "$NET" && fail "staging-db-network-already-exists"
podman volume exists "$VOLUME" && fail "staging-db-volume-already-exists"
podman secret exists "$SECRET" && fail "staging-db-secret-already-exists"
[[ ! -e "$PASSFILE" && ! -e "$RECEIPT" ]] || fail "existing-staging-db-secret-or-receipt"

echo "PREVIEW_HEALTH=PASS"
echo "ISOLATION_PREFLIGHT=PASS"

PHASE="image"
if ! podman image exists "$IMAGE_TAG"; then
  echo "PULLING_OFFICIAL_POSTGRES_16_IMAGE=true"
  timeout 240 podman pull "$IMAGE_TAG" >/dev/null \
    || fail "postgres-image-pull-failed"
fi
IMAGE_ID="$(podman image inspect "$IMAGE_TAG" --format '{{.Id}}')"
IMAGE_ID="sha256:${IMAGE_ID#sha256:}"
[[ "$IMAGE_ID" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid-postgres-image-id"

IMAGE_UID="$(podman run --rm --pull=never --network=none \
  --entrypoint /usr/bin/id "$IMAGE_ID" -u postgres)"
[[ "$IMAGE_UID" == 999 ]] || fail "unexpected-postgres-image-user-id"

echo "POSTGRES_IMAGE_VERIFIED=PASS"
echo "POSTGRES_IMAGE_ID=$IMAGE_ID"

PHASE="private-resources"
mkdir -p "$STAGING_DIR"
chmod 700 "$STAGING_DIR"
openssl rand -hex 32 > "$PASSFILE"
chmod 600 "$PASSFILE"

podman secret create "$SECRET" "$PASSFILE" >/dev/null
echo "PRIVATE_STAGING_SECRET_CREATED=PASS"

podman network create --internal "$NET" >/dev/null
[[ "$(podman network inspect "$NET" --format '{{.Internal}}')" == true ]] \
  || fail "db-network-not-internal"

podman volume create "$VOLUME" >/dev/null

PHASE="start-postgres"
podman run -d \
  --name "$DB_CONTAINER" \
  --pull=never \
  --network "$NET" \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --pids-limit 256 \
  --memory 1024m \
  --cpus 2 \
  --user 999:999 \
  --tmpfs /tmp:rw,nosuid,nodev,size=64m,uid=999,gid=999,mode=1777 \
  --tmpfs /var/run/postgresql:rw,nosuid,nodev,size=16m,uid=999,gid=999,mode=3775 \
  --volume "$VOLUME:/var/lib/postgresql/data:rw,U" \
  --secret "$SECRET,type=mount,target=postgres-password,uid=999,gid=999,mode=0400" \
  --env POSTGRES_USER="$DB_USER" \
  --env POSTGRES_DB="$DB_NAME" \
  --env POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password \
  --env POSTGRES_INITDB_ARGS='--auth-host=scram-sha-256 --auth-local=trust' \
  "$IMAGE_ID" >/dev/null

PHASE="verify"
[[ -z "$(podman port "$DB_CONTAINER")" ]] || fail "postgres-host-port-exposed"
[[ "$(podman inspect "$DB_CONTAINER" --format '{{.State.Running}}')" == true ]] \
  || fail "postgres-container-not-running"

READY=false
for i in $(seq 1 30); do
  if podman exec "$DB_CONTAINER" pg_isready -q -U "$DB_USER" -d "$DB_NAME"; then
    READY=true
    break
  fi
  sleep 2
done
[[ "$READY" == true ]] || fail "postgres-startup-not-ready"

ACTUAL="$(podman exec "$DB_CONTAINER" psql -X -qAt -U "$DB_USER" -d "$DB_NAME" \
  -c "SELECT current_database() || ':' || current_user || ':' || current_setting('server_version_num');")"
[[ "$ACTUAL" == "$DB_NAME:$DB_USER:16"* ]] || fail "database-identity-or-version-invalid"

# Keep receipts non-secret. Authentication password is never printed.
{
  printf 'POSTGRES_IMAGE_ID=%s\n' "$IMAGE_ID"
  printf 'POSTGRES_CONTAINER=%s\n' "$DB_CONTAINER"
  printf 'POSTGRES_NETWORK=%s\n' "$NET"
  printf 'POSTGRES_VOLUME=%s\n' "$VOLUME"
  printf 'POSTGRES_DATABASE=%s\n' "$DB_NAME"
  printf 'POSTGRES_USER=%s\n' "$DB_USER"
  printf 'POSTGRES_PORT_PUBLISHED=false\n'
  printf 'PRODUCTION_MUTATION=false\n'
} > "$RECEIPT"
chmod 600 "$RECEIPT"

echo "AARULYA_STORE_STAGING_POSTGRES=PASS"
echo "POSTGRES_ROOTLESS=PASS"
echo "POSTGRES_INTERNAL_NETWORK=PASS"
echo "POSTGRES_PUBLIC_PORTS=NONE"
echo "POSTGRES_IDENTITY=PASS"
echo "POSTGRES_RECEIPT=$RECEIPT"
echo "STAGING_DATABASE_READY_FOR_GOVERNED_MIGRATIONS=true"
echo "CLOUD_MANAGED_STAGING_ACCEPTANCE=false"
echo "AUTHENTICATED_API_STARTED=false"
echo "PUBLIC_RELEASE=false"
