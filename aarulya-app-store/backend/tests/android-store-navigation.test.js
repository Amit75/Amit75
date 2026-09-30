import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const androidRoot = new URL('../../android-store/', import.meta.url);

async function source(path) {
  return readFile(new URL(path, androidRoot), 'utf8');
}

test('Android Store exposes the agreed unified top and bottom navigation', async () => {
  const catalog = await source('app/src/main/java/com/aarulya/store/catalog/StoreCatalog.kt');
  const home = await source('app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');

  assert.match(catalog, /listOf\("For You", "Top Charts", "Kids", "Categories"\)/);
  assert.match(catalog, /listOf\("Games", "Apps", "Search", "Books", "You"\)/);
  assert.match(home, /StoreCatalog\.topTabs/);
  assert.match(home, /StoreCatalog\.bottomDestinations/);
  assert.match(home, /renderTopCharts\(\)/);
  assert.match(home, /renderCategories\(\)/);
});

test('chart and listing UI never fabricates verification, installs or ratings', async () => {
  const catalog = await source('app/src/main/java/com/aarulya/store/catalog/StoreCatalog.kt');
  const home = await source('app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');

  assert.match(catalog, /fun verifiedTopCharts\(\): List<StoreApp> = emptyList\(\)/);
  assert.match(home, /No verified chart data yet/);
  assert.match(home, /real verified installs/);
  assert.doesNotMatch(catalog, /Aarulya Verified/);
  assert.doesNotMatch(catalog, /[0-9]+(?:\.[0-9]+)?[MK]\+ installs/i);
  assert.doesNotMatch(catalog, /[0-5]\.[0-9]\s*★/);
});

test('app detail view exposes explicit data safety, permissions, security and versions states', async () => {
  const activity = await source('app/src/main/java/com/aarulya/store/MainActivity.kt');

  for (const section of ['About', 'Data safety', 'Permissions', 'Security', 'Versions']) {
    assert.match(activity, new RegExp(`${section}\\\\n`));
  }
  assert.match(activity, /Missing evidence blocks download/);
  assert.match(activity, /No verified public release is available/);
  assert.match(activity, /development record, not a production-release claim/);
});

test('Android build keeps storefront, API, downloads and evidence on isolated origins', async () => {
  const build = await source('app/build.gradle.kts');

  assert.match(build, /https:\/\/store\.aarulya\.com/);
  assert.match(build, /https:\/\/api\.store\.aarulya\.com\/api\/v1/);
  assert.match(build, /https:\/\/downloads\.store\.aarulya\.com/);
  assert.match(build, /https:\/\/evidence\.store\.aarulya\.com/);
  assert.match(build, /isDebuggable = false/);
  assert.match(build, /isMinifyEnabled = true/);
  assert.match(build, /warningsAsErrors = true/);
});

test('authenticated remote catalog enables only verified published releases', async () => {
  const remote = await source('app/src/main/java/com/aarulya/store/catalog/RemoteCatalogRepository.kt');

  assert.match(remote, /latestVersionCode/);
  assert.match(remote, /apkSizeBytes/);
  assert.match(remote, /evidenceStatus == "release-envelope-required-at-download"/);
  assert.match(remote, /verifiedReleaseAvailable = releaseAvailable/);
  assert.match(remote, /status == "published"/);
});

test('Aarulya logo, adaptive icon and clean theme are applied consistently', async () => {
  const manifest = await source('app/src/main/AndroidManifest.xml');
  const mark = await source('app/src/main/res/drawable/ic_aarulya_mark.xml');
  const adaptive = await source('app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml');
  const theme = await source('app/src/main/res/values/styles.xml');
  const home = await source('app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');
  const gate = await source('app/src/main/java/com/aarulya/store/ui/AccountGateView.kt');

  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(manifest, /android:theme="@style\/Theme\.AarulyaStore"/);
  assert.match(mark, /#F5C06A/);
  assert.match(mark, /#00D4E0/);
  assert.match(adaptive, /<monochrome/);
  assert.match(theme, /Theme\.AarulyaStore/);
  assert.match(home, /R\.drawable\.ic_aarulya_mark/);
  assert.match(gate, /R\.drawable\.ic_aarulya_mark/);
});

test('Store interaction avoids per-keystroke heavy rendering and provides motion feedback', async () => {
  const home = await source('app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');
  const activity = await source('app/src/main/java/com/aarulya/store/MainActivity.kt');

  assert.match(home, /SEARCH_DEBOUNCE_MS = 180L/);
  assert.match(home, /postDelayed/);
  assert.match(home, /RippleDrawable/);
  assert.match(home, /isSmoothScrollingEnabled = true/);
  assert.match(home, /setDuration\(140L\)/);
  assert.match(activity, /setContentViewSmooth/);
  assert.match(activity, /setDuration\(160L\)/);
  assert.match(activity, /R\.drawable\.ic_aarulya_mark/);
});


test('Android You tab exposes bounded session state and secure server-backed sign out', async () => {
  const home = await source('app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');
  const activity = await source('app/src/main/java/com/aarulya/store/MainActivity.kt');
  const api = await source('app/src/main/java/com/aarulya/store/api/StoreApiClient.kt');

  assert.match(home, /sessionExpiresAtEpochSeconds/);
  assert.match(home, /Sign out securely/);
  assert.match(home, /onSignOut/);
  assert.match(activity, /apiClient\.revokeCurrentSession/);
  assert.match(activity, /sessionStore\.clear\(\)/);
  assert.match(api, /sessions.*current.*revoke/s);
});
