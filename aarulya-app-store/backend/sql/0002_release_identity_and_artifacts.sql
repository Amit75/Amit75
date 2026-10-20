BEGIN;

SET search_path TO aarulya_store, public;

ALTER TABLE app_versions
  ADD COLUMN version_name_display text,
  ADD COLUMN apk_size_bytes bigint CHECK (apk_size_bytes IS NULL OR apk_size_bytes > 0),
  ADD COLUMN min_sdk integer CHECK (min_sdk IS NULL OR min_sdk >= 26),
  ADD COLUMN target_sdk integer CHECK (target_sdk IS NULL OR target_sdk >= 26),
  ADD COLUMN release_notes text,
  ADD COLUMN ownership_evidence_review text NOT NULL DEFAULT 'pending'
    CHECK (ownership_evidence_review IN ('pending', 'passed', 'failed', 'expired')),
  ADD COLUMN mobile_hardening_review text NOT NULL DEFAULT 'pending'
    CHECK (mobile_hardening_review IN ('pending', 'passed', 'failed', 'expired')),
  ADD COLUMN android_permission_privacy_review text NOT NULL DEFAULT 'pending'
    CHECK (android_permission_privacy_review IN ('pending', 'passed', 'failed', 'expired')),
  ADD COLUMN malware_scan text NOT NULL DEFAULT 'pending'
    CHECK (malware_scan IN ('pending', 'passed', 'failed', 'expired')),
  ADD COLUMN security_review text NOT NULL DEFAULT 'pending'
    CHECK (security_review IN ('pending', 'passed', 'failed', 'expired')),
  ADD COLUMN publication_gate_status text NOT NULL DEFAULT 'blocked'
    CHECK (publication_gate_status IN ('blocked', 'passed')),
  ADD COLUMN final_evidence_report_sha256 text
    CHECK (final_evidence_report_sha256 IS NULL OR final_evidence_report_sha256 ~ '^[a-f0-9]{64}$'),
  ADD COLUMN final_evidence_report_signature_verification text NOT NULL DEFAULT 'pending'
    CHECK (final_evidence_report_signature_verification IN ('pending', 'passed', 'failed')),
  ADD COLUMN final_evidence_report_transparency_inclusion text NOT NULL DEFAULT 'pending'
    CHECK (final_evidence_report_transparency_inclusion IN ('pending', 'verified', 'failed'));

ALTER TABLE app_versions
  ADD CONSTRAINT published_release_evidence_required CHECK (
    status <> 'published' OR (
      ownership_evidence_review = 'passed'
      AND mobile_hardening_review = 'passed'
      AND android_permission_privacy_review = 'passed'
      AND malware_scan = 'passed'
      AND security_review = 'passed'
      AND publication_gate_status = 'passed'
      AND final_evidence_report_sha256 IS NOT NULL
      AND final_evidence_report_signature_verification = 'passed'
      AND final_evidence_report_transparency_inclusion = 'verified'
      AND apk_size_bytes IS NOT NULL
      AND min_sdk IS NOT NULL
      AND target_sdk IS NOT NULL
    )
  );

CREATE TABLE trusted_signing_keys (
  key_id text PRIMARY KEY,
  publisher text NOT NULL CHECK (publisher = 'Aarulya'),
  algorithm text NOT NULL CHECK (algorithm IN ('Ed25519', 'RSA-PSS-SHA256', 'ECDSA-P256-SHA256')),
  public_key_pem text NOT NULL,
  fingerprint_sha256 text NOT NULL UNIQUE CHECK (fingerprint_sha256 ~ '^[a-f0-9]{64}$'),
  purpose text NOT NULL CHECK (purpose IN ('catalog', 'release-manifest', 'evidence-report', 'apk-certificate')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'retiring', 'revoked')),
  not_before timestamptz NOT NULL,
  not_after timestamptz NOT NULL,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (not_after > not_before),
  CHECK ((state = 'revoked' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL) OR state <> 'revoked')
);

CREATE TABLE catalog_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_version bigint NOT NULL UNIQUE CHECK (catalog_version > 0),
  payload_sha256 text NOT NULL UNIQUE CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature text NOT NULL,
  signing_key_id text NOT NULL REFERENCES trusted_signing_keys(key_id) ON DELETE RESTRICT,
  publisher text NOT NULL DEFAULT 'Aarulya' CHECK (publisher = 'Aarulya'),
  generated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  signature_verification text NOT NULL CHECK (signature_verification = 'passed'),
  transparency_record text NOT NULL CHECK (transparency_record = 'verified'),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > generated_at)
);

CREATE UNIQUE INDEX catalog_manifest_current_idx
  ON catalog_manifests (is_current)
  WHERE is_current;

CREATE TABLE release_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version_id uuid NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  evidence_type text NOT NULL,
  issuer_id text NOT NULL,
  issuer_role text NOT NULL,
  signing_key_id text NOT NULL REFERENCES trusted_signing_keys(key_id) ON DELETE RESTRICT,
  apk_sha256 text NOT NULL CHECK (apk_sha256 ~ '^[a-f0-9]{64}$'),
  evidence_url text NOT NULL CHECK (evidence_url ~ '^https://evidence\.store\.aarulya\.com/'),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  signature_verification text NOT NULL CHECK (signature_verification = 'passed'),
  transparency_inclusion text NOT NULL CHECK (transparency_inclusion = 'verified'),
  result text NOT NULL CHECK (result = 'passed'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_version_id, evidence_type, issuer_id),
  CHECK (expires_at > issued_at)
);

CREATE INDEX release_evidence_version_idx
  ON release_evidence (app_version_id, evidence_type, expires_at DESC);

CREATE TABLE distribution_kill_switches (
  scope_type text NOT NULL CHECK (scope_type IN ('global', 'package')),
  scope_id text NOT NULL,
  disabled boolean NOT NULL DEFAULT false,
  reason text,
  activated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  activated_at timestamptz,
  expires_at timestamptz,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  PRIMARY KEY (scope_type, scope_id),
  CHECK ((disabled AND reason IS NOT NULL AND activated_at IS NOT NULL) OR NOT disabled)
);

CREATE TABLE token_revocations (
  token_id text PRIMARY KEY,
  subject text,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > revoked_at)
);

CREATE TABLE session_revocations (
  session_id text PRIMARY KEY,
  subject text,
  reason text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > revoked_at)
);

ALTER TABLE download_grants
  ADD COLUMN idempotency_key text,
  ADD COLUMN download_origin text NOT NULL DEFAULT 'https://downloads.store.aarulya.com'
    CHECK (download_origin = 'https://downloads.store.aarulya.com');

CREATE UNIQUE INDEX download_grants_idempotency_idx
  ON download_grants (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE install_receipts
  ADD COLUMN idempotency_key text;

CREATE UNIQUE INDEX install_receipts_idempotency_idx
  ON install_receipts (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE update_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  installed_version_code bigint NOT NULL CHECK (installed_version_code > 0),
  offered_app_version_id uuid REFERENCES app_versions(id) ON DELETE SET NULL,
  decision text NOT NULL CHECK (decision IN ('up-to-date', 'update-available', 'blocked', 'not-found')),
  request_id text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX update_checks_device_idx ON update_checks (device_id, checked_at DESC);

CREATE TRIGGER release_evidence_immutable
BEFORE UPDATE OR DELETE ON release_evidence
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

CREATE TRIGGER catalog_manifests_immutable
BEFORE UPDATE OR DELETE ON catalog_manifests
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

ALTER TABLE update_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY update_checks_owner_policy ON update_checks
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

REVOKE ALL ON ALL TABLES IN SCHEMA aarulya_store FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA aarulya_store FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aarulya_store FROM PUBLIC;

COMMIT;
