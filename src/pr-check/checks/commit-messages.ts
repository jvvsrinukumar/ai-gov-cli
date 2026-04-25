import { getCommitMessages } from '../../utils/git.js';
import type { CheckResult } from '../types.js';

const CONVENTIONAL_TYPES = ['feat', 'fix', 'refactor', 'hotfix', 'docs', 'test', 'chore', 'style', 'perf', 'ci', 'build'];
const CONVENTIONAL_PATTERN = new RegExp(`^(${CONVENTIONAL_TYPES.join('|')})(\\([a-zA-Z0-9_-]+\\))?: .{10,}`);
const SKIP_PATTERNS = [/^Merge /, /^Revert /, /^(fixup|squash)! /];

export function checkCommitMessages(projectDir: string, baseBranch: string): CheckResult {
    const messages = getCommitMessages(projectDir, baseBranch);

    if (messages.length === 0) {
        return { name: 'Commit Messages', status: 'skip', details: 'No commits found on branch', items: [] };
    }

    const items: CheckResult['items'] = [];

    for (const msg of messages) {
        // Skip merge/revert/fixup
        if (SKIP_PATTERNS.some(p => p.test(msg))) continue;

        if (!CONVENTIONAL_PATTERN.test(msg)) {
            items.push({
                file: 'commit',
                message: `Non-conventional commit: "${msg}" — expected <type>(<scope>): <description>`,
                severity: 'warning',
            });
        }
    }

    if (items.length === 0) {
        return {
            name: 'Commit Messages',
            status: 'pass',
            details: `All ${messages.length} commit(s) follow conventional format`,
            items: [],
        };
    }

    return {
        name: 'Commit Messages',
        status: 'warn',
        details: `${items.length} commit(s) don't follow conventional format`,
        items,
    };
}
