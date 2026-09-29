package com.aarulya.store.catalog

import com.aarulya.store.api.StoreApiClient
import com.aarulya.store.auth.StoreSession

class RemoteCatalogRepository(private val api: StoreApiClient = StoreApiClient()) {
    fun refresh(session: StoreSession): List<StoreApp> {
        require(session.isUsable()) { "usable-session-required" }
        val response = api.getCatalog(session.accessToken)
        val apps = response.optJSONArray("apps") ?: error("catalog-apps-array-required")
        val result = buildList {
            for (index in 0 until apps.length()) {
                val item = apps.getJSONObject(index)
                val id = item.getString("id")
                val packageId = item.getString("packageId")
                require(packageId.matches(Regex("^com\\.aarulya(?:\\.[a-z][a-z0-9_]*)+$"))) {
                    "non-aarulya-package-rejected"
                }
                val status = item.optString("status", "unknown")
                val latestVersionCode = item.optLong("latestVersionCode", 0L).takeIf { it > 0L }
                val apkSizeBytes = item.optLong("apkSizeBytes", 0L).takeIf { it > 0L }
                val evidenceStatus = item.optString("evidenceStatus", "not-published")
                val releaseAvailable =
                    status == "published" &&
                        latestVersionCode != null &&
                        evidenceStatus == "release-envelope-required-at-download"
                add(
                    StoreApp(
                        id = id,
                        name = item.getString("name"),
                        category = item.optString("category", "Apps"),
                        summary = item.optString("description", "Aarulya application"),
                        packageId = packageId,
                        ageLabel = item.optString("age", "Not rated"),
                        sizeLabel = apkSizeBytes?.let(::formatBytes) ?: "Release size pending verification",
                        trustLabel = if (releaseAvailable) {
                            "Published safe release; cryptographic proof is rechecked at download"
                        } else {
                            "No verified public release"
                        },
                        statusLabel = status,
                        featured = false,
                        versionCode = latestVersionCode,
                        verifiedReleaseAvailable = releaseAvailable,
                        source = "authenticated-api"
                    )
                )
            }
        }
        StoreCatalog.replaceAuthenticatedRemoteCatalog(result)
        return result
    }

    private fun formatBytes(bytes: Long): String = when {
        bytes >= 1024L * 1024L * 1024L -> String.format("%.1f GB", bytes.toDouble() / (1024L * 1024L * 1024L))
        bytes >= 1024L * 1024L -> String.format("%.1f MB", bytes.toDouble() / (1024L * 1024L))
        bytes >= 1024L -> String.format("%.1f KB", bytes.toDouble() / 1024L)
        else -> "$bytes B"
    }
}
