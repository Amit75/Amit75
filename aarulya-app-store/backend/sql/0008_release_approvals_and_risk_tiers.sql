BEGIN;

SET search_path TO aarulya_store, public;

ALTER TABLE apps
  ADD COLUMN risk_tier text NOT NULL DEFAULT 'standard'
    CHECK (risk_tier IN ('standard', 'elevated', 'critical'));

UPDATE apps
SET risk_tier = 'critical'
WHERE package_id IN (
  'com.aarulya.store',
  'com.aarulya.browser',
  'com.aarulya.pay',
  'com.aarulya.sentinel',
  'com.aarulya.cloud',
  'com.aarulya.owner',
  'com.aarulya.security.vault'
);

UPDATE apps
SET risk_tier = 'elevated'
WHERE risk_tier = 'standard'
  AND category IN ('Finance', 'Documents', 'Kids & Family', 'Business', 'Cloud & Files', 'Safety');

CREATE TABLE release_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version_id uuid NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  approver_subject text NOT NULL,
  approver_role text NOT NULL CHECK (approver_role IN (
    'owner',
    'release-manager',
    'security-reviewer',
    'privacy-reviewer',
    'independent-security-reviewer'
  )),
  decision text NOT NULL CHECK (decision = 'approved'),
  apk_sha256 text NOT NULL CHECK (apk_sha256 ~ '^[a-f0-9]{64}$'),
  release_manifest_sha256 text NOT NULL CHECK (release_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  signing_key_id text NOT NULL REFERENCES trusted_signing_keys(key_id) ON DELETE RESTRICT,
  signature_verification text NOT NULL CHECK (signature_verification = 'passed'),
  transparency_inclusion text NOT NULL CHECK (transparency_inclusion = 'verified'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_version_id, approver_subject),
  CHECK (length(approver_subject) BETWEEN 8 AND 512),
  CHECK (expires_at > issued_at)
);

CREATE INDEX release_approvals_version_idx
  ON release_approvals (app_version_id, expires_at DESC);

CREATE OR REPLACE FUNCTION enforce_release_approval_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  version_row app_versions%ROWTYPE;
  key_purpose text;
  key_state text;
  key_not_before timestamptz;
  key_not_after timestamptz;
BEGIN
  SELECT * INTO version_row
  FROM app_versions
  WHERE id = NEW.app_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'release approval references unknown app version';
  END IF;
  IF NEW.apk_sha256 <> version_row.apk_sha256 THEN
    RAISE EXCEPTION 'release approval APK digest mismatch';
  END IF;
  IF NEW.release_manifest_sha256 <> version_row.release_manifest_sha256 THEN
    RAISE EXCEPTION 'release approval manifest digest mismatch';
  END IF;

  SELECT purpose, state, not_before, not_after
    INTO key_purpose, key_state, key_not_before, key_not_after
  FROM trusted_signing_keys
  WHERE key_id = NEW.signing_key_id;

  IF key_purpose NOT IN ('evidence-report', 'release-manifest') THEN
    RAISE EXCEPTION 'release approval signing key purpose invalid';
  END IF;
  IF key_state NOT IN ('active', 'retiring') THEN
    RAISE EXCEPTION 'release approval signing key inactive';
  END IF;
  IF NEW.issued_at NOT BETWEEN key_not_before AND key_not_after THEN
    RAISE EXCEPTION 'release approval issued outside signing key validity';
  END IF;
  IF NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'release approval already expired';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER release_approvals_binding
BEFORE INSERT ON release_approvals
FOR EACH ROW EXECUTE FUNCTION enforce_release_approval_binding();

CREATE TRIGGER release_approvals_immutable
BEFORE UPDATE OR DELETE ON release_approvals
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

CREATE OR REPLACE FUNCTION enforce_release_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  common_types text[] := ARRAY[
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
  critical_types text[] := ARRAY[
    'independent-penetration-test',
    'red-team-exercise',
    'key-compromise-recovery',
    'disaster-recovery-drill',
    'break-glass-drill'
  ];
  required_types text[];
  missing_type text;
  app_risk_tier text;
  envelope_ok boolean;
  approval_count integer;
  approval_threshold integer;
  security_approval_count integer;
  independent_approval_count integer;
BEGIN
  IF NEW.status <> 'published' OR (TG_OP = 'UPDATE' AND OLD.status = 'published') THEN
    RETURN NEW;
  END IF;

  SELECT risk_tier INTO app_risk_tier
  FROM apps
  WHERE id = NEW.app_id;

  IF app_risk_tier IS NULL THEN
    RAISE EXCEPTION 'publication blocked: app risk tier missing';
  END IF;

  required_types := CASE
    WHEN app_risk_tier = 'critical' THEN common_types || critical_types
    ELSE common_types
  END;
  approval_threshold := CASE
    WHEN app_risk_tier = 'critical' THEN 3
    ELSE 2
  END;

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
      AND k.purpose = 'release-manifest'
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
    JOIN trusted_signing_keys key ON key.key_id = evidence.signing_key_id
    WHERE evidence.app_version_id = NEW.id
      AND evidence.evidence_type = required_type
      AND evidence.apk_sha256 = NEW.apk_sha256
      AND evidence.result = 'passed'
      AND evidence.signature_verification = 'passed'
      AND evidence.transparency_inclusion = 'verified'
      AND evidence.expires_at > now()
      AND key.state IN ('active', 'retiring')
      AND now() BETWEEN key.not_before AND key.not_after
  )
  LIMIT 1;

  IF missing_type IS NOT NULL THEN
    RAISE EXCEPTION 'publication blocked: missing valid evidence type %', missing_type;
  END IF;

  SELECT
    count(DISTINCT approver_subject),
    count(DISTINCT approver_subject) FILTER (
      WHERE approver_role IN ('security-reviewer', 'independent-security-reviewer')
    ),
    count(DISTINCT approver_subject) FILTER (
      WHERE approver_role = 'independent-security-reviewer'
    )
  INTO approval_count, security_approval_count, independent_approval_count
  FROM release_approvals approval
  JOIN trusted_signing_keys key ON key.key_id = approval.signing_key_id
  WHERE approval.app_version_id = NEW.id
    AND approval.apk_sha256 = NEW.apk_sha256
    AND approval.release_manifest_sha256 = NEW.release_manifest_sha256
    AND approval.decision = 'approved'
    AND approval.signature_verification = 'passed'
    AND approval.transparency_inclusion = 'verified'
    AND approval.expires_at > now()
    AND key.state IN ('active', 'retiring')
    AND now() BETWEEN key.not_before AND key.not_after;

  IF approval_count < approval_threshold THEN
    RAISE EXCEPTION 'publication blocked: % distinct approvals required, found %', approval_threshold, approval_count;
  END IF;
  IF security_approval_count < 1 THEN
    RAISE EXCEPTION 'publication blocked: security approval required';
  END IF;
  IF app_risk_tier = 'critical' AND independent_approval_count < 1 THEN
    RAISE EXCEPTION 'publication blocked: independent security approval required for critical app';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON release_approvals FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_release_approval_binding() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_release_publication() FROM PUBLIC;

COMMIT;
