package com.aarulya.store.install

import android.content.Context
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
        if (!apk.isFile) return ApkVerificationResult(false, listOf("apk-file-missing"))

        val actualDigest = sha256(apk)
        if (!actualDigest.equals(expected.apkSha256, ignoreCase = true)) {
            errors += "apk-sha256-mismatch"
        }

        val flags = if (Build.VERSION.SDK_INT >= 28) {
            PackageManager.GET_SIGNING_CERTIFICATES
        } else {
            @Suppress("DEPRECATION")
            PackageManager.GET_SIGNATURES
        }
        val info = context.packageManager.getPackageArchiveInfo(apk.absolutePath, flags)
        if (info == null) {
            errors += "apk-package-info-unreadable"
            return ApkVerificationResult(false, errors)
        }

        if (info.packageName != expected.packageId) errors += "apk-package-id-mismatch"
        val actualVersionCode = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else {
            @Suppress("DEPRECATION")
            info.versionCode.toLong()
        }
        if (actualVersionCode != expected.versionCode) errors += "apk-version-code-mismatch"

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
        val signerMatches = signatures.any { signature ->
            val digest = MessageDigest.getInstance("SHA-256")
                .digest(signature.toByteArray())
                .joinToString("") { byte -> "%02x".format(byte) }
            digest.equals(expected.signerCertificateSha256, ignoreCase = true)
        }
        if (!signerMatches) errors += "apk-signer-certificate-mismatch"

        return ApkVerificationResult(errors.isEmpty(), errors.distinct())
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
