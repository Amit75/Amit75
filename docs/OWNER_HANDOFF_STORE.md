# Aarulya Store owner handoff

Owner and final production authority: Amit Kumar (`Amit75`).

Create a checksum-bound package from a clean exact-head checkout:

```bash
bash scripts/create-owner-handoff.sh
```

The package contains committed source, exact-head metadata and checksums. It excludes repository history, working changes, credentials, private signing keys, production catalog data and user records.

The archive proves source identity and transfer integrity only. Database, identity, Android build, release-envelope, signing, independent rebuild, security, physical-device, DNS/TLS, backup/restore and rollback gates remain required.

A central Aarulya console may read aggregate catalog and release status through authenticated APIs. Signing authority, private keys and product databases remain isolated from the central control plane.
