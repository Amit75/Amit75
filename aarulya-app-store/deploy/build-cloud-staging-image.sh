#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

STORE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
REPO_ROOT="$(cd "$STORE_ROOT/.." && pwd -P)"
DOCKERFILE="$STORE_ROOT/backend/Dockerfile"

fail() {
  printf 'AARULYA_STORE_STAGING_IMAGE=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail 'git-missing'

EXPECTED="${AARULYA_STORE_SOURCE_COMMIT:-}"
[[ "$EXPECTED" =~ ^[a-f0-9]{40}$ ]] || fail 'exact-source-commit-required'
ACTUAL="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"
[[ "$ACTUAL" == "$EXPECTED" ]] || fail 'exact-source-head-mismatch'
[[ -z "$(git -C "$REPO_ROOT" status --porcelain=v1 --untracked-files=no)" ]] || fail 'tracked-source-not-clean'

ENGINE="${AARULYA_STAGING_CONTAINER_RUNTIME:-podman}"
[[ "$ENGINE" == 'podman' || "$ENGINE" == 'docker' ]] || fail 'container-runtime-must-be-podman-or-docker'
command -v "$ENGINE" >/dev/null 2>&1 || fail "container-runtime-missing:$ENGINE"

[[ "$(id -u)" != '0' ]] || fail 'rootless-build-required'
if [[ "$ENGINE" == 'podman' ]]; then
  ROOTLESS="$("$ENGINE" info --format '{{.Host.Security.Rootless}}' 2>/dev/null || true)"
  [[ "$ROOTLESS" == 'true' ]] || fail 'podman-rootless-required'
else
  SECURITY="$("$ENGINE" info --format '{{json .SecurityOptions}}' 2>/dev/null || true)"
  grep -Fqi 'rootless' <<<"$SECURITY" || fail 'docker-rootless-required'
fi

TAG="localhost/aarulya-store-staging:${EXPECTED:0:12}"
"$ENGINE" build   --build-arg "SOURCE_SHA=$EXPECTED"   --label "org.opencontainers.image.revision=$EXPECTED"   --tag "$TAG"   --file "$DOCKERFILE"   "$STORE_ROOT"

IMAGE_ID="$("$ENGINE" image inspect "$TAG" --format '{{.Id}}' | tr '[:upper:]' '[:lower:]')"
[[ "$IMAGE_ID" =~ ^sha256:[a-f0-9]{64}$ ]] || fail 'immutable-local-image-id-invalid'

REVISION="$("$ENGINE" image inspect "$IMAGE_ID" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')"
[[ "$REVISION" == "$EXPECTED" ]] || fail 'image-source-label-mismatch'

OUTPUT="${AARULYA_STAGING_IMAGE_ENV_OUTPUT:-/var/lib/aarulya-cloud/staging/aarulya-store/image.env}"
mkdir -p "$(dirname "$OUTPUT")"
cat >"$OUTPUT" <<EOF
AARULYA_STORE_SOURCE_COMMIT=$EXPECTED
AARULYA_STORE_STAGING_BACKEND_IMAGE=$IMAGE_ID
AARULYA_STORE_STAGING_ARTIFACT_DIGEST=$IMAGE_ID
EOF
chmod 600 "$OUTPUT"

printf 'AARULYA_STORE_STAGING_IMAGE=PASS\n'
printf 'EXACT_HEAD=%s\n' "$EXPECTED"
printf 'CONTAINER_RUNTIME=%s\n' "$ENGINE"
printf 'IMAGE_ID=%s\n' "$IMAGE_ID"
printf 'IMAGE_ENV=%s\n' "$OUTPUT"
printf 'PRODUCTION_DEPLOYED=false\n'
