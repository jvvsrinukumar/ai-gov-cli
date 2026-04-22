import { existsSync } from 'fs';
import { join, basename } from 'path';
import type { Stack, BaseProfile, ScanResult } from '../types.js';
import { findFilesRecursive, fileExists } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';
import { scanFlutter } from './flutter.js';
import { scanKotlin } from './kotlin.js';
import { scanNodejs } from './nodejs.js';
import { scanReact } from './react.js';
import { scanAngular } from './angular.js';
import { scanSwiftUI } from './swiftui.js';
import { scanPython } from './python.js';
import { scanJsPackageManager, scanJsScripts, scanJsTooling, scanJsTestFramework } from './shared-js.js';

export function scanProject(
    stack: Stack, projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    console.log('');
    log.bold('--- Scanning project ---');

    switch (stack) {
        case 'flutter': scanFlutter(projectDir, profile, scan); break;
        case 'kotlin': scanKotlin(projectDir, profile, scan); break;
        case 'angular':
            scanJsPackageManager(projectDir, profile, scan);
            scanJsScripts(projectDir, profile, scan);
            scanJsTooling(projectDir, profile, scan);
            scanJsTestFramework(projectDir, profile, scan);
            scanAngular(projectDir, profile, scan);
            break;
        case 'react':
            scanJsPackageManager(projectDir, profile, scan);
            scanJsScripts(projectDir, profile, scan);
            scanJsTooling(projectDir, profile, scan);
            scanJsTestFramework(projectDir, profile, scan);
            scanReact(projectDir, profile, scan);
            break;
        case 'nodejs':
            scanJsPackageManager(projectDir, profile, scan);
            scanJsScripts(projectDir, profile, scan);
            scanJsTooling(projectDir, profile, scan);
            scanJsTestFramework(projectDir, profile, scan);
            scanNodejs(projectDir, profile, scan);
            break;
        case 'swiftui': scanSwiftUI(projectDir, profile, scan); break;
        case 'python': scanPython(projectDir, profile, scan); break;
    }

    scanHighRiskByName(stack, projectDir, profile, scan);

    // Default featuresDir
    profile.featuresDir = profile.featuresDir || profile.sourceDir;

    // Deduplicate high-risk
    scan.highRiskFiles = [...new Set(scan.highRiskFiles)];

    console.log('');
    log.success(`Scan complete — ${scan.highRiskFiles.length} high-risk file(s).`);
}

function scanHighRiskByName(
    stack: Stack, projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Config/auth/DB files');
    let srcRoot = projectDir;
    switch (stack) {
        case 'kotlin': srcRoot = join(projectDir, 'app/src/main'); break;
        case 'python': if (existsSync(join(projectDir, 'app'))) srcRoot = join(projectDir, 'app'); break;
        default:
            if (existsSync(join(projectDir, 'src'))) srcRoot = join(projectDir, 'src');
            if (existsSync(join(projectDir, 'lib'))) srcRoot = join(projectDir, 'lib');
            if (existsSync(join(projectDir, 'Sources'))) srcRoot = join(projectDir, 'Sources');
            break;
    }
    if (!existsSync(srcRoot)) return;

    const patterns = ['config', 'auth', 'database', 'migration', 'middleware', 'interceptor', 'guard', 'connection', 'security'];
    const ext = profile.fileExt;
    const found = findFilesRecursive(srcRoot, 6, f => {
        if (!f.endsWith(ext)) return false;
        if (/\.test\.|\.spec\.|_test\./.test(f)) return false;
        if (/\.freezed\.|\.g\.dart/.test(f)) return false;
        const bn = basename(f).toLowerCase();
        return patterns.some(p => bn.includes(p));
    });

    for (const f of found) {
        const bn = basename(f);
        if (!scan.highRiskFiles.includes(bn)) scan.highRiskFiles.push(bn);
    }

    // .env files
    if (fileExists(projectDir, '.env') && !scan.highRiskFiles.includes('.env')) {
        scan.highRiskFiles.push('.env');
    }
}
