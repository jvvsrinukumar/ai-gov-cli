import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import type { CheckResult } from '../types.js';

/**
 * Extracts the git hash from a knowledge file's Generated line.
 * Format: "Generated: 2026-05-07 (git: a3f8c12)"
 */
function extractGitHash(content: string): string | null {
    const match = content.match(/Generated:.*\(git:\s*([a-f0-9]+)\)/i);
    return match?.[1] ?? null;
}

/**
 * Returns the number of files and lines changed in source paths since a given hash.
 */
function diffStatSince(projectDir: string, hash: string, sourcePaths: string[]): { files: number; lines: number } {
    try {
        const pathArgs = sourcePaths.map(p => `"${p}"`).join(' ');
        const out = execSync(
            `git diff --stat ${hash}..HEAD -- ${pathArgs}`,
            { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString();

        // Last line: "7 files changed, 312 insertions(+), 48 deletions(-)"
        const summary = out.split('\n').filter(Boolean).pop() ?? '';
        const files = parseInt(summary.match(/(\d+) file/)?.[1] ?? '0', 10);
        const insertions = parseInt(summary.match(/(\d+) insertion/)?.[1] ?? '0', 10);
        const deletions = parseInt(summary.match(/(\d+) deletion/)?.[1] ?? '0', 10);
        return { files, lines: insertions + deletions };
    } catch {
        return { files: 0, lines: 0 };
    }
}

export function checkKnowledgeFreshness(projectDir: string): CheckResult {
    const knowledgeDir = join(projectDir, 'knowledge');

    if (!existsSync(knowledgeDir)) {
        return {
            name: 'Knowledge Freshness',
            status: 'skip',
            details: 'No knowledge/ directory — run /tech-knowledge to initialize',
            items: [],
        };
    }

    let knowledgeFiles: string[] = [];
    try {
        knowledgeFiles = readdirSync(knowledgeDir)
            .filter(f => f.startsWith('tech-') && f.endsWith('.md'))
            .map(f => join(knowledgeDir, f));
    } catch {
        return { name: 'Knowledge Freshness', status: 'skip', details: 'Cannot read knowledge/ directory', items: [] };
    }

    if (knowledgeFiles.length === 0) {
        return {
            name: 'Knowledge Freshness',
            status: 'skip',
            details: 'No tech-*.md files in knowledge/ — run /tech-knowledge',
            items: [],
        };
    }

    const items: CheckResult['items'] = [];
    const DRIFT_FILE_THRESHOLD = 10;
    const DRIFT_LINE_THRESHOLD = 200;

    for (const filePath of knowledgeFiles) {
        let content: string;
        try {
            content = readFileSync(filePath, 'utf-8');
        } catch {
            continue;
        }

        const hash = extractGitHash(content);
        if (!hash) continue;

        // Derive the source path from the scope slug in the filename
        // knowledge/tech-auth.md → scope: auth → check src/ and common source paths
        const scope = filePath.split('/').pop()!.replace('tech-', '').replace('.md', '');
        const sourcePaths = ['src/', 'lib/', 'app/', `src/${scope}`, `lib/${scope}`, `app/${scope}`];

        const { files, lines } = diffStatSince(projectDir, hash, sourcePaths);

        if (files > DRIFT_FILE_THRESHOLD || lines > DRIFT_LINE_THRESHOLD) {
            const knowledgeRelPath = `knowledge/${filePath.split('/knowledge/')[1]}`;
            items.push({
                file: knowledgeRelPath,
                message: `Significant drift since last generation: ${files} files changed, ${lines} lines delta. Re-run /tech-knowledge ${scope} before next release.`,
                severity: 'warning',
            });
        }
    }

    if (items.length === 0) {
        return {
            name: 'Knowledge Freshness',
            status: 'pass',
            details: `${knowledgeFiles.length} tech knowledge file(s) — no significant drift detected`,
            items: [],
        };
    }

    return {
        name: 'Knowledge Freshness',
        status: 'warn',
        details: `${items.length} knowledge file(s) may be stale — review before release`,
        items,
    };
}
