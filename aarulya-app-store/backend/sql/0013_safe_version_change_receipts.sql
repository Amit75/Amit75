BEGIN;

SET search_path TO aarulya_store, public;

CREATE TABLE safe_version_change_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  previous_app_version_id uuid REFERENCES app_versions(id) ON DELETE RESTRICT,
  selected_app_version_id uuid NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  request_id text NOT NULL UNIQUE,
  actor_subject text NOT NULL,
  reason text NOT NULL,
  change_kind text NOT NULL CHECK (change_kind IN ('initial', 'rollback', 'forward', 'reselect')),
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(request_id) BETWEEN 16 AND 200),
  CHECK (length(actor_subject) BETWEEN 8 AND 512),
  CHECK (length(reason) BETWEEN 12 AND 2000)
);

CREATE INDEX safe_version_change_receipts_app_idx
  ON safe_version_change_receipts (app_id, changed_at DESC);

CREATE TRIGGER safe_version_change_receipts_immutable
BEFORE UPDATE OR DELETE ON safe_version_change_receipts
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

REVOKE ALL ON safe_version_change_receipts FROM PUBLIC;
GRANT SELECT, INSERT ON safe_version_change_receipts TO aarulya_store_publisher;

COMMIT;
