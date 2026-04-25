import { execSync } from 'child_process';

export function getChangedFiles(projectDir: string, baseBranch: string): string[] {
    try {
        const out = execSync(
            `git diff --name-only ${baseBranch}...HEAD`,
            { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        return out ? out.split('\n').filter(Boolean) : [];
    } catch {
        return [];
    }
}

export function getDiff(projectDir: string, baseBranch: string): string {
    try {
        return execSync(
            `git diff ${baseBranch}...HEAD`,
            { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 }
        ).toString();
    } catch {
        return '';
    }
}

export function getCommitMessages(projectDir: string, baseBranch: string): string[] {
    try {
        const out = execSync(
            `git log ${baseBranch}...HEAD --format=%s`,
            { cwd: projectDir, stdio: ['pipe', 'pipe', 'pipe'] }
        ).toString().trim();
        return out ? out.split('\n').filter(Boolean) : [];
    } catch {
        return [];
    }
}
