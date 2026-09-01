package com.aarulya.store.install

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import com.aarulya.store.storage.StoreStateDatabase
import java.io.File
import java.io.FileInputStream

class VerifiedPackageInstaller(
    private val context: Context,
    private val verifier: VerifiedApkVerifier = VerifiedApkVerifier(context),
    private val stateDatabase: StoreStateDatabase = StoreStateDatabase(context)
) {
    companion object {
        const val ACTION_INSTALL_STATUS = "com.aarulya.store.INSTALL_STATUS"
        const val EXTRA_AARULYA_SESSION_ID = "aarulya_session_id"
    }

    fun beginInstall(
        apk: File,
        expected: ExpectedRelease,
        userPressedInstall: Boolean
    ): Result<Int> {
        if (!userPressedInstall) return Result.failure(IllegalStateException("explicit-user-action-required"))
        if (!context.packageManager.canRequestPackageInstalls()) {
            return Result.failure(SecurityException("install-source-permission-required"))
        }

        val verification = verifier.verify(apk, expected)
        if (!verification.valid) return Result.failure(SecurityException(verification.errors.joinToString(",")))

        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(expected.packageId)
            setSize(apk.length())
            setInstallLocation(PackageInfo.INSTALL_LOCATION_AUTO)
        }
        val sessionId = installer.createSession(params)

        try {
            installer.openSession(sessionId).use { session ->
                FileInputStream(apk).use { input ->
                    session.openWrite("base.apk", 0, apk.length()).use { output ->
                        input.copyTo(output)
                        session.fsync(output)
                    }
                }

                stateDatabase.recordPrepared(
                    sessionId = sessionId,
                    packageId = expected.packageId,
                    versionCode = expected.versionCode,
                    apkSha256 = expected.apkSha256.lowercase(),
                    signerSha256 = expected.signerCertificateSha256.lowercase()
                )

                val callbackIntent = Intent(ACTION_INSTALL_STATUS)
                    .setPackage(context.packageName)
                    .putExtra(EXTRA_AARULYA_SESSION_ID, sessionId)
                val pendingIntent = PendingIntent.getBroadcast(
                    context,
                    sessionId,
                    callbackIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                )
                session.commit(pendingIntent.intentSender)
            }
        } catch (error: Throwable) {
            runCatching { installer.abandonSession(sessionId) }
            stateDatabase.updateStatus(sessionId, PackageInstaller.STATUS_FAILURE, error.javaClass.simpleName)
            return Result.failure(error)
        }

        return Result.success(sessionId)
    }
}
