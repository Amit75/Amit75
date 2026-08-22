BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE release_publication_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_version_id uuid NOT NULL UNIQUE REFERENCES app_versions(id) ON DELETE RESTRICT,
  request_id text NOT NULL UNIQUE,
  actor_subject text NOT NULL,
  reason text NOT NULL,
  release_manifest_sha256 text NOT NULL CHECK (release_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  apk_sha256 text NOT NULL CHECK (apk_sha256 ~ '^[a-f0-9]{64}$'),
  approval_count integer NOT NULL CHECK (approval_count >= 2),
  evidence_count integer NOT NULL CHECK (evidence_count >= 12),
  risk_tier text NOT NULL CHECK (risk_tier IN ('standard', 'elevated', 'critical')),
  published_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(request_id) BETWEEN 16 AND 200),
  CHECK (length(actor_subject) BETWEEN 8 AND 512),
  CHECK (length(reason) BETWEEN 12 AND 2000)
);

CREATE TRIGGER release_publication_receipts_immutable
BEFORE UPDATE OR DELETE ON release_publication_receipts
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

REVOKE ALL ON release_publication_receipts FROM PUBLIC;

COMMIT;
