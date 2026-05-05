import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { GovernanceConfig } from '../../types.js';
import type { CheckResult } from '../types.js';

export function checkArchitecture(changedFiles: string[], config: GovernanceConfig | null, projectDir?: string): CheckResult {
    const items: CheckResult['items'] = [];

    // Try to read layer flow from governance config, or fall back to steering files
    let layerFlow = config?.profile?.layerFlow || '';
    if (!layerFlow && projectDir) {
        // Check Claude Code: .claude/CLAUDE.md, then Kiro: .kiro/steering/architecture.md
        const candidates = [
            join(projectDir, '.claude', 'CLAUDE.md'),
            join(projectDir, '.kiro', 'steering', 'architecture.md'),
        ];
        for (const candidate of candidates) {
            if (!existsSync(candidate)) continue;
            try {
                const content = readFileSync(candidate, 'utf-8');
                const match = content.match(/Never skip a layer.*?`([^`]+)`/);
                if (match) { layerFlow = match[1]; break; }
            } catch { /* ignore */ }
        }
    }

    if (!layerFlow) {
        return { name: 'Architecture', status: 'skip', details: 'No layer flow configured', items: [] };
    }

    // Simple heuristic: detect if UI files directly import from data layer
    // Patterns to detect cross-layer violations
    const uiPatterns = ['/ui/', '/screens/', '/pages/', '/components/', '/views/'];
    const dataPatterns = ['/data/', '/repository/', '/repositories/', '/dao/', '/db/'];

    const uiFiles = changedFiles.filter(f => uiPatterns.some(p => f.includes(p)));
    const dataFiles = changedFiles.filter(f => dataPatterns.some(p => f.includes(p)));

    if (uiFiles.length > 0 && dataFiles.length > 0) {
        items.push({
            file: uiFiles[0],
            message: `UI and data layer files changed together — verify no direct UI→data dependency`,
            severity: 'warning',
        });
    }

    if (items.length === 0) {
        return { name: 'Architecture', status: 'pass', details: 'No layer boundary violations detected', items: [] };
    }

    return {
        name: 'Architecture',
        status: 'warn',
        details: `${items.length} potential layer boundary issue(s)`,
        items,
    };
}
