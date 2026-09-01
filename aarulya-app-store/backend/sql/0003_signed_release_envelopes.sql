BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE signed_release_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version_id uuid NOT NULL UNIQUE REFERENCES app_versions(id) ON DELETE RESTRICT,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  canonical_payload_base64 text NOT NULL,
  payload_sha256 text NOT NULL UNIQUE CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  signature_base64 text NOT NULL,
  signing_key_id text NOT NULL REFERENCES trusted_signing_keys(key_id) ON DELETE RESTRICT,
  algorithm text NOT NULL CHECK (algorithm IN ('Ed25519', 'RSA-PSS-SHA256', 'ECDSA-P256-SHA256')),
  publisher text NOT NULL DEFAULT 'Aarulya' CHECK (publisher = 'Aarulya'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  transparency_log_id text NOT NULL,
  transparency_inclusion_proof text NOT NULL,
  signature_verification text NOT NULL CHECK (signature_verification = 'passed'),
  transparency_inclusion text NOT NULL CHECK (transparency_inclusion = 'verified'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > issued_at)
);

CREATE INDEX signed_release_envelopes_expiry_idx
  ON signed_release_envelopes (expires_at);

CREATE TRIGGER signed_release_envelopes_immutable
BEFORE UPDATE OR DELETE ON signed_release_envelopes
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

ALTER TABLE app_versions
  ADD CONSTRAINT published_signed_release_envelope_required CHECK (
    status <> 'published' OR release_manifest_sha256 IS NOT NULL
  );

REVOKE ALL ON signed_release_envelopes FROM PUBLIC;

COMMIT;
