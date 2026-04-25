import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { pkgHas, pkgVersion, fileExists, findFilesRecursive, readFileSafe } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanAngular(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Angular details');
    const ngVer = pkgVersion(projectDir, '@angular/core');
    if (ngVer) { scan.detectedAngularVersion = ngVer; log.detected(`Angular version: ${ngVer}`); }
    const majorV = parseInt(scan.detectedAngularVersion) || 0;
    if (majorV >= 14) profile.diFramework = 'Angular DI (inject() function)';

    // Signals
    if (majorV >= 17) {
        const srcDir = join(projectDir, 'src');
        if (existsSync(srcDir)) {
            const sigCount = findFilesRecursive(srcDir, 6, f => f.endsWith('.ts'))
                .filter(f => /\bsignal\(|toSignal\(|input\(|linkedSignal\(/.test(readFileSafe(f))).length;
            if (sigCount > 0) { scan.detectedAngularSignalState = true; log.detected(`Angular Signals in ${sigCount} file(s)`); }
        }
    }

    // State management
    if (pkgHas(projectDir, '@ngrx/store')) {
        scan.detectedState = 'NgRx'; profile.stateFramework = 'NgRx';
        profile.statePattern = 'NgRx: createAction + createReducer + createSelector + createEffect';
        profile.layerFlow = 'Component → Store → Effect → Service → DataSource'; profile.archSimple = false;
        log.detected('State: NgRx');
    } else if (pkgHas(projectDir, '@ngxs/store')) {
        scan.detectedState = 'NGXS'; profile.stateFramework = 'NGXS';
        profile.statePattern = 'NGXS: @State + @Action + @Selector classes'; profile.archSimple = false;
        log.detected('State: NGXS');
    } else if (pkgHas(projectDir, '@datorama/akita')) {
        scan.detectedState = 'Akita'; profile.stateFramework = 'Akita';
        profile.statePattern = 'Akita: EntityStore + Query + Service pattern'; profile.archSimple = false;
        log.detected('State: Akita');
    } else if (scan.detectedAngularSignalState) {
        scan.detectedState = 'Angular Signals'; profile.stateFramework = 'Angular Signals';
        profile.statePattern = 'signal<T>() + computed() + effect() — no external state library';
    } else {
        scan.detectedState = 'RxJS'; profile.stateFramework = 'RxJS BehaviorSubjects';
        profile.statePattern = 'BehaviorSubject<T> in services, exposed via asObservable()';
    }

    // SSR
    if (pkgHas(projectDir, '@angular/ssr')) { scan.detectedSSR = true; log.detected('SSR detected'); }

    // UI libs
    const uiLibs: string[] = [];
    if (pkgHas(projectDir, '@angular/material')) uiLibs.push('Angular Material');
    if (pkgHas(projectDir, 'primeng')) uiLibs.push('PrimeNG');
    if (pkgHas(projectDir, '@ng-bootstrap/ng-bootstrap')) uiLibs.push('ng-bootstrap');
    if (pkgHas(projectDir, '@ng-select/ng-select')) uiLibs.push('ng-select');
    if (uiLibs.length) { scan.detectedUILibs = uiLibs.join(', '); log.detected(`UI libraries: ${scan.detectedUILibs}`); }

    // i18n
    if (pkgHas(projectDir, '@ngx-translate/core') || pkgHas(projectDir, 'ngx-translate')) {
        scan.detectedI18N = 'ngx-translate'; log.detected('i18n: ngx-translate');
    }

    // Architecture depth
    const srcDir = join(projectDir, 'src');
    const ucExists = existsSync(join(srcDir, 'app', 'usecases')) || existsSync(join(srcDir, 'app', 'use-cases'));
    const repoExists = existsSync(join(srcDir, 'app', 'repositories')) || existsSync(join(srcDir, 'app', 'repository'));
    if (ucExists && repoExists) {
        profile.layerFlow = 'Component → Service → UseCase → Repository → DataSource';
        profile.layerNames = ['Component', 'Service', 'UseCase', 'Repository', 'DataSource'];
        profile.layerLogic = 'UseCase'; profile.layerAdapter = 'Repository'; profile.archSimple = false;
        log.detected('Architecture: full (UseCase + Repository)');
    } else {
        profile.layerFlow = 'Component → Service → DataSource';
        profile.layerNames = ['Component', 'Service', 'DataSource'];
        profile.layerUI = 'Component'; profile.layerState = 'Service'; profile.layerLogic = 'Service';
        profile.layerAdapter = 'Service'; profile.layerData = 'DataSource'; profile.archSimple = true;
        log.detected('Architecture: simple (Component → Service → DataSource)');
    }

    // Source dir
    for (const c of ['src/app/features', 'src/app/pages', 'src/app/modules', 'src/app']) {
        if (existsSync(join(projectDir, c))) { profile.sourceDir = `${c}/`; log.detected(`Source dir: ${profile.sourceDir}`); break; }
    }

    // High-risk
    scan.highRiskFiles.push('environment.ts');
    if (fileExists(projectDir, 'src', 'app', 'app.module.ts')) scan.highRiskFiles.push('app.module.ts');
    if (fileExists(projectDir, 'src', 'app', 'app.config.ts')) scan.highRiskFiles.push('app.config.ts');
    if (existsSync(srcDir)) {
        findFilesRecursive(srcDir, 4, f => f.endsWith('.interceptor.ts') || f.endsWith('.guard.ts'))
            .forEach(f => { const bn = f.split('/').pop()!; if (!scan.highRiskFiles.includes(bn)) scan.highRiskFiles.push(bn); });
    }

    // Test framework
    if (pkgHas(projectDir, 'jest') || pkgHas(projectDir, 'jest-preset-angular')) {
        scan.detectedTestFramework = 'Jest'; profile.testCmd = 'npx jest'; log.detected('Test: Jest');
    } else if (pkgHas(projectDir, 'karma') || pkgHas(projectDir, 'karma-jasmine')) {
        scan.detectedTestFramework = 'Karma + Jasmine'; profile.testCmd = 'ng test'; log.detected('Test: Karma + Jasmine');
    } else if (pkgHas(projectDir, '@playwright/test')) {
        scan.detectedTestFramework = 'Playwright'; profile.testCmd = 'npx playwright test'; log.detected('Test: Playwright');
    }

    // Monorepo (Nx)
    if (pkgHas(projectDir, '@nrwl/angular') || pkgHas(projectDir, '@nx/angular')) {
        scan.detectedMonorepo = 'Nx'; log.detected('Monorepo: Nx');
    }

    // Legacy zone detection — NgModule style alongside standalone components = dual-mode
    const hasNgModule    = existsSync(join(srcDir, 'app', 'app.module.ts'));
    const hasStandalone  = existsSync(join(srcDir, 'app', 'app.config.ts'));
    if (hasNgModule && hasStandalone) {
        scan.hasLegacyZones = true;
        scan.legacyZones = ['NgModule-based components'];
        scan.cleanZones  = ['Standalone components (app.config.ts)'];
        scan.legacyZoneNote = `Dual-mode Angular: NgModule pattern (app.module.ts) coexists with standalone components (app.config.ts) — migration in progress`;
        log.detected('Legacy zones: NgModule + standalone dual-mode');
    } else if (hasNgModule && !hasStandalone) {
        scan.hasLegacyZones = true;
        scan.legacyZones = ['NgModule-based (all components)'];
        scan.cleanZones  = [];
        scan.legacyZoneNote = `Legacy NgModule-only project — no standalone components detected. Consider migrating with ng generate @angular/core:standalone`;
        log.detected('Legacy zones: NgModule-only');
    }

    // Scaffold
    if (pkgHas(projectDir, '@angular/cli')) {
        scan.scaffoldTool = 'Angular CLI'; scan.scaffoldCmdFeature = 'ng generate component features/feature-name';
        log.detected('Scaffold: ng generate');
    }
}
