#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/aarulya/play"
CONTAINER="aarulya-play-static"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP="/opt/aarulya/backups/aarulya-play-v3-$STAMP"
SOURCE="https://raw.githubusercontent.com/Amit75/Amit75/710e1b12c0f6be87910619ee13b4aeb37465dfeb/aarulya-play-v3"

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

echo "==> Downloading Aarulya Play V3"
for file in index.html styles.css app.js; do
  curl -fsSL --retry 3 --connect-timeout 15 "$SOURCE/$file" -o "$APP_DIR/$file.new"
  mv "$APP_DIR/$file.new" "$APP_DIR/$file"
done
chmod 0644 "$APP_DIR/index.html" "$APP_DIR/styles.css" "$APP_DIR/app.js"

echo "==> Validating product files"
grep -q '<title>Aarulya Play</title>' "$APP_DIR/index.html"
grep -q 'अब lobby नहीं—असली playable games' "$APP_DIR/index.html"
grep -q 'Aarulya Sky Rush' "$APP_DIR/index.html"
grep -q 'function sky' "$APP_DIR/app.js"
grep -q 'function goal' "$APP_DIR/app.js"
grep -q 'function stack' "$APP_DIR/app.js"
grep -q '.game-grid' "$APP_DIR/styles.css"

echo "==> Reloading static application"
docker inspect "$CONTAINER" >/dev/null
docker start "$CONTAINER" >/dev/null 2>&1 || true
docker exec "$CONTAINER" nginx -t
docker exec "$CONTAINER" nginx -s reload
sleep 4

echo "==> Verifying public build"
HTML="$(curl -ksSL --max-time 20 "https://aarulya.com/play/?v=3-$STAMP" || true)"
CSS_CODE="$(curl -ksS --max-time 20 -o /tmp/aarulya-v3.css -w '%{http_code}' "https://aarulya.com/play/styles.css?v=3-$STAMP" || true)"
JS_CODE="$(curl -ksS --max-time 20 -o /tmp/aarulya-v3.js -w '%{http_code}' "https://aarulya.com/play/app.js?v=3-$STAMP" || true)"

grep -q 'अब lobby नहीं—असली playable games' <<<"$HTML"
[ "$CSS_CODE" = "200" ]
[ "$JS_CODE" = "200" ]
grep -q '.game-grid' /tmp/aarulya-v3.css
grep -q 'function sky' /tmp/aarulya-v3.js

trap - ERR

echo
echo "=========================================="
echo "LIVE: https://aarulya.com/play/?v=3-$STAMP"
echo "GAMES: Sky Rush, Goal Master, Neon Stack"
echo "BACKUP: $BACKUP"
echo "=========================================="
