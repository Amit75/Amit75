plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.aarulya.store"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.aarulya.store"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField("String", "STORE_ORIGIN", "\"https://store.aarulya.com\"")
        buildConfigField("String", "API_BASE_URL", "\"https://api.store.aarulya.com/v1\"")
        buildConfigField("String", "DOWNLOAD_BASE_URL", "\"https://downloads.store.aarulya.com\"")
        buildConfigField("String", "EVIDENCE_BASE_URL", "\"https://evidence.store.aarulya.com\"")
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isDebuggable = false
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        buildConfig = true
    }

    lint {
        abortOnError = true
        checkReleaseBuilds = true
        warningsAsErrors = true
    }

    packaging {
        resources.excludes += setOf(
            "META-INF/DEPENDENCIES",
            "META-INF/LICENSE*",
            "META-INF/NOTICE*"
        )
    }
}
