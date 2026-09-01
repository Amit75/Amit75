-- Run once as a PostgreSQL cluster administrator before Store migrations.
-- This file creates NOLOGIN group roles only. Login credentials must be created
-- outside source control and granted membership through the deployment secret system.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_migrator') THEN
    CREATE ROLE aarulya_store_migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_api') THEN
    CREATE ROLE aarulya_store_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_downloads') THEN
    CREATE ROLE aarulya_store_downloads NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_worker') THEN
    CREATE ROLE aarulya_store_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aarulya_store_publisher') THEN
    CREATE ROLE aarulya_store_publisher NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

ALTER ROLE aarulya_store_api NOBYPASSRLS;
ALTER ROLE aarulya_store_downloads NOBYPASSRLS;
ALTER ROLE aarulya_store_worker NOBYPASSRLS;
ALTER ROLE aarulya_store_publisher NOBYPASSRLS;
ALTER ROLE aarulya_store_migrator NOBYPASSRLS;
