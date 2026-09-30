#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() {
  printf 'AARULYA_STORE_DEVICE_ACCEPTANCE=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 1
}

for command in adb sha256sum; do
  command -v "$command" >/dev/null 2>&1 || fail "missing-command:$command"
done

[[ -n "${AARULYA_DEVICE_SERIAL:-}" ]] || fail 'AARULYA_DEVICE_SERIAL-required'
[[ -n "${AARULYA_ACCEPTANCE_APK:-}" ]] || fail 'AARULYA_ACCEPTANCE_APK-required'
[[ -f "$AARULYA_ACCEPTANCE_APK" && ! -L "$AARULYA_ACCEPTANCE_APK" ]] || fail 'acceptance-apk-invalid'
[[ -n "${AARULYA_EXPECTED_APK_SHA256:-}" ]] || fail 'AARULYA_EXPECTED_APK_SHA256-required'
[[ "$AARULYA_EXPECTED_APK_SHA256" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid-expected-apk-sha256'

actual_sha="$(sha256sum "$AARULYA_ACCEPTANCE_APK" | awk '{print $1}')"
[[ "$actual_sha" == "$AARULYA_EXPECTED_APK_SHA256" ]] || fail 'apk-sha256-mismatch'

state="$(adb -s "$AARULYA_DEVICE_SERIAL" get-state 2>/dev/null || true)"
[[ "$state" == 'device' ]] || fail 'approved-device-not-ready'

model="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.product.model | tr -d '\r')"
api="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
patch="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.build.version.security_patch | tr -d '\r')"

printf 'AARULYA_STORE_DEVICE_ACCEPTANCE=PREFLIGHT_PASS\n'
printf 'DEVICE_SERIAL=%s\n' "$AARULYA_DEVICE_SERIAL"
printf 'DEVICE_MODEL=%s\n' "$model"
printf 'ANDROID_API=%s\n' "$api"
printf 'SECURITY_PATCH=%s\n' "$patch"
printf 'APK_SHA256=%s\n' "$actual_sha"
printf 'INSTALL_EXECUTED=false\n'
printf 'NEXT=Follow docs/PHYSICAL_DEVICE_ACCEPTANCE.md with explicit owner-authorized installation and record signed evidence.\n'
