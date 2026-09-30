BEGIN;

SET search_path TO aarulya_store, public;

ALTER TABLE apps
  ADD COLUMN description text NOT NULL DEFAULT '',
  ADD COLUMN age_label text NOT NULL DEFAULT 'Not rated',
  ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'planned'
    CHECK (lifecycle_status IN ('planned', 'in-development', 'source-foundation', 'private-test', 'retired')),
  ADD COLUMN visibility text NOT NULL DEFAULT 'visible'
    CHECK (visibility IN ('visible', 'hidden', 'retired')),
  ADD COLUMN featured boolean NOT NULL DEFAULT false,
  ADD COLUMN sort_priority integer NOT NULL DEFAULT 1000,
  ADD COLUMN metadata_revision bigint NOT NULL DEFAULT 1 CHECK (metadata_revision > 0);

CREATE INDEX apps_catalog_idx
  ON apps (visibility, featured DESC, sort_priority, name)
  WHERE visibility = 'visible';

CREATE TABLE catalog_seed_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_sha256 text NOT NULL CHECK (catalog_sha256 ~ '^[a-f0-9]{64}$'),
  app_count integer NOT NULL CHECK (app_count > 0),
  source_commit_sha text NOT NULL CHECK (source_commit_sha ~ '^[a-f0-9]{40,64}$'),
  seeded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catalog_sha256, source_commit_sha)
);

CREATE TRIGGER catalog_seed_audit_immutable
BEFORE UPDATE OR DELETE ON catalog_seed_audit
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

REVOKE ALL ON catalog_seed_audit FROM PUBLIC;

COMMIT;
