import type { CheckResult } from '../types.js';

const AKIA_PATTERN = /AKIA[0-9A-Z]{16}/;
const CREDENTIAL_PATTERN = /(secret_?key|access_?key|api_?key|api_?token|auth_?token|password|passwd|private_?key)\s*[=:]\s*["'][A-Za-z0-9/+_-]{20,}/i;
const NOSECRET_PATTERN = /nosecret|no.secret|ai-gov:ignore/i;
const TEST_FILE_PATTERN = /\/(test|tests|__tests__|spec|specs|fixtures|mocks|__mocks__|factories)\/|\.test\.|\.spec\.|_test\./;

/** Parse diff into per-file added lines, skipping test files. */
function getAddedLinesByFile(diff: string): Map<string, string[]> {
    const result = new Map<string, string[]>();
    let currentFile = '';
    for (const line of diff.split('\n')) {
        if (line.startsWith('+++ b/')) {
            currentFile = line.slice(6);
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
            if (!TEST_FILE_PATTERN.test(currentFile)) {
                const lines = result.get(currentFile) ?? [];
                lines.push(line);
                result.set(currentFile, lines);
            }
        }
    }
    return result;
}

export function checkCredentials(diff: string, _changedFiles: string[]): CheckResult {
    const items: CheckResult['items'] = [];
    const fileLines = getAddedLinesByFile(diff);

    for (const [file, lines] of fileLines) {
        for (const line of lines) {
            if (AKIA_PATTERN.test(line) && !NOSECRET_PATTERN.test(line)) {
                items.push({
                    file,
                    message: `AWS Access Key ID detected (AKIA pattern) — use environment variables`,
                    severity: 'error',
                });
                break;
            }
        }
    }

    for (const [file, lines] of fileLines) {
        if (items.some(i => i.file === file)) continue; // already flagged
        for (const line of lines) {
            if (CREDENTIAL_PATTERN.test(line) &&
                !NOSECRET_PATTERN.test(line) &&
                !/example|placeholder|changeme|your.key|xxxxx/i.test(line)) {
                items.push({
                    file,
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
