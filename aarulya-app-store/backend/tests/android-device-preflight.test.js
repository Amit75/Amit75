import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = resolve(fileURLToPath(new URL('.', import.meta.url)));
const script = resolve(directory, '..', '..', 'deploy', 'verify-device-acceptance.sh');
const exampleSigner = 'a'.repeat(64);
const serial = 'PRIVATE_SERIAL_MUST_NOT_BE_LOGGED';

function setupFixture() {
  const root = mkdtempSync(join(tmpdir(), 'aarulya-store-device-gate-'));
  const apk = join(root, 'dummy-test-only.apk');
  writeFileSync(apk, 'local-script-fixture-not-an-android-apk');
  const apkDigest = createHash('sha256').update('local-script-fixture-not-an-android-apk').digest('hex');

  const scripts = {
    apksigner: `#!/bin/sh\nprintf '%s\\n' 'Verified using v2 scheme (APK Signature Scheme v2): true' 'Verified using v3 scheme (APK Signature Scheme v3): true' 'Signer #1 certificate SHA-256 digest: ${exampleSigner}'\n`,
    aapt: `#!/bin/sh\nprintf "%s\\n" "package: name='com.aarulya.store' versionCode='1' versionName='0.1.0'"\n`,
    adb: `#!/bin/sh\ncase "$*" in *get-state*) echo device;; *ro.product.model*) echo CPH2859;; *ro.build.version.sdk*) echo 36;; *ro.build.version.security_patch*) echo 2026-09-05;; esac\n`,
  };
  for (const [name, content] of Object.entries(scripts)) {
    const file = join(root, name);
    writeFileSync(file, content, { mode: 0o700 });
    chmodSync(file, 0o700);
  }
  const env = {
    ...process.env,
    PATH: `${root}:${process.env.PATH}`,
    AARULYA_DEVICE_SERIAL: serial,
    AARULYA_ACCEPTANCE_APK: apk,
    AARULYA_EXPECTED_APK_SHA256: apkDigest,
    AARULYA_EXPECTED_SIGNER_SHA256: exampleSigner,
    AARULYA_EXPECTED_VERSION_CODE: '1',
  };
  return { root, env };
}

function runScript(env) {
  return spawnSync('bash', [script], { env, encoding: 'utf8', timeout: 5000 });
}

test('device acceptance preflight checks signer, package, version, hash and never installs', (t) => {
  const { root, env } = setupFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const result = runScript(env);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AARULYA_STORE_DEVICE_ACCEPTANCE=PREFLIGHT_PASS/);
  assert.match(result.stdout, /PACKAGE_NAME=com\.aarulya\.store/);
  assert.match(result.stdout, /VERSION_CODE=1/);
  assert.match(result.stdout, /DEVICE_MODEL=CPH2859/);
  assert.match(result.stdout, /INSTALL_EXECUTED=false/);
  assert.match(result.stdout, /PHYSICAL_DEVICE_QA_PASS=false/);
  assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_SERIAL_MUST_NOT_BE_LOGGED/);
});

for (const [label, change, reason] of [
  ['wrong APK', { AARULYA_EXPECTED_APK_SHA256: 'b'.repeat(64) }, 'apk-sha256-mismatch'],
  ['wrong signer', { AARULYA_EXPECTED_SIGNER_SHA256: 'b'.repeat(64) }, 'apk-signer-fingerprint-mismatch'],
  ['wrong version', { AARULYA_EXPECTED_VERSION_CODE: '2' }, 'apk-version-code-mismatch'],
  ['missing signer trust root', { AARULYA_EXPECTED_SIGNER_SHA256: '' }, 'invalid-expected-signer-sha256'],
]) {
  test(`device acceptance rejects ${label}`, (t) => {
    const { root, env } = setupFixture();
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const result = runScript({ ...env, ...change });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(reason));
    assert.doesNotMatch(result.stdout, /PREFLIGHT_PASS/);
  });
}

test('device acceptance rejects nonmatching package ID', (t) => {
  const { root, env } = setupFixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'aapt'), '#!/bin/sh\nprintf "%s\\n" "package: name=\'com.other.store\' versionCode=\'1\'"\n', { mode: 0o700 });
  const result = runScript(env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unexpected-apk-package-id/);
});
