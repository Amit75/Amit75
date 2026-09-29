# Aarulya Store staging acceptance

Staging is a non-production execution gate. Source files alone never satisfy this gate.

## Preconditions

- Exact reviewed source head is recorded.
- Backend and edge images are immutable digest references.
- Dedicated staging database identities and secret files exist outside the repository.
- Staging APK and evidence roots are private and non-production.
- Production signing keys, production customer data and production payment credentials are prohibited.
- The read-only production preflight may be reused only with staging-specific origins and credentials.

## Required execution evidence

A staging acceptance record must contain:

- exact source commit SHA;
- immutable backend and edge image digests;
- migration output and least-privilege role verification;
- API, download and evidence health probes;
- authenticated catalog read and safe download-grant flow;
- worker lease and durable-job recovery check;
- backup creation and restore to an isolated target;
- rollback to the previous known-good staging release;
- timestamps, tool versions and hashes of all evidence files.

## Pass rule

The gate remains PARTIAL until an isolated staging deployment is actually executed and its evidence is retained. It becomes PASS only when the exact head used for launch has a successful staging acceptance record.
