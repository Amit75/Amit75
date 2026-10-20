# Aarulya APK Final Release Evidence Report

This report is mandatory for every Aarulya APK before publication. A report belongs to one exact package, version, signer and APK SHA-256. Evidence from another build or version cannot be reused unless its policy explicitly permits reuse and the new report verifies that reuse.

## Release identity

- Aarulya app ID
- Product name
- `com.aarulya.*` package ID
- Version name and version code
- APK SHA-256
- Signer certificate fingerprint
- Aarulya signing-key ID
- Source commit SHA
- Source archive SHA-256
- Asset manifest SHA-256
- SBOM SHA-256
- Test report SHA-256

## Ownership and originality evidence

The report must contain signed evidence for:

- Aarulya source origin and repository history
- Aarulya package namespace ownership
- Aarulya signing identity ownership
- Complete inventory of icons, UI, images, animation, music, audio, fonts, templates, screenshots and promotional assets
- Origin and license for every third-party component or asset
- Contributor employment, assignment or licence rights
- Name and trademark conflict review
- Copyright and similarity review
- Confirmation that no imported or re-signed third-party APK was used
- Confirmation that no copied source, UI, icon, audio or marketing material was used

Unknown origin, unknown licence, copied material or missing contributor rights is a release blocker.

## Build and supply-chain evidence

- Protected source revision
- Reviewed change intent
- Independent source approvals
- Hermetic and isolated build
- Signed build provenance
- Signed SBOM
- Two independent reproducible builds with matching APK digest
- Dependency and licence allowlist
- Secret scan, malicious-package scan and vulnerability scan
- Offline threshold root and hardware-backed release signing evidence
- Transparency-log inclusion proof

## APK hardening evidence

- Release build, `debuggable=false`, `testOnly=false`
- No embedded production secrets or master credentials
- Cleartext traffic disabled
- Safe exported components, intents and deep links
- Safe FileProvider and URI handling
- Secure WebView configuration and no unsafe JavaScript bridges
- Secure local storage and Android Keystore review
- Certificate validation and network security tests
- Session binding, replay protection and server-side authorization tests
- Logging and crash-report redaction
- Obfuscation and reverse-engineering resistance review
- Native library hardening where applicable
- Tamper, instrumentation and hooking risk tests for critical apps
- Update-signature continuity and rollback-attack tests
- Malicious-input fuzzing and fail-closed behavior tests

Root, emulator or tamper detection must never be the only security control. Sensitive authorization and privileged results remain server-side.

## Privacy and user-safety evidence

- Data inventory and purpose map
- Permission justification
- Data minimization and retention
- Export and verified deletion tests
- Encryption and backup/restore tests
- Child-safety review where applicable
- Ad and tracker disclosure
- Abuse, fraud and account-takeover tests
- Incident, privacy and abuse-response runbooks

## Test execution report

The final report must link to executed and immutable results for:

- Unit and integration tests
- Database and RLS isolation tests
- API authorization tests
- Static and dynamic security tests
- Malware and dependency tests
- Device and Android-version compatibility tests
- Performance, crash and resource tests
- Penetration test when required
- Independent reverse-engineering assessment for critical APKs
- Backup, rollback, revocation and disaster-recovery drills

A test file existing in source is not a PASS. The executed result, tool identity, environment, timestamp and evidence digest are required.

## Final decision

Publication is allowed only when:

1. Every mandatory section passes.
2. Every evidence item is signed, current and bound to the exact APK SHA-256.
3. Evidence is frozen and immutable for the release.
4. The final report is signed by an authorized report-signing key.
5. The report has a transparency-log inclusion proof.
6. Required independent approvers approve the exact digest.
7. No unresolved critical/high vulnerability outside policy remains.
8. The APK is not copied, imported or re-signed from another publisher.

The report must clearly return `NOT READY` whenever any required evidence is absent, expired, mismatched, unverified or failed.
