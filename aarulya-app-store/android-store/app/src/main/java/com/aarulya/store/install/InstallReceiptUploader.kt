package com.aarulya.store.install

import android.content.Context
import com.aarulya.store.api.StoreApiClient
import com.aarulya.store.auth.StoreSession
import com.aarulya.store.storage.StoreStateDatabase
import java.util.UUID

class DevicePublicIdentity(context: Context) {
    private val preferences = context.getSharedPreferences("aarulya_store_device", Context.MODE_PRIVATE)

    fun id(): String {
        preferences.getString("device_public_id", null)?.let { return it }
        val generated = "android-${UUID.randomUUID()}"
        preferences.edit().putString("device_public_id", generated).apply()
        return generated
    }
}

class InstallReceiptUploader(
    context: Context,
    private val api: StoreApiClient = StoreApiClient(),
    private val database: StoreStateDatabase = StoreStateDatabase(context),
    private val deviceIdentity: DevicePublicIdentity = DevicePublicIdentity(context)
) {
    fun uploadPending(session: StoreSession): Int {
        require(session.isUsable()) { "usable-session-required" }
        var uploaded = 0
        database.unreportedSuccessful().forEach { receipt ->
            api.reportInstall(
                accessToken = session.accessToken,
                deviceId = deviceIdentity.id(),
                packageId = receipt.packageId,
                versionCode = receipt.versionCode,
                downloadedSha256 = receipt.apkSha256,
                installed = null,
                idempotencyKey = "install-${receipt.sessionId}-${receipt.apkSha256.take(16)}"
            )
            database.markReported(receipt.sessionId)
            uploaded += 1
        }
        database.deleteExpired(System.currentTimeMillis() - 30L * 24L * 60L * 60L * 1000L)
        return uploaded
    }
}
