import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, '../../..');
const script = resolve(testsDir, '../../deploy/build-cloud-staging-image.sh');
const head = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const hex = 'c'.repeat(64);

function runMockedPodman(t, imageId, revision = head) {
  const temp = mkdtempSync(join(tmpdir(), 'aarulya-store-image-id-'));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const podman = join(temp, 'podman');
  const mockScript = [
    '#!/bin/sh',
    'set -eu',
    'case "$1" in',
    '  info) printf "true\\n" ;;',
    '  build) exit 0 ;;',
    '  image)',
    '    [ "$2" = inspect ] || exit 10',
    '    [ "$4" = --format ] || exit 11',
    '    case "$5" in',
    "      '{{.Id}}') printf '%s\\n' \"$MOCK_IMAGE_ID\" ;;",
    "      '{{index .Config.Labels \"org.opencontainers.image.revision\"}}') printf '%s\\n' \"$MOCK_REVISION_HEAD\" ;;",
    '      *) exit 12 ;;',
    '    esac',
    '    ;;',
    '  *) exit 13 ;;',
    'esac',
  ].join('\n') + '\n';
  writeFileSync(podman, mockScript, { mode: 0o700 });
  chmodSync(podman, 0o700);
  const output = join(temp, 'image.env');
  const result = spawnSync('bash', [script], {
    encoding: 'utf8',
    timeout: 15000,
    env: {
      ...process.env,
      PATH: temp + ':' + process.env.PATH,
      MOCK_IMAGE_ID: imageId,
      MOCK_REVISION_HEAD: revision,
      AARULYA_STORE_SOURCE_COMMIT: head,
      AARULYA_STAGING_CONTAINER_RUNTIME: 'podman',
      AARULYA_STAGING_IMAGE_ENV_OUTPUT: output,
    },
  });
  return { result, output };
}

for (const [name, raw] of [
  ['bare Podman digest', hex],
  ['sha256-prefixed Docker digest', 'sha256:' + hex],
]) {
  test('staging image records canonical digest from ' + name, (t) => {
    if (process.getuid?.() === 0) return t.skip('requires non-root build identity');
    const { result, output } = runMockedPodman(t, raw);
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
    assert.match(result.stdout, /AARULYA_STORE_STAGING_IMAGE=PASS/);
    assert.match(result.stdout, /PRODUCTION_DEPLOYED=false/);
    const record = readFileSync(output, 'utf8');
    assert.match(record, new RegExp('AARULYA_STORE_STAGING_BACKEND_IMAGE=sha256:' + hex));
    assert.match(record, new RegExp('AARULYA_STORE_STAGING_ARTIFACT_DIGEST=sha256:' + hex));
    assert.match(record, new RegExp('AARULYA_STORE_SOURCE_COMMIT=' + head));
  });
}

test('staging image rejects malformed image ID without writing evidence', (t) => {
  if (process.getuid?.() === 0) return t.skip('requires non-root build identity');
  const { result, output } = runMockedPodman(t, 'not-a-digest');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /immutable-local-image-id-invalid/);
  assert.equal(existsSync(output), false);
});

test('staging image rejects incorrect revision label', (t) => {
  if (process.getuid?.() === 0) return t.skip('requires non-root build identity');
  const { result, output } = runMockedPodman(t, hex, 'a'.repeat(40));
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /image-source-label-mismatch/);
  assert.equal(existsSync(output), false);
});
