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
