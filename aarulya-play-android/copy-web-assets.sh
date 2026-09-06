#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/aarulya-play-v3"
DST="$ROOT/aarulya-play-android/web-assets"
rm -rf "$DST"
mkdir -p "$DST"
cp "$SRC/index.html" "$SRC/styles.css" "$SRC/app.js" "$DST/"
for optional in privacy.html terms.html; do
  if [ -f "$SRC/$optional" ]; then cp "$SRC/$optional" "$DST/"; fi
done
printf 'AARULYA_PLAY_WEB_ASSETS_READY\n'
