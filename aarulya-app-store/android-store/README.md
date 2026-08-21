# Aarulya Store Android foundation

This directory contains the Android-first Store installer foundation for Aarulya-owned APKs.

## Permission model

- No runtime or special permission is requested on first launch.
- Internet access is a normal permission and does not trigger a runtime dialog.
- Update notifications are optional and requested only after the user enables alerts.
- `REQUEST_INSTALL_PACKAGES` is used only by the Store installer after the user presses Install.
- The user is sent to Android's per-source **Install unknown apps** settings only when installation is requested.
- Denying notifications or install-source access does not block browsing, search, Trust Receipts or other unrelated Store features.
- The Store does not request camera, microphone, contacts, location, SMS, call logs, overlay, accessibility, device-admin or broad storage access.
- File and media selection must use Android system pickers where applicable.

## Verified installation boundary

Before opening an Android package installation session, the Store must verify:

1. Explicit user Install action.
2. Active short-lived server download grant.
3. APK SHA-256.
4. Aarulya package ID.
5. Exact version code.
6. Aarulya signing certificate digest.
7. Release is not revoked and remains eligible.

The Android system confirmation screen remains mandatory. Silent or hidden installation is not part of this foundation.

## Privacy controls

- Permission purpose is shown before the Android prompt or special-access screen.
- Consent is granular, revocable and never preselected.
- Privacy Center is required for notifications, cloud sync, analytics, export and deletion controls.
- No unrelated feature can be blocked because a user denied an optional permission.
- Sensitive data is not backed up or transferred through Android backup mechanisms.

## Build baseline

- Android Gradle Plugin 9.3.0
- Kotlin Android plugin 2.3.21
- Compile/target SDK 37
- Minimum SDK 26
- Cleartext network traffic disabled
- Release minification and resource shrinking enabled
- Release lint warnings treated as errors

## Current boundary

This is source foundation only. It is not yet a signed, installed or production-verified APK. Build execution, device tests, permission-flow tests, installer tests, signer verification tests and final evidence reports remain required before publication.
