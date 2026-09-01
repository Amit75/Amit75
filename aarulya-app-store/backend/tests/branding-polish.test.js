import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const storeRoot = new URL('../../', import.meta.url);

async function source(path) {
  return readFile(new URL(path, storeRoot), 'utf8');
}

test('web and Android use the same original Aarulya Store mark', async () => {
  const index = await source('index.html');
  const svg = await source('assets/aarulya-store-mark.svg');
  const manifest = await source('android-store/app/src/main/AndroidManifest.xml');
  const mark = await source('android-store/app/src/main/res/drawable/ic_aarulya_mark.xml');
  const themed = await source('android-store/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml');
  const accountGate = await source('android-store/app/src/main/java/com/aarulya/store/ui/AccountGateView.kt');
  const home = await source('android-store/app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');

  assert.match(index, /assets\/aarulya-store-mark\.svg/);
  assert.match(index, /rel="icon" type="image\/svg\+xml"/);
  assert.match(svg, /Original geometric Aarulya letter A/);
  for (const color of ['#0F1E2E', '#F5C06A', '#00D4E0']) {
    assert.match(svg, new RegExp(color));
    assert.match(mark, new RegExp(color));
  }
  assert.match(manifest, /android:icon="@mipmap\/ic_launcher"/);
  assert.match(manifest, /android:roundIcon="@mipmap\/ic_launcher_round"/);
  assert.match(themed, /<monochrome/);
  assert.match(accountGate, /R\.drawable\.ic_aarulya_mark/);
  assert.match(home, /R\.drawable\.ic_aarulya_mark/);
  assert.doesNotMatch(index, /<span class="logo">A<\/span>/);
});

test('interaction polish is motion-aware and avoids immediate search rebuilds', async () => {
  const app = await source('src/app.js');
  const polish = await source('polish.css');
  const home = await source('android-store/app/src/main/java/com/aarulya/store/ui/StoreHomeView.kt');
  const activity = await source('android-store/app/src/main/java/com/aarulya/store/MainActivity.kt');

  assert.match(app, /SEARCH_DEBOUNCE_MS = 160/);
  assert.match(app, /scheduleSearch/);
  assert.match(app, /prefers-reduced-motion/);
  assert.match(polish, /prefers-reduced-motion:reduce/);
  assert.match(polish, /content-visibility:auto/);
  assert.match(polish, /focus-visible/);
  assert.match(home, /SEARCH_DEBOUNCE_MS = 180L/);
  assert.match(home, /RippleDrawable/);
  assert.match(home, /isSmoothScrollingEnabled = true/);
  assert.match(activity, /setContentViewSmooth/);
});

test('production edge includes final logo and polish assets', async () => {
  const compose = await source('deploy/compose.production.yml');
  const index = await source('index.html');

  assert.match(compose, /\.\.\/polish\.css:\/srv\/storefront\/polish\.css:ro/);
  assert.match(compose, /\.\.\/assets:\/srv\/storefront\/assets:ro/);
  assert.match(index, /href="polish\.css"/);
});

test('brand ownership manifest keeps release claims honest', async () => {
  const manifest = await source('docs/BRAND_ASSET_MANIFEST.md');

  assert.match(manifest, /first-party geometric source asset/);
  assert.match(manifest, /not imported from another app/);
  assert.match(manifest, /Final release evidence still requires/);
  assert.match(manifest, /No legal registration or production release is claimed/);
});
