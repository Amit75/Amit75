package com.aarulya.store.download

import android.content.Context
import android.net.Uri
import com.aarulya.store.BuildConfig
import com.aarulya.store.security.VerifiedReleaseEnvelope
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.UUID

data class DownloadedApk(
    val file: File,
    val sha256: String,
    val bytes: Long
)

class SecureApkDownloader(private val context: Context) {
    fun download(authorization: JSONObject, release: VerifiedReleaseEnvelope): DownloadedApk {
        val token = authorization.getString("token")
        val grantId = authorization.getString("grantId")
        val downloadUrl = authorization.getString("downloadUrl")
        require(token.length in 32..256) { "valid-download-token-required" }
        require(grantId.matches(Regex("^[0-9a-fA-F-]{36}$"))) { "valid-download-grant-required" }

        val uri = Uri.parse(downloadUrl)
        val canonical = Uri.parse(BuildConfig.DOWNLOAD_BASE_URL)
        require(uri.scheme == "https" && uri.host == canonical.host && uri.port == canonical.port) {
            "canonical-download-host-required"
        }
        require(uri.path == "/v1/grants/$grantId/apk" && uri.query.isNullOrEmpty()) {
            "canonical-one-time-download-path-required"
        }

        val downloadDirectory = File(context.noBackupFilesDir, "verified-apk-downloads").apply {
            if (!exists() && !mkdirs()) error("private-download-directory-unavailable")
        }
        val partial = File(downloadDirectory, "${UUID.randomUUID()}.apk.partial")
        val finalFile = File(downloadDirectory, "${release.packageId}-${release.versionCode}-${release.apkSha256}.apk")
        partial.delete()

        try {
            val connection = (URL(downloadUrl).openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 120_000
                instanceFollowRedirects = false
                useCaches = false
                setRequestProperty("Accept", "application/vnd.android.package-archive")
                setRequestProperty("Authorization", "Bearer $token")
            }
            val status = connection.responseCode
            require(status !in 300..399) { "download-redirect-prohibited" }
            require(status == 200) { "apk-download-failed:$status" }
            val declaredLength = connection.contentLengthLong
            require(declaredLength == -1L || declaredLength == release.apkSizeBytes) {
                "apk-content-length-mismatch"
            }
            require(connection.contentType?.substringBefore(';') == "application/vnd.android.package-archive") {
                "apk-content-type-required"
            }

            val digest = MessageDigest.getInstance("SHA-256")
            var total = 0L
            connection.inputStream.use { input ->
                FileOutputStream(partial).use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read < 0) break
                        total += read
                        require(total <= release.apkSizeBytes && total <= 2L * 1024L * 1024L * 1024L) {
                            "apk-download-size-limit-exceeded"
                        }
                        digest.update(buffer, 0, read)
                        output.write(buffer, 0, read)
                    }
                    output.fd.sync()
                }
            }
            require(total == release.apkSizeBytes) { "apk-download-truncated" }
            val actualSha256 = digest.digest().joinToString("") { "%02x".format(it) }
            require(actualSha256 == release.apkSha256) { "apk-download-sha256-mismatch" }
            if (finalFile.exists() && !finalFile.delete()) error("stale-final-apk-delete-failed")
            require(partial.renameTo(finalFile)) { "verified-apk-atomic-rename-failed" }
            return DownloadedApk(finalFile, actualSha256, total)
        } catch (error: Throwable) {
            partial.delete()
            throw error
        }
    }
}
