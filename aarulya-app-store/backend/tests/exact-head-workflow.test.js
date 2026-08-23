import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [workflow, dockerfile] = await Promise.all([
  readFile(new URL('../../../.github/workflows/aarulya-store-verify.yml', import.meta.url), 'utf8'),
  readFile(new URL('../Dockerfile', import.meta.url), 'utf8'),
]);

test('Store verification checks out the real PR head instead of a merge ref', () => {
  assert.match(workflow, /STORE_EXPECTED_HEAD: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u);
  assert.equal((workflow.match(/ref: \$\{\{ env\.STORE_EXPECTED_HEAD \}\}/gu) ?? []).length, 2);
  assert.match(workflow, /pr\.draft !== true/u);
  assert.match(workflow, /pr\.head\?\.sha !== process\.env\.EXPECTED_HEAD/u);
  assert.match(workflow, /AARULYA_SOURCE_COMMIT_SHA="\$STORE_EXPECTED_HEAD"/u);
  assert.doesNotMatch(workflow, /AARULYA_SOURCE_COMMIT_SHA="\$\{GITHUB_SHA\}"/u);
});

test('backend image and CI APK evidence bind to the exact source SHA', () => {
  assert.match(dockerfile, /ARG SOURCE_SHA=unknown/u);
  assert.match(dockerfile, /org\.opencontainers\.image\.revision="\$\{SOURCE_SHA\}"/u);
  assert.match(dockerfile, /USER 10001:10001/u);
  assert.match(workflow, /--build-arg "SOURCE_SHA=\$STORE_EXPECTED_HEAD"/u);
  assert.match(workflow, /exactHeadSha: process\.env\.STORE_EXPECTED_HEAD/u);
  assert.match(workflow, /artifactType: 'CI_TEST_SIGNED_APK'/u);
  assert.match(workflow, /productionSigned: false/u);
  assert.match(workflow, /physicalDeviceVerified: false/u);
  assert.match(workflow, /published: false/u);
});

test('verification workflow cannot deploy production', () => {
  assert.doesNotMatch(workflow, /workflow_run:|environment:\s*production|render|kubectl|ssh /iu);
});
