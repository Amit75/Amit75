# Aarulya App Store

Aarulya App Store is an Android-first, India-focused distribution platform for Aarulya applications and, later, approved third-party developers.

## Product structure

The store is one unified catalog, not a collection of separate zone stores.

- One home screen
- One universal search
- One app detail and release flow
- Category filters
- Curated shelves such as Daily Essentials, Documents, Creator Tools, Games, Books & Learning, Farmer & Rural, Business, and Safety & Cloud
- Dedicated platform apps including Aarulya Play, Aarulya Books, Aarulya Cinema, Aarulya Kisan and Aarulya Learning

Books, cinema and farming are represented by dedicated apps and curated shelves inside the same store. Users do not need to enter separate store experiences.

## Current milestone

- Mobile-first storefront
- Search, category filtering, curated shelves and app detail views
- First-party catalog covering utilities, media, documents, education, business, rural use, safety, cloud, books, entertainment and games
- Install button stays disabled until a signed APK, SHA-256 checksum, privacy policy and security review are present
- Clear distinction between `planned`, `in-development`, `review` and `published`
- No copied APKs or third-party apps without developer authorization

## Distribution model

1. Aarulya creates and signs its own Android applications.
2. Release artifacts are uploaded to Aarulya Cloud object storage.
3. The store API publishes verified metadata and signed download URLs.
4. Aarulya App Store client verifies package name, signer identity and SHA-256 before installation.
5. Updates are accepted only when the package ID and signing certificate match the installed app.

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

- Every APK must be signed by its verified owner.
- SHA-256 checksum is required.
- Malware/static analysis result is required.
- Privacy policy and data-safety declaration are required.
- Copyright ownership or licence evidence is required.
- Books and films must be original, licensed or verified public-domain content.
- Child-directed apps require child-safety review.
- Ads must follow the app's age mode and may not interrupt active gameplay or core tasks.

## State

This branch contains the store foundation and planned first-party catalog. It is not yet deployed to Aarulya Cloud and does not claim that planned apps are complete.
