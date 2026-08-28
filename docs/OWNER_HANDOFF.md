# Aarulya Play owner handoff

Owner and final production authority: Amit Kumar (`Amit75`).

Create a checksum-bound package from a clean exact-head checkout:

```bash
bash scripts/create-owner-handoff.sh
```

The package contains committed source, exact-head metadata and checksums. It excludes repository history, working changes, credentials, private player data and runtime databases.

The archive proves source identity and transfer integrity only. Game-catalog completion, original asset licences, gameplay tests, browser/device, accessibility, performance, audience policy, advertising/consent, backend recovery and release/rollback gates remain required.

A central Aarulya console may read aggregate game and release status through authenticated APIs. It may not access player records, credentials or private runtime data directly.
