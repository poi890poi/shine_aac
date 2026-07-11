plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

android {
    namespace = "org.shineaac.blinktest"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.shineaac.blinktest"
        minSdk = 25
        targetSdk = 35
        versionCode = 11
        versionName = "0.11.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
}
