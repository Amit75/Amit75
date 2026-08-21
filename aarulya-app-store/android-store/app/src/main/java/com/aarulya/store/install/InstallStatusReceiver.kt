package com.aarulya.store.install

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build

class InstallStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val status = intent.getIntExtra(
            PackageInstaller.EXTRA_STATUS,
            PackageInstaller.STATUS_FAILURE
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

        // Production implementation must send only a redacted receipt to the
        // Aarulya backend. Never log token, file path, user data or raw intent.
        val packageName = intent.getStringExtra(PackageInstaller.EXTRA_PACKAGE_NAME)
        val message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
        InstallStatusReceiptSink.record(
            context = context,
            packageName = packageName,
            status = status,
            redactedMessage = message?.take(160)
        )
    }
}

object InstallStatusReceiptSink {
    fun record(context: Context, packageName: String?, status: Int, redactedMessage: String?) {
        // Fail closed until authenticated backend receipt upload is injected.
        // Local plaintext persistence is intentionally not implemented.
    }
}
