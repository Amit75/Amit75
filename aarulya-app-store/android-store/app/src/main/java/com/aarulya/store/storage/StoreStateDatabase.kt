package com.aarulya.store.storage

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class PendingInstallReceipt(
    val sessionId: Int,
    val packageId: String,
    val versionCode: Long,
    val apkSha256: String,
    val signerSha256: String,
    val status: Int,
    val statusMessage: String?,
    val createdAt: Long
)

class StoreStateDatabase(context: Context) : SQLiteOpenHelper(
    context,
    "aarulya_store_state.db",
    null,
    1
) {
    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
        db.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE pending_install_receipts (
              session_id INTEGER PRIMARY KEY,
              package_id TEXT NOT NULL,
              version_code INTEGER NOT NULL,
              apk_sha256 TEXT NOT NULL,
              signer_sha256 TEXT NOT NULL,
              status INTEGER NOT NULL,
              status_message TEXT,
              created_at INTEGER NOT NULL,
              reported_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX pending_install_unreported_idx ON pending_install_receipts(reported_at, created_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        throw IllegalStateException("unsupported-store-state-database-upgrade:$oldVersion:$newVersion")
    }

    fun recordPrepared(
        sessionId: Int,
        packageId: String,
        versionCode: Long,
        apkSha256: String,
        signerSha256: String
    ) {
        require(packageId.matches(Regex("^com\\.aarulya(?:\\.[a-z][a-z0-9_]*)+$"))) { "invalid-package-id" }
        require(apkSha256.matches(Regex("^[a-f0-9]{64}$"))) { "invalid-apk-sha256" }
        require(signerSha256.matches(Regex("^[a-f0-9]{64}$"))) { "invalid-signer-sha256" }
        writableDatabase.insertOrThrow("pending_install_receipts", null, ContentValues().apply {
            put("session_id", sessionId)
            put("package_id", packageId)
            put("version_code", versionCode)
            put("apk_sha256", apkSha256)
            put("signer_sha256", signerSha256)
            put("status", -999)
            put("created_at", System.currentTimeMillis())
        })
    }

    fun updateStatus(sessionId: Int, status: Int, redactedMessage: String?) {
        writableDatabase.update(
            "pending_install_receipts",
            ContentValues().apply {
                put("status", status)
                put("status_message", redactedMessage?.take(160))
            },
            "session_id = ?",
            arrayOf(sessionId.toString())
        )
    }

    fun unreportedSuccessful(limit: Int = 20): List<PendingInstallReceipt> {
        val bounded = limit.coerceIn(1, 100)
        return readableDatabase.query(
            "pending_install_receipts",
            arrayOf("session_id", "package_id", "version_code", "apk_sha256", "signer_sha256", "status", "status_message", "created_at"),
            "reported_at IS NULL AND status = 0",
            null,
            null,
            null,
            "created_at ASC",
            bounded.toString()
        ).use { cursor ->
            buildList {
                while (cursor.moveToNext()) {
                    add(
                        PendingInstallReceipt(
                            sessionId = cursor.getInt(0),
                            packageId = cursor.getString(1),
                            versionCode = cursor.getLong(2),
                            apkSha256 = cursor.getString(3),
                            signerSha256 = cursor.getString(4),
                            status = cursor.getInt(5),
                            statusMessage = cursor.getString(6),
                            createdAt = cursor.getLong(7)
                        )
                    )
                }
            }
        }
    }

    fun markReported(sessionId: Int) {
        writableDatabase.update(
            "pending_install_receipts",
            ContentValues().apply { put("reported_at", System.currentTimeMillis()) },
            "session_id = ?",
            arrayOf(sessionId.toString())
        )
    }

    fun deleteExpired(cutoffEpochMillis: Long) {
        writableDatabase.delete(
            "pending_install_receipts",
            "created_at < ? AND (reported_at IS NOT NULL OR status != -999)",
            arrayOf(cutoffEpochMillis.toString())
        )
    }
}
