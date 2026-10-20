# Aarulya Store physical-device acceptance (owner gated)

This procedure tests an **exact APK**. Passing it never approves production, DNS changes, publication, signing-key activation or real user data.

## Current test devices

- Primary candidate: owner's **OPPO Reno16c 5G**, model CPH2859, Android 16. Verify actual API level and patch from the device at test time.
- A second physically distinct Android device (API 26 or later) is required for the final compatibility matrix. Do not substitute an emulator for the entire matrix.
- No IMEI, phone number, serial or other personal device identifier may be committed, shared in chat or copied to public CI logs. The preflight outputs only a shortened SHA-256 of the ADB serial.

## Mandatory checks before any installation

1. The owner explicitly authorizes the particular device and exact APK. This repository performs **no installation** as part of preflight.
2. Record the exact Git commit and a trusted, independently sourced APK SHA-256, signing certificate SHA-256, package name and version code. Do not take expected values from the unverified APK itself.
3. For the Store, package ID must equal `com.aarulya.store`. Minimum Android API is 26.
4. Use Android SDK platform-tools, `apksigner` and `aapt` from a trusted local SDK installation.
5. Set these locally (never put serials in GitHub or chat). Replace the placeholders using the **trusted build receipt**:

```bash
export AARULYA_DEVICE_SERIAL='<owner-selected-adb-serial>'
export AARULYA_ACCEPTANCE_APK='/secure/path/to/verified-store.apk'
export AARULYA_EXPECTED_APK_SHA256='<64-lowercase-hex-from-build-receipt>'
export AARULYA_EXPECTED_SIGNER_SHA256='<64-lowercase-hex-from-trusted-signing-receipt>'
export AARULYA_EXPECTED_VERSION_CODE='1'
bash aarulya-app-store/deploy/verify-device-acceptance.sh
```

Expected result is `AARULYA_STORE_DEVICE_ACCEPTANCE=PREFLIGHT_PASS`, `INSTALL_EXECUTED=false` and `PHYSICAL_DEVICE_QA_PASS=false`. Any hash, signer, package, version, missing tool, unsupported device or device-state mismatch must fail closed.

The GitHub Actions artifact with `CI_TEST_SIGNED_APK` uses **disposable CI credentials**. It is for controlled tests only, never customer distribution, and will not provide production signing-key continuity. Installing a test-signed `com.aarulya.store` on a phone requires uninstalling it before installing a production version with a different signer; arrange test-data backup and explicit owner approval first.

## Owner-authorized manual test matrix

Only after preflight and express owner approval:

1. Verify exact signer/digest/version again immediately before transfer and installation.
2. Install with Android's visible permission/confirmation flow, never silently.
3. Cold launch. No unrelated permissions may be prompted at startup.
4. Try anonymous browsing and sign-in flows as designed; record unavailable features as **BLOCKED**, not PASS.
5. Verify identity HTTPS/OIDC app link only against an accepted staging provider, never unapproved production endpoints.
6. Test authenticated catalog, search, category navigation and real approved downloads using an isolated **test** release and isolated test account.
7. Confirm downloaded APK digest, package name, signing-key continuity, release envelope and installation confirmation.
8. Deny optional notifications and install-source access. Browsing must remain usable.
9. Test app restart, device restart, background/foreground and lost network; record recovery behavior.
10. Test allowed update, rollback prevention, same-version refusal, revoked-release refusal and tampered APK refusal.
11. Test uninstall/reinstall, account/session revocation, accessibility, performance, crashes and unsupported input.
12. Repeat required coverage on a second independent supported Android phone.

If no safely configured staging backend, identity service, test artifacts or consent is available, do not fabricate successful end-to-end results.

## Acceptance evidence

Maintain a private record bound to: exact source SHA, APK SHA-256, trusted signer fingerprint, package ID, version code, timestamp, non-reversible device identifier, Android API/patch, actual test steps, signed evidence references and observed failures. No plaintext personal serials, OTPs or passwords.

**PASS boundary:** preflight checks are not physical-device QA; a CI test-signed APK is not an owner-signed production release. Store launch remains blocked until a separate production-signing ceremony, independent rebuild/security assessment, staging/identity/HTTPS acceptance, download/rollback drills, and exact-release owner approval are complete.
