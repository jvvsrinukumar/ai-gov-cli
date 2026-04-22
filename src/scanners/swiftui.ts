import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { swiftPkgHas, fileExists, findFilesRecursive, readFileSafe } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanSwiftUI(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('SwiftUI details');

    // Dep manager
    if (fileExists(projectDir, 'Package.swift')) { scan.detectedDepManagerSwift = 'SPM'; log.detected('Dep: SPM'); }
    else if (fileExists(projectDir, 'Podfile')) { scan.detectedDepManagerSwift = 'CocoaPods'; profile.installCmd = 'pod install'; log.detected('Dep: CocoaPods'); }

    // TCA
    if (swiftPkgHas(projectDir, 'swift-composable-architecture|ComposableArchitecture')) {
        scan.detectedTCA = true; profile.stateFramework = 'TCA';
        profile.statePattern = '@Reducer struct Feature { @ObservableState struct State; enum Action; var body: some ReducerOf<Self> }';
        profile.layerFlow = 'View → Store<Feature> → Reducer → Effect → DataSource';
        profile.layerNames = ['View', 'Store', 'Reducer', 'Effect', 'DataSource'];
        profile.layerUI = 'View'; profile.layerState = 'Store'; profile.layerLogic = 'Reducer';
        profile.layerAdapter = 'Effect'; profile.layerData = 'DataSource';
        profile.diFramework = 'TCA Dependencies (@Dependency)'; log.detected('TCA detected');
    } else {
        // DI
        if (swiftPkgHas(projectDir, 'Resolver')) { profile.diFramework = 'Resolver'; log.detected('DI: Resolver'); }
        else if (swiftPkgHas(projectDir, 'Swinject')) { profile.diFramework = 'Swinject'; log.detected('DI: Swinject'); }
        else if (swiftPkgHas(projectDir, 'Factory')) { profile.diFramework = 'Factory'; log.detected('DI: Factory'); }

        // State
        const sourcesDir = join(projectDir, 'Sources');
        if (existsSync(sourcesDir)) {
            const obsCount = findFilesRecursive(sourcesDir, 6, f => f.endsWith('.swift'))
                .filter(f => readFileSafe(f).includes('@Observable')).length;
            const obobjCount = findFilesRecursive(sourcesDir, 6, f => f.endsWith('.swift'))
                .filter(f => readFileSafe(f).includes('ObservableObject')).length;
            if (obsCount > 0) {
                scan.detectedState = 'Observation'; profile.stateFramework = '@Observable (Swift 5.9+)';
                profile.statePattern = '@Observable final class ViewModel { var isLoading = false; var data: T?; var error: Error? }';
                log.detected(`State: @Observable (${obsCount} files)`);
            } else if (obobjCount > 0) {
                scan.detectedState = 'ObservableObject'; profile.stateFramework = 'ObservableObject + @Published';
                profile.statePattern = '@Published var state: ViewState';
                log.detected('State: ObservableObject + @Published');
            }
        }
    }

    // Async
    const sourcesDir = join(projectDir, 'Sources');
    if (existsSync(sourcesDir)) {
        const asyncCount = findFilesRecursive(sourcesDir, 6, f => f.endsWith('.swift'))
            .filter(f => /async throws| await /.test(readFileSafe(f))).length;
        if (asyncCount > 0) { scan.detectedSwiftAsync = true; log.detected('Data flow: async/await dominant'); }

        // @MainActor
        if (findFilesRecursive(sourcesDir, 6, f => f.endsWith('.swift'))
            .some(f => readFileSafe(f).includes('@MainActor'))) {
            scan.detectedMainActor = true; log.detected('@MainActor in use');
        }
    }

    // Network
    if (swiftPkgHas(projectDir, 'Alamofire')) { scan.detectedNetworkSwift = 'Alamofire'; log.detected('Network: Alamofire'); }
    else if (swiftPkgHas(projectDir, 'Moya')) { scan.detectedNetworkSwift = 'Moya'; log.detected('Network: Moya'); }
    else { scan.detectedNetworkSwift = 'URLSession'; log.detected('Network: URLSession'); }

    // Local DB
    if (swiftPkgHas(projectDir, 'SwiftData')) { scan.detectedLocalDBSwift = 'SwiftData'; log.detected('DB: SwiftData'); }
    else if (swiftPkgHas(projectDir, 'GRDB|grdb')) { scan.detectedLocalDBSwift = 'GRDB'; log.detected('DB: GRDB'); }
    else if (swiftPkgHas(projectDir, 'Realm')) { scan.detectedLocalDBSwift = 'Realm'; log.detected('DB: Realm'); }

    // Min iOS
    if (fileExists(projectDir, 'Package.swift')) {
        const content = readFileSafe(join(projectDir, 'Package.swift'));
        const m = content.match(/\.iOS\("([^"]+)"\)/);
        if (m) { scan.detectedSwiftMinIOS = m[1]; log.detected(`Min iOS: ${m[1]}`); }
    }

    // Source dir
    for (const c of ['Sources/Features', 'Sources/App', 'Sources/Core', 'Sources']) {
        if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; break; }
    }

    // High-risk
    scan.highRiskFiles.push('App.swift');
    if (fileExists(projectDir, 'Package.swift')) scan.highRiskFiles.push('Package.swift');

    // Scaffold
    if (fileExists(projectDir, 'plopfile.js') || fileExists(projectDir, 'plopfile.ts')) {
        scan.scaffoldTool = 'Plop'; scan.scaffoldCmdFeature = 'npx plop feature';
    }
}
