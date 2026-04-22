plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.google.dagger.hilt.android")
}

android {
    compileSdk = 34
    defaultConfig {
        applicationId = "com.example.testapp"
        minSdk = 26
    }
}

dependencies {
    implementation("com.google.dagger:hilt-android:2.48")
    implementation("androidx.room:room-runtime:2.6.0")
    implementation("com.google.firebase:firebase-crashlytics:18.6.0")
    implementation("com.google.firebase:firebase-analytics:21.5.0")
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("io.github.raamcosta.compose-destinations:core:1.9.0")
    implementation("com.jakewharton.retrofit:retrofit2-kotlinx-serialization-converter:1.0.0")
}
