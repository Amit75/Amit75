package com.aarulya.store.install

import android.content.Context
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.os.Build
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

data class ExpectedRelease(
    val packageId: String,
    val versionCode: Long,
    val apkSha256: String,
    val signerCertificateSha256: String
)

data class ApkVerificationResult(
    val valid: Boolean,
    val errors: List<String>
)

class VerifiedApkVerifier(private val context: Context) {

    fun verify(apk: File, expected: ExpectedRelease): ApkVerificationResult {
        val errors = mutableListOf<String>()
        if (!apk.isFile || apk.length() <= 0L) return ApkVerificationResult(false, listOf("apk-file-missing"))
        if (!expected.packageId.matches(Regex("^com\\.aarulya(?:\\.[a-z][a-z0-9_]*)+$"))) {
            errors += "non-aarulya-package-rejected"
        }
        if (!expected.apkSha256.matches(Regex("^[a-f0-9]{64}$"))) errors += "expected-apk-sha256-invalid"
        if (!expected.signerCertificateSha256.matches(Regex("^[a-f0-9]{64}$"))) {
            errors += "expected-signer-certificate-sha256-invalid"
        }

        val actualDigest = sha256(apk)
        if (!actualDigest.equals(expected.apkSha256, ignoreCase = true)) errors += "apk-sha256-mismatch"

        val flags = signingFlags()
        val archiveInfo = context.packageManager.getPackageArchiveInfo(apk.absolutePath, flags)
        if (archiveInfo == null) {
            errors += "apk-package-info-unreadable"
            return ApkVerificationResult(false, errors.distinct())
        }
        if (archiveInfo.packageName != expected.packageId) errors += "apk-package-id-mismatch"
        val archiveVersionCode = versionCode(archiveInfo)
        if (archiveVersionCode != expected.versionCode) errors += "apk-version-code-mismatch"

        val archiveSigners = signerDigests(archiveInfo)
        if (expected.signerCertificateSha256.lowercase() !in archiveSigners) {
            errors += "apk-signer-certificate-mismatch"
        }

        val installedInfo = runCatching {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(expected.packageId, flags)
        }.getOrNull()
        if (installedInfo != null) {
            val installedVersionCode = versionCode(installedInfo)
            if (expected.versionCode <= installedVersionCode) errors += "downgrade-or-same-version-prohibited"
            val installedSigners = signerDigests(installedInfo)
            if (installedSigners.isEmpty() || archiveSigners.intersect(installedSigners).isEmpty()) {
                errors += "installed-signer-continuity-failed"
            }
        }

        return ApkVerificationResult(errors.isEmpty(), errors.distinct())
    }

    private fun signingFlags(): Int = if (Build.VERSION.SDK_INT >= 28) {
        PackageManager.GET_SIGNING_CERTIFICATES
    } else {
        @Suppress("DEPRECATION")
        PackageManager.GET_SIGNATURES
    }

    private fun versionCode(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) {
        info.longVersionCode
    } else {
        @Suppress("DEPRECATION")
        info.versionCode.toLong()
    }

    private fun signerDigests(info: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            val signingInfo = info.signingInfo
            when {
                signingInfo == null -> emptyArray()
                signingInfo.hasMultipleSigners() -> signingInfo.apkContentsSigners
                else -> signingInfo.signingCertificateHistory
            }
        } else {
            @Suppress("DEPRECATION")
            info.signatures ?: emptyArray()
        }
        return signatures.map { signature ->
            MessageDigest.getInstance("SHA-256")
                .digest(signature.toByteArray())
                .joinToString("") { byte -> "%02x".format(byte) }
        }.toSet()
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }
}
