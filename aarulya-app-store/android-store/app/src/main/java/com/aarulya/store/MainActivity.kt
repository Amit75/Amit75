package com.aarulya.store

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import com.aarulya.store.auth.OidcPkceClient
import com.aarulya.store.auth.SecureSessionStore
import com.aarulya.store.auth.StoreSession
import com.aarulya.store.catalog.RemoteCatalogRepository
import com.aarulya.store.catalog.StoreApp
import com.aarulya.store.catalog.StoreCatalog
import com.aarulya.store.install.InstallFlowResult
import com.aarulya.store.install.InstallReceiptUploader
import com.aarulya.store.install.StoreInstallCoordinator
import com.aarulya.store.ui.AccountGateView
import com.aarulya.store.ui.StoreHomeView
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var sessionStore: SecureSessionStore
    private lateinit var oidc: OidcPkceClient
    private lateinit var catalogRepository: RemoteCatalogRepository
    private lateinit var installCoordinator: StoreInstallCoordinator
    private lateinit var receiptUploader: InstallReceiptUploader
    @Volatile private var destroyed = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.WHITE
        window.navigationBarColor = Color.WHITE
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        sessionStore = SecureSessionStore(this)
        oidc = OidcPkceClient(sessionStore)
        catalogRepository = RemoteCatalogRepository()
        installCoordinator = StoreInstallCoordinator(this)
        receiptUploader = InstallReceiptUploader(this)
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onDestroy() {
        destroyed = true
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun handleIntent(intent: Intent?) {
        val incoming = intent?.data
        val installAppId = trustedInstallAppId(incoming)
        if (installAppId != null) {
            sessionStore.savePendingInstall(installAppId)
            val session = sessionStore.loadSession()
            if (session == null) {
                renderAccountGate("Sign in to continue the verified install.")
            } else {
                renderAuthenticated(session, refresh = true)
            }
            return
        }

        if (incoming != null && isTrustedCallback(incoming)) {
            showProgress("Verifying secure sign-in…")
            executor.execute {
                runCatching { oidc.exchangeCallback(incoming) }
                    .onSuccess { session ->
                        sessionStore.saveSession(session)
                        onUi { renderAuthenticated(session, refresh = true) }
                    }
                    .onFailure { error ->
                        sessionStore.clear()
                        onUi { renderAccountGate("Sign-in failed: ${safeError(error)}") }
                    }
            }
            return
        }

        if (incoming != null && incoming.getQueryParameter("code") != null) {
            sessionStore.clear()
            renderAccountGate("Untrusted sign-in callback was blocked.")
            return
        }

        val session = sessionStore.loadSession()
        if (session == null) renderAccountGate() else renderAuthenticated(session, refresh = true)
    }

    private fun isTrustedCallback(uri: Uri): Boolean {
        val expected = Uri.parse(BuildConfig.OIDC_REDIRECT_URI)
        return uri.scheme == "https" &&
            uri.scheme == expected.scheme &&
            uri.host == expected.host &&
            uri.path == expected.path &&
            uri.port == -1
    }

    private fun trustedInstallAppId(uri: Uri?): String? {
        if (uri == null) return null
        if (uri.scheme != "https" || uri.host != "store.aarulya.com" || uri.port != -1) return null
        if (uri.path != "/install" || uri.fragment != null || uri.queryParameterNames != setOf("app")) return null
        return uri.getQueryParameter("app")
            ?.takeIf { it.matches(Regex("^[a-z0-9][a-z0-9-]{0,79}$")) }
    }

    private fun renderAccountGate(message: String? = null) {
        if (destroyed) return
        StoreCatalog.clearAuthenticatedRemoteCatalog()
        setContentViewSmooth(AccountGateView(this, message, ::beginLogin).build())
    }

    private fun beginLogin() {
        val uri = oidc.createAuthorizationUri()
        val identity = Uri.parse(BuildConfig.IDENTITY_ORIGIN)
        require(uri.scheme == "https" && uri.host == identity.host && uri.port == -1) {
            "trusted-identity-origin-required"
        }
        startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
    }

    private fun renderAuthenticated(session: StoreSession, refresh: Boolean) {
        if (destroyed) return
        if (!session.isUsable()) {
            sessionStore.clear()
            renderAccountGate("Your session expired. Sign in again.")
            return
        }
        setContentViewSmooth(StoreHomeView(this, ::showAppDetails).build())
        if (!refresh) return

        executor.execute {
            runCatching {
                catalogRepository.refresh(session)
                receiptUploader.uploadPending(session)
            }.onSuccess {
                onUi {
                    setContentViewSmooth(StoreHomeView(this, ::showAppDetails).build())
                    resumePendingInstallIfReady()
                }
            }.onFailure { error ->
                if (error.message?.contains("401") == true || error.message?.contains("authentication") == true) {
                    sessionStore.clear()
                    onUi { renderAccountGate("Session verification failed. Sign in again.") }
                } else {
                    onUi {
                        Toast.makeText(this, "Store sync unavailable: ${safeError(error)}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun resumePendingInstallIfReady() {
        val pending = sessionStore.consumePendingInstall() ?: return
        val app = StoreCatalog.byId(pending.appId)
        if (app == null) {
            Toast.makeText(this, "The requested app is not in the authenticated catalog.", Toast.LENGTH_LONG).show()
            return
        }
        if (!app.statusLabel.equals("published", ignoreCase = true) || !app.verifiedReleaseAvailable) {
            Toast.makeText(this, "No verified published release is available for ${app.name}.", Toast.LENGTH_LONG).show()
            return
        }
        beginVerifiedInstall(app)
    }

    private fun showAppDetails(app: StoreApp) {
        if (destroyed) return
        val releaseMessage = if (app.statusLabel.equals("published", ignoreCase = true)) {
            "Install remains blocked unless the signed release envelope, pinned key, APK digest, signer, ownership, privacy, malware and final evidence checks all pass."
        } else {
            "No verified public release is available. This listing is a development record, not a production-release claim."
        }

        val builder = AlertDialog.Builder(this)
            .setTitle(app.name)
            .setMessage(
                "About\n${app.summary}\n\n" +
                    "Data safety\nNo verified public data-safety receipt is available until the exact release evidence is loaded.\n\n" +
                    "Permissions\nNo permission is requested by this listing. Each released app must publish its exact permission purpose before download.\n\n" +
                    "Security\nTrust: ${app.trustLabel}. Missing evidence blocks download.\n\n" +
                    "Versions\nStatus: ${app.statusLabel}. ${app.sizeLabel}.\nPackage: ${app.packageId}\n\n" +
                    releaseMessage
            )
            .setNegativeButton("Close", null)
            .setNeutralButton("Trust details") { _, _ -> showTrustDetails(app) }

        if (app.statusLabel.equals("published", ignoreCase = true) && app.verifiedReleaseAvailable) {
            builder.setPositiveButton("Install") { _, _ -> beginVerifiedInstall(app) }
        }
        builder.show()
    }

    private fun beginVerifiedInstall(app: StoreApp) {
        val session = sessionStore.loadSession()
        if (session == null) {
            sessionStore.savePendingInstall(app.id)
            renderAccountGate("Sign in before installing an app.")
            return
        }
        showProgress("Verifying release and preparing installation…")
        executor.execute {
            runCatching {
                installCoordinator.prepareAndInstall(
                    session = session,
                    appId = app.id,
                    requestedVersionCode = app.versionCode,
                    userPressedInstall = true
                )
            }.onSuccess { result ->
                onUi {
                    when (result) {
                        is InstallFlowResult.InstallPermissionRequired -> {
                            Toast.makeText(this, "Allow Aarulya Store as an install source, then press Install again.", Toast.LENGTH_LONG).show()
                        }
                        is InstallFlowResult.SessionCommitted -> {
                            Toast.makeText(this, "Android installation confirmation opened.", Toast.LENGTH_LONG).show()
                        }
                    }
                    renderAuthenticated(session, refresh = false)
                }
            }.onFailure { error ->
                onUi {
                    AlertDialog.Builder(this)
                        .setTitle("Installation blocked")
                        .setMessage("A security or release requirement failed: ${safeError(error)}")
                        .setPositiveButton("Close", null)
                        .show()
                    renderAuthenticated(session, refresh = false)
                }
            }
        }
    }

    private fun showTrustDetails(app: StoreApp) {
        if (destroyed) return
        AlertDialog.Builder(this)
            .setTitle("Verified Trust Receipt")
            .setMessage(
                "${app.name} requires all of the following for the exact APK digest:\n\n" +
                    "• Aarulya source and asset ownership\n" +
                    "• Pinned release-signing public key\n" +
                    "• APK package, version, digest and signer verification\n" +
                    "• Permission and privacy review\n" +
                    "• Malware, static, dynamic and abuse tests\n" +
                    "• Build provenance and SBOM\n" +
                    "• Signed final evidence report and transparency inclusion\n\n" +
                    "Any missing, expired or mismatched evidence blocks download and install."
            )
            .setPositiveButton("Understood", null)
            .show()
    }

    private fun showProgress(message: String) {
        if (destroyed) return
        val view = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(40), dp(40), dp(40), dp(40))
            setBackgroundColor(Color.rgb(248, 250, 252))
            addView(ImageView(this@MainActivity).apply {
                setImageResource(R.drawable.ic_aarulya_mark)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "Aarulya Store logo"
            }, LinearLayout.LayoutParams(dp(82), dp(82)))
            addView(ProgressBar(this@MainActivity).apply {
                isIndeterminate = true
                contentDescription = "Loading"
            }, LinearLayout.LayoutParams(dp(42), dp(42)).apply { topMargin = dp(24) })
            addView(TextView(this@MainActivity).apply {
                text = message
                textSize = 16f
                gravity = Gravity.CENTER
                setTextColor(Color.rgb(71, 85, 105))
                includeFontPadding = false
                setPadding(0, dp(18), 0, 0)
            })
        }
        setContentViewSmooth(view)
    }

    private fun setContentViewSmooth(view: View) {
        if (destroyed) return
        view.alpha = 0f
        setContentView(view)
        view.animate().alpha(1f).setDuration(160L).start()
    }

    private fun onUi(action: () -> Unit) {
        if (destroyed) return
        runOnUiThread {
            if (!destroyed && !isFinishing && !isDestroyed) action()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun safeError(error: Throwable): String = (error.message ?: error.javaClass.simpleName)
        .replace(Regex("[\\r\\n\\t]+"), " ")
        .take(180)
}
