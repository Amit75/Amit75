#!/usr/bin/env bash
# Owner-approved local staging preview; NOT Cloud-managed staging acceptance or public deployment.
set -Eeuo pipefail
umask 077

EXPECTED_HEAD="a007331b09572bb6932cc4df439102ecd9b8145e"
ROOT="/var/tmp/aarulya-store-fixed.IA2miyS0"
SRC="$ROOT/source"
ENVFILE="$ROOT/image.env"
TAG="localhost/aarulya-store-staging:${EXPECTED_HEAD:0:12}"
NETWORK="aarulya-store-private-preview-v1"
CONTAINER="aarulya-store-private-preview-edge"
PORT=18940
CREATED_NETWORK=false
CREATED_CONTAINER=false

fail() {
  printf 'AARULYA_STORE_PRIVATE_PREVIEW=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 2
}
cleanup() {
  rc=$?
  if (( rc != 0 )); then
    if [[ "$CREATED_CONTAINER" == true ]]; then
      podman rm -f "$CONTAINER" >/dev/null 2>&1 || true
    fi
    if [[ "$CREATED_NETWORK" == true ]]; then
      podman network rm "$NETWORK" >/dev/null 2>&1 || true
    fi
  fi
  printf 'FINAL_EXIT_CODE=%s\n' "$rc"
  printf 'PRODUCTION_MUTATION=NONE\n'
  exit "$rc"
}
trap cleanup EXIT

for cmd in podman git curl grep ss sed tr sleep seq mkdir chmod; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing-command:$cmd"
done
[[ "$(id -un)" == "admin1" && "$(id -u)" != 0 ]] || fail "admin1-nonroot-required"
[[ "$(podman info --format '{{.Host.Security.Rootless}}' 2>/dev/null)" == true ]] || fail "rootless-podman-required"

[[ -s "$ENVFILE" && -d "$SRC/.git" ]] || fail "verified-image-and-source-record-required"
[[ "$(git -C "$SRC" rev-parse HEAD)" == "$EXPECTED_HEAD" ]] || fail "exact-head-mismatch"
[[ -z "$(git -C "$SRC" status --porcelain --untracked-files=no)" ]] || fail "source-is-not-clean"

RECORDED_HEAD="$(sed -n 's/^AARULYA_STORE_SOURCE_COMMIT=//p' "$ENVFILE")"
IMAGE_ID="$(sed -n 's/^AARULYA_STORE_STAGING_BACKEND_IMAGE=//p' "$ENVFILE")"
[[ "$RECORDED_HEAD" == "$EXPECTED_HEAD" ]] || fail "image-record-head-mismatch"
[[ "$IMAGE_ID" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "invalid-image-digest"

ACTUAL_IMAGE="$(podman image inspect "$TAG" --format '{{.Id}}' 2>/dev/null || true)"
ACTUAL_IMAGE="sha256:${ACTUAL_IMAGE#sha256:}"
[[ "$ACTUAL_IMAGE" == "$IMAGE_ID" ]] || fail "immutable-image-id-mismatch"
REVISION="$(podman image inspect "$TAG" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' 2>/dev/null || true)"
[[ "$REVISION" == "$EXPECTED_HEAD" ]] || fail "image-revision-mismatch"

if podman container exists "$CONTAINER"; then
  fail "preview-container-already-exists-no-implicit-replacement"
fi
if podman network exists "$NETWORK"; then
  fail "preview-network-already-exists-no-implicit-replacement"
fi
if ss -H -ltn "( sport = :$PORT )" | grep -q .; then
  fail "loopback-port-already-in-use"
fi

printf 'SOURCE_VERIFIED=PASS\nIMAGE_VERIFIED=PASS\n'
printf 'CREATING_PRIVATE_PREVIEW=true\n'

# Dedicated rootless internal network. No production DB, third-party identity
# or public outbound service access.
podman network create --internal "$NETWORK" >/dev/null
CREATED_NETWORK=true
podman network inspect "$NETWORK" --format '{{.Internal}}' | grep -qx true \
  || fail "preview-network-not-internal"

podman run --detach --pull=never \
  --name "$CONTAINER" \
  --network "$NETWORK" \
  --publish "127.0.0.1:$PORT:8083/tcp" \
  --read-only \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --pids-limit 128 \
  --memory 256m \
  --cpus 1 \
  --user 10001:10001 \
  --env HOST=0.0.0.0 \
  --env PORT=8083 \
  --env AARULYA_EDGE_ALLOWED_HOSTS=store.aarulya.com \
  --env AARULYA_STOREFRONT_ROOT=/app/storefront \
  --env AARULYA_STORE_INTERNAL_API_ORIGIN=http://aarulya-aarulya-store-api:8080 \
  --entrypoint=node \
  "$TAG" src/cloud-staging-edge.js >/dev/null
CREATED_CONTAINER=true

MAPPING="$(podman port "$CONTAINER" 8083/tcp | tr -d '\r')"
[[ "$MAPPING" == "127.0.0.1:$PORT" ]] || fail "public-port-mapping-detected"

READY=false
for _ in $(seq 1 20); do
  if curl --noproxy '*' -fsS --max-time 3 "http://127.0.0.1:$PORT/health" \
    | grep -q '"service":"aarulya-store-cloud-staging-edge"'; then
    READY=true
    break
  fi
  sleep 1
done
[[ "$READY" == true ]] || fail "private-preview-health-unavailable"

curl --noproxy '*' -fsS --max-time 5 \
  --header 'Host: store.aarulya.com' \
  "http://127.0.0.1:$PORT/" \
  | grep -qi "aarulya" || fail "storefront-homepage-unavailable"

DENIED_CODE="$(curl --noproxy '*' --silent --output /dev/null \
  --write-out '%{http_code}' --max-time 5 \
  --header 'Host: unrelated.invalid' \
  "http://127.0.0.1:$PORT/")"
[[ "$DENIED_CODE" == 421 ]] || fail "foreign-host-not-denied"

STATUS_DIR="$ROOT/private-preview"
mkdir -p "$STATUS_DIR"
chmod 700 "$STATUS_DIR"
printf 'SOURCE_HEAD=%s\nIMAGE_ID=%s\nBIND_ADDRESS=127.0.0.1\nBIND_PORT=%s\nNETWORK=%s\nCONTAINER=%s\nPUBLIC_DEPLOYMENT=false\nLOGIN_ENABLED=false\n' \
  "$EXPECTED_HEAD" "$IMAGE_ID" "$PORT" "$NETWORK" "$CONTAINER" > "$STATUS_DIR/receipt.env"
chmod 600 "$STATUS_DIR/receipt.env"

printf 'AARULYA_STORE_PRIVATE_PREVIEW=PASS\n'
printf 'STORE_FRONTEND_HTTP=PASS\n'
printf 'STORE_UNTRUSTED_HOST_DENIAL=PASS\n'
printf 'PRIVATE_NETWORK=PASS\n'
printf 'LOCAL_URL=http://127.0.0.1:%s/\n' "$PORT"
printf 'PREVIEW_RECEIPT=%s/receipt.env\n' "$STATUS_DIR"
printf 'POSTGRES_STARTED=false\nAUTHENTICATED_API_STARTED=false\n'
printf 'CLOUD_MANAGED_STAGING_ACCEPTANCE=false\n'
printf 'PUBLIC_DNS_CHANGED=false\nPUBLIC_RELEASE=false\n'
