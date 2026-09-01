package com.aarulya.store.install

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.Settings

class InstallSourceGate(private val activity: Activity) {

    fun canInstallPackages(): Boolean = activity.packageManager.canRequestPackageInstalls()

    /**
     * Open Android's per-source permission screen only after the user presses
     * Install on a verified Aarulya release. Never open this screen at startup.
     */
    fun openInstallSourceSettings() {
        val intent = Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:${activity.packageName}")
        )
        activity.startActivity(intent)
    }

    fun requireExplicitUserActionBeforeInstall(userPressedInstall: Boolean): Boolean {
        return userPressedInstall && canInstallPackages()
    }
}
