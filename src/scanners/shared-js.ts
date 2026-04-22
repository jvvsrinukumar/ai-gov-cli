import type { BaseProfile, ScanResult } from '../types.js';
import { pkgHas, findPackageJson, readFileSafe } from '../utils/file-helpers.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { log } from '../utils/logger.js';

export function scanJsPackageManager(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Package manager');
    if (existsSync(join(projectDir, 'bun.lockb'))) scan.detectedPackageManager = 'bun';
    else if (existsSync(join(projectDir, 'pnpm-lock.yaml'))) scan.detectedPackageManager = 'pnpm';
    else if (existsSync(join(projectDir, 'yarn.lock'))) scan.detectedPackageManager = 'yarn';
    else scan.detectedPackageManager = 'npm';
    log.detected(`Package manager: ${scan.detectedPackageManager}`);

    const pm = scan.detectedPackageManager;
    profile.installCmd = `${pm} install`;
    switch (pm) {
        case 'bun': profile.runCmd = 'bun dev'; profile.buildCmd = 'bun run build'; profile.testCmd = 'bun test'; break;
        case 'pnpm': profile.runCmd = 'pnpm dev'; profile.buildCmd = 'pnpm build'; profile.testCmd = 'pnpm test'; break;
        case 'yarn': profile.runCmd = 'yarn dev'; profile.buildCmd = 'yarn build'; profile.testCmd = 'yarn test'; break;
        default: profile.runCmd = 'npm run dev'; profile.buildCmd = 'npm run build'; profile.testCmd = 'npm test'; break;
    }
}

export function scanJsScripts(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    const f = findPackageJson(projectDir);
    if (!f) return;
    const content = readFileSafe(f);
    const pm = scan.detectedPackageManager || 'npm';
    const rp = `${pm} run`;

    if (content.includes('"start:dev"')) profile.runCmd = `${rp} start:dev`;
    else if (content.includes('"dev"')) profile.runCmd = `${rp} dev`;
    else if (content.includes('"serve"')) profile.runCmd = `${rp} serve`;
    else if (content.includes('"start"')) profile.runCmd = `${pm} start`;

    if (content.includes('"test:unit"')) profile.testCmd = `${rp} test:unit`;
    if (content.includes('"lint"')) profile.analyzeCmd = `${rp} lint`;
    if (content.includes('"format"')) profile.formatCmd = `${rp} format`;
    if (content.includes('"build"')) profile.buildCmd = `${rp} build`;
}

export function scanJsTooling(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Linter/formatter');
    if (pkgHas(projectDir, '@biomejs/biome')) {
        scan.detectedLinter = 'biome'; scan.detectedFormatter = 'biome';
    } else {
        if (pkgHas(projectDir, 'eslint')) scan.detectedLinter = 'eslint';
        if (pkgHas(projectDir, 'prettier')) scan.detectedFormatter = 'prettier';
    }
    if (scan.detectedLinter) log.detected(`Linter: ${scan.detectedLinter}`);
    if (scan.detectedFormatter) log.detected(`Formatter: ${scan.detectedFormatter}`);
}

export function scanJsTestFramework(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Test framework');
    if (pkgHas(projectDir, 'vitest')) scan.detectedTestFramework = 'vitest';
    else if (pkgHas(projectDir, 'jest') || pkgHas(projectDir, '@jest/core')) scan.detectedTestFramework = 'jest';
    else if (pkgHas(projectDir, 'karma') || pkgHas(projectDir, 'karma-jasmine')) scan.detectedTestFramework = 'Karma + Jasmine';
    else if (pkgHas(projectDir, 'mocha')) scan.detectedTestFramework = 'mocha';
    if (scan.detectedTestFramework) log.detected(`Test: ${scan.detectedTestFramework}`);
}
