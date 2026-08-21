import { createHash } from 'node:crypto';
import { APP_CATALOG } from '../../src/catalog.js';
import { createPostgresPool, closePostgresPool } from './postgres.js';

if (process.env.NODE_ENV !== 'production') throw new Error('production-catalog-seed-environment-required');
const sourceCommitSha = String(process.env.AARULYA_SOURCE_COMMIT_SHA || '').trim().toLowerCase();
if (!/^[a-f0-9]{40,64}$/.test(sourceCommitSha)) throw new Error('source-commit-sha-required');
if (!Array.isArray(APP_CATALOG) || APP_CATALOG.length === 0) throw new Error('nonempty-aarulya-catalog-required');

const normalized = APP_CATALOG.map((app, index) => {
  if (!/^com\.aarulya(?:\.[a-z][a-z0-9_]*)+$/.test(app.packageId || '')) {
    throw new Error(`non-aarulya-package-in-catalog:${app.id}`);
  }
  return Object.freeze({
    id: String(app.id),
    packageId: String(app.packageId),
    name: String(app.name),
    category: String(app.category),
    description: String(app.description || ''),
    ageLabel: String(app.age || 'Not rated'),
    childDirected: String(app.category) === 'Kids & Family',
    featured: index < 8,
    sortPriority: index + 1
  });
});
const catalogJson = JSON.stringify(normalized);
const catalogSha256 = createHash('sha256').update(catalogJson).digest('hex');
const pool = createPostgresPool({
  ...process.env,
  AARULYA_DATABASE_APP_NAME: 'aarulya-store-catalog-seed',
  AARULYA_DATABASE_POOL_MAX: '1'
});
const client = await pool.connect();
try {
  await client.query('SELECT pg_advisory_lock($1)', [7_221_409_312]);
  await client.query('BEGIN');
  try {
    await client.query("SET LOCAL search_path TO aarulya_store, public");
    for (const app of normalized) {
      await client.query(
        `INSERT INTO apps
          (id, package_id, publisher, name, category, description, age_label,
           child_directed, visibility, featured, sort_priority)
         VALUES ($1, $2, 'Aarulya', $3, $4, $5, $6, $7, 'visible', $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           package_id = EXCLUDED.package_id,
           publisher = 'Aarulya',
           name = EXCLUDED.name,
           category = EXCLUDED.category,
           description = EXCLUDED.description,
           age_label = EXCLUDED.age_label,
           child_directed = EXCLUDED.child_directed,
           visibility = CASE WHEN apps.visibility = 'retired' THEN 'retired' ELSE 'visible' END,
           featured = EXCLUDED.featured,
           sort_priority = EXCLUDED.sort_priority,
           metadata_revision = apps.metadata_revision + 1,
           updated_at = now()`,
        [app.id, app.packageId, app.name, app.category, app.description,
          app.ageLabel, app.childDirected, app.featured, app.sortPriority]
      );
    }
    await client.query(
      `INSERT INTO catalog_seed_audit (catalog_sha256, app_count, source_commit_sha)
       VALUES ($1, $2, $3)
       ON CONFLICT (catalog_sha256, source_commit_sha) DO NOTHING`,
      [catalogSha256, normalized.length, sourceCommitSha]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
  console.log(`AARULYA_STORE_CATALOG_SEED=PASS count=${normalized.length} sha256=${catalogSha256}`);
} finally {
  await client.query('SELECT pg_advisory_unlock($1)', [7_221_409_312]).catch(() => {});
  client.release();
  await closePostgresPool(pool);
}
