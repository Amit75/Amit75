package com.aarulya.store.catalog

data class StoreApp(
    val id: String,
    val name: String,
    val category: String,
    val summary: String,
    val packageId: String,
    val ageLabel: String,
    val sizeLabel: String,
    val trustLabel: String,
    val statusLabel: String,
    val featured: Boolean = false,
    val versionCode: Long? = null,
    val verifiedReleaseAvailable: Boolean = false,
    val source: String = "planned-source-record"
)

object StoreCatalog {
    private val plannedApps = listOf(
        StoreApp("store", "Aarulya Store", "Apps", "Verified Aarulya apps, secure updates and privacy-first installation.", "com.aarulya.store", "Everyone", "Target pending", "Verification pending", "In development", true),
        StoreApp("saathi", "Aarulya Saathi", "AI & Productivity", "Personal work, files, projects, research and safe actions in one assistant.", "com.aarulya.saathi", "Teen+", "Target pending", "Evidence required", "Planned", true),
        StoreApp("play", "Aarulya Play", "Games", "Original family games, short battles, rewards and child-safe play modes.", "com.aarulya.play", "Family", "Target pending", "Evidence required", "Source foundation", true),
        StoreApp("photo", "Aarulya Photo", "Photo & Video", "Photo editing, background tools, resize, compress and export workflows.", "com.aarulya.photo", "Everyone", "Target pending", "Evidence required", "Planned"),
        StoreApp("docs", "Aarulya Docs", "Documents & PDF", "Scan, create, convert, sign and organize documents with privacy controls.", "com.aarulya.docs", "Everyone", "Target pending", "Evidence required", "Planned"),
        StoreApp("browser", "Aaru Browser", "Internet", "Privacy-first browsing, safe downloads and Aarulya search integration.", "com.aarulya.browser", "Teen+", "Target pending", "Critical review", "Planned"),
        StoreApp("learning", "Aarulya Learning", "Student & Learning", "Hindi and English learning, practice, exams and child-safe lessons.", "com.aarulya.learning", "Family", "Offline packs planned", "Evidence required", "Planned"),
        StoreApp("kisan", "Aarulya Kisan", "Farmer", "Farm records, crop planning, expenses, reminders and local-language help.", "com.aarulya.kisan", "Everyone", "Low-data target", "Evidence required", "Planned"),
        StoreApp("business", "Aarulya Business", "Business", "Invoice, expenses, customers, stock and small-business workflows.", "com.aarulya.business", "Everyone", "Target pending", "Evidence required", "Planned"),
        StoreApp("books", "Aarulya Books", "Books", "Original, licensed and verified public-domain books with offline reading.", "com.aarulya.books", "Family", "Offline reading planned", "Rights evidence required", "Planned"),
        StoreApp("cinema", "Aarulya Cinema", "Cinema & Media", "Original and licensed video, regional stories and family-safe viewing.", "com.aarulya.cinema", "Family", "Adaptive-data target", "Rights evidence required", "Planned"),
        StoreApp("sentinel", "Aarulya Sentinel", "Safety", "Evidence, alerts, fraud checks and defensive security workflows.", "com.aarulya.sentinel", "Adult", "Target pending", "Critical review", "Planned"),
        StoreApp("cloud", "Aarulya Cloud", "Cloud", "Owner-controlled files, backups and governed cloud services.", "com.aarulya.cloud", "Teen+", "Target pending", "Critical review", "Planned")
    )

    @Volatile
    private var authenticatedRemoteApps: List<StoreApp>? = null

    val topTabs: List<String> = listOf("For You", "Top Charts", "Kids", "Categories")
    val bottomDestinations: List<String> = listOf("Games", "Apps", "Search", "Books", "You")
    val categories: List<String> = listOf(
        "Apps", "Games", "AI & Productivity", "Photo & Video", "Documents & PDF",
        "Student & Learning", "Farmer", "Business", "Books", "Cinema & Media",
        "Safety", "Cloud", "Internet"
    )

    private fun snapshot(): List<StoreApp> = authenticatedRemoteApps ?: plannedApps

    @Synchronized
    fun replaceAuthenticatedRemoteCatalog(apps: List<StoreApp>) {
        require(apps.distinctBy { it.id }.size == apps.size) { "duplicate-app-id" }
        require(apps.distinctBy { it.packageId }.size == apps.size) { "duplicate-package-id" }
        require(apps.all { it.packageId.matches(Regex("^com\\.aarulya(?:\\.[a-z][a-z0-9_]*)+$")) }) {
            "non-aarulya-package-rejected"
        }
        require(apps.all { it.source == "authenticated-api" }) { "authenticated-api-source-required" }
        authenticatedRemoteApps = apps.toList()
    }

    @Synchronized
    fun clearAuthenticatedRemoteCatalog() {
        authenticatedRemoteApps = null
    }

    fun all(): List<StoreApp> = snapshot()

    fun featured(): List<StoreApp> = snapshot().filter { it.featured }

    fun kids(): List<StoreApp> = snapshot().filter { it.ageLabel == "Family" || it.ageLabel == "Everyone" }

    fun verifiedTopCharts(): List<StoreApp> = emptyList()

    fun forBottomDestination(destination: String): List<StoreApp> = when (destination) {
        "Games" -> snapshot().filter { it.category == "Games" }
        "Books" -> snapshot().filter { it.category == "Books" }
        "Apps" -> snapshot().filterNot { it.category in setOf("Games", "Books", "Cinema & Media") }
        else -> snapshot()
    }

    fun search(query: String, category: String? = null): List<StoreApp> {
        val normalized = query.trim().lowercase()
        return snapshot().filter { app ->
            val categoryMatch = category.isNullOrBlank() || app.category == category
            val queryMatch = normalized.isBlank() || listOf(app.name, app.category, app.summary, app.packageId)
                .joinToString(" ")
                .lowercase()
                .contains(normalized)
            categoryMatch && queryMatch
        }
    }

    fun byId(id: String): StoreApp? = snapshot().firstOrNull { it.id == id }
}
