import type { CheckResult } from '../types.js';

const AKIA_PATTERN = /AKIA[0-9A-Z]{16}/;
const CREDENTIAL_PATTERN = /(secret_?key|access_?key|api_?key|api_?token|auth_?token|password|passwd|private_?key)\s*[=:]\s*["'][A-Za-z0-9/+_-]{20,}/i;
const NOSECRET_PATTERN = /nosecret|no.secret|ai-gov:ignore/i;

export function checkCredentials(diff: string, _changedFiles: string[]): CheckResult {
    const items: CheckResult['items'] = [];
    const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));

    for (const line of addedLines) {
        if (AKIA_PATTERN.test(line)) {
            if (!NOSECRET_PATTERN.test(line)) {
                items.push({
                    file: 'diff',
                    message: `AWS Access Key ID detected (AKIA pattern) — use environment variables`,
                    severity: 'error',
                });
                break;
            }
        }
    }

    for (const line of addedLines) {
        if (CREDENTIAL_PATTERN.test(line)) {
            if (!NOSECRET_PATTERN.test(line) && !/example|placeholder|changeme|your.key|xxxxx/i.test(line)) {
                items.push({
                    file: 'diff',
                    message: `Credential pattern detected — use environment variables or secrets manager`,
                    severity: 'error',
                });
                break;
            }
        }
    }

    if (items.length === 0) {
        return { name: 'Credentials', status: 'pass', details: 'No credentials detected in diff', items: [] };
    }

    return {
        name: 'Credentials',
        status: 'fail',
        details: `${items.length} potential credential(s) found`,
        items,
    };
}
