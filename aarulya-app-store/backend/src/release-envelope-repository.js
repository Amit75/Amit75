export class PostgreSqlReleaseEnvelopeRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
  }

  async getLatestForApp(appId, versionCode = null) {
    const values = [String(appId)];
    let versionClause = '';
    if (versionCode != null) {
      values.push(Number(versionCode));
      versionClause = `AND v.version_code = $${values.length}`;
    }
    const result = await this.pool.query(
      `SELECT
         e.schema_version,
         e.canonical_payload_base64,
         e.payload_sha256,
         e.signature_base64,
         e.signing_key_id,
         e.algorithm,
         e.publisher,
         e.issued_at,
         e.expires_at,
         e.transparency_log_id,
         e.transparency_inclusion_proof,
         e.signature_verification,
         e.transparency_inclusion,
         k.public_key_pem,
         k.fingerprint_sha256 AS key_fingerprint_sha256,
         k.state AS key_state,
         a.id AS app_id,
         a.package_id,
         v.version_code,
         v.apk_sha256,
         v.apk_size_bytes,
         v.signer_fingerprint,
         v.signing_key_id AS apk_signing_key_id
       FROM aarulya_store.signed_release_envelopes e
       JOIN aarulya_store.app_versions v ON v.id = e.app_version_id
       JOIN aarulya_store.apps a ON a.id = v.app_id
       JOIN aarulya_store.trusted_signing_keys k ON k.key_id = e.signing_key_id
       WHERE a.id = $1
         AND v.status = 'published'
         AND v.revoked_at IS NULL
         AND e.expires_at > now()
         AND k.state IN ('active', 'retiring')
         AND now() BETWEEN k.not_before AND k.not_after
         ${versionClause}
       ORDER BY v.version_code DESC
       LIMIT 1`,
      values
    );
    const row = result.rows[0];
    if (!row) {
      const error = new Error('signed-release-envelope-not-found');
      error.status = 404;
      throw error;
    }
    return Object.freeze({
      schemaVersion: Number(row.schema_version),
      canonicalPayloadBase64: row.canonical_payload_base64,
      payloadSha256: row.payload_sha256,
      signatureBase64: row.signature_base64,
      signingKeyId: row.signing_key_id,
      algorithm: row.algorithm,
      publisher: row.publisher,
      issuedAt: new Date(row.issued_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
      transparencyLogId: row.transparency_log_id,
      transparencyInclusionProof: row.transparency_inclusion_proof,
      signatureVerification: row.signature_verification,
      transparencyInclusion: row.transparency_inclusion,
      publicKeyPem: row.public_key_pem,
      keyFingerprintSha256: row.key_fingerprint_sha256,
      keyState: row.key_state,
      appId: row.app_id,
      packageId: row.package_id,
      versionCode: Number(row.version_code),
      apkSha256: row.apk_sha256,
      apkSizeBytes: row.apk_size_bytes ? Number(row.apk_size_bytes) : null,
      signerFingerprint: row.signer_fingerprint,
      apkSigningKeyId: row.apk_signing_key_id
    });
  }
}
