# Flutter Android Gradle Migration Guide

**Version:** 17.6.0  
**Applies to:** Any Flutter project created before Flutter 3.22 (or upgraded to Flutter 3.22+)

---

## Why this happens

Flutter 3.22 dropped support for the old imperative Gradle plugin format. Projects scaffolded with an older Flutter version (or older `ai-gov project init`) contain three deprecated patterns that now cause hard build failures:

| Deprecated pattern | Error it causes |
|--------------------|-----------------|
| `apply from: ".../app_plugin_loader.gradle"` in `settings.gradle` | `You are applying Flutter's app_plugin_loader Gradle plugin imperatively` |
| `apply plugin: 'dev.flutter.flutter-gradle-plugin'` in `app/build.gradle` | `Failed to apply plugin 'dev.flutter.flutter-gradle-plugin'` |
| `classpath 'com.android.tools.build:gradle:<version>'` in root `build.gradle` | AGP version conflict with Flutter's minimum |

All three are fixed together by migrating to the **declarative plugins block** format. New projects created with `ai-gov project init --type flutter` (v17.6.0+) get the correct format from day one.

---

## Version compatibility matrix

| Component | Minimum | Recommended | Where it lives |
|-----------|---------|-------------|----------------|
| Gradle | 8.7.0 | **8.10.2** | `gradle/wrapper/gradle-wrapper.properties` |
| Android Gradle Plugin (AGP) | 8.1.1 | **8.6.1** | `settings.gradle` plugins block |
| Kotlin Android plugin | 1.8.22 | **2.1.0** | `settings.gradle` plugins block |
| Java | 17 | **17** | `app/build.gradle` compileOptions |
| compileSdk | 34 | **35** | `app/build.gradle` (via `flutter.compileSdkVersion`) |
| minSdk | 21 | **23** | `app/build.gradle` (via `flutter.minSdkVersion`) |

---

## Step-by-step migration

### Step 1 — `android/gradle/wrapper/gradle-wrapper.properties`

Replace the `distributionUrl` line:

```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-all.zip
```

### Step 2 — `android/settings.gradle`

Replace the entire file:

```gradle
pluginManagement {
    def flutterSdkPath = {
        def properties = new Properties()
        file("local.properties").withInputStream { properties.load(it) }
        def flutterSdkPath = properties.getProperty("flutter.sdk")
        assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
        flutterSdkPath
    }()
    settings.ext.flutterSdkPath = flutterSdkPath

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.6.1" apply false
    id "org.jetbrains.kotlin.android" version "2.1.0" apply false
}

include ":app"
```

**What changed:**
- `apply from: ".../app_plugin_loader.gradle"` → `includeBuild(...)` inside `pluginManagement {}`
- AGP and Kotlin are now declared in `plugins {}`, not in a `buildscript { dependencies { classpath } }` block

### Step 3 — `android/build.gradle`

Replace the entire file:

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.buildDir = "../build"
subprojects {
    project.buildDir = "${rootProject.buildDir}/${project.name}"
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register("clean", Delete) {
    delete rootProject.buildDir
}
```

**What changed:** The `buildscript { dependencies { classpath 'com.android.tools.build:gradle:...' } }` block is completely removed. AGP is now declared in `settings.gradle`.

### Step 4 — `android/app/build.gradle`

Replace the top section (everything before `android {`) with a `plugins {}` block:

```gradle
plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

android {
    namespace "com.yourcompany.yourapp"      // keep your existing value
    compileSdk flutter.compileSdkVersion
    ndkVersion flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId "com.yourcompany.yourapp"  // keep your existing value
        minSdk flutter.minSdkVersion
        targetSdk flutter.targetSdkVersion
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}

flutter {
    source "../.."
}
```

**What changed:**
- `apply plugin: 'com.android.application'` and similar → `plugins { id "..." }` block at the top
- `def localProperties = new Properties()` block → removed entirely
- `def flutterRoot = localProperties.getProperty(...)` block → removed entirely
- `apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"` → `id "dev.flutter.flutter-gradle-plugin"` in plugins block

### Step 5 — Clean and rebuild

```bash
cd <your-project>/android
./gradlew clean

cd ..
flutter clean
flutter pub get
flutter run
```

---

## Error → fix mapping

| Error message | Root cause | Fix |
|---------------|------------|-----|
| `You are applying Flutter's app_plugin_loader Gradle plugin imperatively` | `settings.gradle` uses `apply from:` | Step 2 above |
| `Failed to apply plugin 'dev.flutter.flutter-gradle-plugin'` | `app/build.gradle` uses `apply plugin:` | Step 4 above |
| `Android Gradle Plugin version (X) is lower than Flutter's minimum` | AGP version in old `buildscript` block | Steps 2 + 3 |
| `Gradle version (8.4.0) will soon be dropped` | Wrapper pinned to old Gradle | Step 1 above |
| `Starting AGP 9+, only the new DSL interface will be read` | Mix of old format + new AGP | All four steps |

---

## How `ai-gov project init` prevents this

Projects created with `ai-gov project init --type flutter` (v17.6.0+) generate all four Android files in the declarative format with pinned versions from the `ANDROID_VERSIONS` constants in `src/stacks/flutter/templates/dart-android.ts`:

```typescript
export const ANDROID_VERSIONS = {
  gradle:     '8.10.2',
  agp:        '8.6.1',
  kotlin:     '2.1.0',
  compileSdk: 35,
  minSdk:     23,
  targetSdk:  35,
  java:       'VERSION_17',
} as const;
```

When Flutter raises its minimum requirements, update these constants in one place and all future scaffolds get the new versions automatically.

---

## FVM version pinning

Using FVM ensures the Flutter version that created the project is always the one that builds it. The Flutter adapter's `postSetup` runs:

```bash
fvm use <version> --force   # writes .fvmrc
fvm flutter pub get
```

Always use `fvm flutter run` / `fvm flutter build` instead of the system `flutter` command in FVM-pinned projects.

```bash
# Check your pinned version
cat .fvmrc

# Install it if not already cached
fvm install

# Build
fvm flutter build apk --release
```

---

## Checklist — migrating an existing project

- [ ] Update `gradle-wrapper.properties` → Gradle 8.10.2
- [ ] Replace `settings.gradle` with declarative `pluginManagement + plugins` format
- [ ] Replace root `build.gradle` — remove `buildscript` block
- [ ] Replace `app/build.gradle` top section — remove `apply plugin:` and `def localProperties` blocks
- [ ] Run `./gradlew clean && flutter clean && flutter pub get`
- [ ] Verify `flutter run` succeeds on a connected device/emulator
- [ ] Commit all four changed files together: `chore: migrate Android Gradle to declarative format`
