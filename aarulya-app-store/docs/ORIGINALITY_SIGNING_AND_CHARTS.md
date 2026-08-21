# Aarulya Store — Originality, Signing and Chart Integrity

## First-party release rule

The current store accepts only Aarulya-owned applications.

Every published application must have:

- an Aarulya-owned source repository and documented source commit;
- a unique `com.aarulya...` package identity;
- an Aarulya-controlled signing key and stable signer fingerprint;
- a recorded build-provenance receipt;
- a source archive hash and an asset-manifest hash;
- a privacy policy, permissions review and data-safety review;
- malware, copyright and child-safety review where applicable.

A third-party APK must never be copied, imported, modified and re-signed as an Aarulya application. Aarulya apps may use third-party libraries or assets only when their licences permit the intended use and the licence record is retained.

## Signing separation

Each application must have its own controlled signing identity. Signing secrets must not be committed to source control, embedded in the application, shared through chat, or stored with public APK files.

The store records only safe identifiers such as key IDs and certificate fingerprints. Private signing material belongs in a restricted signing service or secure key-management boundary.

An update is accepted only when package ID, publisher identity, signing key ID and signer fingerprint match the installed application and the version code increases.

## Original product identity

Aarulya Store can use familiar marketplace concepts such as search, categories, charts and age browsing. It must not copy another store's logo, icons, exact screen composition, text, illustrations, promotional cards or proprietary interaction design.

Every Aarulya application requires its own:

- name and icon;
- interface and visual system;
- source implementation;
- screenshots and promotional media;
- copy, audio, characters and templates;
- privacy and data-use declaration.

## Top Charts integrity

Organic ranking cannot be purchased.

The organic chart uses verified adoption, update activity, retention, crash-free quality, verified ratings, uninstall rate and abuse penalties. Bot installs, duplicate-device manipulation, incentivised fake reviews and unverifiable traffic are excluded.

Sponsored placements are permitted only in clearly labelled sponsored surfaces. They never alter the organic chart score.

New and useful applications receive separate discovery shelves so that a new app is not forced to compete only on lifetime downloads.

Kids charts use a separate eligibility gate and cannot include apps that fail child-safety, privacy, ad or content requirements.

## Better-than-copy principle

The objective is not to imitate an existing app store. The Aarulya Store must improve the experience through:

- transparent release verification;
- visible publisher and update provenance;
- India-first language and low-bandwidth support;
- useful rural, student, document and small-business discovery;
- clear kids and parent controls;
- honest charts without paid rank manipulation;
- smaller, fast first-party apps with limited permissions;
- direct security and privacy explanations in simple language.

A production or replacement claim is not valid until the installer, signing service, release storage, update client, security scanning, telemetry, support and recovery systems pass real end-to-end verification.
