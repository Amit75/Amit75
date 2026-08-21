package com.aarulya.store.install

import android.app.Activity
import com.aarulya.store.api.StoreApiClient
import com.aarulya.store.auth.StoreSession
import com.aarulya.store.download.SecureApkDownloader
import com.aarulya.store.security.ReleaseEnvelopeVerifier

sealed interface InstallFlowResult {
    data class InstallPermissionRequired(val packageId: String, val versionCode: Long) : InstallFlowResult
    data class SessionCommitted(val sessionId: Int, val packageId: String, val versionCode: Long) : InstallFlowResult
}

class StoreInstallCoordinator(
    private val activity: Activity,
    private val api: StoreApiClient = StoreApiClient(),
    private val envelopeVerifier: ReleaseEnvelopeVerifier = ReleaseEnvelopeVerifier(),
    private val downloader: SecureApkDownloader = SecureApkDownloader(activity),
    private val installer: VerifiedPackageInstaller = VerifiedPackageInstaller(activity),
    private val sourceGate: InstallSourceGate = InstallSourceGate(activity)
) {
    /** Must be called from a worker thread after an explicit user press on Install. */
    fun prepareAndInstall(
        session: StoreSession,
        appId: String,
        requestedVersionCode: Long? = null,
        userPressedInstall: Boolean
    ): InstallFlowResult {
        require(session.isUsable()) { "usable-session-required" }
        require(userPressedInstall) { "explicit-user-action-required" }

        val envelope = envelopeVerifier.verify(
            api.getLatestReleaseEnvelope(session.accessToken, appId, requestedVersionCode)
        )
        if (!sourceGate.canInstallPackages()) {
            activity.runOnUiThread { sourceGate.openInstallSourceSettings() }
            return InstallFlowResult.InstallPermissionRequired(envelope.packageId, envelope.versionCode)
        }

        val authorization = api.authorizeDownload(
            accessToken = session.accessToken,
            appId = envelope.appId,
            versionCode = envelope.versionCode
        )
        val downloaded = downloader.download(authorization, envelope)
        try {
            val result = installer.beginInstall(
                apk = downloaded.file,
                expected = ExpectedRelease(
                    packageId = envelope.packageId,
                    versionCode = envelope.versionCode,
                    apkSha256 = envelope.apkSha256,
                    signerCertificateSha256 = envelope.signerCertificateSha256
                ),
                userPressedInstall = true
            ).getOrThrow()
            return InstallFlowResult.SessionCommitted(result, envelope.packageId, envelope.versionCode)
        } finally {
            downloaded.file.delete()
        }
    }
}
