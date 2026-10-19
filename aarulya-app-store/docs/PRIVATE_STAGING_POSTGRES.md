# Aaru Store: isolated private staging PostgreSQL

This provides a **staging-only PostgreSQL container**, separate from AARULYA Cloud PostgreSQL and all production/customer data. It builds on the already verified rootless Podman private Storefront preview.

## What the script changes

- Requires the existing rootless internal network `aarulya-store-private-preview-v1` and running Storefront preview.
- Pulls the immutable `postgres:17.10-bookworm` image pinned to the digest already used by Store GitHub Actions.
- Creates a **dedicated** rootless Podman named volume and a container named `aarulya-store-private-db`. Does not publish any host ports, join Cloud Docker networks or alter Cloud configuration.
- Creates one staging-only random database credential on the server in `/home/admin1/.local/share/aarulya-store-staging/secrets/postgres-password`, with restrictive directory and file permissions. Podman also imports it as a per-user secret mounted only for container UID 999; it is never exposed in container environment or a root-readable bind mount. Never share or commit this secret.
- Initializes only `aarulya_store_staging`. Does **not** run migrations, grant API access, activate signing keys or create production records.
- On failure attempts to clean up only resources it newly created. Does not remove or replace resources that existed before invocation.

## Invocation (operator-approved non-production change)

Clone the latest Store PR branch, confirm its exact GitHub HEAD, then run:

```bash
bash aarulya-app-store/deploy/start-private-postgres.sh
```

Expected acceptance:
```text
POSTGRES_IMAGE_DIGEST_PIN=PASS
STAGING_DATABASE_CREDENTIAL=CREATED_SERVER_ONLY
AARULYA_STORE_PRIVATE_DB=PASS
DATABASE_HOST_PORTS=NONE
DB_MIGRATIONS_EXECUTED=false
STORE_AUTHENTICATED_API_STARTED=false
CLOUD_MANAGED_STAGING_ACCEPTANCE=false
FINAL_EXIT_CODE=0
```

## Next implementation gates

- Identify and pin an exact Store source head and a managed Cloud head for the complete staging bundle.
- Approve scoped Store staging database roles and controlled migration execution. Currently the default staging database owner is an **isolated cluster administrator**, not a credential to reuse by the API.
- Create least-privilege staging-only API/publisher/download/worker principals; keep URLs in 0600 server-local secret files. Do not send credentials to chat.
- Configure a dedicated test OIDC issuer and key management, without relying on production `identity.aarulya.com`.
- Execute migration and seed as separate governed one-shot jobs; validate API and authenticated download, evidence, backup/restore and rollback.
- Do not treat any of these intermediate stages as full Cloud-managed staging acceptance or production launch.

## Intentional boundaries

No shell command should run against the existing Docker `aarulya-cloud-nonprod-postgres-1` container as part of this isolated staging. The private DB is accessible only to containers connected to the rootless internal network. Do not use production secrets, account data, APK signing keys or payment credentials in this environment.

## Recovery from an OCI read-only secret mount failure

On rootless Podman the read-only root filesystem can prevent runc from creating a secret file mountpoint inside `/run/secrets`. The startup script now mounts a separate writable, noexec tmpfs at `/run/secrets` while keeping the application root filesystem read-only. The secret remains a 0400 Podman file mount, never an environment variable.

**If a previous attempt failed before PostgreSQL started**, use `deploy/recover-created-private-postgres.sh` only after confirming its exact GitHub source. It requires the original Store-only database container to be in `created` state, verifies its identity, checks the existing named volume is completely empty, and runs a one-shot network-disabled Podman secret mount smoke test. Only after all checks pass does it remove *the failed container metadata*, retaining the named volume, Podman secret and password file, and recreate that one container with the fixed tmpfs option. Any unrecognized or non-empty volume blocks recovery, without deletion. No migration or authenticated API is started. Never manually remove a staging volume or secret to make a check pass.
