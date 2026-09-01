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
        `SELECT * FROM aarulya_store.consume_download_grant($1::uuid, $2::text)`,
        [grantId, tokenDigest]
      );
      const row = result.rows[0];
      if (!row) {
        const error = new Error('download-grant-invalid-expired-consumed-or-blocked');
        error.status = 410;
        throw error;
      }
      return Object.freeze({
        grantId: String(row.grant_id),
        releaseId: String(row.release_id),
        objectKey: row.object_key,
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
