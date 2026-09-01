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
                add(
                    StoreApp(
                        id = id,
                        name = item.getString("name"),
                        category = item.optString("category", "Apps"),
                        summary = item.optString("description", "Aarulya application"),
                        packageId = packageId,
                        ageLabel = item.optString("age", "Not rated"),
                        sizeLabel = "Release size pending verification",
                        trustLabel = if (status == "published") {
                            "Published record; release proof checked at download"
                        } else {
                            "No verified public release"
                        },
                        statusLabel = status,
                        featured = false,
                        versionCode = null,
                        verifiedReleaseAvailable = false,
                        source = "authenticated-api"
                    )
                )
            }
        }
        StoreCatalog.replaceAuthenticatedRemoteCatalog(result)
        return result
    }
}
