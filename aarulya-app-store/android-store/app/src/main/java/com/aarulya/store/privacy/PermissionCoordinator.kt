package com.aarulya.store.privacy

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build

class PermissionCoordinator(private val activity: Activity) {

    companion object {
        const val REQUEST_NOTIFICATIONS = 1001
    }

    fun notificationsAlreadyAllowed(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Call only after the user explicitly enables update/security alerts.
     * Never call from app startup or silently from background work.
     */
    fun requestUpdateNotificationsAfterUserOptIn(): Boolean {
        if (Build.VERSION.SDK_INT < 33 || notificationsAlreadyAllowed()) return true
        activity.requestPermissions(
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            REQUEST_NOTIFICATIONS
        )
        return false
    }

    fun shouldShowNotificationRationale(): Boolean {
        if (Build.VERSION.SDK_INT < 33) return false
        return activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)
    }
}
