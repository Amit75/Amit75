# Aarulya Store final non-secret configuration

## Public service origins

- Storefront: `https://store.aarulya.com`
- API: `https://api.store.aarulya.com`
- APK distribution: `https://downloads.store.aarulya.com`
- Evidence and release reports: `https://evidence.store.aarulya.com`

The four origins are isolated. Cross-origin access is deny-by-default. The API permits the canonical storefront origin only. Download and evidence services must not share application credentials, writable storage identities or signing authority.

## Legal and product identity

- Legal operator: Aarulya DigitalWorks
- Legal form: Sole Proprietorship
- Proprietor: Soni Kumari
- Brand: Aarulya
- Product: Aarulya Store
- Android application ID: `com.aarulya.store`
- Public support: `support@aarulya.com`
- Security disclosure: `security@aarulya.com`
- Privacy: `privacy@aarulya.com`
- Copyright and rights reports: `copyright@aarulya.com`

Mailbox activation and inbound/outbound delivery must be tested before public launch. No private mailbox credential belongs in source control.

## Product defaults

- Aarulya-owned APKs only
- Imported, copied, modified or re-signed third-party APKs prohibited
- Third-party developer submissions disabled
- Account required; guest browsing disabled for the initial release
- Advertising disabled for the initial release
- Analytics disabled until a consented, privacy-reviewed implementation is approved
- Redacted crash reporting allowed only after privacy and transport verification
- Hindi and English interface
- No permission prompt on first launch
- No silent installation
- User-visible Android installation confirmation required
- Download disabled without ownership, security, privacy and final signed evidence

## Initial navigation and catalog sections

Games, Apps, Books, Cinema and Media, Photo and Video, Documents and PDF, Student and Learning, Farmer, Business, Safety, and Cloud.

## Release order

1. Complete and privately test Aarulya Store itself.
2. Generate and verify the Store ownership and security evidence pack.
3. Build and sign the Store APK using an Aarulya-controlled signing identity outside GitHub, public storage and application VPS filesystems.
4. Test install, update, rollback, permission-denial and recovery flows on the owner-controlled Pixel 7.
5. Add other original Aarulya applications only after their individual release gates pass.

## Infrastructure boundary

Historical infrastructure records are not deployment authority. Current DNS, VPS IP, operating system, reverse proxy, PostgreSQL, object storage, backups, firewall and certificate state must be re-inventoried before any production mutation. Passwords, OTPs, private SSH keys, signing keys, database credentials and recovery material must never be placed in this document or repository.
