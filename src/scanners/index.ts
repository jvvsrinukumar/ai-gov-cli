import { existsSync, readdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, basename } from 'path';
import type { Stack, BaseProfile, ScanResult } from '../types.js';
import { findFilesRecursive, fileExists, readFileSafe } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';
import { scanFlutter } from './flutter.js';
import { scanKotlin } from './kotlin.js';
import { scanNodejs } from './nodejs.js';
import { scanReact } from './react.js';
import { scanAngular } from './angular.js';
import { scanSwiftUI } from './swiftui.js';
import { scanPython } from './python.js';
import { scanJava } from './java.js';
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
        case 'next':
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
        case 'java': scanJava(projectDir, profile, scan); break;
    }

    scanHighRiskByName(stack, projectDir, profile, scan);
    scanDomainContext(projectDir, scan);

    // Default featuresDir
    profile.featuresDir = profile.featuresDir || profile.sourceDir;

    // Deduplicate high-risk
    scan.highRiskFiles = [...new Set(scan.highRiskFiles)];

    console.log('');
    log.success(`Scan complete — ${scan.highRiskFiles.length} high-risk file(s).`);
}

// v14.2: Universal spec-first enablement check — applies to ALL stacks
// Checks both Claude Code (specs/) and Kiro (.kiro/specs/) locations.
export function checkSpecFirstEnabled(projectDir: string): boolean {
    // Prefer .kiro/specs/ if it exists (Kiro agent), fall back to specs/ (Claude Code)
    const kiroSpecsDir = join(projectDir, '.kiro', 'specs');
    const claudeSpecsDir = join(projectDir, 'specs');
    const specsDir = existsSync(kiroSpecsDir) ? kiroSpecsDir : claudeSpecsDir;
    const specsGitPath = existsSync(kiroSpecsDir) ? '.kiro/specs/' : 'specs/';

    if (existsSync(specsDir)) {
        try {
            const entries = readdirSync(specsDir, { withFileTypes: true });
            const featureDirs = entries.filter(e => e.isDirectory() && e.name !== '_template');
            if (featureDirs.length > 0) {
                log.detected('Spec-first: enabled (existing spec history detected)');
                return true;
            }
        } catch { /* ignore */ }
    }
    try {
        const result = execSync(`git -C "${projectDir}" log --oneline -- ${specsGitPath} 2>/dev/null | wc -l`, { stdio: 'pipe' }).toString().trim();
        if (parseInt(result, 10) > 0) {
            log.detected('Spec-first: enabled (git spec history detected)');
            return true;
        }
    } catch { /* no git or no commits */ }
    log.detected('INFO: No spec history found — spec-first enforcement disabled (opt-in for all stacks)');
    return false;
}

function scanDomainContext(projectDir: string, scan: ScanResult): void {
    // Read manifest + README for domain/sensitivity signals
    const candidates = ['package.json', 'pyproject.toml', 'requirements.txt', 'pom.xml',
        'build.gradle.kts', 'build.gradle', 'pubspec.yaml', 'README.md', 'readme.md'];
    const content = candidates
        .map(f => readFileSafe(join(projectDir, f)))
        .join('\n')
        .toLowerCase();

    if (/fhir|hl7|hipaa|medic[^\w]|clinical|patient\b|phi\b|biometric/.test(content)) {
        scan.detectedDomainContext = 'healthcare';
        scan.detectedDataSensitivity = 'health';
        log.detected('Domain: healthcare (PHI/health data detected)');
        return;
    }
    if (/stripe|plaid|payment|fintech|banking|transaction|ledger|kyc\b/.test(content)) {
        scan.detectedDomainContext = 'fintech';
        log.detected('Domain: fintech');
    } else if (/logistics|shipment|tracking|freight|dispatch|fulfillment/.test(content)) {
        scan.detectedDomainContext = 'logistics';
        log.detected('Domain: logistics');
    }
    // PII sensitivity (independent of domain)
    if (/bcrypt|passlib|jsonwebtoken|gdpr|personal.{0,10}data|pii\b/.test(content)) {
        scan.detectedDataSensitivity = 'pii';
        log.detected('Data sensitivity: PII');
    }
}

function scanHighRiskByName(
    stack: Stack, projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Config/auth/DB files');
    let srcRoot = projectDir;
    switch (stack) {
        case 'kotlin': srcRoot = join(projectDir, 'app/src/main'); break;
        case 'java':
            if (existsSync(join(projectDir, 'src/main/java'))) srcRoot = join(projectDir, 'src/main/java');
            break;
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
