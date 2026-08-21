# Aarulya App Store

Aarulya App Store is an Android-first, India-focused distribution and trusted-action platform for Aarulya-owned applications.

## Product structure

The store is one unified platform, not a collection of separate zone stores and not a catalog-only website.

- One home screen
- One universal search
- One app detail and release flow
- For You, Top Charts, Kids and Categories discovery
- Games, Apps, Search, Books and Profile navigation
- Curated shelves such as Daily Essentials, Documents, Creator Tools, Games, Books & Learning, Farmer & Rural, Business, and Safety & Cloud
- Dedicated platform apps including Aarulya Play, Aarulya Books, Aarulya Cinema, Aarulya Kisan and Aarulya Learning
- Verified APK download and installation handoff
- Signed updates, staged rollout, revocation and safe rollback
- Aarulya-owned APIs, database, object storage and durable job execution

## Full apps and Store capabilities

Aarulya supports both systems without treating small tools as replacements for complete apps.

- A full Aarulya Photo Editor can include resizing, editing, backgrounds, templates and exports.
- The Store may also expose a sandboxed quick photo-resize action when a user needs only one immediate result.
- Both surfaces can use the same controlled Aarulya capability API while keeping permissions, files and audit receipts isolated.
- Long sessions, background work, large files and complex workflows remain dedicated apps.

## Permanent work platform

The Store platform is designed to support one-time, scheduled and long-running work through its own API and database.

- Database-backed jobs survive restarts and worker failures.
- Every mutation uses an idempotency key to prevent duplicate work.
- Workers use expiring leases and heartbeats.
- Retries are bounded and temporary failures use controlled backoff.
- Exhausted failures move to a reviewed dead-letter state.
- Users can see status, pause, resume and cancel eligible work.
- Sensitive actions require explicit user or authorized-owner approval.
- The server, not the client, records authoritative completion and signed action receipts.

## First-party platform services

- Identity, device trust, sessions and consent
- Catalog, app versions, Trust Receipts and release metadata
- Downloads, install receipts, update rollout and revocation
- Intent routing, instant capabilities and full-app workflows
- Durable jobs, attempts, worker leases and event history
- Files, generated outputs, retention and deletion receipts
- Notifications and delivery receipts
- Security, risk, transparency and incident actions
- Privacy-preserving product metrics and fair Top Charts

Each service owns its data domain. Direct cross-service table writes, shared master credentials and client-authoritative security decisions are prohibited.

## Database and API foundation

The target data layer is Aarulya-controlled PostgreSQL plus Aarulya-controlled object storage.

- Encryption in transit and at rest
- Least-privilege database roles
- Row and resource-level authorization
- Encrypted backups and point-in-time recovery
- Immutable security audit history
- User export, retention and verified deletion workflows
- Versioned HTTPS APIs
- Request IDs, schema validation and safe errors
- Authorization on every protected resource
- No stack traces, raw secrets or hidden global admin credential in public flows

## Executable backend reference

The branch now contains a dependency-light Node.js backend reference under `backend/`.

- Public catalog, app-detail and intent-resolution endpoints
- Protected download, installation and durable-job endpoint contracts
- Authentication is fail-closed by default
- Release lookup is server-side; clients cannot submit privileged release metadata as authority
- Request body limits, strict JSON objects, origin allowlisting and safe error responses
- Short-lived actor-bound and single-use download grants
- Server-authoritative install receipts after catalog, hash and signer checks
- Durable job creation, idempotency, ownership enforcement, state transitions and immutable event history
- Graceful server shutdown and bounded HTTP timeouts

Protected routes intentionally remain unavailable in the default bootstrap until a production identity verifier and release repository are injected.

## PostgreSQL core migration

`backend/sql/0001_core.sql` adds an executable PostgreSQL schema foundation with:

- Users and devices
- Apps, signed versions and safe-version pointers
- Download grants and installation receipts
- Durable jobs and append-only job events
- Append-only security audit records
- Package, version, digest and status constraints
- Signer and signing-key continuity enforcement
- Idempotency uniqueness
- Row-level security for user-owned resources
- Revoked public access to the Store schema by default

Database deployment still requires dedicated least-privilege roles, migration verification, backup/restore testing and production connection hardening.

## First-party ownership

- Every app uses Aarulya-owned source, package identity, visual identity and controlled signing keys.
- Imported APK copying, modification and re-signing are prohibited.
- Third-party submissions remain disabled in this milestone.
- Books, films, music, fonts, templates and other assets must be original, licensed or verified public-domain material.

## Sovereign release foundation

A release is denied unless its exact APK digest is supported by independently verifiable evidence across source, build, security, signing, distribution and recovery.

- Zero-trust, deny-by-default release policy
- OWASP MASVS/MASTG-aligned mobile assurance
- NIST SSDF-aligned secure development controls
- SLSA Build Level 3 target and reviewed source history
- Hermetic, ephemeral and isolated builders
- Two independent reproducible builds with matching digests
- Signed provenance and signed SBOM
- Offline three-of-five root-key threshold
- Hardware-backed role-separated signing keys
- TUF-style root, targets, snapshot and timestamp metadata roles
- Signed, expiring and digest-bound security attestations
- Append-only transparency log with independent witnesses
- Two-person release approval; three approvals for critical products
- Revocation, staged rollout, rollback, disaster recovery and key-compromise drills

A plain `passed=true` value is not sufficient. Every security result must have a signed attestation, evidence digest, issuer identity, expiry and transparency inclusion proof.

## Security profiles

Every app receives the common baseline plus risk-specific controls:

- Offline utility
- Documents and media
- Account, cloud and business
- Child and family
- Finance and payments
- Browser and safety
- Store and installer

Critical apps such as Aarulya Store, AaruPay, Sentinel, Aaru Browser, Cloud, Owner and Vault require independent penetration testing, red-team evidence and recovery drills.

## Store and installer integrity

- Signed catalog and signed release manifests
- APK SHA-256 verification after download and before installation
- Package, publisher, signing-key and certificate continuity
- Rollback, freeze, mix-and-match and fast-forward attack protection
- Metadata expiry and revocation enforcement
- Global and per-package kill switches
- Staged rollout with health gates and automatic rollback

## Current milestone

- Mobile-first storefront and catalog foundation
- Search, category filtering, curated shelves and app-detail views
- First-party catalog covering utilities, media, documents, education, business, rural use, safety, cloud, books, entertainment and games
- Product foundations for intent search, quick actions and dedicated applications
- Executable reference backend for catalog, secure download grants, install receipts and durable jobs
- PostgreSQL schema migration with constraints, RLS and append-only event/audit tables
- Backend domain tests covering catalog exposure, download grant replay protection, install verification, idempotent jobs and ownership isolation
- Security, signing, ranking, assurance, attestation and installer-integrity policy foundations
- Download remains disabled until a release is actually signed, independently built, verified and published

## Current boundary

This branch does not claim that the production identity provider, release repository, PostgreSQL cluster, queue, workers, object storage, Android installer, HSM-backed signing, offline root ceremonies, hardened builders, cryptographic attestation verification, independent rebuild infrastructure, transparency witnesses, security scans, penetration tests, APKs or production deployment are complete. The backend and tests are source-level executable foundations; they have not been claimed as production-verified in this branch. Operational infrastructure and evidence must still be implemented and tested.
