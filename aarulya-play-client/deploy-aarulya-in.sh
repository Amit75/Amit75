#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="aarulya.in"
PUBLIC_PATH="/play"
APP_NAME="aarulya-play-static"
APP_DIR="/opt/aarulya/play"
SOURCE_URL="https://raw.githubusercontent.com/Amit75/Amit75/main/aarulya-play-client/index.html"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/opt/aarulya/backups/aarulya-play-${STAMP}"

fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
info() { printf '\n==> %s\n' "$*"; }

[[ ${EUID:-$(id -u)} -eq 0 ]] || fail "Run as root (sudo bash)."
command -v docker >/dev/null 2>&1 || fail "Docker is not installed."
command -v curl >/dev/null 2>&1 || fail "curl is not installed."
command -v python3 >/dev/null 2>&1 || fail "python3 is not installed."

info "Locating the live Caddy gateway"
CADDY_CONTAINER="$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | awk 'tolower($0) ~ /caddy/ {print $1; exit}')"
[[ -n "$CADDY_CONTAINER" ]] || fail "No running Caddy container found."
CADDY_NAME="$(docker inspect -f '{{.Name}}' "$CADDY_CONTAINER" | sed 's#^/##')"
printf 'Caddy container: %s\n' "$CADDY_NAME"

info "Finding the persistent Caddyfile"
CADDYFILE_HOST="$(docker inspect "$CADDY_CONTAINER" | python3 -c '
import json, os, sys
obj=json.load(sys.stdin)[0]
for m in obj.get("Mounts", []):
    dst=m.get("Destination", "")
    src=m.get("Source", "")
    if dst == "/etc/caddy/Caddyfile":
        print(src); raise SystemExit
for m in obj.get("Mounts", []):
    dst=m.get("Destination", "")
    src=m.get("Source", "")
    if dst == "/etc/caddy":
        print(os.path.join(src, "Caddyfile")); raise SystemExit
')"
[[ -n "$CADDYFILE_HOST" && -f "$CADDYFILE_HOST" ]] || fail "Persistent /etc/caddy/Caddyfile mount was not found. Nothing was changed."
printf 'Caddyfile: %s\n' "$CADDYFILE_HOST"

mkdir -p "$BACKUP_DIR" "$APP_DIR"
cp -a "$CADDYFILE_HOST" "$BACKUP_DIR/Caddyfile.before"
if docker inspect "$APP_NAME" >/dev/null 2>&1; then
  docker inspect "$APP_NAME" > "$BACKUP_DIR/${APP_NAME}.inspect.json" || true
fi

info "Downloading the client build"
TMP_HTML="$(mktemp)"
curl -fL --retry 3 --connect-timeout 15 "$SOURCE_URL" -o "$TMP_HTML"
grep -q '<title>Aarulya Play</title>' "$TMP_HTML" || fail "Downloaded file did not pass the product identity check."
install -m 0644 "$TMP_HTML" "$APP_DIR/index.html"
rm -f "$TMP_HTML"
cat > "$APP_DIR/health.txt" <<EOF
Aarulya Play ${STAMP}
EOF

info "Starting isolated static application container"
docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  --label com.aarulya.product=play \
  --label com.aarulya.public-path=/play/ \
  -v "$APP_DIR:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine >/dev/null

info "Connecting the application to the gateway networks"
mapfile -t CADDY_NETWORKS < <(docker inspect "$CADDY_CONTAINER" | python3 -c '
import json, sys
obj=json.load(sys.stdin)[0]
for name in (obj.get("NetworkSettings",{}).get("Networks",{}) or {}):
    print(name)
')
[[ ${#CADDY_NETWORKS[@]} -gt 0 ]] || fail "Caddy has no Docker network."
for net in "${CADDY_NETWORKS[@]}"; do
  docker network connect "$net" "$APP_NAME" >/dev/null 2>&1 || true
done

info "Checking the application before routing"
for _ in $(seq 1 20); do
  if docker exec "$APP_NAME" wget -qO- http://127.0.0.1/health.txt | grep -q 'Aarulya Play'; then
    break
  fi
  sleep 1
done
docker exec "$APP_NAME" wget -qO- http://127.0.0.1/health.txt | grep -q 'Aarulya Play' || fail "Static application health check failed."

info "Adding an isolated ${PUBLIC_PATH}/ route"
if ! grep -q 'aarulya-play-static:80' "$CADDYFILE_HOST"; then
  PATCHED="$(mktemp)"
  python3 - "$CADDYFILE_HOST" "$PATCHED" "$DOMAIN" <<'PY'
import re, sys
src, dst, domain = sys.argv[1:]
text = open(src, encoding="utf-8").read()
lines = text.splitlines(True)
start = None
level = 0
end = None
for i, line in enumerate(lines):
    stripped = line.strip()
    if start is None and "{" in line and domain in line and not stripped.startswith("#"):
        start = i
        level = line.count("{") - line.count("}")
        if level <= 0:
            start = None
        continue
    if start is not None:
        level += line.count("{") - line.count("}")
        if level == 0:
            end = i
            break
if start is None or end is None:
    raise SystemExit(f"Could not locate a Caddy site block containing {domain}")
indent_match = re.match(r"(\s*)", lines[end])
base = indent_match.group(1)
block = (
    f"{base}    # Aarulya Play: managed isolated route\n"
    f"{base}    redir /play /play/ 308\n"
    f"{base}    handle_path /play/* {{\n"
    f"{base}        reverse_proxy aarulya-play-static:80\n"
    f"{base}    }}\n\n"
)
lines.insert(end, block)
open(dst, "w", encoding="utf-8").write("".join(lines))
PY
  cp "$PATCHED" "$CADDYFILE_HOST"
  rm -f "$PATCHED"
fi

info "Validating Caddy configuration"
if ! docker exec "$CADDY_CONTAINER" caddy validate --config /etc/caddy/Caddyfile; then
  cp "$BACKUP_DIR/Caddyfile.before" "$CADDYFILE_HOST"
  docker rm -f "$APP_NAME" >/dev/null 2>&1 || true
  fail "Caddy validation failed. The original configuration was restored."
fi

info "Reloading the gateway"
docker exec "$CADDY_CONTAINER" caddy reload --config /etc/caddy/Caddyfile

info "Verifying the public URL"
SUCCESS=0
for _ in $(seq 1 24); do
  BODY="$(curl -fsSL --max-time 15 "https://${DOMAIN}${PUBLIC_PATH}/" 2>/dev/null || true)"
  if grep -q '<title>Aarulya Play</title>' <<<"$BODY"; then
    SUCCESS=1
    break
  fi
  sleep 5
done

if [[ "$SUCCESS" -ne 1 ]]; then
  printf '\nDeployment is running, but the external HTTPS check did not pass yet.\n'
  printf 'Check DNS for %s and inspect: docker logs %s\n' "$DOMAIN" "$CADDY_NAME"
  printf 'Backup: %s\n' "$BACKUP_DIR"
  exit 2
fi

printf '\nLIVE: https://%s%s/\n' "$DOMAIN" "$PUBLIC_PATH"
printf 'Backup: %s\n' "$BACKUP_DIR"
printf 'Container: %s\n' "$APP_NAME"
