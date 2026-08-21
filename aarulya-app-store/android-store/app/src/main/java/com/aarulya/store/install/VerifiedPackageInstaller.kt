package com.aarulya.store.install

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import java.io.File
import java.io.FileInputStream

class VerifiedPackageInstaller(
    private val context: Context,
    private val verifier: VerifiedApkVerifier = VerifiedApkVerifier(context)
) {
    companion object {
        const val ACTION_INSTALL_STATUS = "com.aarulya.store.INSTALL_STATUS"
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
        if (!verification.valid) {
            return Result.failure(SecurityException(verification.errors.joinToString(",")))
        }

        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(expected.packageId)
            setSize(apk.length())
            setInstallLocation(PackageInstaller.SessionParams.INSTALL_LOCATION_AUTO)
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

                val callbackIntent = Intent(ACTION_INSTALL_STATUS).setPackage(context.packageName)
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
            return Result.failure(error)
        }

        return Result.success(sessionId)
    }
}
