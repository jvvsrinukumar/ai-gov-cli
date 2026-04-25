import { existsSync } from 'fs';
import { join } from 'path';
import type { CheckResult } from '../types.js';

export function checkPRDescription(projectDir: string): CheckResult {
    // In CLI context, check if PR template exists
    const templatePaths = [
        join(projectDir, '.github', 'PULL_REQUEST_TEMPLATE.md'),
        join(projectDir, '.github', 'pull_request_template.md'),
        join(projectDir, 'PULL_REQUEST_TEMPLATE.md'),
        join(projectDir, 'docs', 'pull_request_template.md'),
    ];

    const hasTemplate = templatePaths.some(p => existsSync(p));

    if (!hasTemplate) {
        return {
            name: 'PR Description',
            status: 'skip',
            details: 'No PR template found — not applicable in CLI context',
            items: [],
        };
    }

    return {
        name: 'PR Description',
        status: 'pass',
        details: 'PR template exists',
        items: [],
    };
}
