#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

fail() {
  printf 'AARULYA_STORE_DEVICE_ACCEPTANCE=BLOCKED\nREASON=%s\n' "$1" >&2
  exit 1
}

for command in adb sha256sum apksigner aapt sed awk tr grep head; do
  command -v "$command" >/dev/null 2>&1 || fail "missing-command:$command"
done

[[ -n "${AARULYA_DEVICE_SERIAL:-}" ]] || fail 'AARULYA_DEVICE_SERIAL-required'
[[ -n "${AARULYA_ACCEPTANCE_APK:-}" ]] || fail 'AARULYA_ACCEPTANCE_APK-required'
[[ -f "$AARULYA_ACCEPTANCE_APK" && ! -L "$AARULYA_ACCEPTANCE_APK" ]] || fail 'acceptance-apk-invalid'

[[ "${AARULYA_EXPECTED_APK_SHA256:-}" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid-expected-apk-sha256'
[[ "${AARULYA_EXPECTED_SIGNER_SHA256:-}" =~ ^[a-f0-9]{64}$ ]] || fail 'invalid-expected-signer-sha256'
[[ "${AARULYA_EXPECTED_VERSION_CODE:-}" =~ ^[1-9][0-9]*$ ]] || fail 'invalid-expected-version-code'

actual_sha="$(sha256sum "$AARULYA_ACCEPTANCE_APK" | awk '{print $1}')"
[[ "$actual_sha" == "$AARULYA_EXPECTED_APK_SHA256" ]] || fail 'apk-sha256-mismatch'

signature_report="$(apksigner verify --verbose --print-certs "$AARULYA_ACCEPTANCE_APK" 2>/dev/null)" \
  || fail 'apk-signature-verification-failed'
grep -Fq 'Verified using v2 scheme (APK Signature Scheme v2): true' <<< "$signature_report" \
  || fail 'apk-v2-signature-not-verified'
grep -Fq 'Verified using v3 scheme (APK Signature Scheme v3): true' <<< "$signature_report" \
  || fail 'apk-v3-signature-not-verified'
! grep -Eq '^Signer #[2-9][0-9]* certificate SHA-256 digest:' <<< "$signature_report" \
  || fail 'unexpected-multiple-apk-signers'
signer_sha="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<< "$signature_report" | tr -d ':[:space:]' | tr '[:upper:]' '[:lower:]')"
[[ "$signer_sha" =~ ^[a-f0-9]{64}$ ]] || fail 'apk-signer-fingerprint-invalid'
[[ "$signer_sha" == "$AARULYA_EXPECTED_SIGNER_SHA256" ]] || fail 'apk-signer-fingerprint-mismatch'

badging="$(aapt dump badging "$AARULYA_ACCEPTANCE_APK" 2>/dev/null)" || fail 'apk-badging-unavailable'
package_name="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<< "$badging" | head -n 1)"
version_code="$(sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p" <<< "$badging" | head -n 1)"
[[ "$package_name" == 'com.aarulya.store' ]] || fail 'unexpected-apk-package-id'
[[ "$version_code" == "$AARULYA_EXPECTED_VERSION_CODE" ]] || fail 'apk-version-code-mismatch'

state="$(adb -s "$AARULYA_DEVICE_SERIAL" get-state 2>/dev/null || true)"
[[ "$state" == 'device' ]] || fail 'approved-device-not-ready'

model="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.product.model | tr -d '\r')"
api="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.build.version.sdk | tr -d '\r')"
patch="$(adb -s "$AARULYA_DEVICE_SERIAL" shell getprop ro.build.version.security_patch | tr -d '\r')"
[[ "$api" =~ ^[0-9]+$ ]] || fail 'device-android-api-invalid'
(( api >= 26 )) || fail 'device-android-api-below-minimum'
[[ "$patch" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail 'device-security-patch-invalid'
device_fingerprint="$(printf '%s' "$AARULYA_DEVICE_SERIAL" | sha256sum | awk '{print substr($1,1,16)}')"

printf 'AARULYA_STORE_DEVICE_ACCEPTANCE=PREFLIGHT_PASS\n'
printf 'DEVICE_SERIAL_SHA256_PREFIX=%s\n' "$device_fingerprint"
printf 'DEVICE_MODEL=%s\nANDROID_API=%s\nSECURITY_PATCH=%s\n' "$model" "$api" "$patch"
printf 'PACKAGE_NAME=%s\nVERSION_CODE=%s\n' "$package_name" "$version_code"
printf 'APK_SHA256=%s\nSIGNER_SHA256=%s\n' "$actual_sha" "$signer_sha"
printf 'INSTALL_EXECUTED=false\nPHYSICAL_DEVICE_QA_PASS=false\n'
printf 'NEXT=Only after explicit owner approval, complete the manual device matrix and record signed evidence.\n'
