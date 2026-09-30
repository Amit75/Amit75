package com.aarulya.store.privacy

data class AppPrivacyControl(
    val appId: String,
    val displayName: String,
    val cloudSyncEnabled: Boolean,
    val analyticsEnabled: Boolean,
    val notificationsEnabled: Boolean,
    val dataExportAvailable: Boolean,
    val deletionAvailable: Boolean
)

data class PrivacyCenterState(
    val controls: List<AppPrivacyControl>,
    val personalizedAdsEnabled: Boolean = false,
    val crossAppTrackingEnabled: Boolean = false,
    val consentVersion: String,
    val lastReviewedAt: String? = null
) {
    init {
        require(!crossAppTrackingEnabled) { "Cross-app tracking is prohibited by default." }
    }
}
