BEGIN;

SET search_path TO aarulya_store, public;

CREATE OR REPLACE FUNCTION run_store_maintenance(task_name text, max_rows integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, aarulya_store
AS $$
DECLARE
  affected integer := 0;
  secondary_affected integer := 0;
BEGIN
  IF NOT pg_has_role(session_user, 'aarulya_store_worker', 'member') THEN
    RAISE EXCEPTION 'worker role required';
  END IF;
  IF max_rows < 1 OR max_rows > 1000 THEN
    RAISE EXCEPTION 'bounded maintenance row count required';
  END IF;

  CASE task_name
    WHEN 'store-maintenance.expire-download-grants' THEN
      WITH expired AS (
        SELECT id
        FROM aarulya_store.download_grants
        WHERE expires_at < now() - interval '1 day'
           OR consumed_at < now() - interval '1 day'
        ORDER BY expires_at
        LIMIT max_rows
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM aarulya_store.download_grants grant_row
      USING expired
      WHERE grant_row.id = expired.id;
      GET DIAGNOSTICS affected = ROW_COUNT;

    WHEN 'store-maintenance.expire-auth-revocations' THEN
      WITH expired AS (
        SELECT token_id
        FROM aarulya_store.token_revocations
        WHERE expires_at < now() - interval '7 days'
        ORDER BY expires_at
        LIMIT max_rows
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM aarulya_store.token_revocations revocation
      USING expired
      WHERE revocation.token_id = expired.token_id;
      GET DIAGNOSTICS affected = ROW_COUNT;

      WITH expired AS (
        SELECT session_id
        FROM aarulya_store.session_revocations
        WHERE expires_at < now() - interval '7 days'
        ORDER BY expires_at
        LIMIT GREATEST(1, max_rows - affected)
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM aarulya_store.session_revocations revocation
      USING expired
      WHERE revocation.session_id = expired.session_id;
      GET DIAGNOSTICS secondary_affected = ROW_COUNT;
      affected := affected + secondary_affected;

    WHEN 'store-maintenance.prune-update-checks' THEN
      WITH expired AS (
        SELECT id
        FROM aarulya_store.update_checks
        WHERE checked_at < now() - interval '90 days'
        ORDER BY checked_at
        LIMIT max_rows
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM aarulya_store.update_checks check_row
      USING expired
      WHERE check_row.id = expired.id;
      GET DIAGNOSTICS affected = ROW_COUNT;

    ELSE
      RAISE EXCEPTION 'unsupported maintenance task';
  END CASE;

  RETURN jsonb_build_object('task', task_name, 'affectedRows', affected);
END;
$$;

REVOKE ALL ON FUNCTION run_store_maintenance(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION run_store_maintenance(text, integer) TO aarulya_store_worker;

COMMIT;
