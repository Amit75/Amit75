#!/usr/bin/env bash
# Aaru Store: one-shot, owner-approved private storefront and staging DB recovery.
# Bounded to existing Store preview and Store-only database resources; never public/production.
set -Eeuo pipefail
umask 077

PREVIEW=aarulya-store-private-preview-edge
NETWORK=aarulya-store-private-preview-v1
PORT=18940
DB=aarulya-store-private-db
DB_VOL=aarulya-store-private-db-data
DB_SECRET=aarulya-store-private-postgres-password
DB_PASSWORD_FILE=/home/admin1/.local/share/aarulya-store-staging/secrets/postgres-password
IMAGE_RECORD=/var/tmp/aarulya-store-fixed.IA2miyS0/image.env
DB_NAME=aarulya_store_staging
DB_USER=aarulya_store_staging
PHASE=preflight
BASE_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

fail() {
  printf 'AARULYA_STORE_PRIVATE_STAGE=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 2
}
finish() {
  rc=$?
  printf 'FINAL_EXIT_CODE=%s\nLAST_PHASE=%s\nPRODUCTION_MUTATION=NONE\nPUBLIC_RELEASE=false\n' "$rc" "$PHASE"
}
trap finish EXIT

for cmd in podman python3 curl grep sed ss sleep timeout stat; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing-command:$cmd"
done

[[ "$(id -un)" == admin1 && "$(id -u)" -ne 0 ]] || fail "nonroot-admin1-required"
[[ "$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null)" == true ]] \
  || fail "rootless-podman-required"
[[ "$(podman network inspect "$NETWORK" --format '{{.Internal}}' 2>/dev/null)" == true ]] \
  || fail "store-network-not-internal"
podman container exists "$PREVIEW" || fail "store-preview-container-missing"
[[ -s "$IMAGE_RECORD" ]] || fail "verified-image-evidence-missing"

expected_image="$(sed -n 's/^AARULYA_STORE_STAGING_BACKEND_IMAGE=//p' "$IMAGE_RECORD")"
[[ "$expected_image" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid-preview-image-evidence"
actual_image="$(podman inspect "$PREVIEW" --format '{{.Image}}' | sed 's/^sha256://')"
[[ "sha256:$actual_image" == "$expected_image" ]] || fail "store-preview-image-mismatch"

# Inspect *saved* config: podman port for a stopped container may return nothing.
podman inspect "$PREVIEW" | python3 -c '
import json,sys
i=json.load(sys.stdin)[0]
cfg=i.get("Config") or {}
host=i.get("HostConfig") or {}
network=i.get("NetworkSettings") or {}
bindings=(host.get("PortBindings") or {}).get("8083/tcp") or []
env=cfg.get("Env") or []
def require(cond, code):
    if not cond: raise SystemExit("BLOCKED="+code)
require(cfg.get("User")=="10001:10001", "unexpected-preview-user")
require(host.get("ReadonlyRootfs") is True, "preview-root-not-readonly")
require("aarulya-store-private-preview-v1" in (network.get("Networks") or {}), "preview-network-mismatch")
require(len(bindings)==1 and bindings[0].get("HostIp")=="127.0.0.1"
        and str(bindings[0].get("HostPort"))=="18940", "preview-exposure-mismatch")
require("AARULYA_EDGE_ALLOWED_HOSTS=store.aarulya.com" in env, "preview-allowed-hosts-mismatch")
require(not host.get("Privileged"), "preview-privileged")
print("PREVIEW_SAVED_SECURITY=PASS")
'

PHASE=resume-private-storefront
preview_state="$(podman inspect "$PREVIEW" --format '{{.State.Status}}')"
preview_exit="$(podman inspect "$PREVIEW" --format '{{.State.ExitCode}}')"
printf 'PREVIEW_STATUS_BEFORE=%s\nPREVIEW_PREVIOUS_EXIT_CODE=%s\n' "$preview_state" "$preview_exit"

case "$preview_state" in
  running)
    echo "PREVIEW_ALREADY_RUNNING=true"
    ;;
  created|exited)
    [[ "$preview_exit" == 0 || "$preview_exit" == 143 ]] \
      || fail "unexpected-preview-exit-requires-diagnostics"
    if ss -H -ltn "( sport = :$PORT )" | grep -q .; then
      fail "store-loopback-port-in-use"
    fi
    podman start "$PREVIEW" >/dev/null || fail "store-preview-restart-failed"
    ;;
  *)
    fail "unknown-preview-state"
    ;;
esac

[[ "$(podman inspect "$PREVIEW" --format '{{.State.Running}}')" == true ]] \
  || fail "store-preview-not-running"
[[ "$(podman port "$PREVIEW" 8083/tcp)" == "127.0.0.1:$PORT" ]] \
  || fail "live-preview-port-exposure"
ready=false
for i in {1..20}; do
  if curl --noproxy '*' -fsS --max-time 3 \
      "http://127.0.0.1:$PORT/health" 2>/dev/null \
      | grep -q '"service":"aarulya-store-cloud-staging-edge"'; then
    ready=true
    break
  fi
  sleep 1
done
[[ "$ready" == true ]] || fail "store-preview-http-unhealthy"
curl --noproxy '*' -fsS --max-time 5 -H 'Host: store.aarulya.com' \
  "http://127.0.0.1:$PORT/" | grep -qi 'aarulya' \
  || fail "store-preview-homepage-failed"
denied="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' --max-time 5 \
  -H 'Host: unrelated.invalid' "http://127.0.0.1:$PORT/")"
[[ "$denied" == 421 ]] || fail "store-preview-host-filter-failed"
echo "STORE_PRIVATE_PREVIEW=PASS"

PHASE=staging-database
if podman container exists "$DB"; then
  db_state="$(podman inspect "$DB" --format '{{.State.Status}}')"
  printf 'DATABASE_STATUS_BEFORE=%s\n' "$db_state"
  case "$db_state" in
    running)
      [[ -z "$(podman port "$DB")" ]] || fail "database-host-port-exposed"
      [[ "$(podman inspect "$DB" --format '{{.Config.User}}')" == "999:999" ]] \
        || fail "database-user-mismatch"
      [[ "$(podman inspect "$DB" --format '{{.HostConfig.ReadonlyRootfs}}')" == true ]] \
        || fail "database-root-not-readonly"
      podman inspect "$DB" | python3 -c '
import json,sys
x=json.load(sys.stdin)[0]
h=x.get("HostConfig") or {}
n=x.get("NetworkSettings") or {}
m=x.get("Mounts") or []
if "aarulya-store-private-preview-v1" not in (n.get("Networks") or {}): raise SystemExit("BLOCKED=database-network-mismatch")
if not any(z.get("Name")=="aarulya-store-private-db-data" and z.get("Destination")=="/var/lib/postgresql/data" for z in m): raise SystemExit("BLOCKED=database-volume-mismatch")
if h.get("PortBindings"): raise SystemExit("BLOCKED=database-port-exposure")
'
      ;;
    created)
      [[ -f "$BASE_DIR/recover-created-private-postgres.sh" ]] \
        || fail "private-recovery-script-missing"
      timeout 300 bash "$BASE_DIR/recover-created-private-postgres.sh" \
        || fail "private-db-created-container-recovery-failed"
      ;;
    *)
      fail "stopped-db-needs-manual-review-do-not-remove-volume"
      ;;
  esac
else
  if podman volume exists "$DB_VOL" || podman secret exists "$DB_SECRET" \
       || [[ -e "$DB_PASSWORD_FILE" ]]; then
    fail "partial-db-resources-without-container-require-manual-review"
  fi
  [[ -f "$BASE_DIR/start-private-postgres.sh" ]] || fail "private-db-starter-missing"
  timeout 300 bash "$BASE_DIR/start-private-postgres.sh" \
    || fail "new-private-postgres-start-failed"
fi

PHASE=final-database-acceptance
podman container exists "$DB" || fail "staging-db-container-missing"
[[ "$(podman inspect "$DB" --format '{{.State.Running}}')" == true ]] \
  || fail "staging-database-not-running"
[[ -z "$(podman port "$DB")" ]] || fail "database-port-published"
podman exec "$DB" pg_isready -q -U "$DB_USER" -d "$DB_NAME" \
  || fail "staging-database-pg-isready-failed"
name="$(podman exec "$DB" psql -X -qAt -U "$DB_USER" -d "$DB_NAME" -c 'SELECT current_database()')"
[[ "$name" == "$DB_NAME" ]] || fail "staging-database-name-mismatch"

echo "AARULYA_STORE_PRIVATE_DB=PASS"
echo "DATABASE_HOST_PORTS=NONE"
echo "DB_MIGRATIONS_EXECUTED=false"
echo "AUTHENTICATED_API_STARTED=false"
echo "CLOUD_MANAGED_STAGING_ACCEPTANCE=false"
echo "PUBLIC_DNS_CHANGED=false"

# Informative only: rootless process lifecycle may depend on user lingering.
if command -v loginctl >/dev/null 2>&1; then
  loginctl show-user admin1 -p Linger 2>/dev/null || true
fi
