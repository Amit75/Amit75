BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE store_sessions (
  session_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_subject text NOT NULL,
  token_id text NOT NULL,
  device_public_id text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (length(session_id) BETWEEN 8 AND 512),
  CHECK (length(external_subject) BETWEEN 8 AND 512),
  CHECK (length(token_id) BETWEEN 8 AND 512),
  CHECK (expires_at > first_seen_at)
);

CREATE INDEX store_sessions_user_idx ON store_sessions (user_id, last_seen_at DESC);

CREATE TABLE developer_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_name text NOT NULL CHECK (length(app_name) BETWEEN 2 AND 120),
  package_id text NOT NULL CHECK (package_id ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$'),
  category text NOT NULL CHECK (length(category) BETWEEN 2 AND 80),
  privacy_policy_url text NOT NULL CHECK (privacy_policy_url ~ '^https://'),
  ownership_evidence_url text NOT NULL CHECK (ownership_evidence_url ~ '^https://'),
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','submitted','changes-requested','approved','rejected')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, package_id),
  CHECK ((state = 'draft' AND submitted_at IS NULL) OR state <> 'draft')
);

CREATE TABLE developer_submission_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  submission_id uuid NOT NULL REFERENCES developer_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('draft-created','submitted','changes-requested','approved','rejected')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER developer_submission_events_immutable
BEFORE UPDATE OR DELETE ON developer_submission_events
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

ALTER TABLE store_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_submission_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY store_sessions_owner_policy ON store_sessions
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY developer_submissions_owner_policy ON developer_submissions
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY developer_submission_events_owner_policy ON developer_submission_events
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE OR REPLACE FUNCTION revoke_owned_store_session(
  p_session_id text,
  p_reason text DEFAULT 'user-account-session-revocation'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aarulya_store, pg_temp
AS $$
DECLARE
  actor uuid;
  target store_sessions%ROWTYPE;
BEGIN
  actor := nullif(current_setting('aarulya.actor_id', true), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'actor-context-required';
  END IF;

  SELECT * INTO target
  FROM store_sessions
  WHERE session_id = p_session_id
    AND user_id = actor
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'owned-active-session-not-found';
  END IF;

  INSERT INTO session_revocations(session_id, subject, reason, expires_at)
  VALUES (target.session_id, target.external_subject, left(coalesce(nullif(btrim(p_reason), ''), 'user-account-session-revocation'), 160), target.expires_at)
  ON CONFLICT (session_id) DO UPDATE
    SET expires_at = GREATEST(session_revocations.expires_at, EXCLUDED.expires_at),
        reason = EXCLUDED.reason
    WHERE session_revocations.subject IS NOT DISTINCT FROM EXCLUDED.subject;
END
$$;

REVOKE ALL ON FUNCTION revoke_owned_store_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_owned_store_session(text, text) TO aarulya_store_api;

GRANT SELECT, INSERT, UPDATE ON store_sessions TO aarulya_store_api;
GRANT SELECT, INSERT, UPDATE (app_name, category, privacy_policy_url, ownership_evidence_url, state, submitted_at, updated_at)
  ON developer_submissions TO aarulya_store_api;
GRANT SELECT, INSERT ON developer_submission_events TO aarulya_store_api;
GRANT USAGE, SELECT ON SEQUENCE developer_submission_events_sequence_seq TO aarulya_store_api;

COMMIT;
