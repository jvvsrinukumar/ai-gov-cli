import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { GovernanceConfig } from '../../types.js';
import type { CheckResult } from '../types.js';

const FRONTEND_EXTENSIONS = ['.dart', '.tsx', '.jsx', '.ts', '.kt'];
const MAX_LINES = 300;

export function checkFileSize(changedFiles: string[], config: GovernanceConfig | null, projectDir?: string): CheckResult {
    const items: CheckResult['items'] = [];
    const maxLines = MAX_LINES;
    const root = projectDir || process.cwd();

    for (const file of changedFiles) {
        // Skip test files
        if (/\.(test|spec)\.|_test\.|\.stories\./.test(file)) continue;

        // For frontend-only stacks, check relevant extensions
        const ext = '.' + file.split('.').pop();
        const isFrontendFile = FRONTEND_EXTENSIONS.includes(ext);

        // For backend stacks, check all source files
        const isBackend = config ? config.isBackend : false;
        if (!isBackend && !isFrontendFile) continue;

        const fullPath = join(root, file);
        if (!existsSync(fullPath)) continue;

        try {
            const content = readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n').length;
            if (lines > maxLines) {
                items.push({
                    file,
                    message: `${lines} lines (max ${maxLines}) — consider splitting into smaller modules`,
                    severity: 'warning',
                });
            }
        } catch { /* ignore unreadable files */ }
    }

    if (items.length === 0) {
        return { name: 'File Size', status: 'pass', details: 'All files within size limits', items: [] };
    }

    return {
        name: 'File Size',
        status: 'warn',
        details: `${items.length} file(s) exceed ${maxLines} lines`,
        items,
    };
}
