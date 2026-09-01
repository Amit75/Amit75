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

test('production API cannot start with stub authentication or shared publication authority', async () => {
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
  assert.match(composition, /IdempotentPostgreSqlStoreRepository/);
  assert.match(composition, /AARULYA_DOWNLOAD_TOKEN_HMAC_KEY_FILE/);
  assert.match(composition, /AARULYA_PUBLISHER_DATABASE_URL_FILE/);
  assert.match(composition, /publisherPool/);
  assert.match(http, /store-authenticator-required/);
  assert.match(http, /release-envelope-repository-required/);
  assert.match(http, /publication-service-required/);
  assert.match(http, /store:download/);
  assert.match(http, /store:install/);
  assert.match(http, /store:release:publish/);
  assert.match(http, /stepUp: true/);
});

test('database and release migrations require immutable signed evidence and isolated roles', async () => {
  const core = await backend('sql/0001_core.sql');
  const evidence = await backend('sql/0002_release_identity_and_artifacts.sql');
  const envelopes = await backend('sql/0003_signed_release_envelopes.sql');
  const approvals = await backend('sql/0008_release_approvals_and_risk_tiers.sql');
  const receipts = await backend('sql/0009_publication_receipts.sql');
  const hardening = await backend('sql/0010_runtime_identity_hardening.sql');
  const roles = await backend('bootstrap/roles.sql');

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
  assert.match(roles, /aarulya_store_publisher/);
  assert.match(hardening, /session_user/);
  assert.match(hardening, /GRANT UPDATE \(status, published_at\) ON app_versions TO aarulya_store_publisher/);
  assert.match(hardening, /REVOKE ALL ON ALL SEQUENCES IN SCHEMA aarulya_store/);
});

test('download grants are one-time, deterministic and cannot be resurrected by idempotency replay', async () => {
  const idempotent = await backend('src/idempotent-store-repository.js');
  const repository = await backend('src/artifact-repository.js');
  const server = await backend('src/artifact-server.js');

  assert.match(idempotent, /createHmac/);
  assert.match(idempotent, /download-idempotency-key-already-consumed/);
  assert.match(idempotent, /download-idempotency-key-expired/);
  assert.match(idempotent, /download-idempotency-key-bound-to-different-request/);
  assert.doesNotMatch(idempotent, /consumed_at\s*=\s*NULL/);
  assert.match(repository, /consume_download_grant/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /artifact-digest-mismatch/);
  assert.match(server, /application\/vnd\.android\.package-archive/);
  assert.match(server, /private, no-store/);
  assert.doesNotMatch(server, /createReadStream\([^)]*request/);
});

test('Android release build, OAuth callback and install flow fail closed', async () => {
  const build = await store('android-store/app/build.gradle.kts');
  const manifest = await store('android-store/app/src/main/AndroidManifest.xml');
  const oidc = await store('android-store/app/src/main/java/com/aarulya/store/auth/OidcPkceClient.kt');
  const api = await store('android-store/app/src/main/java/com/aarulya/store/api/StoreApiClient.kt');
  const envelope = await store('android-store/app/src/main/java/com/aarulya/store/security/ReleaseEnvelopeVerifier.kt');
  const downloader = await store('android-store/app/src/main/java/com/aarulya/store/download/SecureApkDownloader.kt');
  const verifier = await store('android-store/app/src/main/java/com/aarulya/store/install/VerifiedApkVerifier.kt');

  assert.match(build, /validateReleaseTrustRoots/);
  assert.match(build, /validateExternalReleaseSigning/);
  assert.match(build, /AARULYA_ANDROID_SIGNING_STORE_FILE/);
  assert.match(build, /https:\/\/identity\.aarulya\.com\/store\/android\/callback/);
  assert.match(manifest, /android:autoVerify="true"/);
  assert.match(manifest, /android:scheme="https"/);
  assert.doesNotMatch(manifest, /aarulya-store/);
  assert.match(oidc, /verified-https-redirect-required/);
  assert.match(oidc, /identity-redirect-prohibited/);
  assert.match(api, /json-response-required/);
  assert.match(api, /connection\.disconnect\(\)/);
  assert.match(envelope, /no-pinned-release-trust-root/);
  assert.match(envelope, /release-key-not-pinned-in-store-apk/);
  assert.match(envelope, /verifier\.verify\(signature\)/);
  assert.match(downloader, /download-redirect-prohibited/);
  assert.match(downloader, /apk-download-sha256-mismatch/);
  assert.match(verifier, /downgrade-or-same-version-prohibited/);
  assert.match(verifier, /installed-signer-continuity-failed/);
});

test('production packaging isolates every database identity and exposes only the edge', async () => {
  const compose = await store('deploy/compose.production.yml');
  const dockerfile = await backend('Dockerfile');
  const caddy = await store('deploy/Caddyfile');

  assert.match(compose, /migrator_database_url/);
  assert.match(compose, /api_database_url/);
  assert.match(compose, /publisher_database_url/);
  assert.match(compose, /downloads_database_url/);
  assert.match(compose, /worker_database_url/);
  assert.match(compose, /download_token_hmac_key/);
  assert.match(compose, /seed-catalog:/);
  assert.match(compose, /worker:/);
  assert.match(compose, /private:\n\s+internal: true/);
  assert.match(compose, /cap_drop: \["ALL"\]/);
  assert.match(compose, /no-new-privileges:true/);
  assert.doesNotMatch(compose, /5432:5432/);
  assert.doesNotMatch(compose, /8080:8080/);
  assert.match(dockerfile, /node:22\.23\.2-bookworm-slim@sha256:/);
  assert.match(dockerfile, /npm ci/);
  assert.doesNotMatch(dockerfile, /npm install/);
  for (const host of [
    'store.aarulya.com',
    'api.store.aarulya.com',
    'downloads.store.aarulya.com',
    'evidence.store.aarulya.com'
  ]) assert.match(caddy, new RegExp(host.replaceAll('.', '\\.'), 'g'));
});
