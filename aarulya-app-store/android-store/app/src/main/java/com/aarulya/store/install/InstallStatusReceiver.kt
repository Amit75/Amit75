package com.aarulya.store.install

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import com.aarulya.store.storage.StoreStateDatabase

class InstallStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)
        val sessionId = intent.getIntExtra(
            VerifiedPackageInstaller.EXTRA_AARULYA_SESSION_ID,
            intent.getIntExtra(PackageInstaller.EXTRA_SESSION_ID, -1)
        )

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            val confirmation = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_INTENT)
            }
            confirmation?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (confirmation != null) context.startActivity(confirmation)
            return
        }

        if (sessionId >= 0) {
            val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
                ?.replace(Regex("[\\r\\n\\t]+"), " ")
                ?.take(160)
            StoreStateDatabase(context).updateStatus(sessionId, status, message)
        }
        // No access token, APK path, user identifier or raw system intent is logged or persisted here.
        // Successful receipts are uploaded later from an authenticated foreground session.
    }
}
