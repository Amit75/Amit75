# Aarulya App Store

Aarulya App Store is an Android-first, India-focused distribution platform for Aarulya applications and, later, approved third-party developers.

## Current milestone

- Mobile-first store web application
- Search, category filtering and app detail views
- First-party catalog covering utilities, media, documents, education, business, safety, cloud and games
- Install button stays disabled until a signed APK, SHA-256 checksum, privacy policy and security review are present
- App version, package ID, minimum Android version, file size and update metadata
- Clear distinction between `planned`, `in-development`, `review` and `published`
- No copied APKs or third-party apps without developer authorization

## Distribution model

1. Aarulya creates and signs its own Android applications.
2. Release artifacts are uploaded to Aarulya Cloud object storage.
3. The store API publishes verified metadata and signed download URLs.
4. Aarulya App Store client verifies package name, signer identity and SHA-256 before installation.
5. Updates are accepted only when the package ID and signing certificate match the installed app.

## Initial first-party app families

- Daily tools: calculator, scanner, QR tools, notes, files, clipboard, unit converter
- Documents: PDF tools, image-to-PDF, compressor, e-sign helper, forms
- Media: photo editor, video compressor, audio cutter, screen recorder helper
- India utility: Hindi typing, document checklist, local services, exam tools
- Business: invoice, inventory, CRM companion, attendance, expense manager
- Family and learning: kids learning, maths, GK, drawing, stories
- Aarulya ecosystem: Play, Saathi, Browser, AaruPay, DigitalWorks, Sentinel, Cloud

## Non-negotiable release rules

- Every APK must be signed by its verified owner.
- SHA-256 checksum is required.
- Malware/static analysis result is required.
- Privacy policy and data-safety declaration are required.
- Copyright ownership or licence evidence is required.
- Child-directed apps require child-safety review.
- Ads must follow the app's age mode and may not interrupt active gameplay or core tasks.

## State

This branch contains the store foundation and planned first-party catalog. It is not yet deployed to Aarulya Cloud and does not claim that planned apps are complete.