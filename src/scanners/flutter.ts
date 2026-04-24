import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { pubspecHas, fileExists, readFileSafe } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanFlutter(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Flutter details');

    // FVM
    if (fileExists(projectDir, '.fvmrc') || fileExists(projectDir, '.fvm', 'fvm_config.json')) {
        scan.detectedFVM = true;
        profile.formatCmd = 'fvm dart format'; profile.formatCmdFull = 'fvm dart format lib/';
        profile.analyzeCmd = 'fvm dart analyze'; profile.analyzeCmdFile = 'fvm dart analyze';
        profile.testCmd = 'fvm flutter test'; profile.buildCmd = 'fvm flutter build apk';
        profile.installCmd = 'fvm flutter pub get'; profile.cleanCmd = 'fvm flutter clean';
        profile.runCmd = 'fvm flutter run';
        log.detected('FVM detected');
    }

    // State management
    if (pubspecHas(projectDir, 'flutter_riverpod') || pubspecHas(projectDir, 'riverpod')) {
        scan.detectedState = 'Riverpod'; profile.stateFramework = 'Riverpod';
        profile.diFramework = 'Riverpod (ProviderScope)';
        profile.statePattern = 'AsyncNotifier / Notifier: AsyncValue<T> — loading / data / error';
        profile.layerFlow = 'Widget → Notifier → UseCase → Repository → Service';
        profile.layerNames = ['Widget', 'Notifier', 'UseCase', 'Repository', 'Service'];
        profile.layerState = 'Notifier'; log.detected('State: Riverpod');
    } else if (pubspecHas(projectDir, 'flutter_bloc') || pubspecHas(projectDir, 'bloc')) {
        scan.detectedState = 'BLoC'; profile.stateFramework = 'flutter_bloc / Cubit';
        profile.statePattern = 'Cubit emits: Initial | Loading | Success(data) | Error(message)';
        log.detected('State: flutter_bloc');
    } else if (pubspecHas(projectDir, 'provider')) {
        scan.detectedState = 'Provider'; profile.stateFramework = 'Provider + ChangeNotifier';
        profile.statePattern = 'ChangeNotifier: bool isLoading, T? data, String? error + notifyListeners()';
        profile.layerFlow = 'Widget → ChangeNotifier → Repository → Service';
        profile.layerNames = ['Widget', 'ChangeNotifier', 'Repository', 'Service'];
        profile.layerState = 'ChangeNotifier'; log.detected('State: Provider');
    } else if (pubspecHas(projectDir, 'get')) {
        scan.detectedState = 'GetX'; profile.stateFramework = 'GetX';
        profile.statePattern = 'GetxController: .obs variables, RxStatus';
        profile.layerFlow = 'View → GetxController → Repository → Service';
        profile.layerNames = ['View', 'GetxController', 'Repository', 'Service'];
        profile.layerUI = 'View'; profile.layerState = 'GetxController'; log.detected('State: GetX');
    }

    // DI
    if (pubspecHas(projectDir, 'injectable')) {
        profile.diFramework = 'get_it + injectable'; log.detected('DI: injectable');
    } else if (pubspecHas(projectDir, 'get_it') && scan.detectedState !== 'Riverpod') {
        profile.diFramework = 'get_it'; log.detected('DI: get_it');
    }

    // Router
    if (pubspecHas(projectDir, 'go_router')) { scan.detectedRouter = 'go_router'; log.detected('Router: go_router'); }
    else if (pubspecHas(projectDir, 'auto_route')) { scan.detectedRouter = 'auto_route'; log.detected('Router: auto_route'); }
    else if (pubspecHas(projectDir, 'beamer')) { scan.detectedRouter = 'beamer'; log.detected('Router: beamer'); }

    // Network
    if (pubspecHas(projectDir, 'dio')) { scan.detectedNetwork = 'Dio'; log.detected('Network: Dio'); }
    else if (pubspecHas(projectDir, 'chopper')) { scan.detectedNetwork = 'Chopper'; log.detected('Network: Chopper'); }
    else if (pubspecHas(projectDir, 'http')) { scan.detectedNetwork = 'http'; log.detected('Network: http'); }
    else if (pubspecHas(projectDir, 'retrofit')) { scan.detectedNetwork = 'retrofit'; log.detected('Network: retrofit'); }

    // Local DB
    if (pubspecHas(projectDir, 'isar')) { scan.detectedLocalDB = 'Isar'; log.detected('DB: Isar'); }
    else if (pubspecHas(projectDir, 'drift')) { scan.detectedLocalDB = 'Drift'; log.detected('DB: Drift'); }
    else if (pubspecHas(projectDir, 'hive_flutter') || pubspecHas(projectDir, 'hive')) { scan.detectedLocalDB = 'Hive'; log.detected('DB: Hive'); }
    else if (pubspecHas(projectDir, 'sqflite')) { scan.detectedLocalDB = 'sqflite'; log.detected('DB: sqflite'); }

    // Code gen
    const codegenPkgs: string[] = [];
    if (pubspecHas(projectDir, 'freezed')) { codegenPkgs.push('freezed'); profile.generatedPatterns += ' *.freezed.dart'; }
    if (pubspecHas(projectDir, 'json_serializable')) { codegenPkgs.push('json_serializable'); profile.generatedPatterns += ' *.g.dart'; }
    if (pubspecHas(projectDir, 'injectable_generator')) codegenPkgs.push('injectable_generator');
    if (codegenPkgs.length > 0) {
        scan.detectedCodegen = true;
        const base = scan.detectedFVM ? 'fvm flutter pub run build_runner build --delete-conflicting-outputs'
            : 'flutter pub run build_runner build --delete-conflicting-outputs';
        scan.detectedCodegenCmd = base; profile.codegenCmd = base;
        log.detected(`Code gen: ${codegenPkgs.join(', ')}`);
    }

    // i18n
    if (pubspecHas(projectDir, 'easy_localization')) { scan.detectedI18N = 'easy_localization'; log.detected('i18n: easy_localization'); }
    if (pubspecHas(projectDir, 'flutter_localizations') || pubspecHas(projectDir, 'intl')) {
        scan.detectedI18N = scan.detectedI18N || 'flutter_localizations';
    }

    // Mason
    if (fileExists(projectDir, 'mason.yaml')) {
        scan.detectedMason = true; scan.scaffoldTool = 'Mason';
        scan.scaffoldCmdFeature = 'mason make clean_feature'; log.detected('Mason detected');
    }

    // Flavors
    let gradleFile = join(projectDir, 'android', 'app', 'build.gradle');
    if (!existsSync(gradleFile)) gradleFile = join(projectDir, 'android', 'app', 'build.gradle.kts');
    if (existsSync(gradleFile)) {
        const gc = readFileSafe(gradleFile);
        if (gc.includes('productFlavors')) {
            const flavors = [...gc.matchAll(/create\("([a-zA-Z]+)"\)/g)].map(m => m[1]).slice(0, 5).join(',');
            if (flavors) { scan.detectedFlavors = flavors; log.detected(`Flavors: ${flavors}`); }
        }
    }

    // Source dir
    for (const c of ['lib/features', 'lib/modules', 'lib/pages', 'lib/screens']) {
        if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; log.detected(`Source dir: ${profile.sourceDir}`); break; }
    }

    // Error pattern
    if (pubspecHas(projectDir, 'either_dart')) {
        profile.errorPattern = 'Either<ServerError, T> from either_dart — Left(error) / Right(data)';
    } else if (pubspecHas(projectDir, 'dartz')) {
        profile.errorPattern = 'Either<Failure, T> from dartz — Left(failure) / Right(data)';
    } else if (pubspecHas(projectDir, 'fpdart')) {
        profile.errorPattern = 'Either<Failure, T> from fpdart — Left(failure) / Right(data)';
    }

    // High-risk
    scan.highRiskFiles.push('main.dart');
    if (fileExists(projectDir, 'lib', 'app.dart')) scan.highRiskFiles.push('app.dart');
}
