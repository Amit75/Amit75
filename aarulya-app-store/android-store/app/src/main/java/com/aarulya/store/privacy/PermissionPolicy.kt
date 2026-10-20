package com.aarulya.store.privacy

import android.Manifest

private const val POST_NOTIFICATIONS_PERMISSION = "android.permission.POST_NOTIFICATIONS"
private const val ACCESS_BACKGROUND_LOCATION_PERMISSION = "android.permission.ACCESS_BACKGROUND_LOCATION"
private const val MANAGE_EXTERNAL_STORAGE_PERMISSION = "android.permission.MANAGE_EXTERNAL_STORAGE"

/**
 * Permissions are requested only after an explicit user action.
 * The Store itself does not request camera, microphone, contacts, location,
 * SMS, call-log or broad storage access.
 */
enum class PermissionPurpose(
    val permission: String?,
    val runtimePrompt: Boolean,
    val requiredForCoreStore: Boolean
) {
    INTERNET(null, runtimePrompt = false, requiredForCoreStore = true),
    INSTALL_VERIFIED_APK(Manifest.permission.REQUEST_INSTALL_PACKAGES, runtimePrompt = false, requiredForCoreStore = false),
    UPDATE_NOTIFICATIONS(POST_NOTIFICATIONS_PERMISSION, runtimePrompt = true, requiredForCoreStore = false)
}

data class PermissionExplanation(
    val purpose: PermissionPurpose,
    val title: String,
    val reason: String,
    val deniedBehavior: String,
    val canAskAgain: Boolean
)

object StorePermissionPolicy {
    val prohibitedPermissions = setOf(
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.WRITE_CONTACTS,
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.ACCESS_FINE_LOCATION,
        ACCESS_BACKGROUND_LOCATION_PERMISSION,
        Manifest.permission.READ_SMS,
        Manifest.permission.SEND_SMS,
        Manifest.permission.READ_CALL_LOG,
        Manifest.permission.WRITE_CALL_LOG,
        MANAGE_EXTERNAL_STORAGE_PERMISSION,
        Manifest.permission.SYSTEM_ALERT_WINDOW
    )

    fun validateDeclaredPermissions(declared: Set<String>): List<String> {
        val errors = mutableListOf<String>()
        val prohibited = declared.intersect(prohibitedPermissions)
        prohibited.forEach { errors += "prohibited-store-permission:$it" }
        if (Manifest.permission.REQUEST_INSTALL_PACKAGES !in declared) {
            errors += "installer-permission-missing"
        }
        return errors
    }
}
