import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { Stack } from './types.js';
import { log } from './utils/logger.js';

export function detectStack(projectDir: string, explicit?: string): Stack {
    if (explicit) {
        const valid: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'angular', 'swiftui', 'python'];
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
    if (existsSync(join(projectDir, 'build.gradle.kts')) ||
        existsSync(join(projectDir, 'build.gradle'))) {
        log.success('Kotlin'); return 'kotlin';
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

    log.error('Could not detect stack. Use --stack to specify.');
    process.exit(1);
}
