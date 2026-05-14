import { readFileSync } from 'fs';

export function validateGitHooksConfig(configPath: string): string[] {
    const issues: string[] = [];
    let cfg: Record<string, unknown>;
    try {
        cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
        return ['config.json is not valid JSON — fix syntax errors'];
    }

    const preCommit = cfg['pre-commit'];
    if (preCommit !== undefined && typeof preCommit !== 'object') {
        issues.push('"pre-commit" must be an object');
        return issues;
    }
    const pc = (preCommit ?? {}) as Record<string, unknown>;

    const checks = ['file-size', 'secrets', 'no-todos', 'no-debug', 'format-check', 'lint-check'];
    for (const name of checks) {
        const section = pc[name];
        if (section === undefined) continue;
        if (typeof section !== 'object' || section === null) {
            issues.push(`pre-commit.${name} must be an object`);
            continue;
        }
        const s = section as Record<string, unknown>;
        if ('enabled' in s && typeof s.enabled !== 'boolean') {
            issues.push(`pre-commit.${name}.enabled must be true or false (got ${JSON.stringify(s.enabled)})`);
        }
        if (name === 'file-size' && 'max-lines' in s && typeof s['max-lines'] !== 'number') {
            issues.push(`pre-commit.file-size.max-lines must be a number (got ${JSON.stringify(s['max-lines'])})`);
        }
    }

    const commitMsg = cfg['commit-msg'];
    if (commitMsg !== undefined) {
        if (typeof commitMsg !== 'object' || commitMsg === null) {
            issues.push('"commit-msg" must be an object');
        } else {
            const cm = commitMsg as Record<string, unknown>;
            if ('conventional-commits' in cm && typeof cm['conventional-commits'] !== 'boolean') {
                issues.push('commit-msg.conventional-commits must be true or false');
            }
            if ('require-ticket-ref' in cm && typeof cm['require-ticket-ref'] !== 'boolean') {
                issues.push('commit-msg.require-ticket-ref must be true or false');
            }
            if ('min-description-length' in cm && typeof cm['min-description-length'] !== 'number') {
                issues.push('commit-msg.min-description-length must be a number');
            }
        }
    }

    return issues;
}
