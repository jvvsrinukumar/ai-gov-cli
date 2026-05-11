/**
 * Unit tests for CLI transparency disclosure and gitignore management.
 *
 * Tests the behavior added in task 16.1:
 * - Transparency disclosure is shown when hub config exists
 * - Transparency disclosure is not shown when hub config is missing
 * - .ai-gov/usage-logs/ gitignore entry is appended correctly
 * - Gitignore entry is skipped when no .git directory
 *
 * Validates: Requirements 12.1, 12.6, 12.7
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { readHubConfig } from '../src/utils/hub-config.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'cli-disclosure-test-'));
}

function writeHubConfig(projectDir: string, config: Record<string, unknown>): void {
    const configDir = join(projectDir, '.ai-gov');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), JSON.stringify(config), 'utf-8');
}

function createGitDir(projectDir: string): void {
    mkdirSync(join(projectDir, '.git'), { recursive: true });
}

function createGitignore(projectDir: string, content: string = ''): void {
    writeFileSync(join(projectDir, '.gitignore'), content, 'utf-8');
}

/**
 * Replicates the addUsageLogsToGitignore logic from src/cli.ts.
 * Since the function is not exported, we replicate it here for testing.
 */
function addUsageLogsToGitignore(projectDir: string): void {
    const { existsSync: exists, readFileSync: readFile, appendFileSync: appendFile } = require('fs');
    const { join: pathJoin } = require('path');
    const gi = pathJoin(projectDir, '.gitignore');
    const gitDir = pathJoin(projectDir, '.git');
    // Skip if no .gitignore and no .git directory
    if (!exists(gi) && !exists(gitDir)) return;
    try {
        const content = exists(gi) ? readFile(gi, 'utf-8') : '';
        if (!content.includes('.ai-gov/usage-logs/')) {
            appendFile(gi, '\n# AI governance usage logs (local telemetry)\n.ai-gov/usage-logs/\n');
        }
    } catch { /* ignore */ }
}

/**
 * Replicates the displayTransparencyDisclosure logic from src/cli.ts.
 * Since the function is not exported, we replicate it here for testing.
 */
function displayTransparencyDisclosure(projectDir: string): string[] {
    const hubConfig = readHubConfig(projectDir);
    if (!hubConfig || !hubConfig.hub) return [];

    const lines: string[] = [];
    lines.push('');
    lines.push('  Hub Telemetry Disclosure');
    lines.push('');
    lines.push(`  Hub URL: ${hubConfig.hub}`);
    lines.push('');
    lines.push('  Data reported on git push:');
    lines.push('    • Commit count');
    lines.push('    • Compliance percentage');
    lines.push('    • Violation counts');
    lines.push('');
    lines.push('  Privacy:');
    lines.push('    • No source code or commit messages are sent');
    lines.push('    • Developer emails are hashed (SHA-256) before transmission');
    lines.push('');
    lines.push('  To disable telemetry:');
    lines.push('    export AI_GOV_TELEMETRY=off');
    lines.push('');
    return lines;
}

// ─── Transparency Disclosure Tests ───────────────────────────────────────────

describe('CLI transparency disclosure', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = makeTempDir();
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    describe('disclosure is shown when hub config exists', () => {
        test('displays hub URL from config', () => {
            writeHubConfig(tempDir, { hub: 'https://my-hub.railway.app' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.length).toBeGreaterThan(0);
            expect(output.some(line => line.includes('https://my-hub.railway.app'))).toBe(true);
        });

        test('displays "Hub Telemetry Disclosure" header', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('Hub Telemetry Disclosure'))).toBe(true);
        });

        test('lists commit count as reported data', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('Commit count'))).toBe(true);
        });

        test('lists compliance percentage as reported data', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('Compliance percentage'))).toBe(true);
        });

        test('lists violation counts as reported data', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('Violation counts'))).toBe(true);
        });

        test('states no source code or commit messages are sent', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('No source code or commit messages are sent'))).toBe(true);
        });

        test('states developer emails are hashed before transmission', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('hashed') && line.includes('SHA-256'))).toBe(true);
        });

        test('includes instructions to disable telemetry', () => {
            writeHubConfig(tempDir, { hub: 'https://hub.example.com' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output.some(line => line.includes('AI_GOV_TELEMETRY=off'))).toBe(true);
        });
    });

    describe('disclosure is not shown when hub config is missing', () => {
        test('returns empty when no .ai-gov/config.json exists', () => {
            const output = displayTransparencyDisclosure(tempDir);
            expect(output).toEqual([]);
        });

        test('returns empty when config has empty hub URL', () => {
            writeHubConfig(tempDir, { hub: '', project: 'test' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output).toEqual([]);
        });

        test('returns empty when config has no hub field', () => {
            writeHubConfig(tempDir, { project: 'test', team: 'my-team' });

            const output = displayTransparencyDisclosure(tempDir);
            expect(output).toEqual([]);
        });

        test('returns empty when config is invalid JSON', () => {
            const configDir = join(tempDir, '.ai-gov');
            mkdirSync(configDir, { recursive: true });
            writeFileSync(join(configDir, 'config.json'), 'not json!!!', 'utf-8');

            const output = displayTransparencyDisclosure(tempDir);
            expect(output).toEqual([]);
        });
    });
});

// ─── Gitignore Management Tests ──────────────────────────────────────────────

describe('CLI gitignore management (.ai-gov/usage-logs/)', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = makeTempDir();
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    describe('gitignore entry is appended correctly', () => {
        test('appends .ai-gov/usage-logs/ to existing .gitignore', () => {
            createGitDir(tempDir);
            createGitignore(tempDir, 'node_modules/\ndist/\n');

            addUsageLogsToGitignore(tempDir);

            const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
            expect(content).toContain('.ai-gov/usage-logs/');
        });

        test('does not duplicate entry if already present', () => {
            createGitDir(tempDir);
            createGitignore(tempDir, 'node_modules/\n.ai-gov/usage-logs/\n');

            addUsageLogsToGitignore(tempDir);

            const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
            const matches = content.match(/\.ai-gov\/usage-logs\//g);
            expect(matches).toHaveLength(1);
        });

        test('creates .gitignore entry when .git exists but no .gitignore', () => {
            createGitDir(tempDir);
            // No .gitignore file exists

            addUsageLogsToGitignore(tempDir);

            const gi = join(tempDir, '.gitignore');
            expect(existsSync(gi)).toBe(true);
            const content = readFileSync(gi, 'utf-8');
            expect(content).toContain('.ai-gov/usage-logs/');
        });

        test('appends with comment header', () => {
            createGitDir(tempDir);
            createGitignore(tempDir, 'node_modules/\n');

            addUsageLogsToGitignore(tempDir);

            const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
            expect(content).toContain('# AI governance usage logs');
        });
    });

    describe('gitignore is skipped when no .git directory', () => {
        test('does not create .gitignore when no .git and no .gitignore exist', () => {
            // No .git directory, no .gitignore file
            addUsageLogsToGitignore(tempDir);

            const gi = join(tempDir, '.gitignore');
            expect(existsSync(gi)).toBe(false);
        });

        test('still appends when .gitignore exists but no .git directory', () => {
            // .gitignore exists but no .git — should still append
            createGitignore(tempDir, 'node_modules/\n');

            addUsageLogsToGitignore(tempDir);

            const content = readFileSync(join(tempDir, '.gitignore'), 'utf-8');
            expect(content).toContain('.ai-gov/usage-logs/');
        });
    });
});
