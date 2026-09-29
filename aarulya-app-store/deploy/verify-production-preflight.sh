#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

readonly STORE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly REPO_ROOT="$(cd "$STORE_ROOT/.." && pwd -P)"
readonly COMPOSE_FILE="$STORE_ROOT/deploy/compose.production.yml"

fail() {
  printf 'AARULYA_STORE_PRODUCTION_PREFLIGHT=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 1
}

pass() {
  printf 'AARULYA_STORE_PRODUCTION_PREFLIGHT=PASS\n'
  printf 'EXACT_HEAD=%s\n' "$AARULYA_SOURCE_COMMIT_SHA"
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing-command:$1"
}

require_command git
require_command docker
require_command curl
require_command getent
require_command stat
require_command readlink
require_command grep

[[ -n "${AARULYA_SOURCE_COMMIT_SHA:-}" ]] || fail 'AARULYA_SOURCE_COMMIT_SHA-required'
[[ "$AARULYA_SOURCE_COMMIT_SHA" =~ ^[a-f0-9]{40}$ ]] || fail 'invalid-source-commit-sha'
actual_head="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
[[ "$actual_head" == "$AARULYA_SOURCE_COMMIT_SHA" ]] || fail 'exact-head-mismatch'
[[ -z "$(git -C "$REPO_ROOT" status --porcelain=v1 --untracked-files=no)" ]] || fail 'tracked-source-not-clean'

for image_var in AARULYA_STORE_BACKEND_IMAGE AARULYA_CADDY_IMAGE; do
  image="${!image_var:-}"
  [[ "$image" =~ @sha256:[a-f0-9]{64}$ ]] || fail "immutable-image-digest-required:$image_var"
done

secret_vars=(
  AARULYA_MIGRATOR_DATABASE_URL_SECRET_FILE
  AARULYA_API_DATABASE_URL_SECRET_FILE
  AARULYA_PUBLISHER_DATABASE_URL_SECRET_FILE
  AARULYA_DOWNLOADS_DATABASE_URL_SECRET_FILE
  AARULYA_WORKER_DATABASE_URL_SECRET_FILE
  AARULYA_DOWNLOAD_TOKEN_HMAC_KEY_SECRET_FILE
)

for secret_var in "${secret_vars[@]}"; do
  path="${!secret_var:-}"
  [[ -n "$path" ]] || fail "secret-file-required:$secret_var"
  [[ -f "$path" && ! -L "$path" ]] || fail "secret-must-be-regular-nonsymlink:$secret_var"
  resolved="$(readlink -f "$path")"
  [[ "$resolved" != "$REPO_ROOT/"* ]] || fail "secret-inside-repository:$secret_var"
  links="$(stat -c '%h' "$path")"
  [[ "$links" == '1' ]] || fail "secret-hardlink-count-invalid:$secret_var"
  owner_uid="$(stat -c '%u' "$path")"
  [[ "$owner_uid" == '0' ]] || fail "secret-owner-must-be-root:$secret_var"
  permission="$(stat -c '%a' "$path")"
  mode=$((8#$permission))
  (( (mode & 077) == 0 )) || fail "secret-group-or-world-readable:$secret_var"
  [[ -s "$path" ]] || fail "secret-file-empty:$secret_var"
done

for root_var in AARULYA_APK_ARTIFACT_ROOT AARULYA_EVIDENCE_ARTIFACT_ROOT; do
  path="${!root_var:-}"
  [[ -n "$path" ]] || fail "artifact-root-required:$root_var"
  [[ "$path" = /* ]] || fail "artifact-root-must-be-absolute:$root_var"
  [[ -d "$path" && ! -L "$path" ]] || fail "artifact-root-invalid:$root_var"
  resolved="$(readlink -f "$path")"
  [[ "$resolved" != "$REPO_ROOT/"* ]] || fail "artifact-root-inside-repository:$root_var"
done

[[ -n "${AARULYA_WORKER_ID:-}" ]] || fail 'AARULYA_WORKER_ID-required'

docker info >/dev/null 2>&1 || fail 'docker-unavailable'
docker compose -f "$COMPOSE_FILE" config --quiet || fail 'production-compose-invalid'

hosts=(
  store.aarulya.com
  api.store.aarulya.com
  downloads.store.aarulya.com
  evidence.store.aarulya.com
  identity.aarulya.com
)
for host in "${hosts[@]}"; do
  getent ahostsv4 "$host" >/dev/null 2>&1 || fail "dns-unresolved:$host"
done

probe() {
  local url="$1"
  curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --connect-timeout 5 --max-time 15 --output /dev/null "$url" \
    || fail "https-probe-failed:$url"
}

probe 'https://store.aarulya.com/'
probe 'https://api.store.aarulya.com/health'
probe 'https://downloads.store.aarulya.com/health'
probe 'https://evidence.store.aarulya.com/health'
probe 'https://identity.aarulya.com/.well-known/jwks.json'

for policy in privacy terms support pricing; do
  body="$(curl --proto '=https' --tlsv1.2 --fail --silent --show-error \
    --connect-timeout 5 --max-time 15 "https://store.aarulya.com/policies/$policy.html")" \
    || fail "policy-fetch-failed:$policy"
  grep -Fq 'data-policy-state="active"' <<<"$body" || fail "policy-not-active:$policy"
  ! grep -Fqi 'pre-launch draft' <<<"$body" || fail "prelaunch-policy-public:$policy"
done

pass
