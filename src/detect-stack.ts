import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { Stack } from './types.js';
import { log } from './utils/logger.js';

export function detectStack(projectDir: string, explicit?: string): Stack {
    if (explicit) {
        const valid: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'angular', 'swiftui', 'python', 'java'];
        if (!valid.includes(explicit as Stack)) {
            log.error(`Unknown stack: ${explicit}`);
            process.exit(1);
        }
        log.info(`Stack: ${explicit}`);
        return explicit as Stack;
    }

    log.info('Detecting stack...');

    if (existsSync(join(projectDir, 'pubspec.yaml'))) {
        log.success('Flutter'); return 'flutter';
    }
    if (existsSync(join(projectDir, 'Package.swift'))) {
        log.success('SwiftUI'); return 'swiftui';
    }
    // Java (Maven) — pom.xml without kotlin-maven-plugin
    if (existsSync(join(projectDir, 'pom.xml'))) {
        const pomContent = readFileSync(join(projectDir, 'pom.xml'), 'utf-8');
        if (!pomContent.includes('kotlin-maven-plugin') && !pomContent.includes('kotlin-stdlib')) {
            log.success('Java'); return 'java';
        }
    }

    // Gradle — disambiguate Kotlin vs Java
    if (existsSync(join(projectDir, 'build.gradle.kts')) ||
        existsSync(join(projectDir, 'build.gradle'))) {
        const gradleFile = existsSync(join(projectDir, 'build.gradle.kts'))
            ? join(projectDir, 'build.gradle.kts')
            : join(projectDir, 'build.gradle');
        const gradleContent = readFileSync(gradleFile, 'utf-8');
        if (/kotlin\(|org\.jetbrains\.kotlin|kotlin-android|kotlin-stdlib/.test(gradleContent)) {
            log.success('Kotlin'); return 'kotlin';
        }
        if (/apply\s+plugin:\s*['"]java['"]|id\s*\(?\s*['"]java['"]|plugins\s*\{[^}]*\bjava\b/.test(gradleContent)) {
            log.success('Java'); return 'java';
        }
    }
    if (existsSync(join(projectDir, 'pyproject.toml')) ||
        existsSync(join(projectDir, 'requirements.txt'))) {
        log.success('Python'); return 'python';
    }

    const pkgPath = existsSync(join(projectDir, 'package.json'))
        ? join(projectDir, 'package.json')
        : existsSync(join(projectDir, 'src', 'package.json'))
            ? join(projectDir, 'src', 'package.json')
            : null;

    if (pkgPath) {
        const content = readFileSync(pkgPath, 'utf-8');
        if (content.includes('"@angular/core"')) { log.success('Angular'); return 'angular'; }
        if (content.includes('"react"')) { log.success('React'); return 'react'; }
        if (/"express"|"@nestjs\/core"|"fastify"/.test(content)) {
            log.success('Node.js'); return 'nodejs';
        }
        log.warn('Node.js (fallback)'); return 'nodejs';
    }

    // Fallback: scan for Java/Kotlin indicators when no root manifest exists
    // (multi-module projects, Weasis-style structures, or src/main/java presence)
    const javaIndicators = [
        'src/main/java',
        'src/main/kotlin',
        'settings.gradle',
        'settings.gradle.kts',
        'mvnw',
        'gradlew',
    ];
    const hasJavaIndicator = javaIndicators.some(f => existsSync(join(projectDir, f)));
    if (hasJavaIndicator) {
        // Check if it's Kotlin-dominant
        if (existsSync(join(projectDir, 'src', 'main', 'kotlin'))) {
            log.success('Kotlin (inferred from src/main/kotlin)'); return 'kotlin';
        }
        log.success('Java (inferred from project structure)'); return 'java';
    }

    // Check for pom.xml in immediate subdirectories (multi-module parent without root pom)
    try {
        const entries = readdirSync(projectDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                if (existsSync(join(projectDir, entry.name, 'pom.xml'))) {
                    log.success('Java (inferred from sub-module pom.xml)'); return 'java';
                }
                if (existsSync(join(projectDir, entry.name, 'build.gradle.kts')) ||
                    existsSync(join(projectDir, entry.name, 'build.gradle'))) {
                    log.success('Java (inferred from sub-module gradle)'); return 'java';
                }
            }
        }
    } catch { /* ignore readdir errors */ }

    log.error('Could not detect stack. Use --stack to specify.');
    process.exit(1);
}
