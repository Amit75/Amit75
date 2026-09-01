import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

function required(name, value) {
  if (!value) throw new Error(`${name}-required`);
  return value;
}

function secretValue(env, directName, fileName) {
  const direct = String(env[directName] || '').trim();
  const file = String(env[fileName] || '').trim();
  if (direct && file) throw new Error(`${directName}-and-${fileName}-mutually-exclusive`);
  if (file) {
    const value = readFileSync(file, { encoding: 'utf8', flag: 'r' }).trim();
    if (!value) throw new Error(`${fileName}-empty`);
    return value;
  }
  return direct;
}

export function createPostgresPool(env = process.env) {
  const connectionString = required(
    'database-url-or-file',
    secretValue(env, 'AARULYA_DATABASE_URL', 'AARULYA_DATABASE_URL_FILE')
  );
  const environment = env.AARULYA_ENV || 'production';
  const sslMode = env.AARULYA_DATABASE_SSL_MODE || 'verify-full';
  if (environment === 'production' && sslMode !== 'verify-full') {
    throw new Error('production-database-verify-full-required');
  }
  if (!['verify-full', 'development-local'].includes(sslMode)) {
    throw new Error('secure-database-ssl-mode-required');
  }

  return new Pool({
    connectionString,
    max: Number(env.AARULYA_DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: false,
    ssl: sslMode === 'verify-full' ? { rejectUnauthorized: true } : false,
    application_name: env.AARULYA_DATABASE_APP_NAME || 'aarulya-store-api',
    statement_timeout: 10_000,
    query_timeout: 12_000
  });
}

export async function withTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL search_path TO aarulya_store, public");
    await client.query("SET LOCAL lock_timeout TO '3s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout TO '10s'");
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function withActorTransaction(pool, actorId, operation) {
  if (!/^[0-9a-f-]{36}$/i.test(String(actorId || ''))) throw new Error('valid-actor-id-required');
  return withTransaction(pool, async (client) => {
    await client.query("SELECT set_config('aarulya.actor_id', $1, true)", [actorId]);
    return operation(client);
  });
}

export async function closePostgresPool(pool) {
  if (pool) await pool.end();
}
