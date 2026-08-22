import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const backendRoot = new URL('../', import.meta.url);
const storeRoot = new URL('../../', import.meta.url);

async function backend(path) {
  return readFile(new URL(path, backendRoot), 'utf8');
}

async function store(path) {
  return readFile(new URL(path, storeRoot), 'utf8');
}

test('production API cannot start with stub authentication or missing release repositories', async () => {
  const server = await backend('src/server.js');
  const composition = await backend('src/production-composition.js');
  const http = await backend('src/http-app.js');

  assert.doesNotMatch(server, /authenticate:\s*async\s*\(\)\s*=>\s*null/);
  assert.doesNotMatch(server, /releaseRepository:\s*null/);
  assert.match(server, /createProductionComposition/);
  assert.match(server, /releaseEnvelopeRepository/);
  assert.match(server, /publicationService/);
  assert.match(composition, /createOidcAccessTokenVerifier/);
  assert.match(composition, /PostgreSqlIdentityRepository/);
  assert.match(composition, /identityRepository\.resolveUser/);
  assert.match(composition, /PostgreSqlPublicationRepository/);
  assert.match(composition, /createPublicationService/);
  assert.match(http, /store-authenticator-required/);
  assert.match(http, /release-envelope-repository-required/);
  assert.match(http, /publication-service-required/);
  assert.match(http, /store:download/);
  assert.match(http, /store:install/);
  assert.match(http, /store:release:publish/);
  assert.match(http, /stepUp: true/);
});

test('database and release migrations require immutable signed evidence', async () => {
  const core = await backend('sql/0001_core.sql');
  const evidence = await backend('sql/0002_release_identity_and_artifacts.sql');
  const envelopes = await backend('sql/0003_signed_release_envelopes.sql');
  const approvals = await backend('sql/0008_release_approvals_and_risk_tiers.sql');
  const receipts = await backend('sql/0009_publication_receipts.sql');

  assert.match(core, /ENABLE ROW LEVEL SECURITY/);
  assert.match(core, /enforce_signer_continuity/);
  assert.match(core, /REVOKE ALL ON ALL TABLES IN SCHEMA aarulya_store FROM PUBLIC/);
  assert.match(evidence, /published_release_evidence_required/);
  assert.match(evidence, /release_evidence_immutable/);
  assert.match(evidence, /token_revocations/);
  assert.match(evidence, /session_revocations/);
  assert.match(envelopes, /signed_release_envelopes_immutable/);
  assert.match(envelopes, /canonical_payload_base64/);
  assert.match(envelopes, /transparency_inclusion/);
  assert.match(approvals, /release_approvals_immutable/);
  assert.match(approvals, /approval_threshold/);
  assert.match(approvals, /independent-security-reviewer/);
  assert.match(receipts, /release_publication_receipts_immutable/);
});

test('artifact services enforce one-time grant consumption and exact digest before streaming', async () => {
  const repository = await backend('src/artifact-repository.js');
  const server = await backend('src/artifact-server.js');

  assert.match(repository, /consume_download_grant/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /artifact-digest-mismatch/);
  assert.match(server, /application\/vnd\.android\.package-archive/);
  assert.match(server, /private, no-store/);
  assert.doesNotMatch(server, /createReadStream\([^)]*request/);
});

test('Android release build and install flow fail closed without signing identity and pinned trust roots', async () => {
  const build = await store('android-store/app/build.gradle.kts');
  const envelope = await store('android-store/app/src/main/java/com/aarulya/store/security/ReleaseEnvelopeVerifier.kt');
  const downloader = await store('android-store/app/src/main/java/com/aarulya/store/download/SecureApkDownloader.kt');
  const verifier = await store('android-store/app/src/main/java/com/aarulya/store/install/VerifiedApkVerifier.kt');

  assert.match(build, /validateReleaseTrustRoots/);
  assert.match(build, /validateExternalReleaseSigning/);
  assert.match(build, /AARULYA_ANDROID_SIGNING_STORE_FILE/);
  assert.match(build, /signing material must remain outside the repository/);
  assert.match(build, /aarulyaReleaseKeyFingerprints/);
  assert.match(envelope, /no-pinned-release-trust-root/);
  assert.match(envelope, /release-key-not-pinned-in-store-apk/);
  assert.match(envelope, /verifier\.verify\(signature\)/);
  assert.match(downloader, /download-redirect-prohibited/);
  assert.match(downloader, /apk-download-sha256-mismatch/);
  assert.match(verifier, /downgrade-or-same-version-prohibited/);
  assert.match(verifier, /installed-signer-continuity-failed/);
});

test('production packaging exposes only the edge and keeps service images digest-configured', async () => {
  const compose = await store('deploy/compose.production.yml');
  const caddy = await store('deploy/Caddyfile');

  assert.match(compose, /AARULYA_STORE_BACKEND_IMAGE:\?immutable backend image reference with digest required/);
  assert.match(compose, /AARULYA_CADDY_IMAGE:\?immutable Caddy image reference with digest required/);
  assert.match(compose, /private:\n\s+internal: true/);
  assert.match(compose, /cap_drop: \["ALL"\]/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.doesNotMatch(compose, /8080:8080/);
  for (const host of [
    'store.aarulya.com',
    'api.store.aarulya.com',
    'downloads.store.aarulya.com',
    'evidence.store.aarulya.com'
  ]) assert.match(caddy, new RegExp(host.replaceAll('.', '\\.'), 'g'));
});
