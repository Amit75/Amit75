# Aarulya Play production release checklist

## Required before revenue ads are enabled

- Create/register `com.aarulya.play` in the Owner-controlled AdMob account.
- Create production banner, interstitial and rewarded ad units.
- Configure Privacy & Messaging in AdMob/UMP for applicable regions.
- Supply production IDs only through protected release secrets/Gradle properties.
- Keep `LIVE_ADS_ENABLED=false` until the production IDs and consent configuration are reviewed.
- Verify child/teen/adult audience treatment and Google Play target-audience declarations before publishing.
- Complete the Play Console Data safety form based on the exact SDK/runtime behavior.
- Publish Privacy Policy and Terms on the Aarulya-controlled HTTPS domain.
- Generate one permanent upload/signing key, back it up offline, and never commit it.
- Run physical-device acceptance on at least one Android 8+, Android 13+ and current Android device.
- Verify gameplay with network unavailable; verify ads fail closed and gameplay remains functional.
- Verify banner is hidden during active gameplay.
- Verify interstitial appears only at a natural break and never interrupts a running match.
- Verify rewarded ad requires an explicit user action and grants virtual coins only.
- Verify no deposits, cash stakes, cash win/loss, or withdrawals are exposed.
- Build signed release APK/AAB from a clean exact commit and record SHA-256 digests.

## Cloud launch

When Aarulya Cloud is stable, deploy the web build under the Aarulya-controlled HTTPS route and keep the APK compatible with local/offline gameplay. Add Cloud-backed accounts/analytics only through versioned APIs with a fail-closed offline path.
