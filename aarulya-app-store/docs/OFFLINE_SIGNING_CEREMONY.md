# Aarulya Store offline signing ceremony

Production signing authority must stay outside GitHub, public servers and application containers.

## Ceremony controls

1. Record the exact source commit, unsigned artifact SHA-256 and release version.
2. Use an owner-approved offline or hardware-backed signing environment.
3. Verify the signing device identity and expected certificate fingerprint before signing.
4. Keep private key material non-exportable where hardware support exists.
5. Sign only the previously approved artifact digest.
6. Verify APK package ID, version code, SHA-256, signer certificate and v2/v3 signature schemes after signing.
7. Produce a signed ceremony receipt containing only safe identifiers and hashes.
8. Transfer the signed APK and receipt through a checksum-verified path.
9. Remove temporary working copies from the signing workstation and transport media as policy requires.
10. Never place private signing material, PINs, OTPs or recovery secrets in the repository or evidence report.

## Required receipt fields

- exact source commit SHA;
- unsigned artifact SHA-256;
- signed APK SHA-256;
- package ID and version code;
- signing-key ID and certificate SHA-256 fingerprint;
- signing tool and version;
- ceremony timestamp;
- authorized approver identities;
- verification result.

This gate remains PARTIAL until a real production ceremony is executed for the exact release artifact.
