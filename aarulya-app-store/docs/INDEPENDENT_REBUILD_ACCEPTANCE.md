# Aarulya Store independent rebuild acceptance

An independent rebuild must prove that the reviewed source and locked dependencies reproduce the expected application payload in a separately prepared environment.

## Independence requirements

- Use a fresh environment that does not reuse the primary build workspace or Gradle cache.
- Checkout the exact source commit by SHA.
- Enforce committed Gradle wrapper, dependency lock and verification metadata.
- Use the same documented JDK, Android SDK, build-tools and Gradle versions.
- Do not use production signing private keys during the reproducibility comparison.
- Record all tool versions and dependency-verification results.

## Comparison

The comparison artifact must exclude signatures or other intentionally non-deterministic signing material. Compare the canonical unsigned/aligned application payload, resources and manifest digests. Any unexplained mismatch is a blocker.

## Evidence

Retain both environment descriptions, source SHA, build logs, canonical artifact digests and a signed comparison result.

This gate remains PARTIAL until two genuinely independent builds are executed and the canonical payloads match.
