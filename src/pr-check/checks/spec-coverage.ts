import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { CheckResult } from '../types.js';

export function checkSpecCoverage(changedFiles: string[], projectDir: string): CheckResult {
    const items: CheckResult['items'] = [];
    const specsDir = join(projectDir, 'specs');

    if (!existsSync(specsDir)) {
        return { name: 'Spec Coverage', status: 'skip', details: 'No specs/ directory found', items: [] };
    }

    // Feature file patterns: files in features/ lib/features/ src/features/
    const featureFiles = changedFiles.filter(f =>
        f.includes('/features/') || f.includes('/feature/')
    );

    if (featureFiles.length === 0) {
        return { name: 'Spec Coverage', status: 'pass', details: 'No feature files changed', items: [] };
    }

    // Get existing spec directories (feature-level, not file-level)
    let specDirs: string[] = [];
    try {
        specDirs = readdirSync(specsDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name !== '_template')
            .map(d => d.name.toLowerCase().replace(/[_\-.]/g, ''));
    } catch { /* ignore */ }

    // Extract unique feature directory names from changed files
    // e.g. src/features/user-auth/LoginScreen.tsx → "userauth"
    const checkedFeatures = new Set<string>();

    for (const file of featureFiles) {
        const parts = file.split('/');
        const featIdx = parts.findIndex(p => p === 'features' || p === 'feature');
        if (featIdx === -1 || featIdx + 1 >= parts.length) continue;

        const featureDir = parts[featIdx + 1].toLowerCase().replace(/[_\-.]/g, '');
        if (checkedFeatures.has(featureDir)) continue;
        checkedFeatures.add(featureDir);

        const hasSpec = specDirs.some(s => s === featureDir || s.includes(featureDir) || featureDir.includes(s));

        if (!hasSpec) {
            items.push({
                file: `${parts.slice(0, featIdx + 2).join('/')}/`,
                message: `No matching spec found in specs/ for feature "${parts[featIdx + 1]}"`,
                severity: 'warning',
            });
        }
    }

    if (items.length === 0) {
        return { name: 'Spec Coverage', status: 'pass', details: 'All feature files have matching specs', items: [] };
    }

    return {
        name: 'Spec Coverage',
        status: 'warn',
        details: `${items.length} feature file(s) missing specs`,
        items,
    };
}
