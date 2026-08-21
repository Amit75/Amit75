# Aarulya App Store

Aarulya App Store is an Android-first, India-focused distribution platform for Aarulya-owned applications. Third-party submissions remain disabled in the current foundation.

## Product structure

The store is one unified catalog, not a collection of separate zone stores.

- One home screen
- One universal search
- For You, Top Charts, Kids and Categories discovery
- Games, Apps, Search, Books and You navigation
- One app-detail and verified-release flow
- Curated shelves for daily tools, documents, creator tools, games, books, farming, business, safety and cloud
- Dedicated platform apps including Aarulya Play, Books, Cinema, Kisan and Learning

## Current milestone

- Mobile-first storefront
- Search, category filtering, curated shelves and app-detail views
- First-party catalog covering utilities, media, documents, education, business, rural use, safety, cloud, books, entertainment and games
- Original Aarulya package identities and first-party release mode
- Signing, source-provenance and update-continuity gates
- Risk-based security requirements for every app family
- Signed catalog and installer-integrity policy foundation
- Transparent Top Charts rules that separate sponsored placement from organic ranking
- Download remains disabled until an APK and all required evidence are actually verified

## Distribution model

1. Aarulya creates and owns its source, package identity, assets and release metadata.
2. Every app uses an Aarulya-controlled signing key; signing secrets stay outside source repositories and public server directories.
3. Release artifacts are uploaded to controlled Aarulya Cloud storage.
4. The store publishes signed catalog and release manifests.
5. The client verifies catalog signature, release signature, APK SHA-256, package name and signer continuity before installation.
6. Updates are accepted only when package ID, publisher, signing key ID and signer fingerprint match and the version code increases.
7. Revoked, downgraded, expired, unsigned or hash-mismatched releases are blocked.

## Security profiles

Every release gets the common baseline plus all applicable risk profiles:

- **Baseline:** threat model, permissions, privacy map, secret/dependency scan, static analysis, SBOM, hardened build, secure logging and incident owner.
- **Offline utilities:** network minimization, encrypted sensitive local data, temporary-data cleanup and justified permissions.
- **Documents/media:** safe file handling, MIME validation, malformed-file resilience, metadata and export review.
- **Account/cloud/business:** secure tokens, session revocation, rate limits, server authorization, recovery and audit trails.
- **Child/family:** no personalized child ads, no stranger chat, no precise child location, parental gates and deletion flow.
- **Finance critical:** strong and step-up authentication, server transaction authorization, immutable audit, fraud/reconciliation controls and kill switch.
- **Browser/safety critical:** input isolation, URL canonicalization, safe intents, no certificate-error bypass and signed rules.
- **Store/installer critical:** signed manifests, hash checks, anti-rollback, signer continuity, revocation, staged rollout and download kill switches.

See `docs/SECURITY_MODEL.md` for the complete policy.

## Initial first-party app families

- Daily tools: calculator, QR tools, notes, clipboard, unit converter, alarm and recorder
- Documents: scanner, PDF tools, image-to-PDF, compressor and forms
- Creator tools: photo editor, resizer, video compressor, audio cutter and poster maker
- Platforms: Aarulya Play, Books, Cinema, Kisan, Learning, Saathi and Browser
- India utility: Hindi typing, document checklist and local services
- Business: invoice, inventory, CRM, attendance and expense manager
- Family and learning: kids maths, GK, drawing and original stories
- Safety and cloud: Sentinel, secure vault, permission checker, scam check, files and backup

## Non-negotiable release rules

- No copied, imported, modified or re-signed third-party APK.
- Every release must prove Aarulya source ownership and verified build provenance.
- Every APK must use its approved package ID and Aarulya-controlled signer.
- APK, source archive, SBOM and asset-manifest hashes are required.
- Malware, static/dynamic security, permission, privacy, data-safety and copyright reviews are required.
- Dangerous permissions require written user-facing justification.
- Embedded secrets, debug releases, demo credentials and known critical vulnerabilities block publication.
- Vulnerability disclosure, verified security contact, incident response and tested rollback are required.
- Books and films must be original, licensed or verified public-domain content.
- Child-directed and finance apps require their additional high-risk controls.
- Ads must follow age mode and may not interrupt active gameplay or essential tasks.

## State

This branch contains the store, catalog, signing, ranking and security-policy foundation. It is not deployed to Aarulya Cloud and does not claim that any planned app, APK, security scanner, signing service or installer is complete.
