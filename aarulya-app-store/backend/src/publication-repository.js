import { withTransaction } from './postgres.js';

function requiredText(name, value, minimum, maximum) {
  const normalized = String(value || '').trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw new Error(`${name}-invalid`);
  }
  return normalized;
}

function positiveInteger(name, value) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) throw new Error(`${name}-invalid`);
  return normalized;
}

function requiredUuid(name, value) {
  const normalized = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${name}-invalid`);
  }
  return normalized;
}

export class PostgreSqlPublicationRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
  }

  async selectSafeVersion({ appId, versionCode, requestId, actorSubject, selectedBy, reason }) {
    const normalizedAppId = requiredText('app-id', appId, 2, 160);
    const normalizedVersionCode = positiveInteger('version-code', versionCode);
    const normalizedRequestId = requiredText('request-id', requestId, 16, 200);
    const normalizedActorSubject = requiredText('actor-subject', actorSubject, 8, 512);
    const normalizedSelectedBy = requiredUuid('selected-by', selectedBy);
    const normalizedReason = requiredText('rollback-reason', reason, 12, 2000);

    return withTransaction(this.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [normalizedAppId, normalizedVersionCode]);

      const replayResult = await client.query(
        `SELECT receipt.id, receipt.app_id, receipt.previous_app_version_id,
                receipt.selected_app_version_id, receipt.change_kind, receipt.changed_at,
                selected.version_code AS selected_version_code, app.package_id
         FROM aarulya_store.safe_version_change_receipts receipt
         JOIN aarulya_store.app_versions selected ON selected.id = receipt.selected_app_version_id
         JOIN aarulya_store.apps app ON app.id = receipt.app_id
         WHERE receipt.request_id = $1`,
        [normalizedRequestId]
      );
      if (replayResult.rows[0]) {
        const replay = replayResult.rows[0];
        if (replay.app_id !== normalizedAppId || Number(replay.selected_version_code) !== normalizedVersionCode) {
          const error = new Error('safe-version-idempotency-conflict');
          error.status = 409;
          throw error;
        }
        return Object.freeze({
          safeVersionReceiptId: String(replay.id),
          appId: replay.app_id,
          packageId: replay.package_id,
          versionCode: Number(replay.selected_version_code),
          changeKind: replay.change_kind,
          changedAt: new Date(replay.changed_at).toISOString(),
          idempotentReplay: true
        });
      }

      const targetResult = await client.query(
        `SELECT v.id, v.version_code, a.package_id,
                current_safe.app_version_id AS previous_app_version_id,
                previous.version_code AS previous_version_code
         FROM aarulya_store.app_versions v
         JOIN aarulya_store.apps a ON a.id = v.app_id
         LEFT JOIN aarulya_store.safe_versions current_safe ON current_safe.app_id = v.app_id
         LEFT JOIN aarulya_store.app_versions previous ON previous.id = current_safe.app_version_id
         WHERE v.app_id = $1
           AND v.version_code = $2
           AND v.status = 'published'
           AND v.revoked_at IS NULL
           AND v.publication_gate_status = 'passed'
           AND v.final_evidence_report_signature_verification = 'passed'
           AND v.final_evidence_report_transparency_inclusion = 'verified'
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
         LIMIT 1`,
        [normalizedAppId, normalizedVersionCode]
      );
      const target = targetResult.rows[0];
      if (!target) {
        const error = new Error('safe-version-target-not-eligible');
        error.status = 409;
        throw error;
      }

      const previousVersionCode = target.previous_version_code == null
        ? null
        : Number(target.previous_version_code);
      const changeKind = previousVersionCode == null
        ? 'initial'
        : normalizedVersionCode < previousVersionCode
          ? 'rollback'
          : normalizedVersionCode > previousVersionCode
            ? 'forward'
            : 'reselect';

      await client.query(
        `INSERT INTO aarulya_store.safe_versions (app_id, app_version_id, selected_by, selected_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (app_id) DO UPDATE SET
           app_version_id = EXCLUDED.app_version_id,
           selected_by = EXCLUDED.selected_by,
           selected_at = EXCLUDED.selected_at`,
        [normalizedAppId, target.id, normalizedSelectedBy]
      );

      const receiptResult = await client.query(
        `INSERT INTO aarulya_store.safe_version_change_receipts
          (app_id, previous_app_version_id, selected_app_version_id, request_id,
           actor_subject, reason, change_kind, changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now())
         RETURNING id, changed_at`,
        [normalizedAppId, target.previous_app_version_id, target.id, normalizedRequestId,
          normalizedActorSubject, normalizedReason, changeKind]
      );

      return Object.freeze({
        safeVersionReceiptId: String(receiptResult.rows[0].id),
        appId: normalizedAppId,
        packageId: target.package_id,
        versionCode: normalizedVersionCode,
        previousVersionCode,
        changeKind,
        changedAt: new Date(receiptResult.rows[0].changed_at).toISOString(),
        idempotentReplay: false
      });
    });
  }

  async publish({ appId, versionCode, requestId, actorSubject, reason }) {
    const normalizedAppId = requiredText('app-id', appId, 2, 160);
    const normalizedVersionCode = positiveInteger('version-code', versionCode);
    const normalizedRequestId = requiredText('request-id', requestId, 16, 200);
    const normalizedActorSubject = requiredText('actor-subject', actorSubject, 8, 512);
    const normalizedReason = requiredText('publication-reason', reason, 12, 2000);

    return withTransaction(this.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [normalizedAppId, normalizedVersionCode]);

      const versionResult = await client.query(
        `SELECT
           v.id, v.app_id, v.version_code, v.status, v.apk_sha256,
           v.release_manifest_sha256, v.published_at, a.package_id, a.risk_tier
         FROM aarulya_store.app_versions v
         JOIN aarulya_store.apps a ON a.id = v.app_id
         WHERE v.app_id = $1 AND v.version_code = $2
         FOR UPDATE`,
        [normalizedAppId, normalizedVersionCode]
      );
      const version = versionResult.rows[0];
      if (!version) {
        const error = new Error('release-version-not-found');
        error.status = 404;
        throw error;
      }
      if (version.status === 'published') {
        const existing = await client.query(
          `SELECT id, request_id, published_at
           FROM aarulya_store.release_publication_receipts
           WHERE app_version_id = $1`,
          [version.id]
        );
        const receipt = existing.rows[0];
        if (!receipt) throw new Error('published-release-receipt-missing');
        if (receipt.request_id !== normalizedRequestId) {
          const error = new Error('release-already-published');
          error.status = 409;
          throw error;
        }
        return Object.freeze({
          publicationReceiptId: String(receipt.id),
          appId: version.app_id,
          packageId: version.package_id,
          versionCode: Number(version.version_code),
          publishedAt: new Date(receipt.published_at).toISOString(),
          idempotentReplay: true
        });
      }
      if (version.status !== 'review') {
        const error = new Error('release-must-be-in-review-state');
        error.status = 409;
        throw error;
      }

      const approvalResult = await client.query(
        `SELECT count(DISTINCT approver_subject)::integer AS count
         FROM aarulya_store.release_approvals
         WHERE app_version_id = $1
           AND decision = 'approved'
           AND signature_verification = 'passed'
           AND transparency_inclusion = 'verified'
           AND expires_at > now()`,
        [version.id]
      );
      const evidenceResult = await client.query(
        `SELECT count(DISTINCT evidence_type)::integer AS count
         FROM aarulya_store.release_evidence
         WHERE app_version_id = $1
           AND result = 'passed'
           AND signature_verification = 'passed'
           AND transparency_inclusion = 'verified'
           AND expires_at > now()`,
        [version.id]
      );
      const approvalCount = Number(approvalResult.rows[0]?.count || 0);
      const evidenceCount = Number(evidenceResult.rows[0]?.count || 0);

      // The database publication trigger independently revalidates the signed
      // envelope, required evidence types, key validity and approval threshold.
      const publishedResult = await client.query(
        `UPDATE aarulya_store.app_versions
         SET status = 'published', published_at = now()
         WHERE id = $1 AND status = 'review'
         RETURNING published_at`,
        [version.id]
      );
      if (publishedResult.rowCount !== 1) throw new Error('release-publication-race-detected');
      const publishedAt = publishedResult.rows[0].published_at;

      await client.query(
        `INSERT INTO aarulya_store.safe_versions
          (app_id, app_version_id, selected_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (app_id) DO UPDATE SET
           app_version_id = EXCLUDED.app_version_id,
           selected_at = EXCLUDED.selected_at
         WHERE (
           SELECT version_code FROM aarulya_store.app_versions
           WHERE id = EXCLUDED.app_version_id
         ) > (
           SELECT version_code FROM aarulya_store.app_versions
           WHERE id = safe_versions.app_version_id
         )`,
        [version.app_id, version.id, publishedAt]
      );

      const receiptResult = await client.query(
        `INSERT INTO aarulya_store.release_publication_receipts
          (app_version_id, request_id, actor_subject, reason,
           release_manifest_sha256, apk_sha256, approval_count,
           evidence_count, risk_tier, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [version.id, normalizedRequestId, normalizedActorSubject, normalizedReason,
          version.release_manifest_sha256, version.apk_sha256, approvalCount,
          evidenceCount, version.risk_tier, publishedAt]
      );

      return Object.freeze({
        publicationReceiptId: String(receiptResult.rows[0].id),
        appId: version.app_id,
        packageId: version.package_id,
        versionCode: Number(version.version_code),
        riskTier: version.risk_tier,
        approvalCount,
        evidenceCount,
        publishedAt: new Date(publishedAt).toISOString(),
        idempotentReplay: false
      });
    });
  }
}
