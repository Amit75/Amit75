package com.aarulya.store

import android.app.Activity
import android.app.AlertDialog
import android.os.Bundle
import com.aarulya.store.catalog.StoreApp
import com.aarulya.store.ui.StoreHomeView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Privacy invariant: never request runtime or special permissions on first launch.
        setContentView(StoreHomeView(this, ::showAppDetails).build())
    }

    private fun showAppDetails(app: StoreApp) {
        val releaseMessage = when (app.statusLabel) {
            "In development", "Foundation ready" ->
                "Download अभी बंद है। Signed APK, ownership proof, security tests और final evidence report पूरा होने के बाद ही Install चालू होगा।"
            else ->
                "यह Aarulya-owned app production queue में है। Ready होने से पहले copy, unsigned build या unverified APK publish नहीं किया जाएगा।"
        }

        AlertDialog.Builder(this)
            .setTitle(app.name)
            .setMessage(
                "${app.summary}\n\n" +
                    "Package: ${app.packageId}\n" +
                    "Category: ${app.category}\n" +
                    "Age: ${app.ageLabel}\n" +
                    "Size: ${app.sizeLabel}\n" +
                    "Trust: ${app.trustLabel}\n" +
                    "Status: ${app.statusLabel}\n\n" +
                    releaseMessage
            )
            .setPositiveButton("ठीक है", null)
            .setNeutralButton("Trust details") { _, _ -> showTrustDetails(app) }
            .show()
    }

    private fun showTrustDetails(app: StoreApp) {
        AlertDialog.Builder(this)
            .setTitle("Verified Trust Receipt")
            .setMessage(
                "${app.name} के लिए publish से पहले:\n\n" +
                    "• Aarulya source ownership\n" +
                    "• Package और signer verification\n" +
                    "• APK SHA-256\n" +
                    "• Permission और privacy review\n" +
                    "• Malware और security tests\n" +
                    "• Build provenance और SBOM\n" +
                    "• Signed final evidence report\n\n" +
                    "इनमें से कोई evidence missing हुआ तो download और install block रहेगा।"
            )
            .setPositiveButton("समझ गया", null)
            .show()
    }
}
