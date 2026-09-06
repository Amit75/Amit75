#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
[[ -z "$(git status --porcelain)" ]] || { echo 'Refusing dirty working tree' >&2; exit 1; }
SHA="$(git rev-parse HEAD)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_DIR="${1:-dist/owner-handoff}"
PACKAGE="${OUTPUT_DIR}/aarulya-play-${SHA}-${STAMP}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUTPUT_DIR" "$TMP/source" "$TMP/evidence"
git archive --format=tar --prefix=source/ "$SHA" | tar -xf - -C "$TMP"
for required in OWNER_PROJECT_MANIFEST.json SOVEREIGN_RUNTIME_PROFILE.json DEPLOYMENT_READINESS.json; do
  test -s "$required" || { echo "Missing $required" >&2; exit 1; }
done
SOURCE_SHA="$SHA" CREATED_AT="$STAMP" python3 - <<'PY' > "$TMP/evidence/HANDOFF_METADATA.json"
import json
import os
print(json.dumps({
    "schemaVersion": 1,
    "projectId": "aarulya-play",
    "projectName": "Aarulya Play",
    "repository": "Amit75/Amit75",
    "sourceSha": os.environ["SOURCE_SHA"],
    "createdAtUtc": os.environ["CREATED_AT"],
    "owner": "Amit Kumar",
    "containsSecrets": False,
    "productionDeployed": False,
    "deploymentReadyClaimed": False,
}, indent=2))
PY
(
  cd "$TMP"
  find source evidence -type f -print0 | sort -z | xargs -0 sha256sum > evidence/SHA256SUMS
  tar -czf "$ROOT/$PACKAGE" source evidence
)
sha256sum "$PACKAGE" > "${PACKAGE}.sha256"
chmod 600 "$PACKAGE" "${PACKAGE}.sha256"
printf 'AARULYA_PLAY_HANDOFF_SOURCE_SHA=%s\n' "$SHA"
printf 'AARULYA_PLAY_HANDOFF_PACKAGE=%s\n' "$PACKAGE"
printf 'AARULYA_PLAY_PRODUCTION_DEPLOYED=false\n'
