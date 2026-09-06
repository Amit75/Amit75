#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
"$HERE/copy-web-assets.sh"
cd "$HERE"
gradle --no-daemon :app:assembleDebug
sha256sum app/build/outputs/apk/debug/app-debug.apk
