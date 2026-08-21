package com.aarulya.store.api

import android.net.Uri
import com.aarulya.store.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

class StoreApiException(val status: Int, val code: String) : Exception("$code:$status")

class StoreApiClient {
    private val baseUri = Uri.parse(BuildConfig.API_BASE_URL)
    private val trustedHost = baseUri.host ?: error("api-host-required")

    fun getCatalog(accessToken: String, query: String = "", category: String? = null): JSONObject {
        val uri = baseUri.buildUpon()
            .appendPath("catalog")
            .appendQueryParameter("q", query)
            .apply { category?.takeIf { it.isNotBlank() }?.let { appendQueryParameter("category", it) } }
            .build()
        return request("GET", uri, accessToken)
    }

    fun getApp(accessToken: String, appId: String): JSONObject =
        request("GET", baseUri.buildUpon().appendPath("apps").appendPath(appId).build(), accessToken)

    fun resolveAction(accessToken: String, query: String): JSONObject = request(
        "POST",
        baseUri.buildUpon().appendPath("actions").appendPath("resolve").build(),
        accessToken,
        JSONObject().put("query", query)
    )

    fun authorizeDownload(
        accessToken: String,
        appId: String,
        versionCode: Long? = null,
        idempotencyKey: String = UUID.randomUUID().toString()
    ): JSONObject = request(
        "POST",
        baseUri.buildUpon().appendPath("downloads").appendPath("authorize").build(),
        accessToken,
        JSONObject().apply {
            put("appId", appId)
            versionCode?.let { put("versionCode", it) }
        },
        idempotencyKey
    )

    fun checkUpdate(
        accessToken: String,
        deviceId: String,
        packageId: String,
        installedVersionCode: Long
    ): JSONObject = request(
        "POST",
        baseUri.buildUpon().appendPath("updates").appendPath("check").build(),
        accessToken,
        JSONObject()
            .put("deviceId", deviceId)
            .put("packageId", packageId)
            .put("installedVersionCode", installedVersionCode)
    )

    fun reportInstall(
        accessToken: String,
        deviceId: String,
        packageId: String,
        versionCode: Long,
        downloadedSha256: String,
        installed: JSONObject?,
        idempotencyKey: String = UUID.randomUUID().toString()
    ): JSONObject = request(
        "POST",
        baseUri.buildUpon().appendPath("installs").appendPath("report").build(),
        accessToken,
        JSONObject()
            .put("deviceId", deviceId)
            .put("packageId", packageId)
            .put("versionCode", versionCode)
            .put("downloadedSha256", downloadedSha256)
            .apply { installed?.let { put("installed", it) } },
        idempotencyKey
    )

    private fun request(
        method: String,
        uri: Uri,
        accessToken: String,
        body: JSONObject? = null,
        idempotencyKey: String? = null
    ): JSONObject {
        require(accessToken.length in 32..8192) { "valid-access-token-required" }
        require(uri.scheme == "https" && uri.host == trustedHost) { "trusted-api-origin-required" }
        val connection = (URL(uri.toString()).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 10_000
            readTimeout = 20_000
            instanceFollowRedirects = false
            useCaches = false
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("X-Request-Id", UUID.randomUUID().toString())
            idempotencyKey?.let { setRequestProperty("Idempotency-Key", it) }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                val bytes = body.toString().toByteArray(Charsets.UTF_8)
                require(bytes.size <= 1024 * 1024) { "request-body-too-large" }
                setFixedLengthStreamingMode(bytes.size)
                outputStream.use { it.write(bytes) }
            }
        }

        val status = connection.responseCode
        if (status in 300..399) throw StoreApiException(status, "redirect-prohibited")
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val raw = stream?.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                total += read
                if (total > 2 * 1024 * 1024) throw StoreApiException(status, "response-too-large")
                output.write(buffer, 0, read)
            }
            output.toString(Charsets.UTF_8.name())
        }.orEmpty()
        val json = runCatching { JSONObject(raw) }.getOrElse { JSONObject() }
        if (status !in 200..299) {
            throw StoreApiException(status, json.optString("error", "store-api-request-failed"))
        }
        return json
    }
}
