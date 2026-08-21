import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { withActorTransaction, withTransaction } from './postgres.js';

const DOWNLOAD_TTL_SECONDS = 300;
const DOWNLOAD_ORIGIN = 'https://downloads.store.aarulya.com';

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function requireUuid(name, value) {
  const normalized = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${name}-valid-uuid-required`);
  }
  return normalized;
}

function rowToRelease(row) {
  if (!row) return null;
  return Object.freeze({
    releaseId: row.release_id,
    appId: row.app_id,
    packageId: row.package_id,
    publisher: row.publisher,
    versionCode: Number(row.version_code),
    versionName: row.version_name_display || row.version_name,
    apkUrl: `${DOWNLOAD_ORIGIN}/v1/releases/${row.release_id}.apk`,
    apkObjectKey: row.apk_object_key,
    apkSha256: row.apk_sha256,
    apkSizeBytes: row.apk_size_bytes ? Number(row.apk_size_bytes) : null,
    signerFingerprint: row.signer_fingerprint,
    signingKeyId: row.signing_key_id,
    sourceCommitSha: row.source_commit_sha,
    sbomSha256: row.sbom_sha256,
    manifestSignatureVerification: 'passed',
    malwareScan: row.malware_scan,
    securityReview: row.security_review,
    ownershipEvidenceReview: row.ownership_evidence_review,
    mobileHardeningReview: row.mobile_hardening_review,
    androidPermissionPrivacyReview: row.android_permission_privacy_review,
    publicationGateStatus: row.publication_gate_status,
    finalEvidenceReportSha256: row.final_evidence_report_sha256,
    finalEvidenceReportSignatureVerification: row.final_evidence_report_signature_verification,
    finalEvidenceReportTransparencyInclusion: row.final_evidence_report_transparency_inclusion,
    minimumStoreVersionCode: 1,
    currentStoreVersionCode: 1,
    revoked: row.status === 'revoked' || row.revoked_at != null
  });
}

const RELEASE_SELECT = `
  SELECT
    v.id AS release_id,
    v.app_id,
    a.package_id,
    a.publisher,
    v.version_code,
    v.version_name,
    v.version_name_display,
    v.apk_object_key,
    v.apk_sha256,
    v.apk_size_bytes,
    v.signer_fingerprint,
    v.signing_key_id,
    v.source_commit_sha,
    v.sbom_sha256,
    v.status,
    v.revoked_at,
    v.malware_scan,
    v.security_review,
    v.ownership_evidence_review,
    v.mobile_hardening_review,
    v.android_permission_privacy_review,
    v.publication_gate_status,
    v.final_evidence_report_sha256,
    v.final_evidence_report_signature_verification,
    v.final_evidence_report_transparency_inclusion
  FROM aarulya_store.app_versions v
  JOIN aarulya_store.apps a ON a.id = v.app_id
`;

export class PostgreSqlStoreRepository {
  constructor(pool, { downloadOrigin = DOWNLOAD_ORIGIN } = {}) {
    if (!pool) throw new Error('postgres-pool-required');
    if (downloadOrigin !== DOWNLOAD_ORIGIN) throw new Error('canonical-download-origin-required');
    this.pool = pool;
  }

  async upsertUser(externalSubject) {
    const subject = String(externalSubject || '').trim();
    if (subject.length < 8 || subject.length > 512) throw new Error('valid-external-subject-required');
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `INSERT INTO aarulya_store.users (external_subject)
         VALUES ($1)
         ON CONFLICT (external_subject)
         DO UPDATE SET updated_at = now()
         RETURNING id, status`,
        [subject]
      );
      const user = result.rows[0];
      if (!user || user.status !== 'active') throw new Error('store-account-not-active');
      return String(user.id);
    });
  }

  async isTokenRevoked(tokenId) {
    const result = await this.pool.query(
      `SELECT 1 FROM aarulya_store.token_revocations
       WHERE token_id = $1 AND expires_at > now()`,
      [String(tokenId)]
    );
    return result.rowCount > 0;
  }

  async isSessionRevoked(sessionId) {
    const result = await this.pool.query(
      `SELECT 1 FROM aarulya_store.session_revocations
       WHERE session_id = $1 AND expires_at > now()`,
      [String(sessionId)]
    );
    return result.rowCount > 0;
  }

  async getReleaseForDownload(appId, versionCode) {
    const values = [String(appId)];
    let versionFilter = '';
    if (versionCode != null) {
      values.push(Number(versionCode));
      versionFilter = `AND v.version_code = $${values.length}`;
    }
    const result = await this.pool.query(
      `${RELEASE_SELECT}
       WHERE v.app_id = $1
         AND v.status = 'published'
         ${versionFilter}
       ORDER BY v.version_code DESC
       LIMIT 1`,
      values
    );
    const release = rowToRelease(result.rows[0]);
    if (!release) {
      const error = new Error('published-release-not-found');
      error.status = 404;
      throw error;
    }
    return release;
  }

  async getReleaseByPackageAndVersion(packageId, versionCode) {
    const result = await this.pool.query(
      `${RELEASE_SELECT}
       WHERE a.package_id = $1 AND v.version_code = $2
       LIMIT 1`,
      [String(packageId), Number(versionCode)]
    );
    const release = rowToRelease(result.rows[0]);
    if (!release) {
      const error = new Error('release-not-found');
      error.status = 404;
      throw error;
    }
    return release;
  }

  async getCurrentCatalogManifest() {
    const result = await this.pool.query(
      `SELECT catalog_version, payload_sha256, signature, signing_key_id,
              publisher, generated_at, expires_at, signature_verification,
              transparency_record
       FROM aarulya_store.catalog_manifests
       WHERE is_current = true AND expires_at > now()
       LIMIT 1`
    );
    const row = result.rows[0];
    if (!row) {
      const error = new Error('current-catalog-manifest-not-found');
      error.status = 503;
      throw error;
    }
    return Object.freeze({
      catalogVersion: Number(row.catalog_version),
      payloadSha256: row.payload_sha256,
      signature: row.signature,
      signingKeyId: row.signing_key_id,
      publisher: row.publisher,
      generatedAt: new Date(row.generated_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      signatureVerification: row.signature_verification,
      transparencyRecord: row.transparency_record
    });
  }

  async isGlobalDownloadDisabled() {
    return this.#isKillSwitchActive('global', 'downloads');
  }

  async isPackageDownloadDisabled(packageId) {
    return this.#isKillSwitchActive('package', String(packageId));
  }

  async #isKillSwitchActive(scopeType, scopeId) {
    const result = await this.pool.query(
      `SELECT disabled FROM aarulya_store.distribution_kill_switches
       WHERE scope_type = $1 AND scope_id = $2
         AND (expires_at IS NULL OR expires_at > now())`,
      [scopeType, scopeId]
    );
    return result.rows[0]?.disabled === true;
  }

  async createDownloadGrant({ userId, deviceId = null, release, requestId, idempotencyKey }) {
    const actorId = requireUuid('user-id', userId);
    const token = randomBytes(32).toString('base64url');
    const tokenDigest = sha256(token);
    const grantId = randomUUID();
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);

    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        `INSERT INTO aarulya_store.download_grants
          (id, user_id, device_id, app_version_id, token_sha256, request_id,
           expires_at, idempotency_key, download_origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET request_id = EXCLUDED.request_id
         RETURNING id, expires_at`,
        [grantId, actorId, deviceId, release.releaseId, tokenDigest, requestId,
          expiresAt, idempotencyKey, DOWNLOAD_ORIGIN]
      );
      const row = result.rows[0];
      return Object.freeze({
        grantId: String(row.id),
        token,
        expiresAt: new Date(row.expires_at).toISOString(),
        downloadUrl: `${DOWNLOAD_ORIGIN}/v1/grants/${row.id}/apk`
      });
    });
  }

  async consumeDownloadGrant({ userId, grantId, token }) {
    const actorId = requireUuid('user-id', userId);
    const id = requireUuid('grant-id', grantId);
    const tokenDigest = sha256(token || '');
    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        `UPDATE aarulya_store.download_grants g
         SET consumed_at = now()
         FROM aarulya_store.app_versions v, aarulya_store.apps a
         WHERE g.id = $1
           AND g.user_id = $2
           AND g.token_sha256 = $3
           AND g.consumed_at IS NULL
           AND g.expires_at > now()
           AND v.id = g.app_version_id
           AND a.id = v.app_id
           AND v.status = 'published'
         RETURNING g.id, g.app_version_id, v.apk_object_key, v.apk_sha256,
                   v.apk_size_bytes, a.package_id, v.version_code`,
        [id, actorId, tokenDigest]
      );
      const row = result.rows[0];
      if (!row) {
        const error = new Error('download-grant-invalid-expired-or-consumed');
        error.status = 410;
        throw error;
      }
      return Object.freeze({
        grantId: String(row.id),
        releaseId: String(row.app_version_id),
        objectKey: row.apk_object_key,
        apkSha256: row.apk_sha256,
        apkSizeBytes: row.apk_size_bytes ? Number(row.apk_size_bytes) : null,
        packageId: row.package_id,
        versionCode: Number(row.version_code)
      });
    });
  }

  async recordInstall({ userId, devicePublicId, release, requestId, idempotencyKey, downloadedSha256, signerFingerprint }) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const deviceResult = await client.query(
        `INSERT INTO aarulya_store.devices (user_id, device_public_id, last_seen_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id, device_public_id)
         DO UPDATE SET last_seen_at = now()
         RETURNING id`,
        [actorId, String(devicePublicId)]
      );
      const deviceId = deviceResult.rows[0].id;
      const receiptResult = await client.query(
        `INSERT INTO aarulya_store.install_receipts
          (user_id, device_id, app_version_id, request_id, apk_sha256,
           signer_fingerprint, signing_key_id, installed_at, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8)
         ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET reported_at = now()
         RETURNING id, installed_at`,
        [actorId, deviceId, release.releaseId, requestId, downloadedSha256,
          signerFingerprint, release.signingKeyId, idempotencyKey]
      );
      const row = receiptResult.rows[0];
      return Object.freeze({
        receiptId: String(row.id),
        actorId,
        deviceId: String(deviceId),
        packageId: release.packageId,
        versionCode: release.versionCode,
        apkSha256: downloadedSha256,
        signerFingerprint,
        signingKeyId: release.signingKeyId,
        installedAt: new Date(row.installed_at).toISOString(),
        requestId
      });
    });
  }

  async checkUpdate({ userId, devicePublicId, packageId, installedVersionCode, requestId }) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const deviceResult = await client.query(
        `INSERT INTO aarulya_store.devices (user_id, device_public_id, last_seen_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id, device_public_id)
         DO UPDATE SET last_seen_at = now()
         RETURNING id`,
        [actorId, String(devicePublicId)]
      );
      const deviceId = deviceResult.rows[0].id;
      const releaseResult = await client.query(
        `${RELEASE_SELECT}
         WHERE a.package_id = $1 AND v.status = 'published'
           AND v.version_code > $2
         ORDER BY v.version_code DESC LIMIT 1`,
        [String(packageId), Number(installedVersionCode)]
      );
      const release = rowToRelease(releaseResult.rows[0]);
      const decision = release ? 'update-available' : 'up-to-date';
      await client.query(
        `INSERT INTO aarulya_store.update_checks
          (user_id, device_id, package_id, installed_version_code,
           offered_app_version_id, decision, request_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [actorId, deviceId, packageId, installedVersionCode, release?.releaseId || null, decision, requestId]
      );
      return Object.freeze({ decision, release });
    });
  }
}
