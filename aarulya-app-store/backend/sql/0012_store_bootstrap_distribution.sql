BEGIN;

SET search_path TO aarulya_store, public;

CREATE OR REPLACE FUNCTION get_store_bootstrap_release()
RETURNS TABLE (
  release_id uuid,
  object_key text,
  apk_sha256 text,
  apk_size_bytes bigint,
  package_id text,
  version_code bigint,
  signer_fingerprint text,
  signing_key_id text,
  evidence_report_sha256 text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, aarulya_store
AS $$
  SELECT
    v.id,
    v.apk_object_key,
    v.apk_sha256,
    v.apk_size_bytes,
    a.package_id,
    v.version_code,
    v.signer_fingerprint,
    v.signing_key_id,
    v.final_evidence_report_sha256
  FROM aarulya_store.safe_versions safe
  JOIN aarulya_store.apps a ON a.id = safe.app_id
  JOIN aarulya_store.app_versions v
    ON v.id = safe.app_version_id
   AND v.app_id = a.id
  WHERE safe.app_id = 'aarulya-store'
    AND a.package_id = 'com.aarulya.store'
    AND a.publisher = 'Aarulya'
    AND a.visibility = 'visible'
    AND v.status = 'published'
    AND v.revoked_at IS NULL
    AND v.apk_size_bytes IS NOT NULL
    AND v.ownership_evidence_review = 'passed'
    AND v.mobile_hardening_review = 'passed'
    AND v.android_permission_privacy_review = 'passed'
    AND v.malware_scan = 'passed'
    AND v.security_review = 'passed'
    AND v.publication_gate_status = 'passed'
    AND v.final_evidence_report_sha256 IS NOT NULL
    AND v.final_evidence_report_signature_verification = 'passed'
    AND v.final_evidence_report_transparency_inclusion = 'verified'
    AND EXISTS (
      SELECT 1
      FROM aarulya_store.signed_release_envelopes envelope
      JOIN aarulya_store.trusted_signing_keys key
        ON key.key_id = envelope.signing_key_id
      WHERE envelope.app_version_id = v.id
        AND envelope.payload_sha256 = v.release_manifest_sha256
        AND envelope.publisher = 'Aarulya'
        AND envelope.signature_verification = 'passed'
        AND envelope.transparency_inclusion = 'verified'
        AND envelope.expires_at > now()
        AND key.purpose = 'release-manifest'
        AND key.state IN ('active', 'retiring')
        AND now() BETWEEN key.not_before AND key.not_after
    )
    AND NOT EXISTS (
      SELECT 1
      FROM aarulya_store.distribution_kill_switches kill_switch
      WHERE kill_switch.disabled = true
        AND (kill_switch.expires_at IS NULL OR kill_switch.expires_at > now())
        AND (
          (kill_switch.scope_type = 'global' AND kill_switch.scope_id = 'downloads')
          OR (kill_switch.scope_type = 'package' AND kill_switch.scope_id = 'com.aarulya.store')
        )
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_store_bootstrap_release() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_store_bootstrap_release() TO aarulya_store_downloads;

COMMIT;
