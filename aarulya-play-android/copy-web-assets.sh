#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/aarulya-play-superapp"
DST="$ROOT/aarulya-play-android/web-assets"

rm -rf "$DST"
mkdir -p "$DST/src"

cp "$SRC/index.html" "$SRC/styles.css" "$SRC/monetization.css" "$SRC/phase-two-games.css" "$DST/"
cp "$SRC/learning.html" "$SRC/learning.css" "$SRC/privacy.html" "$SRC/manifest.webmanifest" "$SRC/sw.js" "$DST/"
cp "$SRC/src/"*.js "$DST/src/"

required=(
  index.html
  styles.css
  monetization.css
  phase-two-games.css
  learning.html
  learning.css
  privacy.html
  manifest.webmanifest
  sw.js
  src/app.js
  src/battle-engine.js
  src/game-catalog.js
  src/phase-two-games.js
  src/platform-controls.js
  src/pwa.js
)

for file in "${required[@]}"; do
  test -s "$DST/$file" || { echo "Missing packaged asset: $file" >&2; exit 65; }
done

grep -q '40 original Aarulya games' "$DST/index.html"
grep -q "'metro-dash'" "$DST/src/app.js"
grep -q "'bubble-arena'" "$DST/src/app.js"
grep -q 'aarulya-play-profile-v1' "$DST/src/battle-engine.js"

printf 'AARULYA_PLAY_SUPERAPP_ASSETS_READY\n'
