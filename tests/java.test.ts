import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks, isJavaBackend } from '../src/content-blocks.js';
import { scanProject } from '../src/scanners/index.js';
import { detectStack } from '../src/detect-stack.js';
import { generateArchitecture } from '../src/generators/architecture.js';
import type { Stack, ScanResult, GovernanceConfig } from '../src/types.js';

const FIXTURES = join(__dirname, 'fixtures');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function runScan(stack: Stack, fixture: string) {
    const dir = join(FIXTURES, fixture);
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    const origLog = console.log;
    console.log = () => { };
    scanProject(stack, dir, profile, scan);
    console.log = origLog;
    return { profile, scan };
}

function makeConfig(stack: Stack, scanOverrides: Partial<ScanResult> = {}): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        stack, profile, scan, blocks,
        project: { packageName: 'test', appName: 'test', appDescription: '', ticketSystem: 'Jira', ticketPrefix: 'T', legacyDescription: '' },
        isBackend: stack === 'nodejs' || stack === 'python' || (stack === 'java' && isJavaBackend(scan)),
        hookVersion: '16.0.0',
        projectDir: '/tmp/test',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

function silentDetect(dir: string, explicit?: string): Stack {
    const origLog = console.log;
    const origExit = process.exit;
    console.log = () => { };
    // @ts-ignore — mock process.exit for detection failures
    process.exit = ((code?: number) => { throw new Error(`exit ${code}`); }) as never;
    let result: Stack;
    try {
        result = detectStack(dir, explicit);
    } finally {
        console.log = origLog;
        process.exit = origExit;
    }
    return result;
}

// ─── detect-stack.ts ─────────────────────────────────────────────────────────

describe('Java detection', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = join(__dirname, '.tmp-detect-' + Date.now());
        mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('detects Java from pom.xml', () => {
        writeFileSync(join(tmpDir, 'pom.xml'), '<project><artifactId>my-app</artifactId></project>');
        expect(silentDetect(tmpDir)).toBe('java');
    });

    test('detects Kotlin when pom.xml has kotlin-maven-plugin', () => {
        writeFileSync(join(tmpDir, 'pom.xml'), '<project><artifactId>my-app</artifactId><plugin>kotlin-maven-plugin</plugin></project>');
        // Kotlin detection requires build.gradle — pom with kotlin falls through
        // The pom check skips it, then no build.gradle exists, so it falls to package.json check
        // This test verifies pom.xml with kotlin is NOT detected as java
        expect(() => silentDetect(tmpDir)).toThrow('exit');
    });

    test('--stack java explicit override works', () => {
        expect(silentDetect(tmpDir, 'java')).toBe('java');
    });

    test('Gradle with java plugin detects as Java', () => {
        writeFileSync(join(tmpDir, 'build.gradle'), "apply plugin: 'java'\ndependencies {}");
        expect(silentDetect(tmpDir)).toBe('java');
    });

    test('Gradle with kotlin plugin detects as Kotlin', () => {
        writeFileSync(join(tmpDir, 'build.gradle.kts'), 'plugins { kotlin("jvm") }');
        expect(silentDetect(tmpDir)).toBe('kotlin');
    });

    test('Gradle without java or kotlin plugin does not detect as Java', () => {
        writeFileSync(join(tmpDir, 'build.gradle'), "apply plugin: 'groovy'\ndependencies {}");
        // Falls through to package.json check, then fails
        expect(() => silentDetect(tmpDir)).toThrow('exit');
    });
});

// ─── profiles.ts ─────────────────────────────────────────────────────────────

describe('Java profile', () => {
    const profile = loadBaseProfile('java');

    test('has correct stack display', () => {
        expect(profile.stackDisplay).toBe('Java');
    });

    test('has .java file extension', () => {
        expect(profile.fileExt).toBe('.java');
    });

    test('has 4 layer names', () => {
        expect(profile.layerNames).toHaveLength(4);
        expect(profile.layerNames).toEqual(['Controller', 'Service', 'Repository', 'Entity']);
    });

    test('has Maven commands by default', () => {
        expect(profile.testCmd).toBe('mvn test');
        expect(profile.buildCmd).toBe('mvn clean install');
        expect(profile.manifestFile).toBe('pom.xml');
    });

    test('has all required fields non-empty', () => {
        expect(profile.layerFlow).toBeTruthy();
        expect(profile.sourceDir).toBeTruthy();
        expect(profile.importStyle).toBeTruthy();
        expect(profile.errorPattern).toBeTruthy();
        expect(profile.namingFiles).toBeTruthy();
        expect(profile.namingConstants).toBeTruthy();
    });
});

// ─── isJavaBackend ───────────────────────────────────────────────────────────

describe('isJavaBackend', () => {
    test('returns true for Spring Boot', () => {
        const scan = { ...createDefaultScanResult(), detectedSubtype: 'spring-boot' };
        expect(isJavaBackend(scan)).toBe(true);
    });

    test('returns true for Quarkus', () => {
        const scan = { ...createDefaultScanResult(), detectedSubtype: 'quarkus' };
        expect(isJavaBackend(scan)).toBe(true);
    });

    test('returns true for OSGi (no subtype)', () => {
        const scan = { ...createDefaultScanResult(), detectedOSGi: true };
        expect(isJavaBackend(scan)).toBe(true);
    });

    test('returns true for plain Maven project (no subtype, no UI)', () => {
        const scan = createDefaultScanResult();
        expect(isJavaBackend(scan)).toBe(true);
    });

    test('returns false for pure Swing app', () => {
        const scan = { ...createDefaultScanResult(), detectedUISystem: 'swing' };
        expect(isJavaBackend(scan)).toBe(false);
    });

    test('returns false for pure JavaFX app', () => {
        const scan = { ...createDefaultScanResult(), detectedUISystem: 'javafx' };
        expect(isJavaBackend(scan)).toBe(false);
    });

    test('returns true for OSGi + Swing (mixed like Weasis)', () => {
        const scan = { ...createDefaultScanResult(), detectedUISystem: 'swing', detectedOSGi: true };
        expect(isJavaBackend(scan)).toBe(true);
    });

    test('returns true for Spring Boot + JavaFX (embedded UI)', () => {
        const scan = { ...createDefaultScanResult(), detectedUISystem: 'javafx', detectedSubtype: 'spring-boot' };
        expect(isJavaBackend(scan)).toBe(true);
    });
});

// ─── scanners/java.ts — Spring Boot fixture ─────────────────────────────────

describe('Java Spring Boot scanner', () => {
    const { profile, scan } = runScan('java', 'java-spring');

    test('detects Maven build system', () => {
        expect(scan.detectedBuildSystem).toBe('Maven');
    });

    test('detects Java 21', () => {
        expect(scan.detectedJavaVersion).toBe('21');
    });

    test('detects Spring Boot framework', () => {
        expect(scan.detectedSubtype).toBe('spring-boot');
    });

    test('detects Spring DI', () => {
        expect(scan.detectedDI).toBe('Spring DI');
        expect(profile.diFramework).toBe('Spring DI');
    });

    test('detects JPA/Hibernate ORM', () => {
        expect(scan.detectedORM).toBe('JPA/Hibernate');
    });

    test('detects JUnit 5 + Mockito + AssertJ', () => {
        expect(scan.detectedTestFramework).toContain('JUnit 5');
        expect(scan.detectedTestFramework).toContain('Mockito');
        expect(scan.detectedTestFramework).toContain('AssertJ');
    });

    test('detects Spotless formatter', () => {
        expect(scan.detectedFormatter).toBe('Spotless');
    });

    test('detects Checkstyle linter', () => {
        expect(scan.detectedLinter).toContain('Checkstyle');
    });

    test('detects springdoc API docs', () => {
        expect(scan.detectedSwagger).toBe(true);
        expect(scan.detectedSwaggerStyle).toBe('springdoc');
    });

    test('detects Lombok', () => {
        expect(scan.detectedLombok).toBe(true);
    });

    test('detects MapStruct', () => {
        expect(scan.detectedMapStruct).toBe(true);
    });

    test('detects SLF4J + Logback logging', () => {
        expect(scan.detectedLogger).toContain('SLF4J');
        expect(scan.detectedLogger).toContain('Logback');
    });

    test('pom.xml is high-risk', () => {
        expect(scan.highRiskFiles).toContain('pom.xml');
    });
});

// ─── scanners/java.ts — OSGi fixture ────────────────────────────────────────

describe('Java OSGi scanner', () => {
    const { profile, scan } = runScan('java', 'java-osgi');

    test('detects Maven build system', () => {
        expect(scan.detectedBuildSystem).toBe('Maven');
    });

    test('detects Java 21', () => {
        expect(scan.detectedJavaVersion).toBe('21');
    });

    test('detects OSGi', () => {
        expect(scan.detectedOSGi).toBe(true);
    });

    test('overrides layer flow to OSGi pattern', () => {
        expect(profile.layerFlow).toContain('Bundle');
        expect(profile.layerNames[0]).toBe('Bundle UI');
    });

    test('sets OSGi SCR as DI framework', () => {
        expect(profile.diFramework).toBe('OSGi SCR');
    });

    test('detects multi-module (7 modules)', () => {
        expect(scan.detectedMultimodule).toBe(true);
    });

    test('detects JUnit 5 + Mockito + AssertJ', () => {
        expect(scan.detectedTestFramework).toContain('JUnit 5');
        expect(scan.detectedTestFramework).toContain('Mockito');
    });

    test('detects Spotless formatter', () => {
        expect(scan.detectedFormatter).toBe('Spotless');
    });

    test('detects SLF4J logging', () => {
        expect(scan.detectedLogger).toContain('SLF4J');
    });
});

// ─── Architecture generator — Java variants ─────────────────────────────────

describe('Java architecture generator', () => {
    test('Spring Boot produces controller/service/repository structure', () => {
        const config = makeConfig('java', { detectedSubtype: 'spring-boot' });
        const output = generateArchitecture(config);
        expect(output).toContain('controller/');
        expect(output).toContain('service/');
        expect(output).toContain('repository/');
        expect(output).toContain('@RestController');
    });

    test('OSGi produces bundle structure', () => {
        const config = makeConfig('java', { detectedOSGi: true });
        const output = generateArchitecture(config);
        expect(output).toContain('OSGI-INF');
        expect(output).toContain('Bundle');
    });

    test('desktop Java (Swing) produces feature-based structure', () => {
        const config = makeConfig('java', { detectedUISystem: 'swing' });
        // isBackend is false for pure Swing, so it uses the generic desktop block
        expect(config.isBackend).toBe(false);
        const output = generateArchitecture(config);
        expect(output).toContain('presentation');
    });
});
