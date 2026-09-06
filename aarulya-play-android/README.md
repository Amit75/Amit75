# Aarulya Play Android

Native Android shell for the three existing Aarulya Play games:

- Aarulya Sky Rush
- Goal Master
- Neon Stack

The app packages the web game assets locally, so gameplay starts without requiring Aarulya Cloud to be online. Cloud can later provide analytics, accounts, leaderboards and remote configuration.

## Monetization boundary

Development builds use Google's official AdMob test app/ad-unit IDs. Production ads stay disabled unless `LIVE_ADS_ENABLED=true` is supplied together with owner-controlled production AdMob IDs.

Ads are intentionally limited to natural breaks:

- banner: lobby only; hidden while a game modal is active
- interstitial: after every third completed game
- rewarded: explicit opt-in after a completed game, granting only virtual coins
- app-open ads: not implemented
- forced mid-game ads: not implemented
- cash rewards / wagering: not implemented

The Android shell includes Google UMP consent gating before requesting ads and caps ad content to the `G` rating.

## Local build

Requires Java 17+, Android SDK 35 and Gradle 8.9+.

```bash
gradle :app:assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Production configuration

Do not commit production ad IDs or signing keys. Supply Gradle properties from the release environment:

```text
ADMOB_APP_ID=ca-app-pub-...~...
ADMOB_BANNER_ID=ca-app-pub-.../...
ADMOB_INTERSTITIAL_ID=ca-app-pub-.../...
ADMOB_REWARDED_ID=ca-app-pub-.../...
LIVE_ADS_ENABLED=true
```

A permanent Android signing key must be generated once, stored outside GitHub, backed up securely and used for every future update of the same package `com.aarulya.play`.
