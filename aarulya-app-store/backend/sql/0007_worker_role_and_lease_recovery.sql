BEGIN;

SET search_path TO aarulya_store, public;

CREATE POLICY jobs_worker_policy ON jobs
  USING (pg_has_role(current_user, 'aarulya_store_worker', 'member'))
  WITH CHECK (pg_has_role(current_user, 'aarulya_store_worker', 'member'));

CREATE POLICY job_events_worker_policy ON job_events
  USING (pg_has_role(current_user, 'aarulya_store_worker', 'member'))
  WITH CHECK (pg_has_role(current_user, 'aarulya_store_worker', 'member'));

GRANT SELECT, UPDATE ON jobs TO aarulya_store_worker;
GRANT SELECT, INSERT ON job_events TO aarulya_store_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA aarulya_store TO aarulya_store_worker;

CREATE OR REPLACE FUNCTION recover_expired_job_leases(max_rows integer DEFAULT 100)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, aarulya_store
AS $$
DECLARE
  recovered integer := 0;
BEGIN
  IF NOT pg_has_role(current_user, 'aarulya_store_worker', 'member') THEN
    RAISE EXCEPTION 'worker role required';
  END IF;
  IF max_rows < 1 OR max_rows > 1000 THEN
    RAISE EXCEPTION 'bounded recovery row count required';
  END IF;

  WITH expired AS (
    SELECT id, state
    FROM aarulya_store.jobs
    WHERE state IN ('leased', 'running')
      AND lease_expires_at < now()
    ORDER BY lease_expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT max_rows
  ), recovered_rows AS (
    UPDATE aarulya_store.jobs job_row
    SET state = CASE WHEN job_row.attempt < job_row.max_attempts THEN 'retrying'::aarulya_store.durable_job_state
                     ELSE 'dead-lettered'::aarulya_store.durable_job_state END,
        lease_owner = NULL,
        lease_token_sha256 = NULL,
        lease_expires_at = NULL,
        last_heartbeat_at = NULL,
        completed_at = CASE WHEN job_row.attempt >= job_row.max_attempts THEN now() ELSE NULL END,
        updated_at = now()
    FROM expired
    WHERE job_row.id = expired.id
    RETURNING job_row.id, expired.state AS prior_state, job_row.state
  )
  INSERT INTO aarulya_store.job_events (job_id, event_type, from_state, to_state, metadata)
  SELECT id, 'worker-lease-expired', prior_state, state, jsonb_build_object('automaticRecovery', true)
  FROM recovered_rows;

  GET DIAGNOSTICS recovered = ROW_COUNT;
  RETURN recovered;
END;
$$;

REVOKE ALL ON FUNCTION recover_expired_job_leases(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recover_expired_job_leases(integer) TO aarulya_store_worker;

COMMIT;
