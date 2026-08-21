import { randomUUID } from 'node:crypto';
import { withActorTransaction } from './postgres.js';

function requireUuid(name, value) {
  const normalized = String(value || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new Error(`${name}-valid-uuid-required`);
  }
  return normalized;
}

function mapJob(row) {
  return Object.freeze({
    id: String(row.id),
    ownerId: String(row.owner_id),
    type: row.type,
    state: row.state,
    idempotencyKey: row.idempotency_key,
    payload: row.payload || {},
    sensitive: row.sensitive,
    approvalState: row.approval_state,
    runAt: row.run_at ? new Date(row.run_at).toISOString() : null,
    attempt: Number(row.attempt),
    maxAttempts: Number(row.max_attempts),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null
  });
}

export class PostgreSqlJobRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
  }

  async create(actorId, job, requestId) {
    const ownerId = requireUuid('actor-id', actorId);
    return withActorTransaction(this.pool, ownerId, async (client) => {
      const inserted = await client.query(
        `INSERT INTO aarulya_store.jobs
          (id, owner_id, type, state, idempotency_key, payload, sensitive,
           approval_state, run_at, max_attempts)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
         ON CONFLICT (owner_id, idempotency_key)
         DO NOTHING
         RETURNING *`,
        [job.id || randomUUID(), ownerId, job.type, job.state, job.idempotencyKey,
          JSON.stringify(job.payload || {}), job.sensitive === true,
          job.sensitive === true ? 'pending' : 'not-required', job.runAt || null,
          job.maxAttempts]
      );

      let row = inserted.rows[0];
      let created = true;
      if (!row) {
        created = false;
        const existing = await client.query(
          `SELECT * FROM aarulya_store.jobs
           WHERE owner_id = $1 AND idempotency_key = $2`,
          [ownerId, job.idempotencyKey]
        );
        row = existing.rows[0];
      }
      if (!row) throw new Error('durable-job-create-failed');

      if (created) {
        await client.query(
          `INSERT INTO aarulya_store.job_events
            (job_id, actor_id, event_type, to_state, metadata)
           VALUES ($1, $2, 'job-created', $3, $4::jsonb)`,
          [row.id, ownerId, row.state, JSON.stringify({ requestId })]
        );
      }
      return mapJob(row);
    });
  }

  async get(actorId, jobId) {
    const ownerId = requireUuid('actor-id', actorId);
    const id = requireUuid('job-id', jobId);
    return withActorTransaction(this.pool, ownerId, async (client) => {
      const jobResult = await client.query(
        `SELECT * FROM aarulya_store.jobs WHERE id = $1`,
        [id]
      );
      const row = jobResult.rows[0];
      if (!row) {
        const error = new Error('job-not-found');
        error.status = 404;
        throw error;
      }
      const events = await client.query(
        `SELECT event_id, event_type, from_state, to_state, metadata, recorded_at
         FROM aarulya_store.job_events
         WHERE job_id = $1
         ORDER BY sequence`,
        [id]
      );
      return Object.freeze({
        job: mapJob(row),
        events: Object.freeze(events.rows.map((event) => Object.freeze({
          eventId: String(event.event_id),
          type: event.event_type,
          from: event.from_state,
          to: event.to_state,
          metadata: event.metadata || {},
          recordedAt: new Date(event.recorded_at).toISOString()
        })))
      });
    });
  }

  async transition(actorId, jobId, nextState, requestId, metadata = {}) {
    const ownerId = requireUuid('actor-id', actorId);
    const id = requireUuid('job-id', jobId);
    return withActorTransaction(this.pool, ownerId, async (client) => {
      const currentResult = await client.query(
        `SELECT * FROM aarulya_store.jobs WHERE id = $1 FOR UPDATE`,
        [id]
      );
      const current = currentResult.rows[0];
      if (!current) {
        const error = new Error('job-not-found');
        error.status = 404;
        throw error;
      }
      const terminal = ['succeeded', 'failed', 'cancelled', 'dead-lettered'].includes(nextState);
      const updatedResult = await client.query(
        `UPDATE aarulya_store.jobs
         SET state = $2,
             updated_at = now(),
             completed_at = CASE WHEN $3 THEN now() ELSE completed_at END,
             lease_owner = CASE WHEN $2 IN ('leased', 'running') THEN lease_owner ELSE NULL END,
             lease_token_sha256 = CASE WHEN $2 IN ('leased', 'running') THEN lease_token_sha256 ELSE NULL END,
             lease_expires_at = CASE WHEN $2 IN ('leased', 'running') THEN lease_expires_at ELSE NULL END
         WHERE id = $1
         RETURNING *`,
        [id, nextState, terminal]
      );
      await client.query(
        `INSERT INTO aarulya_store.job_events
          (job_id, actor_id, event_type, from_state, to_state, metadata)
         VALUES ($1, $2, 'job-transition', $3, $4, $5::jsonb)`,
        [id, ownerId, current.state, nextState, JSON.stringify({ ...metadata, requestId })]
      );
      return mapJob(updatedResult.rows[0]);
    });
  }
}
