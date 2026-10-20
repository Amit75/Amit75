BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS aarulya_store;
SET search_path TO aarulya_store, public;

CREATE TYPE app_release_status AS ENUM ('draft', 'review', 'published', 'revoked');
CREATE TYPE durable_job_state AS ENUM (
  'queued', 'scheduled', 'leased', 'running', 'waiting-user', 'waiting-external',
  'paused', 'retrying', 'succeeded', 'failed', 'cancelled', 'dead-lettered'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_subject text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'locked', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_public_id text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  integrity_state text NOT NULL DEFAULT 'unknown' CHECK (integrity_state IN ('unknown', 'trusted', 'limited', 'blocked')),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_public_id)
);

CREATE TABLE apps (
  id text PRIMARY KEY,
  package_id text NOT NULL UNIQUE CHECK (package_id ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$'),
  publisher text NOT NULL DEFAULT 'Aarulya' CHECK (publisher = 'Aarulya'),
  name text NOT NULL,
  category text NOT NULL,
  child_directed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL REFERENCES apps(id) ON DELETE RESTRICT,
  version_code bigint NOT NULL CHECK (version_code > 0),
  version_name text NOT NULL,
  status app_release_status NOT NULL DEFAULT 'draft',
  apk_object_key text NOT NULL,
  apk_sha256 text NOT NULL CHECK (apk_sha256 ~ '^[a-f0-9]{64}$'),
  signer_fingerprint text NOT NULL,
  signing_key_id text NOT NULL,
  source_commit_sha text NOT NULL CHECK (source_commit_sha ~ '^[a-f0-9]{40,64}$'),
  sbom_sha256 text NOT NULL CHECK (sbom_sha256 ~ '^[a-f0-9]{64}$'),
  release_manifest_sha256 text NOT NULL CHECK (release_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  published_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (app_id, version_code),
  UNIQUE (apk_sha256),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR status <> 'published'),
  CHECK ((status = 'revoked' AND revoked_at IS NOT NULL AND revocation_reason IS NOT NULL) OR status <> 'revoked')
);

CREATE INDEX app_versions_lookup_idx ON app_versions (app_id, status, version_code DESC);

CREATE TABLE safe_versions (
  app_id text PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
  app_version_id uuid NOT NULL UNIQUE REFERENCES app_versions(id) ON DELETE RESTRICT,
  selected_by uuid REFERENCES users(id) ON DELETE SET NULL,
  selected_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE download_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  app_version_id uuid NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  token_sha256 text NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
  request_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX download_grants_expiry_idx ON download_grants (expires_at) WHERE consumed_at IS NULL;

CREATE TABLE install_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  app_version_id uuid NOT NULL REFERENCES app_versions(id) ON DELETE RESTRICT,
  request_id text NOT NULL,
  apk_sha256 text NOT NULL CHECK (apk_sha256 ~ '^[a-f0-9]{64}$'),
  signer_fingerprint text NOT NULL,
  signing_key_id text NOT NULL,
  installed_at timestamptz NOT NULL,
  reported_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, app_version_id)
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  state durable_job_state NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  sensitive boolean NOT NULL DEFAULT false,
  approval_state text NOT NULL DEFAULT 'not-required' CHECK (approval_state IN ('not-required', 'pending', 'approved', 'rejected', 'expired')),
  run_at timestamptz,
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  lease_owner text,
  lease_token_sha256 text CHECK (lease_token_sha256 IS NULL OR lease_token_sha256 ~ '^[a-f0-9]{64}$'),
  lease_expires_at timestamptz,
  last_heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (owner_id, idempotency_key),
  CHECK (NOT sensitive OR approval_state IN ('pending', 'approved', 'rejected', 'expired')),
  CHECK ((state IN ('leased', 'running') AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) OR state NOT IN ('leased', 'running')),
  CHECK ((state IN ('succeeded', 'failed', 'cancelled', 'dead-lettered') AND completed_at IS NOT NULL) OR state NOT IN ('succeeded', 'failed', 'cancelled', 'dead-lettered'))
);

CREATE INDEX jobs_claim_idx ON jobs (state, run_at, created_at)
  WHERE state IN ('queued', 'scheduled', 'retrying');
CREATE INDEX jobs_owner_idx ON jobs (owner_id, created_at DESC);

CREATE TABLE job_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_state durable_job_state,
  to_state durable_job_state,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX job_events_job_idx ON job_events (job_id, sequence);

CREATE TABLE security_audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  request_id text NOT NULL,
  event_type text NOT NULL,
  subject_type text NOT NULL,
  subject_id text NOT NULL,
  decision text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL CHECK (event_hash ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_audit_subject_idx ON security_audit (subject_type, subject_id, sequence DESC);

CREATE OR REPLACE FUNCTION reject_mutation_of_immutable_rows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'immutable table % cannot be updated or deleted', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER job_events_immutable
BEFORE UPDATE OR DELETE ON job_events
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

CREATE TRIGGER security_audit_immutable
BEFORE UPDATE OR DELETE ON security_audit
FOR EACH ROW EXECUTE FUNCTION reject_mutation_of_immutable_rows();

CREATE OR REPLACE FUNCTION enforce_signer_continuity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior app_versions%ROWTYPE;
BEGIN
  SELECT * INTO prior
  FROM app_versions
  WHERE app_id = NEW.app_id
    AND status IN ('published', 'revoked')
    AND version_code < NEW.version_code
  ORDER BY version_code DESC
  LIMIT 1;

  IF FOUND AND (prior.signer_fingerprint <> NEW.signer_fingerprint OR prior.signing_key_id <> NEW.signing_key_id) THEN
    RAISE EXCEPTION 'signer continuity violation for app %', NEW.app_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER app_versions_signer_continuity
BEFORE INSERT OR UPDATE OF signer_fingerprint, signing_key_id, version_code ON app_versions
FOR EACH ROW EXECUTE FUNCTION enforce_signer_continuity();

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE install_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY devices_owner_policy ON devices
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY download_grants_owner_policy ON download_grants
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY install_receipts_owner_policy ON install_receipts
  USING (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (user_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY jobs_owner_policy ON jobs
  USING (owner_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid)
  WITH CHECK (owner_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid);

CREATE POLICY job_events_owner_policy ON job_events
  USING (EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id = job_events.job_id
      AND jobs.owner_id = nullif(current_setting('aarulya.actor_id', true), '')::uuid
  ));

REVOKE ALL ON SCHEMA aarulya_store FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA aarulya_store FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA aarulya_store FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA aarulya_store FROM PUBLIC;

COMMIT;
