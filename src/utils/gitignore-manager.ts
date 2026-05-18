import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

export function addToGitignore(projectDir: string): void {
    const gi = join(projectDir, '.gitignore');
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gi) && !existsSync(gitDir)) return;
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('ai-gov')) {
            appendFileSync(gi, '\n# AI governance CLI\nonboard.sh\n');
        }
    } catch { /* ignore */ }
}

export function addUsageLogsToGitignore(projectDir: string): void {
    const gi = join(projectDir, '.gitignore');
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gi) && !existsSync(gitDir)) return;
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('.ai-gov/usage-logs/')) {
            appendFileSync(gi, '\n# AI governance usage logs (local telemetry)\n.ai-gov/usage-logs/\n');
        }
    } catch { /* ignore */ }
}

export function addKnowledgeHubToGitFiles(projectDir: string): void {
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gitDir)) return;

    // .gitignore — exclude HTML exports (local sharing only, not for git)
    const gi = join(projectDir, '.gitignore');
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('knowledge/*.html')) {
            appendFileSync(gi, '\n# Knowledge hub HTML exports (local sharing only)\nknowledge/*.html\n');
        }
    } catch { /* ignore */ }

    // .gitattributes — merge=union so parallel knowledge edits don't conflict
    const ga = join(projectDir, '.gitattributes');
    try {
        const content = existsSync(ga) ? readFileSync(ga, 'utf-8') : '';
        if (!content.includes('knowledge/*.md')) {
            appendFileSync(ga, '\n# Knowledge hub — keep all additions from both sides on merge\nknowledge/*.md merge=union\n');
        }
    } catch { /* ignore */ }
}
