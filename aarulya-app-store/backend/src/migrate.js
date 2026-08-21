import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPostgresPool, closePostgresPool } from './postgres.js';

if (process.env.NODE_ENV !== 'production') throw new Error('production-migration-environment-required');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const pool = createPostgresPool({
  ...process.env,
  AARULYA_DATABASE_APP_NAME: 'aarulya-store-migrations',
  AARULYA_DATABASE_POOL_MAX: '1'
});
const lockId = 7_221_409_311;

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock($1)', [lockId]);
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.aarulya_store_schema_migrations (
      filename text PRIMARY KEY,
      sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(root))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
    .sort();
  if (files.length === 0) throw new Error('no-store-migrations-found');

  for (const filename of files) {
    const sql = await readFile(resolve(root, filename), 'utf8');
    const sha256 = digest(sql);
    const existing = await client.query(
      'SELECT sha256 FROM public.aarulya_store_schema_migrations WHERE filename = $1',
      [filename]
    );
    if (existing.rowCount > 0) {
      if (existing.rows[0].sha256 !== sha256) throw new Error(`migration-checksum-drift:${filename}`);
      console.log(`SKIP ${filename} ${sha256}`);
      continue;
    }

    console.log(`APPLY ${filename} ${sha256}`);
    await client.query(sql);
    await client.query(
      'INSERT INTO public.aarulya_store_schema_migrations (filename, sha256) VALUES ($1, $2)',
      [filename, sha256]
    );
  }
  console.log('AARULYA_STORE_MIGRATIONS=PASS');
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => {});
  client.release();
  await closePostgresPool(pool);
}
