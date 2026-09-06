#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${AARULYA_PLAY_APP_DIR:-/opt/aarulya/play}"
CONTAINER="${AARULYA_PLAY_CONTAINER:-aarulya-play-static}"
PUBLIC_URL="${AARULYA_PLAY_PUBLIC_URL:-https://aarulya.com/play}"
RELEASE_SHA="${AARULYA_PLAY_RELEASE_SHA:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/aarulya/backups/aarulya-play-v3-$STAMP"

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "AARULYA_PLAY_RELEASE_SHA must be an exact 40-character Git commit SHA" >&2
  exit 64
fi
SOURCE="https://raw.githubusercontent.com/Amit75/Amit75/$RELEASE_SHA/aarulya-play-v3"

mkdir -p "$BACKUP" "$APP_DIR"
cp -a "$APP_DIR/." "$BACKUP/" 2>/dev/null || true

rollback() {
  echo "==> Rolling back"
  find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  cp -a "$BACKUP/." "$APP_DIR/" 2>/dev/null || true
  docker restart "$CONTAINER" >/dev/null 2>&1 || true
  echo "ROLLBACK: $BACKUP"
}

trap 'echo "Deployment failed"; rollback' ERR

echo "==> Downloading exact Aarulya Play release $RELEASE_SHA"
for file in index.html styles.css app.js privacy.html terms.html; do
  curl -fsSL --retry 3 --connect-timeout 15 "$SOURCE/$file" -o "$APP_DIR/$file.new"
  mv "$APP_DIR/$file.new" "$APP_DIR/$file"
done
chmod 0644 "$APP_DIR"/*.html "$APP_DIR"/*.css "$APP_DIR"/*.js

echo "==> Validating product files"
grep -q '<title>Aarulya Play</title>' "$APP_DIR/index.html"
grep -q 'Aarulya Sky Rush' "$APP_DIR/index.html"
grep -q 'function sky' "$APP_DIR/app.js"
grep -q 'function goal' "$APP_DIR/app.js"
grep -q 'function stack' "$APP_DIR/app.js"
grep -q '.game-grid' "$APP_DIR/styles.css"
grep -q 'Privacy Policy — Aarulya Play' "$APP_DIR/privacy.html"
grep -q 'Terms of Use — Aarulya Play' "$APP_DIR/terms.html"

echo "==> Reloading static application"
docker inspect "$CONTAINER" >/dev/null
docker start "$CONTAINER" >/dev/null 2>&1 || true
docker exec "$CONTAINER" nginx -t
docker exec "$CONTAINER" nginx -s reload
sleep 4

echo "==> Verifying public build"
BASE="${PUBLIC_URL%/}"
HTML="$(curl -fsSL --max-time 20 "$BASE/?v=3-$STAMP")"
CSS_CODE="$(curl -fsS --max-time 20 -o /tmp/aarulya-v3.css -w '%{http_code}' "$BASE/styles.css?v=3-$STAMP")"
JS_CODE="$(curl -fsS --max-time 20 -o /tmp/aarulya-v3.js -w '%{http_code}' "$BASE/app.js?v=3-$STAMP")"
PRIVACY_CODE="$(curl -fsS --max-time 20 -o /tmp/aarulya-v3-privacy.html -w '%{http_code}' "$BASE/privacy.html?v=3-$STAMP")"
TERMS_CODE="$(curl -fsS --max-time 20 -o /tmp/aarulya-v3-terms.html -w '%{http_code}' "$BASE/terms.html?v=3-$STAMP")"

grep -q 'Aarulya Sky Rush' <<<"$HTML"
[ "$CSS_CODE" = "200" ]
[ "$JS_CODE" = "200" ]
[ "$PRIVACY_CODE" = "200" ]
[ "$TERMS_CODE" = "200" ]
grep -q '.game-grid' /tmp/aarulya-v3.css
grep -q 'function sky' /tmp/aarulya-v3.js
grep -q 'Privacy Policy — Aarulya Play' /tmp/aarulya-v3-privacy.html
grep -q 'Terms of Use — Aarulya Play' /tmp/aarulya-v3-terms.html

trap - ERR
printf '\n==========================================\n'
echo "LIVE: $BASE/?v=3-$STAMP"
echo "RELEASE_SHA: $RELEASE_SHA"
echo "GAMES: Sky Rush, Goal Master, Neon Stack"
echo "BACKUP: $BACKUP"
echo "=========================================="
