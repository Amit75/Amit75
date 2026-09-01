package com.aarulya.store.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class StoreSession(
    val accessToken: String,
    val expiresAtEpochSeconds: Long,
    val subject: String?
) {
    fun isUsable(nowEpochSeconds: Long = System.currentTimeMillis() / 1000L): Boolean =
        accessToken.length >= 32 && expiresAtEpochSeconds > nowEpochSeconds + 60
}

data class PendingAuthorization(
    val state: String,
    val codeVerifier: String,
    val createdAtEpochSeconds: Long
)

data class PendingInstall(
    val appId: String,
    val createdAtEpochSeconds: Long
)

class SecureSessionStore(context: Context) {
    private val preferences = context.getSharedPreferences("aarulya_store_secure_session", Context.MODE_PRIVATE)
    private val keyAlias = "aarulya_store_session_aes_v1"
    private val appIdPattern = Regex("^[a-z0-9][a-z0-9-]{0,79}$")

    fun saveSession(session: StoreSession) {
        require(session.isUsable()) { "usable-session-required" }
        writeEncrypted("session", JSONObject().apply {
            put("accessToken", session.accessToken)
            put("expiresAt", session.expiresAtEpochSeconds)
            put("subject", session.subject)
        }.toString())
    }

    fun loadSession(): StoreSession? {
        val raw = readEncrypted("session") ?: return null
        return runCatching {
            val json = JSONObject(raw)
            StoreSession(
                accessToken = json.getString("accessToken"),
                expiresAtEpochSeconds = json.getLong("expiresAt"),
                subject = json.optString("subject").takeIf { it.isNotBlank() && it != "null" }
            )
        }.getOrNull()?.takeIf { it.isUsable() }
    }

    fun savePendingAuthorization(pending: PendingAuthorization) {
        writeEncrypted("pending_authorization", JSONObject().apply {
            put("state", pending.state)
            put("codeVerifier", pending.codeVerifier)
            put("createdAt", pending.createdAtEpochSeconds)
        }.toString())
    }

    fun consumePendingAuthorization(expectedState: String): PendingAuthorization? {
        val raw = readEncrypted("pending_authorization") ?: return null
        preferences.edit().remove("pending_authorization").apply()
        return runCatching {
            val json = JSONObject(raw)
            PendingAuthorization(
                state = json.getString("state"),
                codeVerifier = json.getString("codeVerifier"),
                createdAtEpochSeconds = json.getLong("createdAt")
            )
        }.getOrNull()?.takeIf { pending ->
            pending.state == expectedState &&
                pending.codeVerifier.length in 43..128 &&
                pending.createdAtEpochSeconds > System.currentTimeMillis() / 1000L - 600
        }
    }

    fun savePendingInstall(appId: String) {
        require(appIdPattern.matches(appId)) { "valid-pending-install-app-id-required" }
        writeEncrypted("pending_install", JSONObject().apply {
            put("appId", appId)
            put("createdAt", System.currentTimeMillis() / 1000L)
        }.toString())
    }

    fun consumePendingInstall(): PendingInstall? {
        val raw = readEncrypted("pending_install") ?: return null
        preferences.edit().remove("pending_install").apply()
        return runCatching {
            val json = JSONObject(raw)
            PendingInstall(
                appId = json.getString("appId"),
                createdAtEpochSeconds = json.getLong("createdAt")
            )
        }.getOrNull()?.takeIf { pending ->
            appIdPattern.matches(pending.appId) &&
                pending.createdAtEpochSeconds > System.currentTimeMillis() / 1000L - 1800
        }
    }

    fun clear() {
        preferences.edit().clear().apply()
    }

    private fun writeEncrypted(name: String, plaintext: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val ciphertext = cipher.doFinal(plaintext.toByteArray(Charsets.UTF_8))
        val envelope = JSONObject().apply {
            put("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            put("ciphertext", Base64.encodeToString(ciphertext, Base64.NO_WRAP))
        }
        preferences.edit().putString(name, envelope.toString()).apply()
    }

    private fun readEncrypted(name: String): String? {
        val raw = preferences.getString(name, null) ?: return null
        return runCatching {
            val envelope = JSONObject(raw)
            val iv = Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)
            val ciphertext = Base64.decode(envelope.getString("ciphertext"), Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
            cipher.doFinal(ciphertext).toString(Charsets.UTF_8)
        }.getOrElse {
            preferences.edit().remove(name).apply()
            null
        }
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }
}
