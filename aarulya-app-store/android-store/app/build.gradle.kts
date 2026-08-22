plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val trustedReleaseKeyFingerprints = providers.gradleProperty("aarulyaReleaseKeyFingerprints").orElse("")
val releaseStoreFilePath = providers.environmentVariable("AARULYA_ANDROID_SIGNING_STORE_FILE")
val releaseStorePassword = providers.environmentVariable("AARULYA_ANDROID_SIGNING_STORE_PASSWORD")
val releaseKeyAlias = providers.environmentVariable("AARULYA_ANDROID_SIGNING_KEY_ALIAS")
val releaseKeyPassword = providers.environmentVariable("AARULYA_ANDROID_SIGNING_KEY_PASSWORD")

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
        buildConfigField("String", "IDENTITY_ORIGIN", "\"https://identity.aarulya.com\"")
        buildConfigField("String", "OIDC_CLIENT_ID", "\"aarulya-store-android\"")
        buildConfigField("String", "OIDC_REDIRECT_URI", "\"aarulya-store://oauth/callback\"")
        buildConfigField(
            "String",
            "TRUSTED_RELEASE_KEY_FINGERPRINTS",
            "\"${trustedReleaseKeyFingerprints.get().replace("\\", "\\\\").replace("\"", "\\\"")}\""
        )
    }

    signingConfigs {
        create("aarulyaRelease") {
            storeFile = releaseStoreFilePath.orNull?.let(::file)
            storePassword = releaseStorePassword.orNull
            keyAlias = releaseKeyAlias.orNull
            keyPassword = releaseKeyPassword.orNull
            enableV1Signing = false
            enableV2Signing = true
            enableV3Signing = true
        }
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
            signingConfig = signingConfigs.getByName("aarulyaRelease")
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

val validateReleaseTrustRoots by tasks.registering {
    doLast {
        val fingerprints = trustedReleaseKeyFingerprints.get()
            .split(',')
            .map { it.trim().lowercase() }
            .filter { it.isNotBlank() }
        require(fingerprints.isNotEmpty()) {
            "Release build blocked: provide pinned Aarulya release-key SHA-256 fingerprints via -PaarulyaReleaseKeyFingerprints"
        }
        require(fingerprints.all { it.matches(Regex("^[a-f0-9]{64}$")) }) {
            "Release build blocked: every trusted release-key fingerprint must be 64 lowercase hex characters"
        }
    }
}

val validateExternalReleaseSigning by tasks.registering {
    doLast {
        val signingFile = releaseStoreFilePath.orNull?.let(::file)
        require(signingFile?.isFile == true) {
            "Release build blocked: external Aarulya signing store file is missing"
        }
        require(!releaseStorePassword.orNull.isNullOrBlank()) {
            "Release build blocked: signing store password was not injected"
        }
        require(!releaseKeyAlias.orNull.isNullOrBlank()) {
            "Release build blocked: signing key alias was not injected"
        }
        require(!releaseKeyPassword.orNull.isNullOrBlank()) {
            "Release build blocked: signing key password was not injected"
        }
        val repositoryRoot = project.rootDir.canonicalFile.toPath()
        val signingPath = signingFile.canonicalFile.toPath()
        require(!signingPath.startsWith(repositoryRoot)) {
            "Release build blocked: signing material must remain outside the repository"
        }
    }
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateReleaseTrustRoots, validateExternalReleaseSigning)
}
