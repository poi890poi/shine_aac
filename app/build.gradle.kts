import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

val releaseProperties = Properties().apply {
    rootProject.file("version.properties").inputStream().use { load(it) }
}
val shineVersionName = releaseProperties.getProperty("versionName")
val shineVersionCode = releaseProperties.getProperty("versionCode").toInt()
val keystorePropertiesPath = providers.gradleProperty("shineAacKeystoreProperties")
    .orElse(providers.environmentVariable("SHINE_AAC_KEYSTORE_PROPERTIES"))
    .orNull
val keystorePropertiesFile = keystorePropertiesPath
    ?.let { rootProject.file(it) }
    ?: rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.isFile) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}
fun keystoreProperty(name: String): String? =
    keystoreProperties.getProperty(name)?.takeIf { it.isNotBlank() }
val hasReleaseSigning = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
    .all { !keystoreProperty(it).isNullOrBlank() }

val syncWebAssets by tasks.registering(Exec::class) {
    workingDir = rootProject.projectDir
    commandLine("node", "scripts/build-webview-assets.mjs")
}

android {
    namespace = "org.shineaac.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "org.shineaac.app"
        minSdk = 25
        targetSdk = 36
        versionCode = shineVersionCode
        versionName = shineVersionName

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(keystoreProperty("storeFile")!!)
                storePassword = keystoreProperty("storePassword")
                keyAlias = keystoreProperty("keyAlias")
                keyPassword = keystoreProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    sourceSets {
        getByName("main") {
            assets.srcDir(layout.buildDirectory.dir("generated/assets/shineWeb"))
        }
    }
    androidResources {
        noCompress += "m4a"
    }
    bundle {
        language {
            enableSplit = false
        }
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {

    implementation(project(":android-inputs"))
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.preference.ktx)
    implementation(libs.androidx.work.runtime)
    implementation(libs.material)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}
