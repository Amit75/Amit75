# Aarulya Store Security Model

No Aarulya app is publishable merely because its UI works. Every release must pass ownership, build, application-security, privacy, operational-readiness and installer-integrity gates.

## Security principles

1. **First-party ownership** — source, package identity, signing authority, assets and release metadata remain under Aarulya control.
2. **Least privilege** — every permission must have a concrete user-facing purpose and written justification.
3. **Local-first where possible** — small tools should work without network access and should not collect data merely for analytics.
4. **No secrets in clients** — private keys, provider secrets, database credentials and privileged tokens may never ship inside an APK.
5. **Server-side authorization** — a client screen or hidden button is never treated as an authorization boundary.
6. **Verified builds** — releases require source commit proof, SBOM, source/archive hashes, asset manifest and verified build provenance.
7. **Secure updates** — package ID, publisher, signing key ID and signer fingerprint must remain continuous; downgrades are blocked.
8. **Fail closed** — missing evidence, hash mismatch, signer mismatch, revoked release or security warning blocks publication and download.
9. **Child safety by design** — child-directed apps use data minimization, no open stranger chat, no personalized advertising and parental gates.
10. **Transparent response** — vulnerable or malicious releases can be revoked, downloads can be stopped and staged rollouts can be rolled back.

## App risk profiles

### Baseline — every app

- Threat model
- Permission review
- Privacy/data map
- Secret and dependency scanning
- Static analysis
- SBOM
- Hardened release build
- Cleartext traffic disabled
- Certificate validation review
- Secure logging review
- Backup/export review
- Named incident-response owner

### Offline utilities

Calculator, converter, torch, notes and similar apps should use no network unless essential. Sensitive local data must be encrypted and temporary data must be cleaned.

### Documents and media

Scanners, PDF tools, photo/video editors and file utilities require safe content URI handling, MIME validation, malformed-file resilience, metadata review and explicit export destinations.

### Account, cloud and business

Saathi, Cloud, DigitalWorks, Owner and similar apps require secure token storage, session revocation, rate limits, server-side authorization, account recovery and audit trails.

### Child and family

Games, learning and child-directed apps require age-appropriate content, no open stranger chat, no precise child location, parental gates, child-data minimization and deletion workflows.

### Finance critical

AaruPay and finance apps require strong authentication, step-up checks, server-side transaction authorization, immutable audit trails, fraud controls, reconciliation and an emergency kill switch. Raw card/payment credentials may not be stored.

### Browser and safety critical

Browser, Sentinel and scam/safety apps require untrusted-input isolation, strict URL canonicalization, safe external intent handling, no certificate-error bypass, signed security-rule updates and a false-positive appeal process.

### Store and installer critical

The Aarulya Store requires signed catalog and release manifests, APK hash verification, signer continuity, anti-rollback, revocation lists, staged rollout, remote download kill switches and transparency records.

## Release gate

A release is blocked when any of the following applies:

- Ownership, source or signing proof is missing.
- APK, source archive, SBOM or asset hashes are missing.
- Malware, copyright, permission, data-safety or security review is not passed.
- Required security evidence for the app risk profile is absent.
- Dangerous permissions lack written justification.
- Embedded secrets, test credentials or debug release settings are detected.
- Known critical vulnerabilities remain open.
- Incident response, rollback or security contact is not ready.
- Child or finance-specific controls are incomplete.

## Store-side protection

- Never trust file name or download URL alone.
- Verify signed catalog metadata before showing a release as available.
- Verify release-manifest signature and APK SHA-256 after download and before install.
- Compare installed and candidate package ID, publisher, signing key ID and signer fingerprint.
- Reject same-version and downgrade installation.
- Deny revoked releases and expired catalog manifests.
- Support global and per-package download kill switches.
- Keep signing keys outside source repositories and public server directories.

## Honest current state

This security model is a source-level policy foundation. It does not prove that any APK, backend, scanner, signing service, installer or production deployment is complete. Each app must provide executable evidence before it can be marked published.
