import { createHash, randomBytes } from 'node:crypto';
import { withTransaction } from './postgres.js';

const LEASE_SECONDS = 60;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function validWorkerId(value) {
  return /^[a-z0-9][a-z0-9._:-]{7,127}$/i.test(String(value || ''));
}

function validSupportedTypes(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= 32
    && value.every((type) => /^[a-z0-9][a-z0-9._:-]{3,127}$/i.test(String(type)));
}

export async function claimNextJob(pool, workerId, supportedTypes, now = new Date()) {
  if (!validWorkerId(workerId)) throw new Error('verified-worker-id-required');
  if (!validSupportedTypes(supportedTypes)) throw new Error('supported-worker-job-types-required');
  const leaseToken = randomBytes(32).toString('base64url');
  const leaseDigest = sha256(leaseToken);

  const job = await withTransaction(pool, async (client) => {
    const result = await client.query(
      `WITH candidate AS (
         SELECT id, state AS prior_state
         FROM aarulya_store.jobs
         WHERE state IN ('queued', 'retrying')
           AND type = ANY($5::text[])
           AND (run_at IS NULL OR run_at <= $1)
           AND attempt < max_attempts
           AND (sensitive = false OR approval_state = 'approved')
         ORDER BY COALESCE(run_at, created_at), created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE aarulya_store.jobs AS job_row
       SET state = 'leased',
           lease_owner = $2,
           lease_token_sha256 = $3,
           lease_expires_at = $1 + make_interval(secs => $4),
           last_heartbeat_at = $1,
           attempt = attempt + 1,
           updated_at = $1
       FROM candidate
       WHERE job_row.id = candidate.id
       RETURNING job_row.*, candidate.prior_state`,
      [now, workerId, leaseDigest, LEASE_SECONDS, supportedTypes]
    );

    if (!result.rowCount) return null;
    const claimed = result.rows[0];
    await client.query(
      `INSERT INTO aarulya_store.job_events
        (job_id, event_type, from_state, to_state, metadata)
       VALUES ($1, 'worker-leased', $2::aarulya_store.durable_job_state,
               'leased'::aarulya_store.durable_job_state,
               jsonb_build_object('workerId', $3, 'attempt', $4))`,
      [claimed.id, claimed.prior_state, workerId, claimed.attempt]
    );
    return claimed;
  });

  return job ? Object.freeze({ job, leaseToken, leaseExpiresInSeconds: LEASE_SECONDS }) : null;
}

export async function heartbeatLease(pool, { jobId, workerId, leaseToken, now = new Date() }) {
  if (!validWorkerId(workerId) || !leaseToken) throw new Error('worker-lease-credentials-required');
  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `UPDATE aarulya_store.jobs
       SET last_heartbeat_at = $1,
           lease_expires_at = $1 + make_interval(secs => $5),
           updated_at = $1
       WHERE id = $2
         AND lease_owner = $3
         AND lease_token_sha256 = $4
         AND state IN ('leased', 'running')
         AND lease_expires_at > $1
       RETURNING id, state, lease_expires_at`,
      [now, jobId, workerId, sha256(leaseToken), LEASE_SECONDS]
    );
    if (!result.rowCount) throw new Error('worker-lease-invalid-or-expired');
    return Object.freeze(result.rows[0]);
  });
}

export async function startLeasedJob(pool, { jobId, workerId, leaseToken, now = new Date() }) {
  return transitionLeasedJob(pool, {
    jobId,
    workerId,
    leaseToken,
    fromStates: ['leased'],
    toState: 'running',
    eventType: 'worker-started',
    now
  });
}

export async function finishLeasedJob(pool, {
  jobId,
  workerId,
  leaseToken,
  outcome,
  safeMetadata = {},
  now = new Date()
}) {
  const allowed = new Set(['succeeded', 'failed', 'retrying', 'waiting-user', 'waiting-external']);
  if (!allowed.has(outcome)) throw new Error('invalid-worker-outcome');
  return transitionLeasedJob(pool, {
    jobId,
    workerId,
    leaseToken,
    fromStates: ['leased', 'running'],
    toState: outcome,
    eventType: 'worker-finished',
    safeMetadata,
    now
  });
}

async function transitionLeasedJob(pool, {
  jobId,
  workerId,
  leaseToken,
  fromStates,
  toState,
  eventType,
  safeMetadata = {},
  now
}) {
  if (!validWorkerId(workerId) || !leaseToken) throw new Error('worker-lease-credentials-required');
  if (JSON.stringify(safeMetadata).length > 4096) throw new Error('worker-event-metadata-too-large');

  return withTransaction(pool, async (client) => {
    const result = await client.query(
      `WITH current_job AS (
         SELECT id, state AS prior_state
         FROM aarulya_store.jobs
         WHERE id = $3
           AND lease_owner = $4
           AND lease_token_sha256 = $5
           AND state = ANY($6::aarulya_store.durable_job_state[])
           AND lease_expires_at > $2
         FOR UPDATE
       )
       UPDATE aarulya_store.jobs AS job_row
       SET state = $1::aarulya_store.durable_job_state,
           updated_at = $2,
           run_at = CASE
             WHEN $1 = 'retrying' THEN $2 + make_interval(
               secs => LEAST(3600, (5 * power(2, LEAST(job_row.attempt, 10)))::integer)
             )
             ELSE job_row.run_at
           END,
           completed_at = CASE WHEN $1 IN ('succeeded', 'failed') THEN $2 ELSE job_row.completed_at END,
           lease_owner = NULL,
           lease_token_sha256 = NULL,
           lease_expires_at = NULL,
           last_heartbeat_at = NULL
       FROM current_job
       WHERE job_row.id = current_job.id
       RETURNING job_row.*, current_job.prior_state`,
      [toState, now, jobId, workerId, sha256(leaseToken), fromStates]
    );
    if (!result.rowCount) throw new Error('worker-transition-denied');
    const updated = result.rows[0];

    await client.query(
      `INSERT INTO aarulya_store.job_events
        (job_id, event_type, from_state, to_state, metadata)
       VALUES ($1, $2, $3::aarulya_store.durable_job_state,
               $4::aarulya_store.durable_job_state, $5::jsonb)`,
      [jobId, eventType, updated.prior_state, toState, JSON.stringify(safeMetadata)]
    );
    return Object.freeze(updated);
  });
}
