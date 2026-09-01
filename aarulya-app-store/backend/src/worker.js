import { createPostgresPool, closePostgresPool } from './postgres.js';
import { EXECUTABLE_JOB_TYPES } from './job-types.js';
import {
  claimNextJob,
  finishLeasedJob,
  heartbeatLease,
  startLeasedJob
} from './worker-leasing.js';

if (process.env.NODE_ENV !== 'production') throw new Error('production-worker-environment-required');
const workerId = String(process.env.AARULYA_WORKER_ID || '').trim();
if (!/^[a-z0-9][a-z0-9._:-]{7,127}$/i.test(workerId)) throw new Error('verified-worker-id-required');

const pool = createPostgresPool({
  ...process.env,
  AARULYA_DATABASE_APP_NAME: 'aarulya-store-worker'
});
const pollMilliseconds = Math.max(500, Math.min(Number(process.env.AARULYA_WORKER_POLL_MS) || 2000, 30_000));
let stopping = false;
let active = false;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function boundedRows(payload = {}) {
  const value = Number(payload.maxRows ?? 500);
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error('bounded-maintenance-row-count-required');
  return value;
}

function transientDatabaseError(error) {
  const code = String(error?.code || '');
  return code.startsWith('08') || code.startsWith('40') || code === '57P01';
}

async function recoverExpiredLeases() {
  const result = await pool.query('SELECT aarulya_store.recover_expired_job_leases($1) AS recovered', [100]);
  return Number(result.rows[0]?.recovered || 0);
}

async function executeJob(job) {
  if (!EXECUTABLE_JOB_TYPES.includes(String(job.type))) throw new Error('unsupported-worker-job-type');
  const result = await pool.query(
    'SELECT aarulya_store.run_store_maintenance($1, $2) AS result',
    [String(job.type), boundedRows(job.payload)]
  );
  const safeResult = result.rows[0]?.result || {};
  return Object.freeze({
    task: String(job.type),
    affectedRows: Math.max(0, Number(safeResult.affectedRows || 0))
  });
}

async function runClaimed(claimed) {
  const { job, leaseToken } = claimed;
  await startLeasedJob(pool, { jobId: job.id, workerId, leaseToken });
  let heartbeatRunning = false;
  const heartbeat = setInterval(() => {
    if (heartbeatRunning || stopping) return;
    heartbeatRunning = true;
    heartbeatLease(pool, { jobId: job.id, workerId, leaseToken })
      .catch((error) => console.error({ event: 'worker-heartbeat-failed', jobId: job.id, code: error?.code || error?.message }))
      .finally(() => { heartbeatRunning = false; });
  }, 20_000);
  heartbeat.unref();

  try {
    const result = await executeJob(job);
    await finishLeasedJob(pool, {
      jobId: job.id,
      workerId,
      leaseToken,
      outcome: 'succeeded',
      safeMetadata: result
    });
  } catch (error) {
    const retry = transientDatabaseError(error) && Number(job.attempt) < Number(job.max_attempts);
    await finishLeasedJob(pool, {
      jobId: job.id,
      workerId,
      leaseToken,
      outcome: retry ? 'retrying' : 'failed',
      safeMetadata: {
        errorClass: retry ? 'temporary-database' : 'permanent-failure',
        code: String(error?.code || error?.message || 'worker-failure').slice(0, 120)
      }
    }).catch((transitionError) => {
      console.error({
        event: 'worker-failure-transition-denied',
        jobId: job.id,
        code: transitionError?.code || transitionError?.message
      });
    });
  } finally {
    clearInterval(heartbeat);
  }
}

async function loop() {
  const recovered = await recoverExpiredLeases();
  if (recovered > 0) console.log(`Recovered ${recovered} expired Store worker leases.`);
  console.log(`Aarulya Store worker ${workerId} started with ${EXECUTABLE_JOB_TYPES.length} task types.`);

  while (!stopping) {
    if (active) {
      await sleep(pollMilliseconds);
      continue;
    }
    active = true;
    try {
      const claimed = await claimNextJob(pool, workerId, EXECUTABLE_JOB_TYPES);
      if (claimed) await runClaimed(claimed);
      else await sleep(pollMilliseconds);
    } catch (error) {
      console.error({ event: 'worker-loop-error', code: error?.code || error?.message });
      await sleep(Math.min(30_000, pollMilliseconds * 2));
    } finally {
      active = false;
    }
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Received ${signal}; stopping Aarulya Store worker.`);
  const deadline = Date.now() + 15_000;
  while (active && Date.now() < deadline) await sleep(100);
  await closePostgresPool(pool);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await loop();
