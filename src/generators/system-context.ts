import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import type { GovernanceConfig } from '../types.js';

/**
 * Generates system-context.md for Kiro only.
 * Scans .kiro/notes/ at generation time and auto-links every .md file found.
 * Returns null if the notes directory does not exist or has no .md files — skip generation entirely.
 */
export function generateSystemContext(c: GovernanceConfig): string | null {
    const notesDir = join(c.projectDir, '.kiro', 'notes');
    if (!existsSync(notesDir)) return null;

    let noteFiles: string[] = [];
    try {
        noteFiles = readdirSync(notesDir).filter(f => f.endsWith('.md')).sort();
    } catch {
        return null;
    }
    if (noteFiles.length === 0) return null;

    const refs = noteFiles.map(f => `- #[[file:.kiro/notes/${f}]]`).join('\n');

    return `# System Context — ${c.project.appName}

> Auto-generated index of notes. Add \`#[[file:.kiro/notes/<file>.md]]\` to include in any session.
> To update: re-run \`ai-gov init\` after adding or removing files from \`.kiro/notes/\`.

## Architecture Notes
${refs}
`;
}
