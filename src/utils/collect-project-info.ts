import { existsSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import type { Stack } from '../types.js';

export function collectProjectInfo(stack: Stack, projectDir: string) {
    const dn = basename(projectDir);
    let packageName = '';
    switch (stack) {
        case 'flutter': {
            const pub = join(projectDir, 'pubspec.yaml');
            if (existsSync(pub)) {
                const m = readFileSync(pub, 'utf-8').match(/^name:\s*(.+)/m);
                if (m) packageName = m[1].trim();
            }
            break;
        }
        case 'swiftui': {
            const pkg = join(projectDir, 'Package.swift');
            if (existsSync(pkg)) {
                const m = readFileSync(pkg, 'utf-8').match(/name:\s*"([^"]+)"/);
                if (m) packageName = m[1];
            }
            break;
        }
        case 'python': {
            const pyp = join(projectDir, 'pyproject.toml');
            if (existsSync(pyp)) {
                const m = readFileSync(pyp, 'utf-8').match(/^name\s*=\s*"([^"]+)"/m);
                if (m) packageName = m[1];
            }
            break;
        }
        case 'java': {
            const pom = join(projectDir, 'pom.xml');
            if (existsSync(pom)) {
                const content = readFileSync(pom, 'utf-8');
                const nameMatch = content.match(/<name>([^<]+)<\/name>/);
                const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
                packageName = nameMatch?.[1]?.trim() || artifactMatch?.[1]?.trim() || '';
            }
            if (!packageName) {
                const settingsFile = existsSync(join(projectDir, 'settings.gradle.kts'))
                    ? join(projectDir, 'settings.gradle.kts')
                    : join(projectDir, 'settings.gradle');
                if (existsSync(settingsFile)) {
                    const m = readFileSync(settingsFile, 'utf-8').match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
                    if (m) packageName = m[1];
                }
            }
            break;
        }
        default: {
            packageName = pkgNameSync(projectDir);
            break;
        }
    }
    packageName = packageName || dn;
    return {
        packageName,
        appName: packageName,
        appDescription: '',
        ticketSystem: 'Jira',
        ticketPrefix: 'TICKET',
        legacyDescription: 'No legacy code',
    };
}

export function pkgNameSync(projectDir: string): string {
    const candidates = [join(projectDir, 'package.json'), join(projectDir, 'src', 'package.json')];
    for (const f of candidates) {
        if (existsSync(f)) {
            const m = readFileSync(f, 'utf-8').match(/"name"\s*:\s*"([^"]+)"/);
            if (m) return m[1];
        }
    }
    return '';
}
