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
            "In development", "Source foundation" ->
                "Download अभी बंद है। Signed APK, ownership proof, security tests और final evidence report पूरा होने के बाद ही Install चालू होगा।"
            else ->
                "यह Aarulya-owned app production queue में है। Ready होने से पहले copied, unsigned या unverified APK publish नहीं किया जाएगा।"
        }

        AlertDialog.Builder(this)
            .setTitle(app.name)
            .setMessage(
                "${app.summary}\n\n" +
                    "Package: ${app.packageId}\n" +
                    "Category: ${app.category}\n" +
                    "Age: ${app.ageLabel}\n" +
                    "Size: ${app.sizeLabel}\n" +
                    "Evidence: ${app.trustLabel}\n" +
                    "Status: ${app.statusLabel}\n\n" +
                    releaseMessage
            )
            .setPositiveButton("Close", null)
            .setNeutralButton("Trust & privacy") { _, _ -> showTrustMenu(app) }
            .show()
    }

    private fun showTrustMenu(app: StoreApp) {
        val sections = arrayOf("About", "Data safety", "Permissions", "Security", "Versions")
        AlertDialog.Builder(this)
            .setTitle("${app.name} — Trust details")
            .setItems(sections) { _, which ->
                when (which) {
                    0 -> showSection(app, "About", aboutText(app))
                    1 -> showSection(app, "Data safety", dataSafetyText(app))
                    2 -> showSection(app, "Permissions", permissionsText(app))
                    3 -> showSection(app, "Security", securityText(app))
                    else -> showSection(app, "Versions", versionsText(app))
                }
            }
            .setNegativeButton("Back", null)
            .show()
    }

    private fun showSection(app: StoreApp, title: String, body: String) {
        AlertDialog.Builder(this)
            .setTitle("${app.name} — $title")
            .setMessage(body)
            .setPositiveButton("Close", null)
            .setNeutralButton("All trust details") { _, _ -> showTrustMenu(app) }
            .show()
    }

    private fun aboutText(app: StoreApp): String =
        "${app.summary}\n\n" +
            "Publisher: Aarulya DigitalWorks\n" +
            "Package: ${app.packageId}\n" +
            "Category: ${app.category}\n" +
            "Current state: ${app.statusLabel}\n\n" +
            "This listing is a development record, not a production-release claim."

    private fun dataSafetyText(app: StoreApp): String =
        "No production data-safety declaration has been approved for ${app.name} yet.\n\n" +
            "Publication requires a reviewed data inventory, purpose limitation, retention rules, deletion flow, encryption evidence, third-party processor list and signed privacy approval. Missing evidence blocks download."

    private fun permissionsText(app: StoreApp): String =
        "No permission is approved merely because this listing exists.\n\n" +
            "The final APK must request only feature-essential permissions, explain each request before Android shows it, keep unrelated features working after denial and provide a tested revocation flow. Sensitive permissions require an elevated review."

    private fun securityText(app: StoreApp): String =
        "Required before publication:\n\n" +
            "• Aarulya source ownership\n" +
            "• Package and signer verification\n" +
            "• APK SHA-256\n" +
            "• Permission and privacy review\n" +
            "• Malware and dependency scans\n" +
            "• Build provenance and SBOM\n" +
            "• Tamper, replay and rollback tests\n" +
            "• Signed final evidence report\n\n" +
            "Any failed, missing, expired or mismatched evidence keeps download and install blocked."

    private fun versionsText(app: StoreApp): String =
        "No verified public version is available for ${app.name}.\n\n" +
            "Version history will show only signed Aarulya releases with exact package ID, version code, APK digest, signing-certificate fingerprint, publication time, security review and revocation state."
}
