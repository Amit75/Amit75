import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [
  webApp,
  installPage,
  installScript,
  manifest,
  mainActivity,
  secureSessionStore,
  memoryService,
  postgresRepository,
  workflow,
] = await Promise.all([
  readFile(new URL('../../src/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../../install/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../../install/install.js', import.meta.url), 'utf8'),
  readFile(new URL('../../android-store/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8'),
  readFile(new URL('../../android-store/app/src/main/java/com/aarulya/store/MainActivity.kt', import.meta.url), 'utf8'),
  readFile(new URL('../../android-store/app/src/main/java/com/aarulya/store/auth/SecureSessionStore.kt', import.meta.url), 'utf8'),
  readFile(new URL('../src/store-service.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/postgres-store-repository.js', import.meta.url), 'utf8'),
  readFile(new URL('../../../.github/workflows/aarulya-store-verify.yml', import.meta.url), 'utf8'),
]);

test('web catalog hands published installs to the canonical Store app-link only', () => {
  assert.match(webApp, /https:\/\/store\.aarulya\.com\/install/u);
  assert.match(webApp, /searchParams\.set\('app', appId\)/u);
  assert.match(webApp, /Aarulya Store app में खोलें/u);
  assert.doesNotMatch(webApp, /window\.location\.(?:assign|href)\s*\(?\s*app\.apkUrl/u);
  assert.doesNotMatch(webApp, /downloads\.store\.aarulya\.com/u);
});

test('browser fallback never exposes an APK, access token or download grant', () => {
  assert.match(installPage, /कोई APK, access token या one-time download grant सीधे नहीं दिया जाता/u);
  assert.match(installScript, /CANONICAL_ORIGIN = 'https:\/\/store\.aarulya\.com'/u);
  assert.match(installScript, /onlyAppParameter/u);
  assert.doesNotMatch(`${installPage}\n${installScript}`, /downloads\.store\.aarulya\.com|authorization\s*:\s*bearer|apkUrl/iu);
});

test('Android accepts only the exact canonical install link and encrypted pending state', () => {
  assert.match(manifest, /android:host="store\.aarulya\.com"/u);
  assert.match(manifest, /android:path="\/install"/u);
  assert.match(mainActivity, /uri\.scheme != "https" \|\| uri\.host != "store\.aarulya\.com"/u);
  assert.match(mainActivity, /uri\.queryParameterNames != setOf\("app"\)/u);
  assert.match(mainActivity, /sessionStore\.savePendingInstall/u);
  assert.match(mainActivity, /resumePendingInstallIfReady/u);
  assert.match(mainActivity, /verifiedReleaseAvailable/u);
  assert.match(secureSessionStore, /writeEncrypted\("pending_install"/u);
  assert.match(secureSessionStore, /createdAtEpochSeconds > System\.currentTimeMillis\(\) \/ 1000L - 1800/u);
});

test('memory and PostgreSQL authorization responses share the bounded grant URL contract', () => {
  for (const source of [memoryService, postgresRepository]) {
    assert.match(source, /downloadUrl:/u);
    assert.match(source, /\/v1\/grants\/\$\{/u);
    assert.match(source, /\/apk/u);
  }
  assert.match(postgresRepository, /DOWNLOAD_TTL_SECONDS = 300/u);
  assert.match(memoryService, /DOWNLOAD_TTL_MS = 5 \* 60 \* 1000/u);
});

test('CI evidence refuses to claim app-link association before production assetlinks proof', () => {
  assert.match(workflow, /appLinkAssetAssociationVerified: false/u);
  assert.match(workflow, /productionSigned: false/u);
  assert.match(workflow, /published: false/u);
});
