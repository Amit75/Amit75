BEGIN;

SET search_path TO aarulya_store, public;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_api')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_downloads')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_worker') THEN
    RAISE EXCEPTION 'Aarulya Store database group roles must be bootstrapped before migrations';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION resolve_store_user(subject text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, aarulya_store
AS $$
DECLARE
  resolved_id uuid;
  resolved_status text;
BEGIN
  IF subject IS NULL OR length(btrim(subject)) < 8 OR length(subject) > 512 THEN
    RAISE EXCEPTION 'valid external subject required';
  END IF;

  INSERT INTO aarulya_store.users (external_subject)
  VALUES (btrim(subject))
  ON CONFLICT (external_subject)
  DO UPDATE SET updated_at = now()
  RETURNING id, status INTO resolved_id, resolved_status;

  IF resolved_status <> 'active' THEN
    RAISE EXCEPTION 'store account not active';
  END IF;
  RETURN resolved_id;
END;
$$;

CREATE OR REPLACE FUNCTION consume_download_grant(grant_uuid uuid, supplied_token_sha256 text)
RETURNS TABLE (
  grant_id uuid,
  release_id uuid,
  object_key text,
  apk_sha256 text,
  apk_size_bytes bigint,
  package_id text,
  version_code bigint,
  signer_fingerprint text,
  signing_key_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, aarulya_store
AS $$
BEGIN
  IF supplied_token_sha256 !~ '^[a-f0-9]{64}$' THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE aarulya_store.download_grants grant_row
  SET consumed_at = now()
  FROM aarulya_store.app_versions version_row,
       aarulya_store.apps app_row
  WHERE grant_row.id = grant_uuid
    AND grant_row.token_sha256 = supplied_token_sha256
    AND grant_row.consumed_at IS NULL
    AND grant_row.expires_at > now()
    AND version_row.id = grant_row.app_version_id
    AND app_row.id = version_row.app_id
    AND version_row.status = 'published'
    AND version_row.revoked_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM aarulya_store.signed_release_envelopes envelope
      JOIN aarulya_store.trusted_signing_keys key ON key.key_id = envelope.signing_key_id
      WHERE envelope.app_version_id = version_row.id
        AND envelope.payload_sha256 = version_row.release_manifest_sha256
        AND envelope.signature_verification = 'passed'
        AND envelope.transparency_inclusion = 'verified'
        AND envelope.expires_at > now()
        AND key.state IN ('active', 'retiring')
        AND now() BETWEEN key.not_before AND key.not_after
    )
    AND NOT EXISTS (
      SELECT 1
      FROM aarulya_store.distribution_kill_switches kill_switch
      WHERE kill_switch.disabled = true
        AND (kill_switch.expires_at IS NULL OR kill_switch.expires_at > now())
        AND ((kill_switch.scope_type = 'global' AND kill_switch.scope_id = 'downloads')
          OR (kill_switch.scope_type = 'package' AND kill_switch.scope_id = app_row.package_id))
    )
  RETURNING
    grant_row.id,
    version_row.id,
    version_row.apk_object_key,
    version_row.apk_sha256,
    version_row.apk_size_bytes,
    app_row.package_id,
    version_row.version_code,
    version_row.signer_fingerprint,
    version_row.signing_key_id;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_published_release_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF NEW.status = 'revoked' THEN
      IF NEW.revoked_at IS NULL OR NEW.revocation_reason IS NULL THEN
        RAISE EXCEPTION 'revocation timestamp and reason required';
      END IF;
      IF NEW.id <> OLD.id
         OR NEW.app_id <> OLD.app_id
         OR NEW.version_code <> OLD.version_code
         OR NEW.version_name <> OLD.version_name
         OR NEW.apk_object_key <> OLD.apk_object_key
         OR NEW.apk_sha256 <> OLD.apk_sha256
         OR NEW.signer_fingerprint <> OLD.signer_fingerprint
         OR NEW.signing_key_id <> OLD.signing_key_id
         OR NEW.source_commit_sha <> OLD.source_commit_sha
         OR NEW.sbom_sha256 <> OLD.sbom_sha256
         OR NEW.release_manifest_sha256 <> OLD.release_manifest_sha256
         OR NEW.published_at <> OLD.published_at
         OR NEW.final_evidence_report_sha256 <> OLD.final_evidence_report_sha256 THEN
        RAISE EXCEPTION 'published release identity cannot change during revocation';
      END IF;
      RETURN NEW;
    END IF;

    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'published release is immutable; revoke and publish a higher version';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_published_immutable
BEFORE UPDATE ON app_versions
FOR EACH ROW EXECUTE FUNCTION prevent_published_release_mutation();

CREATE OR REPLACE FUNCTION enforce_safe_version_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  eligible boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM app_versions version_row
    JOIN signed_release_envelopes envelope ON envelope.app_version_id = version_row.id
    WHERE version_row.id = NEW.app_version_id
      AND version_row.app_id = NEW.app_id
      AND version_row.status = 'published'
      AND version_row.revoked_at IS NULL
      AND envelope.payload_sha256 = version_row.release_manifest_sha256
      AND envelope.signature_verification = 'passed'
      AND envelope.transparency_inclusion = 'verified'
      AND envelope.expires_at > now()
  ) INTO eligible;

  IF NOT eligible THEN
    RAISE EXCEPTION 'safe version must reference a current verified published release';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER safe_versions_eligibility
BEFORE INSERT OR UPDATE ON safe_versions
FOR EACH ROW EXECUTE FUNCTION enforce_safe_version_eligibility();

REVOKE ALL ON FUNCTION resolve_store_user(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_download_grant(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION prevent_published_release_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_safe_version_eligibility() FROM PUBLIC;

GRANT USAGE ON SCHEMA aarulya_store TO aarulya_store_api, aarulya_store_downloads, aarulya_store_worker;
GRANT EXECUTE ON FUNCTION resolve_store_user(text) TO aarulya_store_api;
GRANT EXECUTE ON FUNCTION consume_download_grant(uuid, text) TO aarulya_store_downloads;

GRANT SELECT ON
  apps, app_versions, safe_versions, catalog_manifests, catalog_manifest_head,
  trusted_signing_keys, signed_release_envelopes, release_evidence,
  distribution_kill_switches, token_revocations, session_revocations
TO aarulya_store_api;

GRANT SELECT, INSERT, UPDATE ON
  devices, download_grants, install_receipts, jobs, update_checks
TO aarulya_store_api;
GRANT SELECT, INSERT ON job_events TO aarulya_store_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA aarulya_store TO aarulya_store_api;

COMMIT;
