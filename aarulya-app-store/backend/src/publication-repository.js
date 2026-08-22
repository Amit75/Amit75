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

export class PostgreSqlPublicationRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
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
