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
    val featured: Boolean = false
)

object StoreCatalog {
    private val apps = listOf(
        StoreApp("store", "Aarulya Store", "Apps", "Verified Aarulya apps, secure updates and privacy-first installation.", "com.aarulya.store", "Everyone", "18 MB target", "Aarulya Verified", "In development", true),
        StoreApp("saathi", "Aarulya Saathi", "AI & Productivity", "Personal work, files, projects, research and safe actions in one assistant.", "com.aarulya.saathi", "Teen+", "Lite target", "Evidence required", "Planned", true),
        StoreApp("play", "Aarulya Play", "Games", "Original family games, short battles, rewards and child-safe play modes.", "com.aarulya.play", "Family", "Low-data target", "Evidence required", "Foundation ready", true),
        StoreApp("photo", "Aarulya Photo", "Photo & Video", "Photo editing, background tools, resize, compress and export workflows.", "com.aarulya.photo", "Everyone", "Optimized", "Evidence required", "Planned"),
        StoreApp("docs", "Aarulya Docs", "Documents", "Scan, create, convert, sign and organize documents with privacy controls.", "com.aarulya.docs", "Everyone", "Offline-first", "Evidence required", "Planned"),
        StoreApp("browser", "Aaru Browser", "Internet", "Privacy-first browsing, safe downloads and Aarulya search integration.", "com.aarulya.browser", "Teen+", "Lite target", "Critical review", "Planned"),
        StoreApp("learning", "Aarulya Learning", "Education", "Hindi and English learning, practice, exams and child-safe lessons.", "com.aarulya.learning", "Family", "Offline packs", "Evidence required", "Planned"),
        StoreApp("kisan", "Aarulya Kisan", "Agriculture", "Farm records, crop planning, expenses, reminders and local-language help.", "com.aarulya.kisan", "Everyone", "Low-data", "Evidence required", "Planned"),
        StoreApp("business", "Aarulya Business", "Business", "Invoice, expenses, customers, stock and small-business workflows.", "com.aarulya.business", "Everyone", "Lite target", "Evidence required", "Planned"),
        StoreApp("books", "Aarulya Books", "Books", "Original, licensed and public-domain books with offline reading.", "com.aarulya.books", "Family", "Offline reading", "Rights verified", "Planned"),
        StoreApp("cinema", "Aarulya Cinema", "Entertainment", "Original and licensed video, regional stories and family-safe viewing.", "com.aarulya.cinema", "Family", "Adaptive data", "Rights verified", "Planned"),
        StoreApp("sentinel", "Aarulya Sentinel", "Safety", "Evidence, alerts, fraud checks and defensive security workflows.", "com.aarulya.sentinel", "Adult", "Secure", "Critical review", "Planned")
    )

    val categories: List<String> = listOf("For You", "Apps", "Games", "Education", "Photo & Video", "Documents", "Agriculture", "Business", "Books", "Safety")

    fun featured(): List<StoreApp> = apps.filter { it.featured }

    fun search(query: String, category: String? = null): List<StoreApp> {
        val normalized = query.trim().lowercase()
        return apps.filter { app ->
            val categoryMatch = category.isNullOrBlank() || category == "For You" || app.category == category
            val queryMatch = normalized.isBlank() || listOf(app.name, app.category, app.summary, app.packageId)
                .joinToString(" ")
                .lowercase()
                .contains(normalized)
            categoryMatch && queryMatch
        }
    }

    fun byId(id: String): StoreApp? = apps.firstOrNull { it.id == id }
}
