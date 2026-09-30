import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { withActorTransaction, withTransaction } from './postgres.js';

const DOWNLOAD_TTL_SECONDS = 300;
const DOWNLOAD_ORIGIN = 'https://downloads.store.aarulya.com';
const MAX_PAGE_SIZE = 100;

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
    releaseId: String(row.release_id),
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

function rowToPublicApp(row) {
  return Object.freeze({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    age: row.age_label,
    packageId: row.package_id,
    publisher: row.publisher,
    status: row.published_version_code ? 'published' : row.lifecycle_status,
    featured: row.featured === true,
    latestVersionCode: row.published_version_code ? Number(row.published_version_code) : null,
    latestVersionName: row.published_version_name || null,
    apkSizeBytes: row.apk_size_bytes ? Number(row.apk_size_bytes) : null,
    evidenceStatus: row.published_version_code ? 'release-envelope-required-at-download' : 'not-published'
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

const SAFE_VERSION_SELECTED = `
  v.id = (
    SELECT safe.app_version_id
    FROM aarulya_store.safe_versions safe
    WHERE safe.app_id = v.app_id
  )
`;

const VALID_PUBLISHED_RELEASE = `
  v.status = 'published'
  AND v.revoked_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM aarulya_store.signed_release_envelopes envelope
    JOIN aarulya_store.trusted_signing_keys key ON key.key_id = envelope.signing_key_id
    WHERE envelope.app_version_id = v.id
      AND envelope.payload_sha256 = v.release_manifest_sha256
      AND envelope.signature_verification = 'passed'
      AND envelope.transparency_inclusion = 'verified'
      AND envelope.expires_at > now()
      AND key.purpose = 'release-manifest'
      AND key.state IN ('active', 'retiring')
      AND now() BETWEEN key.not_before AND key.not_after
  )
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

  async listCatalog({ category = null, query = '', limit = 50, offset = 0 } = {}) {
    const pageSize = Math.max(1, Math.min(Number(limit) || 50, MAX_PAGE_SIZE));
    const start = Math.max(0, Number(offset) || 0);
    const normalizedQuery = String(query || '').trim();
    const normalizedCategory = category ? String(category).trim() : null;
    const result = await this.pool.query(
      `SELECT
         a.id, a.name, a.category, a.description, a.age_label, a.package_id,
         a.publisher, a.lifecycle_status, a.featured,
         release.version_code AS published_version_code,
         release.version_name AS published_version_name,
         release.apk_size_bytes,
         count(*) OVER() AS total_count
       FROM aarulya_store.apps a
       LEFT JOIN LATERAL (
         SELECT v.version_code, COALESCE(v.version_name_display, v.version_name) AS version_name,
                v.apk_size_bytes
         FROM aarulya_store.app_versions v
         WHERE v.app_id = a.id AND ${SAFE_VERSION_SELECTED} AND ${VALID_PUBLISHED_RELEASE}
         ORDER BY v.version_code DESC
         LIMIT 1
       ) release ON true
       WHERE a.visibility = 'visible'
         AND ($1::text IS NULL OR a.category = $1)
         AND ($2::text = '' OR to_tsvector('simple', a.name || ' ' || a.category || ' ' || a.description)
              @@ plainto_tsquery('simple', $2))
       ORDER BY a.featured DESC, a.sort_priority, a.name
       LIMIT $3 OFFSET $4`,
      [normalizedCategory || null, normalizedQuery, pageSize, start]
    );
    return Object.freeze({
      total: result.rows.length ? Number(result.rows[0].total_count) : 0,
      offset: start,
      limit: pageSize,
      apps: Object.freeze(result.rows.map(rowToPublicApp))
    });
  }

  async getApp(appId) {
    const result = await this.listCatalog({ limit: MAX_PAGE_SIZE });
    const app = result.apps.find((candidate) => candidate.id === String(appId));
    if (!app) {
      const error = new Error('app-not-found');
      error.status = 404;
      throw error;
    }
    return app;
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

  async revokeCurrentSession({ sessionId, subject, expiresAt, reason = 'user-sign-out' }) {
    const normalizedSession = String(sessionId || '');
    const normalizedSubject = String(subject || '');
    const expiry = Number(expiresAt);
    if (normalizedSession.length < 8 || normalizedSession.length > 512) throw new Error('valid-session-id-required');
    if (normalizedSubject.length < 8 || normalizedSubject.length > 512) throw new Error('valid-session-subject-required');
    if (!Number.isFinite(expiry)) throw new Error('valid-session-expiry-required');
    await this.pool.query(
      `SELECT aarulya_store.revoke_current_store_session($1::text, $2::text, to_timestamp($3::double precision), $4::text)`,
      [normalizedSession, normalizedSubject, expiry, String(reason || 'user-sign-out').slice(0, 160)]
    );
    return Object.freeze({ revoked: true, sessionId: normalizedSession });
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
       WHERE v.app_id = $1 AND ${SAFE_VERSION_SELECTED} AND ${VALID_PUBLISHED_RELEASE}
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
       WHERE a.package_id = $1 AND v.version_code = $2 AND ${VALID_PUBLISHED_RELEASE}
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
      `SELECT manifest.catalog_version, manifest.payload_sha256, manifest.signature,
              manifest.signing_key_id, manifest.publisher, manifest.generated_at,
              manifest.expires_at, manifest.signature_verification,
              manifest.transparency_record
       FROM aarulya_store.catalog_manifest_head head
       JOIN aarulya_store.catalog_manifests manifest
         ON manifest.id = head.catalog_manifest_id
       JOIN aarulya_store.trusted_signing_keys key
         ON key.key_id = manifest.signing_key_id
       WHERE head.singleton = true
         AND manifest.expires_at > now()
         AND key.purpose = 'catalog'
         AND key.state IN ('active', 'retiring')
         AND now() BETWEEN key.not_before AND key.not_after
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


  async recordVerifiedSession({ userId, externalSubject, sessionId, tokenId, devicePublicId = null, expiresAt }) {
    const actorId = requireUuid('user-id', userId);
    const session = String(sessionId || '');
    const subject = String(externalSubject || '');
    const token = String(tokenId || '');
    const expiry = Number(expiresAt);
    const nowSeconds = Date.now() / 1000;
    if (session.length < 8 || session.length > 512) throw new Error('valid-session-id-required');
    if (subject.length < 8 || subject.length > 512) throw new Error('valid-session-subject-required');
    if (token.length < 8 || token.length > 512) throw new Error('valid-token-id-required');
    if (!Number.isFinite(expiry) || expiry <= nowSeconds || expiry > nowSeconds + 7200) {
      throw new Error('bounded-session-expiry-required');
    }
    return withActorTransaction(this.pool, actorId, async (client) => {
      await client.query(
        'INSERT INTO aarulya_store.store_sessions ' +
        '(session_id, user_id, external_subject, token_id, device_public_id, expires_at) ' +
        'VALUES ($1, $2, $3, $4, $5, to_timestamp($6::double precision)) ' +
        'ON CONFLICT (session_id) DO UPDATE SET ' +
        'token_id = EXCLUDED.token_id, ' +
        'device_public_id = COALESCE(EXCLUDED.device_public_id, aarulya_store.store_sessions.device_public_id), ' +
        'last_seen_at = now(), expires_at = EXCLUDED.expires_at ' +
        'WHERE aarulya_store.store_sessions.user_id = EXCLUDED.user_id ' +
        'AND aarulya_store.store_sessions.external_subject = EXCLUDED.external_subject',
        [session, actorId, subject, token, devicePublicId ? String(devicePublicId).slice(0, 512) : null, expiry]
      );
      return true;
    });
  }

  async getAccountOverview(userId, currentSessionId = null) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const devices = await client.query(
        'SELECT device_public_id, platform, integrity_state, last_seen_at, created_at ' +
        'FROM aarulya_store.devices WHERE user_id = $1 ' +
        'ORDER BY COALESCE(last_seen_at, created_at) DESC LIMIT 25',
        [actorId]
      );
      const sessions = await client.query(
        'SELECT s.session_id, s.device_public_id, s.first_seen_at, s.last_seen_at, s.expires_at, ' +
        '(r.session_id IS NOT NULL) AS revoked ' +
        'FROM aarulya_store.store_sessions s ' +
        'LEFT JOIN aarulya_store.session_revocations r ON r.session_id = s.session_id AND r.expires_at > now() ' +
        'WHERE s.user_id = $1 AND s.expires_at > now() - interval \'7 days\' ' +
        'ORDER BY s.last_seen_at DESC LIMIT 25',
        [actorId]
      );
      const installs = await client.query(
        'SELECT a.name, a.package_id, v.version_code, r.installed_at, r.reported_at ' +
        'FROM aarulya_store.install_receipts r ' +
        'JOIN aarulya_store.app_versions v ON v.id = r.app_version_id ' +
        'JOIN aarulya_store.apps a ON a.id = v.app_id ' +
        'WHERE r.user_id = $1 ORDER BY r.reported_at DESC LIMIT 25',
        [actorId]
      );
      const updates = await client.query(
        'SELECT package_id, installed_version_code, decision, checked_at ' +
        'FROM aarulya_store.update_checks WHERE user_id = $1 ' +
        'ORDER BY checked_at DESC LIMIT 25',
        [actorId]
      );
      const privacyRequests = await client.query(
        'SELECT id, request_type, state, requested_at, cancelled_at, completed_at ' +
        'FROM aarulya_store.account_privacy_requests WHERE user_id = $1 ' +
        'ORDER BY requested_at DESC LIMIT 25',
        [actorId]
      );
      return Object.freeze({
        devices: devices.rows.map((row) => ({
          deviceId: row.device_public_id,
          platform: row.platform,
          integrityState: row.integrity_state,
          lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString()
        })),
        sessions: sessions.rows.map((row) => ({
          sessionId: row.session_id,
          deviceId: row.device_public_id,
          current: currentSessionId != null && row.session_id === String(currentSessionId),
          revoked: row.revoked === true,
          firstSeenAt: new Date(row.first_seen_at).toISOString(),
          lastSeenAt: new Date(row.last_seen_at).toISOString(),
          expiresAt: new Date(row.expires_at).toISOString()
        })),
        installs: installs.rows.map((row) => ({
          appName: row.name,
          packageId: row.package_id,
          versionCode: Number(row.version_code),
          installedAt: new Date(row.installed_at).toISOString(),
          reportedAt: new Date(row.reported_at).toISOString()
        })),
        updates: updates.rows.map((row) => ({
          packageId: row.package_id,
          installedVersionCode: Number(row.installed_version_code),
          decision: row.decision,
          checkedAt: new Date(row.checked_at).toISOString()
        })),
        privacyRequests: privacyRequests.rows.map((row) => ({
          id: String(row.id),
          type: row.request_type,
          state: row.state,
          requestedAt: new Date(row.requested_at).toISOString(),
          cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
          completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
        }))
      });
    });
  }

  async revokeOwnedSession({ userId, sessionId }) {
    const actorId = requireUuid('user-id', userId);
    const target = String(sessionId || '');
    if (target.length < 8 || target.length > 512) throw new Error('valid-session-id-required');
    return withActorTransaction(this.pool, actorId, async (client) => {
      await client.query(
        'SELECT aarulya_store.revoke_owned_store_session($1::text, $2::text)',
        [target, 'user-account-session-revocation']
      );
      return Object.freeze({ revoked: true, sessionId: target });
    });
  }

  async listDeveloperSubmissions(userId) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        'SELECT id, app_name, package_id, category, privacy_policy_url, ownership_evidence_url, ' +
        'state, submitted_at, created_at, updated_at ' +
        'FROM aarulya_store.developer_submissions WHERE user_id = $1 ' +
        'ORDER BY updated_at DESC LIMIT 50',
        [actorId]
      );
      return result.rows.map((row) => Object.freeze({
        id: String(row.id),
        appName: row.app_name,
        packageId: row.package_id,
        category: row.category,
        privacyPolicyUrl: row.privacy_policy_url,
        ownershipEvidenceUrl: row.ownership_evidence_url,
        state: row.state,
        submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString()
      }));
    });
  }

  async createDeveloperSubmission({ userId, appName, packageId, category, privacyPolicyUrl, ownershipEvidenceUrl }) {
    const actorId = requireUuid('user-id', userId);
    const name = String(appName || '').trim();
    const pkg = String(packageId || '').trim();
    const cat = String(category || '').trim();
    if (name.length < 2 || name.length > 120) throw Object.assign(new Error('valid-app-name-required'), { status: 400 });
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(pkg)) {
      throw Object.assign(new Error('valid-package-id-required'), { status: 400 });
    }
    if (cat.length < 2 || cat.length > 80) throw Object.assign(new Error('valid-category-required'), { status: 400 });

    const urls = [
      ['privacy-policy', privacyPolicyUrl],
      ['ownership-evidence', ownershipEvidenceUrl]
    ];
    for (const pair of urls) {
      const label = pair[0];
      const raw = pair[1];
      let parsed;
      try {
        parsed = new URL(String(raw || ''));
      } catch {
        throw Object.assign(new Error(label + '-https-url-required'), { status: 400 });
      }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw Object.assign(new Error(label + '-https-url-required'), { status: 400 });
      }
    }

    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        'INSERT INTO aarulya_store.developer_submissions ' +
        '(user_id, app_name, package_id, category, privacy_policy_url, ownership_evidence_url) ' +
        'VALUES ($1, $2, $3, $4, $5, $6) ' +
        'ON CONFLICT (user_id, package_id) DO NOTHING ' +
        'RETURNING id, state, created_at, updated_at',
        [actorId, name, pkg, cat, String(privacyPolicyUrl), String(ownershipEvidenceUrl)]
      );
      const row = result.rows[0];
      if (!row) throw Object.assign(new Error('developer-submission-package-already-exists'), { status: 409 });
      await client.query(
        'INSERT INTO aarulya_store.developer_submission_events(submission_id, user_id, event_type) ' +
        'VALUES ($1, $2, $3)',
        [row.id, actorId, 'draft-created']
      );
      return Object.freeze({
        id: String(row.id),
        state: row.state,
        createdAt: new Date(row.created_at).toISOString()
      });
    });
  }

  async submitDeveloperSubmission({ userId, submissionId }) {
    const actorId = requireUuid('user-id', userId);
    const id = requireUuid('submission-id', submissionId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        'UPDATE aarulya_store.developer_submissions ' +
        'SET state = $3, submitted_at = now(), updated_at = now() ' +
        'WHERE id = $1 AND user_id = $2 AND state = $4 ' +
        'RETURNING id, state, submitted_at',
        [id, actorId, 'submitted', 'draft']
      );
      const row = result.rows[0];
      if (!row) throw Object.assign(new Error('developer-submission-not-draft-or-not-found'), { status: 409 });
      await client.query(
        'INSERT INTO aarulya_store.developer_submission_events(submission_id, user_id, event_type) ' +
        'VALUES ($1, $2, $3)',
        [id, actorId, 'submitted']
      );
      return Object.freeze({
        id: String(row.id),
        state: row.state,
        submittedAt: new Date(row.submitted_at).toISOString()
      });
    });
  }


  async getPrivacyRequests(userId) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const result = await client.query(
        'SELECT id, request_type, state, requested_at, cancelled_at, completed_at ' +
        'FROM aarulya_store.account_privacy_requests WHERE user_id = $1 ' +
        'ORDER BY requested_at DESC LIMIT 25',
        [actorId]
      );
      return result.rows.map((row) => Object.freeze({
        id: String(row.id),
        type: row.request_type,
        state: row.state,
        requestedAt: new Date(row.requested_at).toISOString(),
        cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
        completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
      }));
    });
  }

  async getAccountExport(userId, currentSessionId = null) {
    const actorId = requireUuid('user-id', userId);
    const [overview, submissions, privacyRequests] = await Promise.all([
      this.getAccountOverview(actorId, currentSessionId),
      this.listDeveloperSubmissions(actorId),
      this.getPrivacyRequests(actorId)
    ]);
    return Object.freeze({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      devices: overview.devices,
      sessions: overview.sessions.map(({ sessionId: _sessionId, ...session }) => session),
      installs: overview.installs,
      updateChecks: overview.updates,
      developerSubmissions: submissions,
      privacyRequests
    });
  }

  async requestAccountDeletion(userId) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const created = await client.query(
        'SELECT aarulya_store.request_account_deletion() AS id'
      );
      const id = created.rows[0]?.id;
      if (!id) throw new Error('account-deletion-request-create-failed');
      const result = await client.query(
        'SELECT id, state, requested_at FROM aarulya_store.account_privacy_requests WHERE id = $1',
        [id]
      );
      const row = result.rows[0];
      return Object.freeze({
        id: String(row.id),
        state: row.state,
        requestedAt: new Date(row.requested_at).toISOString()
      });
    });
  }

  async cancelAccountDeletion(userId) {
    const actorId = requireUuid('user-id', userId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const cancelled = await client.query(
        'SELECT aarulya_store.cancel_account_deletion_request() AS id'
      );
      const id = cancelled.rows[0]?.id;
      if (!id) throw new Error('account-deletion-request-cancel-failed');
      return Object.freeze({ id: String(id), state: 'cancelled' });
    });
  }

  async createDownloadGrant({ userId, devicePublicId = null, release, requestId, idempotencyKey }) {
    const actorId = requireUuid('user-id', userId);
    const releaseId = requireUuid('release-id', release?.releaseId);
    const token = randomBytes(32).toString('base64url');
    const tokenDigest = sha256(token);
    const grantId = randomUUID();
    const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);

    return withActorTransaction(this.pool, actorId, async (client) => {
      let deviceId = null;
      if (devicePublicId) {
        const deviceResult = await client.query(
          `INSERT INTO aarulya_store.devices (user_id, device_public_id, last_seen_at)
           VALUES ($1, $2, now())
           ON CONFLICT (user_id, device_public_id)
           DO UPDATE SET last_seen_at = now()
           RETURNING id`,
          [actorId, String(devicePublicId).slice(0, 512)]
        );
        deviceId = deviceResult.rows[0].id;
      }

      const result = await client.query(
        `INSERT INTO aarulya_store.download_grants
          (id, user_id, device_id, app_version_id, token_sha256, request_id,
           expires_at, idempotency_key, download_origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO UPDATE SET
           device_id = EXCLUDED.device_id,
           app_version_id = EXCLUDED.app_version_id,
           token_sha256 = EXCLUDED.token_sha256,
           request_id = EXCLUDED.request_id,
           expires_at = EXCLUDED.expires_at,
           consumed_at = NULL,
           download_origin = EXCLUDED.download_origin
         RETURNING id, expires_at`,
        [grantId, actorId, deviceId, releaseId, tokenDigest, requestId,
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
           AND ${VALID_PUBLISHED_RELEASE}
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
    const releaseId = requireUuid('release-id', release?.releaseId);
    return withActorTransaction(this.pool, actorId, async (client) => {
      const deviceResult = await client.query(
        `INSERT INTO aarulya_store.devices (user_id, device_public_id, last_seen_at)
         VALUES ($1, $2, now())
         ON CONFLICT (user_id, device_public_id)
         DO UPDATE SET last_seen_at = now()
         RETURNING id`,
        [actorId, String(devicePublicId).slice(0, 512)]
      );
      const deviceId = deviceResult.rows[0].id;
      const receiptId = randomUUID();
      const inserted = await client.query(
        `INSERT INTO aarulya_store.install_receipts
          (id, user_id, device_id, app_version_id, request_id, apk_sha256,
           signer_fingerprint, signing_key_id, installed_at, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
         ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id, app_version_id, apk_sha256, signer_fingerprint, installed_at`,
        [receiptId, actorId, deviceId, releaseId, requestId, downloadedSha256,
          signerFingerprint, release.signingKeyId, idempotencyKey]
      );
      let row = inserted.rows[0];
      if (!row) {
        const existing = await client.query(
          `SELECT id, app_version_id, apk_sha256, signer_fingerprint, installed_at
           FROM aarulya_store.install_receipts
           WHERE user_id = $1 AND idempotency_key = $2`,
          [actorId, idempotencyKey]
        );
        row = existing.rows[0];
        if (!row || String(row.app_version_id) !== releaseId || row.apk_sha256 !== downloadedSha256 || row.signer_fingerprint !== signerFingerprint) {
          const error = new Error('install-idempotency-conflict');
          error.status = 409;
          throw error;
        }
      }
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
        [actorId, String(devicePublicId).slice(0, 512)]
      );
      const deviceId = deviceResult.rows[0].id;
      const appResult = await client.query(
        `SELECT id FROM aarulya_store.apps WHERE package_id = $1 AND visibility = 'visible'`,
        [String(packageId)]
      );
      if (!appResult.rows[0]) {
        await client.query(
          `INSERT INTO aarulya_store.update_checks
            (user_id, device_id, package_id, installed_version_code, decision, request_id)
           VALUES ($1, $2, $3, $4, 'not-found', $5)`,
          [actorId, deviceId, packageId, installedVersionCode, requestId]
        );
        return Object.freeze({ decision: 'not-found', release: null });
      }
      const releaseResult = await client.query(
        `${RELEASE_SELECT}
         WHERE a.package_id = $1 AND v.version_code > $2 AND ${SAFE_VERSION_SELECTED} AND ${VALID_PUBLISHED_RELEASE}
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
