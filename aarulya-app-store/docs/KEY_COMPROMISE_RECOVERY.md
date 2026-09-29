# Aarulya Store key-compromise recovery

Suspected compromise is a distribution-stop event.

## Immediate actions

1. Activate package or global download kill switch as appropriate.
2. Freeze publication and new release approvals.
3. Preserve audit evidence and identify affected key IDs, packages and release windows.
4. Revoke compromised release-envelope or catalog keys in the trust system.
5. Block affected signer or release records where policy allows.
6. Rotate online verification keys and credentials through approved channels.
7. For APK signing-key compromise, follow the platform-supported signing-key recovery or migration process; never silently re-sign an existing package with an unrelated key.
8. Publish a signed incident and recovery record before distribution resumes.

## Recovery proof

Recovery evidence must include incident ID, affected key fingerprints, revocation timestamps, replacement key identifiers, continuity decision, test results, rollback/kill-switch evidence and owner approval.

This gate remains PARTIAL until the procedure has been exercised in a controlled recovery drill and the evidence is retained.
