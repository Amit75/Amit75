# Aarulya Store Platform Architecture

## Product boundary

Aarulya Store is a full first-party Android distribution and action platform. It is not limited to an app catalog.

It must eventually provide:

- Storefront, search, discovery and Top Charts
- App details, Trust Receipts and verified publisher identity
- APK download, installation handoff, install receipts and update checks
- Signed manifests, signer continuity, revocation and rollback
- Full apps and Store-embedded instant tools
- Aarulya-owned APIs and databases
- Durable scheduled and background work
- Files, outputs, notifications and user-visible task history
- Privacy, security, audit and incident controls

## Two execution modes

### Full applications

A dedicated Android app is used when work needs long sessions, background execution, large local files, device integration, offline storage or a complex interface. Examples include Aarulya Play, Books, Kisan, Saathi, Browser and business products.

### Store capabilities and instant tools

A small action may run through a sandboxed capability without forcing a full app installation. This does not replace the full app. For example, photo resizing may be available as a quick Store action and also inside the complete Aarulya Photo Editor application.

The same underlying Aarulya capability API can serve both surfaces while preserving separate permissions, data access and audit receipts.

## Core services

1. Identity and device trust
2. Catalog and release metadata
3. Distribution and updates
4. Intent and capability routing
5. Durable task orchestration
6. Files and generated outputs
7. Notifications
8. Security and risk
9. Privacy-preserving analytics and ranking

Each service owns its own data domain. Direct cross-service table writes are prohibited. Service calls require authenticated identities and explicit authorization.

## Permanent work model

A user can start one-time, scheduled or long-running work. The database is the source of truth. Jobs survive process restarts and worker failures.

Each job requires:

- Owner identity
- Type and validated payload
- Idempotency key
- Explicit state
- Bounded attempts
- Worker lease and heartbeat
- Immutable event history
- Pause, resume and cancel controls
- Human approval for sensitive actions
- Dead-letter review when retries are exhausted

Client devices cannot declare final success for privileged work. The server records authoritative results and signed action receipts.

## Database and storage

The target database is Aarulya-controlled PostgreSQL with encryption, least-privilege roles, point-in-time recovery and encrypted backups. Binary objects use Aarulya-controlled object storage with per-user grants, malware scanning, versioning and retention rules.

Secrets do not belong in application tables. They must remain in a dedicated secret manager or hardware-backed signing system.

## API principles

- Versioned APIs
- HTTPS only
- Request IDs
- Schema validation
- Authorization on every resource
- Idempotency for mutations
- Safe error responses
- Rate and abuse controls
- No client-asserted privilege
- No secret values in responses or logs
- Audit records for sensitive actions

## Installation and updates

The Store must verify the signed catalog, signed release metadata, APK SHA-256, package identity, publisher and signer continuity before installation is authorized. Same-version installs, downgrades, revoked releases, expired metadata and tampered APKs are rejected.

Rollouts are staged. Health regression can stop a rollout and return users to a last-known-safe release where technically possible.

## Current boundary

This document defines the intended source architecture. It does not claim that the production API, PostgreSQL cluster, queue, workers, object storage, Android installer, signing infrastructure or release artifacts are already operational. Each component needs implementation and executable verification before public availability.
