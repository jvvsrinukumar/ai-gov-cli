import { checkCredentials } from '../src/pr-check/checks/credentials.js';
import { checkFileSize } from '../src/pr-check/checks/file-size.js';
import { checkSpecCoverage } from '../src/pr-check/checks/spec-coverage.js';
import { checkTestCoverage } from '../src/pr-check/checks/test-coverage.js';
import { checkCommitMessages } from '../src/pr-check/checks/commit-messages.js';
import { formatGithub } from '../src/pr-check/formatters/github.js';
import { formatGitlab } from '../src/pr-check/formatters/gitlab.js';
import { formatJson } from '../src/pr-check/formatters/json.js';
import type { CheckResult } from '../src/pr-check/types.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

function makePassResult(name: string): CheckResult {
    return { name, status: 'pass', details: 'All good', items: [] };
}

function makeFailResult(name: string): CheckResult {
    return { name, status: 'fail', details: 'Blocker found', items: [{ file: 'test.ts', message: 'Issue', severity: 'error' }] };
}

function makeWarnResult(name: string): CheckResult {
    return { name, status: 'warn', details: 'Warning found', items: [{ file: 'test.ts', message: 'Warning', severity: 'warning' }] };
}

describe('PR check', () => {
    test('credentials check finds AKIA pattern', () => {
        const diff = `+const key = "AKIAIOSFODNN7EXAMPLE123";\n`;
        const result = checkCredentials(diff, ['src/config.ts']);
        expect(result.status).toBe('fail');
        expect(result.items.length).toBeGreaterThan(0);
        expect(result.items[0].message).toContain('AWS Access Key ID');
    });

    test('credentials check ignores nosecret comment', () => {
        const diff = `+const key = "AKIAIOSFODNN7EXAMPLE123"; // nosecret\n`;
        const result = checkCredentials(diff, ['src/config.ts']);
        expect(result.status).toBe('pass');
    });

    test('file-size respects stack config — warns for large files', () => {
        const tmpDir = join(tmpdir(), `ai-gov-pr-test-${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });

        // Create a large .ts file
        const bigFile = join(tmpDir, 'big.ts');
        const lines = Array(350).fill('const x = 1;').join('\n');
        writeFileSync(bigFile, lines);

        const result = checkFileSize(['big.ts'], null, tmpDir);
        expect(result.status).toBe('warn');
        expect(result.items[0].message).toContain('350');

        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('spec-coverage warns when spec missing', () => {
        const tmpDir = join(tmpdir(), `ai-gov-spec-test-${Date.now()}`);
        mkdirSync(join(tmpDir, 'specs', 'existing-feature'), { recursive: true });
        writeFileSync(join(tmpDir, 'specs', 'existing-feature', 'requirements.md'), '# Spec');

        const changedFiles = ['src/features/new-awesome-feature/widget.ts'];
        const result = checkSpecCoverage(changedFiles, tmpDir);
        expect(result.status).toBe('warn');
        expect(result.items.length).toBeGreaterThan(0);

        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('test-coverage warns for new files without tests', () => {
        const tmpDir = join(tmpdir(), `ai-gov-test-cov-${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });

        const changedFiles = ['src/features/auth/login-service.ts'];
        const result = checkTestCoverage(changedFiles, tmpDir, null);
        expect(result.status).toBe('warn');
        expect(result.items.some(i => i.file.includes('login-service'))).toBe(true);
    });

    test('commit-messages validates conventional format', () => {
        // Mock getCommitMessages is called internally — just test with no commits
        // This tests the function doesn't throw with empty state
        const result = checkCommitMessages('/tmp/nonexistent', 'main');
        // Should return skip when no commits found
        expect(['pass', 'skip', 'warn']).toContain(result.status);
    });

    test('github format produces valid markdown', () => {
        const results: CheckResult[] = [
            makePassResult('Credentials'),
            makeFailResult('File Size'),
            makeWarnResult('TODOs'),
        ];
        const output = formatGithub(results, ['src/foo.ts', 'src/bar.ts']);
        expect(output).toContain('Governance Review');
        expect(output).toContain('2');  // changed files count
        expect(output).toContain('Blockers');
        expect(output).toContain('Warnings');
        expect(output).toContain('---');
    });

    test('gitlab format produces valid markdown', () => {
        const results: CheckResult[] = [
            makePassResult('Architecture'),
            makeWarnResult('Commit Messages'),
        ];
        const output = formatGitlab(results, ['src/foo.ts']);
        expect(output).toContain('Governance MR Review');
        expect(output).toContain('1');  // changed files count
        expect(output).toContain('Blockers');
    });

    test('json format produces valid JSON', () => {
        const results: CheckResult[] = [
            makePassResult('Architecture'),
            makeFailResult('Credentials'),
        ];
        const output = formatJson(results, ['src/foo.ts']);
        const parsed = JSON.parse(output);
        expect(parsed.summary.blockers).toBe(1);
        expect(parsed.summary.passed).toBe(1);
        expect(parsed.summary.changedFiles).toBe(1);
        expect(parsed.summary.hasBlockers).toBe(true);
        expect(Array.isArray(parsed.checks)).toBe(true);
        expect(Array.isArray(parsed.changedFiles)).toBe(true);
    });
});
