import { createHash } from 'node:crypto';
import { withTransaction } from './postgres.js';

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

export class PostgreSqlArtifactRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
  }

  async consumeGrant(grantId, token) {
    if (!validUuid(grantId)) {
      const error = new Error('valid-download-grant-required');
      error.status = 400;
      throw error;
    }
    if (String(token || '').length < 32 || String(token).length > 256) {
      const error = new Error('valid-download-token-required');
      error.status = 401;
      throw error;
    }
    const tokenDigest = sha256(token);
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `UPDATE aarulya_store.download_grants g
         SET consumed_at = now()
         FROM aarulya_store.app_versions v, aarulya_store.apps a
         WHERE g.id = $1
           AND g.token_sha256 = $2
           AND g.consumed_at IS NULL
           AND g.expires_at > now()
           AND v.id = g.app_version_id
           AND a.id = v.app_id
           AND v.status = 'published'
           AND v.revoked_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM aarulya_store.distribution_kill_switches k
             WHERE k.disabled = true
               AND (k.expires_at IS NULL OR k.expires_at > now())
               AND ((k.scope_type = 'global' AND k.scope_id = 'downloads')
                 OR (k.scope_type = 'package' AND k.scope_id = a.package_id))
           )
         RETURNING g.id, v.id AS release_id, v.apk_object_key, v.apk_sha256,
                   v.apk_size_bytes, a.package_id, v.version_code,
                   v.signer_fingerprint, v.signing_key_id`,
        [grantId, tokenDigest]
      );
      const row = result.rows[0];
      if (!row) {
        const error = new Error('download-grant-invalid-expired-consumed-or-blocked');
        error.status = 410;
        throw error;
      }
      return Object.freeze({
        grantId: String(row.id),
        releaseId: String(row.release_id),
        objectKey: row.apk_object_key,
        apkSha256: row.apk_sha256,
        apkSizeBytes: row.apk_size_bytes ? Number(row.apk_size_bytes) : null,
        packageId: row.package_id,
        versionCode: Number(row.version_code),
        signerFingerprint: row.signer_fingerprint,
        signingKeyId: row.signing_key_id
      });
    });
  }
}
