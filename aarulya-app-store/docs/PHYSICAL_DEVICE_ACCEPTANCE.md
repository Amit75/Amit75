# Aarulya Store physical-device acceptance

Physical-device acceptance is required for the exact APK intended for release. Emulator-only evidence is insufficient.

## Approved-device preconditions

- Device is owner-controlled and explicitly selected for the acceptance run.
- Device model, Android version, security patch level and device serial/acceptance identifier are recorded.
- The exact APK SHA-256, package ID, version code and expected signer fingerprint are recorded before installation.
- Test accounts and test data are used unless production-data use is separately approved.
- USB debugging is disabled again after acceptance when it is not otherwise required.

## Required tests

1. Verify APK SHA-256 and APK signature before transfer.
2. Install with Android user confirmation; silent installation is prohibited.
3. Launch from a clean state and verify no first-launch permission prompt is requested without feature need.
4. Sign in through the verified HTTPS identity redirect.
5. Browse the authenticated catalog.
6. Exercise an approved download flow and verify release envelope, APK digest and signer continuity.
7. Deny optional permissions and confirm the application remains safe and usable for unaffected features.
8. Test app restart, device restart and session recovery.
9. Install an allowed higher version and verify update continuity.
10. Confirm same-version/downgrade/tampered APK paths fail closed.
11. Exercise uninstall/reinstall and account/session recovery.
12. Record crashes, ANRs, network failures and support-impacting defects.

## Evidence record

The acceptance record must bind device facts, source SHA, APK SHA-256, signer certificate SHA-256, version, timestamps, test results and evidence hashes.

This gate remains PARTIAL until the exact release APK completes the full device matrix and the signed acceptance record is retained.
