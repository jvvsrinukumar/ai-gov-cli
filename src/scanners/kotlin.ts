import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { gradleHas, fileExists, readFileSafe, countFiles, findFilesRecursive } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanKotlin(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Kotlin/Android details');
    const buildFile = fileExists(projectDir, 'app', 'build.gradle.kts')
        ? join(projectDir, 'app', 'build.gradle.kts')
        : join(projectDir, 'app', 'build.gradle');

    // Source dir
    if (existsSync(join(projectDir, 'app/src/main/kotlin'))) profile.sourceDir = 'app/src/main/kotlin/';
    else if (existsSync(join(projectDir, 'app/src/main/java'))) profile.sourceDir = 'app/src/main/java/';

    // UI system
    const appSrc = join(projectDir, 'app/src');
    const composeCount = existsSync(appSrc)
        ? findFilesRecursive(appSrc, 6, f => f.endsWith('.kt')).filter(f => readFileSafe(f).includes('@Composable')).length : 0;
    if (composeCount > 0) {
        scan.detectedUISystem = 'compose'; profile.layerUI = 'Screen';
        profile.layerFlow = 'Screen → ViewModel → UseCase → Repository → DataSource';
        log.detected(`UI: Jetpack Compose (${composeCount} files)`);
    } else {
        scan.detectedUISystem = 'xml'; profile.layerUI = 'Fragment';
        profile.layerFlow = 'Fragment → ViewModel → UseCase → Repository → DataSource';
        log.detected('UI: XML');
    }

    // DI
    if (gradleHas(projectDir, 'hilt')) { scan.detectedDI = 'Hilt'; profile.diFramework = 'Hilt'; log.detected('DI: Hilt'); }
    else if (gradleHas(projectDir, 'koin')) { scan.detectedDI = 'Koin'; profile.diFramework = 'Koin'; log.detected('DI: Koin'); }
    else if (gradleHas(projectDir, 'dagger')) { scan.detectedDI = 'Dagger'; profile.diFramework = 'Dagger'; log.detected('DI: Dagger'); }

    // State
    const sfCount = existsSync(appSrc) ? findFilesRecursive(appSrc, 6, f => f.endsWith('.kt'))
        .filter(f => /StateFlow|MutableStateFlow/.test(readFileSafe(f))).length : 0;
    const lvCount = existsSync(appSrc) ? findFilesRecursive(appSrc, 6, f => f.endsWith('.kt'))
        .filter(f => /LiveData|MutableLiveData/.test(readFileSafe(f))).length : 0;
    if (sfCount >= lvCount) {
        scan.detectedState = 'StateFlow'; profile.stateFramework = 'ViewModel + StateFlow';
        profile.statePattern = 'Sealed class: Idle | Loading | Success(data) | Error(message)';
        log.detected(`State: StateFlow (${sfCount} files)`);
    } else {
        scan.detectedState = 'LiveData'; profile.stateFramework = 'ViewModel + LiveData';
        profile.statePattern = 'MutableLiveData wrapped in ViewModel';
        log.detected(`State: LiveData (${lvCount} files)`);
    }

    // ORM
    if (gradleHas(projectDir, 'room')) { scan.detectedORM = 'Room'; log.detected('DB: Room'); }
    else if (gradleHas(projectDir, 'realm')) { scan.detectedORM = 'Realm'; log.detected('DB: Realm'); }
    else if (gradleHas(projectDir, 'sqldelight')) { scan.detectedORM = 'SQLDelight'; log.detected('DB: SQLDelight'); }

    // Linter
    if (gradleHas(projectDir, 'detekt')) { scan.detectedLinter = 'detekt'; profile.analyzeCmd = './gradlew detekt'; }
    else if (gradleHas(projectDir, 'ktlint')) { scan.detectedLinter = 'ktlint'; profile.formatCmd = './gradlew ktlintFormat'; }
    else if (gradleHas(projectDir, 'spotless')) { scan.detectedLinter = 'spotless'; profile.formatCmd = './gradlew spotlessApply'; }
    if (scan.detectedLinter) log.detected(`Linter: ${scan.detectedLinter}`);

    // Navigation
    if (gradleHas(projectDir, 'navigation-fragment|navigation.fragment|androidx.navigation')) {
        scan.detectedRouter = 'Navigation Component'; log.detected('Navigation: Navigation Component');
    }

    // WorkManager / Firebase
    if (gradleHas(projectDir, 'work-runtime|work\\.runtime')) { scan.detectedWorkmanager = true; log.detected('WorkManager'); }
    const fb: string[] = [];
    if (gradleHas(projectDir, 'firebase-crashlytics')) fb.push('Crashlytics');
    if (gradleHas(projectDir, 'firebase-analytics')) fb.push('Analytics');
    if (gradleHas(projectDir, 'firebase-messaging')) fb.push('FCM');
    if (gradleHas(projectDir, 'firebase-auth')) fb.push('Auth');
    if (fb.length) { scan.detectedFirebase = fb.join(','); log.detected(`Firebase: ${scan.detectedFirebase}`); }

    // SDK versions
    if (existsSync(buildFile)) {
        const bc = readFileSafe(buildFile);
        const csdk = bc.match(/compileSdk\s*[=:]?\s*(\d+)/)?.[1];
        const msdk = bc.match(/minSdk\s*[=:]?\s*(\d+)/)?.[1];
        if (csdk) { scan.detectedSDKVersions = `compileSdk=${csdk}, minSdk=${msdk ?? '?'}`; log.detected(`SDK: ${scan.detectedSDKVersions}`); }
    }

    // Multi-module
    const modCount = findFilesRecursive(projectDir, 2, f => /build\.gradle/.test(f))
        .filter(f => f !== join(projectDir, 'build.gradle') && f !== join(projectDir, 'build.gradle.kts')).length;
    if (modCount > 2) { scan.detectedMultimodule = true; log.detected(`Multi-module (${modCount} modules)`); }

    // High-risk
    scan.highRiskFiles.push('AndroidManifest.xml');
    if (fileExists(projectDir, 'app', 'build.gradle.kts')) scan.highRiskFiles.push('build.gradle.kts');
    if (fileExists(projectDir, 'app', 'build.gradle')) scan.highRiskFiles.push('build.gradle');

    // Scaffold
    if (fileExists(projectDir, 'plopfile.js') || fileExists(projectDir, 'plopfile.ts')) {
        scan.scaffoldTool = 'Plop'; scan.scaffoldCmdFeature = 'npx plop feature'; log.detected('Scaffold: Plop');
    }
}
