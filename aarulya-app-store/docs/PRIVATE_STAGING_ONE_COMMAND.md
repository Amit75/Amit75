# One-command Aaru Store private preview + PostgreSQL recovery

This **non-public** owner-approved staging operator path resumes the *existing* loopback Storefront, then verifies/resumes only the dedicated rootless PostgreSQL instance. It does not manage existing Cloud/Docker services, DNS, production data, release signing, or customer accounts.

## Operator run

Use one clean, exact GitHub PR #2 commit checkout and run as unprivileged `admin1`:

```bash
bash aarulya-app-store/deploy/resume-private-store-and-db.sh
```

The script verifies the Storefront runtime against the previously recorded immutable image SHA-256 and validates saved rootless user, read-only rootfs, internal Podman network and loopback-only port mapping. It restarts only an existing, known Storefront in the permitted `created` or `exited` state, with exit code 0/143; unknown status is blocked. On restart it checks live port mapping, HTTP health, homepage and Host filtering. It does not recreate the Storefront or publish anything publicly.

For PostgreSQL, it chooses one of three guarded paths: verify the already-running dedicated Store DB; if existing Store DB is in `created` state, call the created-only recovery script that checks **empty** volume and secrets before replacing *only* failed container metadata; if neither DB container nor any prior secret/volume/password exists, call the existing isolated staging DB bootstrap. Stopped/unknown DB states, resource inconsistencies, or nonempty data remain untouched and block.

Expected green outputs include `STORE_PRIVATE_PREVIEW=PASS`, `AARULYA_STORE_PRIVATE_DB=PASS`, `DATABASE_HOST_PORTS=NONE`, and `FINAL_EXIT_CODE=0`. The startup routines may print their own guarded receipts.

### Rootless lifecycle after logout

A rootless Podman container that turns from `running` into `created` may have been affected by host reboot, user-session cleanup, or other lifecycle controls; do not diagnose the cause from status alone. The script emits `loginctl show-user admin1 -p Linger` where available, **read-only**. It does not enable linger, change systemd, configure public TLS, or grant durable production authority. A separate approved Store-only lifecycle plan is required to persist services through logout/reboot.

### Still blocked

This command does **not** run SQL migrations, create API DB principals, enable OAuth/OIDC login, perform backups/restores or satisfy AARULYA Cloud managed acceptance. These are separately controlled subsequent steps. Never send the local Postgres password to chat or GitHub.
