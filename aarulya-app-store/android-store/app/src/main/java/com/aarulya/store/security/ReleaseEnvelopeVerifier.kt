package com.aarulya.store.security

import android.net.Uri
import android.util.Base64
import com.aarulya.store.BuildConfig
import org.json.JSONObject
import java.security.KeyFactory
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.MGF1ParameterSpec
import java.security.spec.PSSParameterSpec
import java.security.spec.X509EncodedKeySpec
import java.time.Instant

data class VerifiedReleaseEnvelope(
    val appId: String,
    val packageId: String,
    val versionCode: Long,
    val apkSha256: String,
    val apkSizeBytes: Long,
    val signerCertificateSha256: String,
    val apkSigningKeyId: String,
    val downloadOrigin: String,
    val evidenceReportSha256: String
)

class ReleaseEnvelopeVerifier {
    private val sha256Pattern = Regex("^[a-f0-9]{64}$")
    private val packagePattern = Regex("^com\\.aarulya(?:\\.[a-z][a-z0-9_]*)+$")
    private val pinnedFingerprints = BuildConfig.TRUSTED_RELEASE_KEY_FINGERPRINTS
        .split(',')
        .map { it.trim().lowercase() }
        .filter { it.isNotBlank() }
        .toSet()

    fun verify(envelope: JSONObject): VerifiedReleaseEnvelope {
        require(pinnedFingerprints.isNotEmpty()) { "no-pinned-release-trust-root" }
        require(envelope.getInt("schemaVersion") == 1) { "unsupported-release-envelope-schema" }
        require(envelope.getString("publisher") == "Aarulya") { "release-publisher-mismatch" }
        require(envelope.getString("signatureVerification") == "passed") { "server-signature-verification-not-passed" }
        require(envelope.getString("transparencyInclusion") == "verified") { "transparency-inclusion-required" }
        require(envelope.getString("keyState") in setOf("active", "retiring")) { "release-signing-key-not-trusted" }

        val expiresAt = Instant.parse(envelope.getString("expiresAt"))
        val issuedAt = Instant.parse(envelope.getString("issuedAt"))
        val now = Instant.now()
        require(issuedAt.isBefore(expiresAt) && expiresAt.isAfter(now)) { "release-envelope-expired" }
        require(issuedAt.isAfter(now.minusSeconds(31L * 24L * 60L * 60L))) { "release-envelope-too-old" }

        val payload = Base64.decode(envelope.getString("canonicalPayloadBase64"), Base64.DEFAULT)
        require(payload.size in 32..(1024 * 1024)) { "release-payload-size-invalid" }
        val payloadSha256 = sha256(payload)
        require(payloadSha256 == envelope.getString("payloadSha256").lowercase()) { "release-payload-digest-mismatch" }

        val publicKeyBytes = decodePem(envelope.getString("publicKeyPem"))
        val keyFingerprint = sha256(publicKeyBytes)
        require(keyFingerprint == envelope.getString("keyFingerprintSha256").lowercase()) {
            "release-key-fingerprint-mismatch"
        }
        require(keyFingerprint in pinnedFingerprints) { "release-key-not-pinned-in-store-apk" }

        val algorithm = envelope.getString("algorithm")
        val publicKey = when (algorithm) {
            "Ed25519" -> KeyFactory.getInstance("Ed25519").generatePublic(X509EncodedKeySpec(publicKeyBytes))
            "RSA-PSS-SHA256" -> KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(publicKeyBytes))
            "ECDSA-P256-SHA256" -> KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(publicKeyBytes))
            else -> error("release-signature-algorithm-not-allowed")
        }
        val verifier = when (algorithm) {
            "Ed25519" -> Signature.getInstance("Ed25519")
            "RSA-PSS-SHA256" -> Signature.getInstance("RSASSA-PSS").apply {
                setParameter(PSSParameterSpec("SHA-256", "MGF1", MGF1ParameterSpec.SHA256, 32, 1))
            }
            "ECDSA-P256-SHA256" -> Signature.getInstance("SHA256withECDSA")
            else -> error("release-signature-algorithm-not-allowed")
        }
        verifier.initVerify(publicKey)
        verifier.update(payload)
        val signature = Base64.decode(envelope.getString("signatureBase64"), Base64.DEFAULT)
        require(verifier.verify(signature)) { "release-envelope-signature-invalid" }

        val manifest = JSONObject(payload.toString(Charsets.UTF_8))
        val packageId = manifest.getString("packageId")
        val versionCode = manifest.getLong("versionCode")
        val apkSha256 = manifest.getString("apkSha256").lowercase()
        val apkSizeBytes = manifest.getLong("apkSizeBytes")
        val signerCertificateSha256 = manifest.getString("signerCertificateSha256").lowercase()
        val downloadOrigin = manifest.getString("downloadOrigin").removeSuffix("/")
        val evidenceReportSha256 = manifest.getString("evidenceReportSha256").lowercase()

        require(packagePattern.matches(packageId)) { "non-aarulya-package-rejected" }
        require(versionCode > 0L) { "positive-version-code-required" }
        require(sha256Pattern.matches(apkSha256)) { "apk-sha256-required" }
        require(sha256Pattern.matches(signerCertificateSha256)) { "signer-certificate-sha256-required" }
        require(sha256Pattern.matches(evidenceReportSha256)) { "evidence-report-sha256-required" }
        require(apkSizeBytes in 1..(2L * 1024L * 1024L * 1024L)) { "bounded-apk-size-required" }
        val downloadUri = Uri.parse(downloadOrigin)
        require(downloadUri.scheme == "https" && downloadOrigin == BuildConfig.DOWNLOAD_BASE_URL) {
            "canonical-download-origin-required"
        }
        require(manifest.getString("publisher") == "Aarulya") { "manifest-publisher-mismatch" }
        require(manifest.getString("ownershipEvidenceReview") == "passed") { "ownership-evidence-required" }
        require(manifest.getString("securityReview") == "passed") { "security-review-required" }
        require(manifest.getString("androidPermissionPrivacyReview") == "passed") { "privacy-review-required" }
        require(manifest.getString("malwareScan") == "passed") { "malware-scan-required" }
        require(manifest.getString("publicationGateStatus") == "passed") { "publication-gate-required" }

        require(envelope.getString("packageId") == packageId) { "envelope-package-mismatch" }
        require(envelope.getLong("versionCode") == versionCode) { "envelope-version-mismatch" }
        require(envelope.getString("apkSha256").lowercase() == apkSha256) { "envelope-apk-digest-mismatch" }
        require(envelope.getString("signerFingerprint").replace(":", "").lowercase() == signerCertificateSha256) {
            "envelope-apk-signer-mismatch"
        }

        return VerifiedReleaseEnvelope(
            appId = envelope.getString("appId"),
            packageId = packageId,
            versionCode = versionCode,
            apkSha256 = apkSha256,
            apkSizeBytes = apkSizeBytes,
            signerCertificateSha256 = signerCertificateSha256,
            apkSigningKeyId = envelope.getString("apkSigningKeyId"),
            downloadOrigin = downloadOrigin,
            evidenceReportSha256 = evidenceReportSha256
        )
    }

    private fun decodePem(pem: String): ByteArray {
        val normalized = pem
            .replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replace(Regex("\\s+"), "")
        require(normalized.length in 64..16384) { "valid-public-key-pem-required" }
        return Base64.decode(normalized, Base64.DEFAULT)
    }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256")
        .digest(bytes)
        .joinToString("") { "%02x".format(it) }
}
