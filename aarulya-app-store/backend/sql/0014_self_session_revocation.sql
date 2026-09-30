BEGIN;

CREATE OR REPLACE FUNCTION aarulya_store.revoke_current_store_session(
  p_session_id text,
  p_subject text,
  p_expires_at timestamptz,
  p_reason text DEFAULT 'user-sign-out'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = aarulya_store, pg_temp
AS $$
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) < 8 OR length(p_session_id) > 512 THEN
    RAISE EXCEPTION 'valid-session-id-required';
  END IF;
  IF p_subject IS NULL OR length(p_subject) < 8 OR length(p_subject) > 512 THEN
    RAISE EXCEPTION 'valid-session-subject-required';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() OR p_expires_at > now() + interval '2 hours' THEN
    RAISE EXCEPTION 'bounded-session-expiry-required';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 OR length(p_reason) > 160 THEN
    RAISE EXCEPTION 'valid-session-revocation-reason-required';
  END IF;

  INSERT INTO aarulya_store.session_revocations(session_id, subject, reason, expires_at)
  VALUES (p_session_id, p_subject, btrim(p_reason), p_expires_at)
  ON CONFLICT (session_id) DO UPDATE
    SET expires_at = GREATEST(aarulya_store.session_revocations.expires_at, EXCLUDED.expires_at),
        reason = EXCLUDED.reason
    WHERE aarulya_store.session_revocations.subject IS NOT DISTINCT FROM EXCLUDED.subject;
END
$$;

REVOKE ALL ON FUNCTION aarulya_store.revoke_current_store_session(text, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION aarulya_store.revoke_current_store_session(text, text, timestamptz, text) TO aarulya_store_api;

COMMIT;
