# Aarulya Store controlled pilot acceptance

A pilot is not a public launch. It uses an owner-approved cohort and non-production commercial claims.

## Entry criteria

- exact-head CI is green;
- staging acceptance is complete;
- test-signed or approved pilot-signed APK is available;
- privacy/support contacts used by the pilot are operational;
- rollback and download kill switch are verified;
- no production payment collection is enabled unless separately approved.

## Pilot evidence

Collect install success/failure, update behavior, crash-free operation, permission-denial behavior, support incidents, download integrity, uninstall/reinstall behavior and rollback recovery. Personal data collection must remain within the approved privacy scope.

## Exit criteria

A pilot passes only when blocking defects are resolved, recovery procedures work and owner approval references the exact release evidence.

This gate remains PARTIAL until an actual controlled pilot is completed.
