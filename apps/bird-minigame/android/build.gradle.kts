plugins { alias(libs.plugins.android.application) }

val prepareBirdAssets by tasks.registering(Exec::class) {
    workingDir = projectDir.parentFile
    commandLine(providers.environmentVariable("BIRD_NODE").getOrElse("node"), "scripts/build-app.mjs")
}
val syncBirdAssets by tasks.registering(Sync::class) {
    dependsOn(prepareBirdAssets)
    from(projectDir.parentFile.resolve("dist")) {
        include("index.html", "src/**", "rules/**", "assets/scenery/**")
        include("assets/candidates/shape-preserving-20260905/**")
        include("assets/candidates/second-bird-20260906/*.png")
        include("assets/candidates/all-birds-20260906/*.png")
    }
    into(layout.buildDirectory.dir("generated/assets/game"))
}
android {
    namespace = "org.shineaac.birdgarden"
    compileSdk = 36
    buildFeatures { buildConfig = true }
    defaultConfig {
        applicationId = "org.shineaac.birdgarden"
        minSdk = 25
        targetSdk = 36
        versionCode = 4
        versionName = "0.1.3-poc"
    }
    sourceSets.getByName("main").assets.srcDir(layout.buildDirectory.dir("generated/assets"))
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
}
tasks.named("preBuild") { dependsOn(syncBirdAssets) }
