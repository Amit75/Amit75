BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE catalog_manifest_head (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  catalog_manifest_id uuid NOT NULL UNIQUE REFERENCES catalog_manifests(id) ON DELETE RESTRICT,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  selected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  selected_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION enforce_release_evidence_digest_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_apk_sha256 text;
BEGIN
  SELECT apk_sha256 INTO expected_apk_sha256
  FROM app_versions
  WHERE id = NEW.app_version_id;

  IF expected_apk_sha256 IS NULL THEN
    RAISE EXCEPTION 'release evidence references unknown app version';
  END IF;
  IF NEW.apk_sha256 <> expected_apk_sha256 THEN
    RAISE EXCEPTION 'release evidence APK digest mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER release_evidence_digest_binding
BEFORE INSERT ON release_evidence
FOR EACH ROW EXECUTE FUNCTION enforce_release_evidence_digest_binding();

CREATE OR REPLACE FUNCTION enforce_release_envelope_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  expected_manifest_sha256 text;
BEGIN
  SELECT release_manifest_sha256 INTO expected_manifest_sha256
  FROM app_versions
  WHERE id = NEW.app_version_id;

  IF expected_manifest_sha256 IS NULL THEN
    RAISE EXCEPTION 'release envelope references unknown app version';
  END IF;
  IF NEW.payload_sha256 <> expected_manifest_sha256 THEN
    RAISE EXCEPTION 'release envelope payload digest mismatch';
  END IF;
  IF NEW.publisher <> 'Aarulya' THEN
    RAISE EXCEPTION 'release envelope publisher mismatch';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER signed_release_envelope_binding
BEFORE INSERT ON signed_release_envelopes
FOR EACH ROW EXECUTE FUNCTION enforce_release_envelope_binding();

CREATE OR REPLACE FUNCTION enforce_release_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  required_types text[] := ARRAY[
    'source-review',
    'slsa-build-provenance',
    'independent-rebuild',
    'sbom',
    'dependency-scan',
    'secret-scan',
    'static-analysis',
    'dynamic-analysis',
    'masvs-verification',
    'privacy-review',
    'release-approval',
    'rollback-readiness'
  ];
  missing_type text;
  envelope_ok boolean;
BEGIN
  IF NEW.status <> 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM signed_release_envelopes e
    JOIN trusted_signing_keys k ON k.key_id = e.signing_key_id
    WHERE e.app_version_id = NEW.id
      AND e.payload_sha256 = NEW.release_manifest_sha256
      AND e.publisher = 'Aarulya'
      AND e.signature_verification = 'passed'
      AND e.transparency_inclusion = 'verified'
      AND e.expires_at > now()
      AND k.state IN ('active', 'retiring')
      AND now() BETWEEN k.not_before AND k.not_after
  ) INTO envelope_ok;

  IF NOT envelope_ok THEN
    RAISE EXCEPTION 'publication blocked: valid signed release envelope required';
  END IF;

  SELECT required_type INTO missing_type
  FROM unnest(required_types) AS required_type
  WHERE NOT EXISTS (
    SELECT 1
    FROM release_evidence evidence
    WHERE evidence.app_version_id = NEW.id
      AND evidence.evidence_type = required_type
      AND evidence.apk_sha256 = NEW.apk_sha256
      AND evidence.result = 'passed'
      AND evidence.signature_verification = 'passed'
      AND evidence.transparency_inclusion = 'verified'
      AND evidence.expires_at > now()
  )
  LIMIT 1;

  IF missing_type IS NOT NULL THEN
    RAISE EXCEPTION 'publication blocked: missing valid evidence type %', missing_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_publication_guard
BEFORE INSERT OR UPDATE OF status ON app_versions
FOR EACH ROW EXECUTE FUNCTION enforce_release_publication();

REVOKE ALL ON catalog_manifest_head FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_release_evidence_digest_binding() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_release_envelope_binding() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_release_publication() FROM PUBLIC;

COMMIT;
