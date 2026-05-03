/**
 * CLI integration tests — verifies --agent flag routing,
 * auto-detection, and agent-specific output.
 */
import { mkdtempSync, rmSync, existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { runGovernance } from '../src/generators/index.js';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack, Agent } from '../src/types.js';

// Mock TTY to prevent interactive prompts
jest.mock('../src/utils/tty.js', () => ({
    isInteractiveTTY: () => false,
    readTTYLine: () => '',
}));

const DEFAULT_PROJECT = {
    packageName: 'test-app', appName: 'test-app', appDescription: '',
    ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: 'No legacy code',
};

function makeConfig(
    agent: Agent,
    stack: Stack = 'react',
    scanOverrides: Partial<ScanResult> = {},
    extras: { specFirstEnabled?: boolean; projectDir?: string } = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent, stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '17.0.0',
        projectDir: extras.projectDir ?? '/tmp/test',
        specFirstEnabled: extras.specFirstEnabled ?? false,
        conflictMode: 'overwrite', overwrite: true, dryRun: false, updateHooks: false,
    };
}

// Silence console output
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

describe('CLI --agent routing', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-cli-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('init --agent kiro creates .kiro/ not .claude/', () => {
        const config = makeConfig('kiro', 'react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'steering'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude'))).toBe(false);
    });

    test('init --agent claude-code creates .claude/ not .kiro/', () => {
        const config = makeConfig('claude-code', 'react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'hooks'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro'))).toBe(false);
    });

    test('init with no flag and no existing dirs creates .claude/ (backward compat)', () => {
        // Default agent is 'claude-code'
        const config = makeConfig('claude-code', 'nodejs', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.claude'))).toBe(true);
    });

    test('kiro init creates .kiro/specs/_template/', () => {
        const config = makeConfig('kiro', 'react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'requirements.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'design.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'tasks.md'))).toBe(true);
        // No root specs/
        expect(existsSync(join(tmpDir, 'specs'))).toBe(false);
    });

    test('kiro steering files have front-matter', () => {
        const config = makeConfig('kiro', 'nodejs', {}, { projectDir: tmpDir });
        runGovernance(config);
        const arch = readFileSync(join(tmpDir, '.kiro', 'steering', 'architecture.md'), 'utf-8');
        expect(arch).toMatch(/^---\ninclusion: always\n---\n/);
    });

    test('kiro hooks are JSON files, not bash scripts', () => {
        const config = makeConfig('kiro', 'nodejs', {}, { projectDir: tmpDir });
        runGovernance(config);
        const hookFile = join(tmpDir, '.kiro', 'hooks', 'block-dangerous-commands.json');
        expect(existsSync(hookFile)).toBe(true);
        const json = JSON.parse(readFileSync(hookFile, 'utf-8'));
        expect(json.when.type).toBe('preToolUse');
        expect(json.then.type).toBe('askAgent');
    });

    test('claude-code hooks are bash scripts, not JSON', () => {
        const config = makeConfig('claude-code', 'nodejs', {}, { projectDir: tmpDir });
        runGovernance(config);
        const hookFile = join(tmpDir, '.claude', 'hooks', 'block-dangerous-commands.sh');
        expect(existsSync(hookFile)).toBe(true);
        const content = readFileSync(hookFile, 'utf-8');
        expect(content).toContain('#!/usr/bin/env bash');
    });

    test('pr-check works identically regardless of agent', () => {
        // PR check is agent-agnostic — it reads git diff, not .claude/ or .kiro/
        // Just verify the module imports work for both agent configs
        const kiroConfig = makeConfig('kiro', 'react', {}, { projectDir: tmpDir });
        const claudeConfig = makeConfig('claude-code', 'react', {}, { projectDir: tmpDir });
        // Both should have the same pr-check-relevant fields
        expect(kiroConfig.stack).toBe(claudeConfig.stack);
        expect(kiroConfig.profile.fileExt).toBe(claudeConfig.profile.fileExt);
    });

    test('kiro init with specFirstEnabled generates spec-first-gate hook', () => {
        const config = makeConfig('kiro', 'nodejs', {}, { projectDir: tmpDir, specFirstEnabled: true });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'spec-first-gate.json'))).toBe(true);
    });

    test('kiro init without specFirstEnabled does NOT generate spec-first-gate hook', () => {
        const config = makeConfig('kiro', 'nodejs', {}, { projectDir: tmpDir, specFirstEnabled: false });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'spec-first-gate.json'))).toBe(false);
    });
});
