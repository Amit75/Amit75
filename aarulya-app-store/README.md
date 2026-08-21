# Aarulya App Store

Aarulya App Store is an Android-first, India-focused distribution platform for Aarulya-owned applications.

## Product structure

The store is one unified catalog, not a collection of separate zone stores.

- One home screen
- One universal search
- One app detail and release flow
- For You, Top Charts, Kids and Categories discovery
- Games, Apps, Search, Books and Profile navigation
- Curated shelves such as Daily Essentials, Documents, Creator Tools, Games, Books & Learning, Farmer & Rural, Business, and Safety & Cloud
- Dedicated platform apps including Aarulya Play, Aarulya Books, Aarulya Cinema, Aarulya Kisan and Aarulya Learning

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
- Security, signing, ranking, assurance, attestation and installer-integrity policy foundations
- Download remains disabled until a release is actually signed, independently built, verified and published

## Current boundary

This branch does not claim that HSM-backed signing, offline root ceremonies, hardened builders, cryptographic attestation verification, independent rebuild infrastructure, transparency witnesses, security scans, penetration tests, APKs or production deployment are complete. Policy files are release-blocking design foundations; operational infrastructure and evidence must still be implemented and tested.
