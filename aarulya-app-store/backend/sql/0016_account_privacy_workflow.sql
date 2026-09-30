BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE account_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type text NOT NULL CHECK (request_type IN ('deletion')),
  state text NOT NULL DEFAULT 'requested' CHECK (state IN ('requested','cancelled','fulfilled','rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((state = 'cancelled' AND cancelled_at IS NOT NULL) OR state <> 'cancelled'),
  CHECK ((state IN ('fulfilled','rejected') AND completed_at IS NOT NULL) OR state NOT IN ('fulfilled','rejected'))
);

CREATE UNIQUE INDEX account_privacy_request_active_idx
  ON account_privacy_requests (user_id, request_type)
  WHERE state = 'requested';

ALTER TABLE account_privacy_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_privacy_requests_owner_policy ON account_privacy_requests
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION request_account_deletion()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aarulya_store, pg_temp
AS $$
DECLARE
  actor uuid;
  existing uuid;
  created uuid;
BEGIN
  actor := nullif(current_setting('aarulya.actor_id', true), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'actor-context-required';
  END IF;

  SELECT id INTO existing
  FROM account_privacy_requests
  WHERE user_id = actor
    AND request_type = 'deletion'
    AND state = 'requested';

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO account_privacy_requests(user_id, request_type)
  VALUES (actor, 'deletion')
  RETURNING id INTO created;

  RETURN created;
END
$$;

CREATE OR REPLACE FUNCTION cancel_account_deletion_request()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aarulya_store, pg_temp
AS $$
DECLARE
  actor uuid;
  cancelled uuid;
BEGIN
  actor := nullif(current_setting('aarulya.actor_id', true), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'actor-context-required';
  END IF;

  UPDATE account_privacy_requests
  SET state = 'cancelled', cancelled_at = now()
  WHERE user_id = actor
    AND request_type = 'deletion'
    AND state = 'requested'
  RETURNING id INTO cancelled;

  IF cancelled IS NULL THEN
    RAISE EXCEPTION 'active-deletion-request-not-found';
  END IF;

  RETURN cancelled;
END
$$;

REVOKE ALL ON FUNCTION request_account_deletion() FROM PUBLIC;
REVOKE ALL ON FUNCTION cancel_account_deletion_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_account_deletion() TO aarulya_store_api;
GRANT EXECUTE ON FUNCTION cancel_account_deletion_request() TO aarulya_store_api;
GRANT SELECT ON account_privacy_requests TO aarulya_store_api;

COMMIT;
