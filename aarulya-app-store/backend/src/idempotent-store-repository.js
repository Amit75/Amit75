import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { withActorTransaction } from './postgres.js';
import { PostgreSqlStoreRepository } from './postgres-store-repository.js';

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

function conflict(code) {
  const error = new Error(code);
  error.code = code;
  error.status = 409;
  return error;
}

export class IdempotentPostgreSqlStoreRepository extends PostgreSqlStoreRepository {
  constructor(pool, { downloadOrigin = DOWNLOAD_ORIGIN, downloadTokenHmacKey } = {}) {
    super(pool, { downloadOrigin });
    const key = Buffer.from(String(downloadTokenHmacKey || ''), 'utf8');
    if (key.length < 32 || key.length > 256) throw new Error('download-token-hmac-key-32-to-256-bytes-required');
    this.downloadTokenHmacKey = key;
  }

  #token({ grantId, actorId, idempotencyKey, releaseId, deviceId, expiresAt }) {
    return createHmac('sha256', this.downloadTokenHmacKey)
      .update('aarulya-store-download-grant-v1\0')
      .update(grantId)
      .update('\0')
      .update(actorId)
      .update('\0')
      .update(idempotencyKey)
      .update('\0')
      .update(releaseId)
      .update('\0')
      .update(deviceId || 'none')
      .update('\0')
      .update(expiresAt)
      .digest('base64url');
  }

  #resultFor(row, actorId, idempotencyKey, releaseId, deviceId) {
    const rowReleaseId = String(row.app_version_id);
    const rowDeviceId = row.device_id == null ? null : String(row.device_id);
    if (rowReleaseId !== releaseId || rowDeviceId !== deviceId) {
      throw conflict('download-idempotency-key-bound-to-different-request');
    }
    if (row.consumed_at != null) throw conflict('download-idempotency-key-already-consumed');
    const expiresAt = new Date(row.expires_at);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw conflict('download-idempotency-key-expired');
    }
    const grantId = String(row.id);
    const expiresAtIso = expiresAt.toISOString();
    const token = this.#token({
      grantId,
      actorId,
      idempotencyKey,
      releaseId,
      deviceId,
      expiresAt: expiresAtIso
    });
    const expected = Buffer.from(sha256(token), 'hex');
    const actual = Buffer.from(String(row.token_sha256 || ''), 'hex');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error('download-grant-token-integrity-failed');
    }
    return Object.freeze({
      grantId,
      token,
      expiresAt: expiresAtIso,
      downloadUrl: `${DOWNLOAD_ORIGIN}/v1/grants/${grantId}/apk`,
      idempotentReplay: true
    });
  }

  async createDownloadGrant({ userId, devicePublicId = null, release, requestId, idempotencyKey }) {
    const actorId = requireUuid('user-id', userId);
    const releaseId = requireUuid('release-id', release?.releaseId);
    const key = String(idempotencyKey || '');
    if (!/^[A-Za-z0-9._:-]{16,200}$/.test(key)) throw new Error('valid-idempotency-key-required');

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
        deviceId = String(deviceResult.rows[0].id);
      }

      const readExisting = async () => {
        const result = await client.query(
          `SELECT id, device_id, app_version_id, token_sha256, expires_at, consumed_at
           FROM aarulya_store.download_grants
           WHERE user_id = $1 AND idempotency_key = $2
           FOR UPDATE`,
          [actorId, key]
        );
        return result.rows[0] || null;
      };

      const existing = await readExisting();
      if (existing) return this.#resultFor(existing, actorId, key, releaseId, deviceId);

      const grantId = randomUUID();
      const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000);
      const expiresAtIso = expiresAt.toISOString();
      const token = this.#token({ grantId, actorId, idempotencyKey: key, releaseId, deviceId, expiresAt: expiresAtIso });
      const inserted = await client.query(
        `INSERT INTO aarulya_store.download_grants
          (id, user_id, device_id, app_version_id, token_sha256, request_id,
           expires_at, idempotency_key, download_origin)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
         DO NOTHING
         RETURNING id, device_id, app_version_id, token_sha256, expires_at, consumed_at`,
        [grantId, actorId, deviceId, releaseId, sha256(token), requestId,
          expiresAt, key, DOWNLOAD_ORIGIN]
      );

      if (!inserted.rowCount) {
        const raced = await readExisting();
        if (!raced) throw new Error('download-idempotency-race-without-row');
        return this.#resultFor(raced, actorId, key, releaseId, deviceId);
      }

      return Object.freeze({
        grantId,
        token,
        expiresAt: expiresAtIso,
        downloadUrl: `${DOWNLOAD_ORIGIN}/v1/grants/${grantId}/apk`,
        idempotentReplay: false
      });
    });
  }
}
