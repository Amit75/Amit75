package com.aarulya.store.auth

import android.net.Uri
import android.util.Base64
import com.aarulya.store.BuildConfig
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.security.MessageDigest
import java.security.SecureRandom

class OidcPkceClient(private val sessionStore: SecureSessionStore) {
    private val random = SecureRandom()
    private val identityOrigin = Uri.parse(BuildConfig.IDENTITY_ORIGIN)
    private val redirectUri = Uri.parse(BuildConfig.OIDC_REDIRECT_URI)

    init {
        require(identityOrigin.scheme == "https" && identityOrigin.host == "identity.aarulya.com") {
            "trusted-identity-origin-required"
        }
        require(
            redirectUri.scheme == "https" &&
                redirectUri.host == identityOrigin.host &&
                redirectUri.path == "/store/android/callback" &&
                redirectUri.port == -1
        ) { "verified-https-redirect-required" }
    }

    fun createAuthorizationUri(): Uri {
        val state = randomUrlSafe(32)
        val verifier = randomUrlSafe(64)
        val challenge = Base64.encodeToString(
            MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.US_ASCII)),
            Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING
        )
        sessionStore.savePendingAuthorization(
            PendingAuthorization(state, verifier, System.currentTimeMillis() / 1000L)
        )
        return identityOrigin.buildUpon()
            .appendPath("authorize")
            .appendQueryParameter("client_id", BuildConfig.OIDC_CLIENT_ID)
            .appendQueryParameter("redirect_uri", BuildConfig.OIDC_REDIRECT_URI)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("scope", "store:read store:download store:install store:updates store:jobs")
            .appendQueryParameter("state", state)
            .appendQueryParameter("code_challenge", challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .build()
    }

    fun exchangeCallback(callback: Uri): StoreSession {
        require(
            callback.scheme == redirectUri.scheme &&
                callback.host == redirectUri.host &&
                callback.path == redirectUri.path &&
                callback.port == -1
        ) { "invalid-oidc-callback" }
        callback.getQueryParameter("error")?.let { throw IllegalStateException("identity-provider-error:$it") }
        val state = callback.getQueryParameter("state") ?: throw IllegalStateException("oidc-state-required")
        val code = callback.getQueryParameter("code") ?: throw IllegalStateException("authorization-code-required")
        require(code.length in 16..4096) { "invalid-authorization-code" }
        val pending = sessionStore.consumePendingAuthorization(state)
            ?: throw IllegalStateException("authorization-state-invalid-or-expired")

        val endpoint = URL("${BuildConfig.IDENTITY_ORIGIN}/token")
        require(endpoint.protocol == "https" && endpoint.host == identityOrigin.host && endpoint.port == -1) {
            "trusted-token-endpoint-required"
        }
        val form = listOf(
            "grant_type" to "authorization_code",
            "client_id" to BuildConfig.OIDC_CLIENT_ID,
            "redirect_uri" to BuildConfig.OIDC_REDIRECT_URI,
            "code" to code,
            "code_verifier" to pending.codeVerifier
        ).joinToString("&") { (key, value) ->
            "${URLEncoder.encode(key, Charsets.UTF_8.name())}=${URLEncoder.encode(value, Charsets.UTF_8.name())}"
        }
        val formBytes = form.toByteArray(Charsets.UTF_8)

        val connection = (endpoint.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 10_000
            readTimeout = 15_000
            instanceFollowRedirects = false
            useCaches = false
            doOutput = true
            setRequestProperty("Content-Type", "application/x-www-form-urlencoded")
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Cache-Control", "no-store")
            setFixedLengthStreamingMode(formBytes.size)
        }

        try {
            connection.outputStream.use { it.write(formBytes) }
            val status = connection.responseCode
            if (status in 300..399) throw IllegalStateException("identity-redirect-prohibited")
            val source = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = source?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                var total = 0
                while (true) {
                    val read = input.read(buffer)
                    if (read < 0) break
                    total += read
                    require(total <= 256 * 1024) { "identity-response-too-large" }
                    output.write(buffer, 0, read)
                }
                output.toString(Charsets.UTF_8.name())
            }.orEmpty()
            if (status !in 200..299) throw IllegalStateException("token-exchange-failed:$status")
            require(connection.contentType?.substringBefore(';')?.trim()?.equals("application/json", true) == true) {
                "identity-json-response-required"
            }

            val json = runCatching { JSONObject(response) }
                .getOrElse { throw IllegalStateException("identity-invalid-json-response") }
            val accessToken = json.getString("access_token")
            val tokenType = json.optString("token_type", "Bearer")
            val expiresIn = json.optLong("expires_in", 0L)
            require(tokenType.equals("Bearer", ignoreCase = true)) { "bearer-token-required" }
            require(accessToken.length in 32..8192) { "invalid-access-token" }
            require(expiresIn in 60..3600) { "bounded-token-expiry-required" }
            return StoreSession(
                accessToken = accessToken,
                expiresAtEpochSeconds = System.currentTimeMillis() / 1000L + expiresIn,
                subject = null
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun randomUrlSafe(bytes: Int): String = ByteArray(bytes).also(random::nextBytes).let {
        Base64.encodeToString(it, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }
}
