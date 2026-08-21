import { withTransaction } from './postgres.js';

export class PostgreSqlIdentityRepository {
  constructor(pool) {
    if (!pool) throw new Error('postgres-pool-required');
    this.pool = pool;
  }

  async resolveUser(externalSubject) {
    const subject = String(externalSubject || '').trim();
    if (subject.length < 8 || subject.length > 512) throw new Error('valid-external-subject-required');
    return withTransaction(this.pool, async (client) => {
      const result = await client.query(
        `SELECT aarulya_store.resolve_store_user($1::text) AS id`,
        [subject]
      );
      const id = result.rows[0]?.id;
      if (!id) throw new Error('store-account-resolution-failed');
      return String(id);
    });
  }
}
