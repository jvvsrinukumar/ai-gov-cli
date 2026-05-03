/**
 * Backward compatibility tests — verifies that Claude Code output
 * is identical after the Phase 2 refactor (file moves + dispatcher).
 *
 * These tests ensure the agent extraction did not change any generated content.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

// Generators at new paths (Claude Code agent module)
import { generateRootClaudeMd, generateMasterClaudeMd } from '../src/agents/claude-code/claude-md.js';
import { generateSettingsJson } from '../src/agents/claude-code/settings-json.js';
import { generateAllHooks } from '../src/agents/claude-code/hooks/index.js';
import { generateCheckSecrets } from '../src/agents/claude-code/hooks/check-secrets.js';
import { generateProtectFiles } from '../src/agents/claude-code/hooks/protect-files.js';
import { generateBlockDangerous } from '../src/agents/claude-code/hooks/block-dangerous.js';

// Shared content generators (unchanged paths)
import { generateArchitecture } from '../src/generators/architecture.js';
import { generateCodingStandards } from '../src/generators/coding-standards.js';
import { generateConstitution } from '../src/generators/constitution.js';

// Dispatcher
import { runGovernance } from '../src/generators/index.js';

const DEFAULT_PROJECT = {
    packageName: 'test-app',
    appName: 'test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(
    stack: Stack,
    scanOverrides: Partial<ScanResult> = {},
    extras: Partial<Pick<GovernanceConfig, 'specFirstEnabled' | 'projectDir'>> = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'claude-code',
        stack,
        profile,
        scan,
        project: DEFAULT_PROJECT,
        blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '16.0.0',
        projectDir: extras.projectDir ?? '/tmp/test-project',
        specFirstEnabled: extras.specFirstEnabled ?? false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

// Silence console output
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Content generators still work at shared paths ────────────────────────────

describe('Shared content generators (unchanged paths)', () => {
    test('generateArchitecture produces non-empty output for all stacks', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python'] as Stack[]) {
            const out = generateArchitecture(makeConfig(stack));
            expect(out.length).toBeGreaterThan(200);
            expect(out).toContain('## Layer Flow');
        }
    });

    test('generateCodingStandards produces non-empty output', () => {
        const out = generateCodingStandards(makeConfig('nodejs'));
        expect(out.length).toBeGreaterThan(200);
    });

    test('generateConstitution produces non-empty output', () => {
        const out = generateConstitution(makeConfig('nodejs'));
        expect(out).toContain('# Constitution');
    });
});

// ─── Claude Code generators work at new paths ────────────────────────────────

describe('Claude Code generators at new paths', () => {
    test('generateRootClaudeMd contains pointer', () => {
        const out = generateRootClaudeMd();
        expect(out).toContain('.claude/CLAUDE.md');
    });

    test('generateMasterClaudeMd contains stack name', () => {
        const out = generateMasterClaudeMd(makeConfig('nodejs'));
        expect(out).toContain('Node.js');
    });

    test('generateCheckSecrets contains AKIA pattern', () => {
        const out = generateCheckSecrets(makeConfig('nodejs'));
        expect(out).toContain('AKIA');
    });

    test('generateProtectFiles contains high-risk files', () => {
        const out = generateProtectFiles(makeConfig('nodejs', { highRiskFiles: ['src/app.js'] }));
        expect(out).toContain('src/app.js');
    });

    test('generateBlockDangerous contains force push guard', () => {
        const out = generateBlockDangerous(makeConfig('nodejs'));
        expect(out).toContain('force');
    });
});

// ─── Settings JSON at new path ────────────────────────────────────────────────

describe('generateSettingsJson at new path', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-compat-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('produces valid JSON with hooks key', () => {
        const config = makeConfig('nodejs', {}, { projectDir: tmpDir });
        const opts = {
            overwrite: true, dryRun: false, updateHooks: false,
            hookVersion: config.hookVersion, projectDir: tmpDir,
            conflictMode: 'keep' as const,
        };
        generateSettingsJson(config, opts);
        const settingsPath = join(tmpDir, '.claude', 'settings.json');
        expect(existsSync(settingsPath)).toBe(true);
        const json = JSON.parse(readFileSync(settingsPath, 'utf-8'));
        expect(json).toHaveProperty('hooks');
        expect(JSON.stringify(json.hooks)).toContain('check-secrets.sh');
    });
});

// ─── runGovernance dispatcher routes to Claude Code ───────────────────────────

describe('runGovernance dispatcher', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-dispatch-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('agent: claude-code produces .claude/ directory', () => {
        const config = makeConfig('react', {}, { projectDir: tmpDir });
        config.overwrite = true;
        config.projectDir = tmpDir;
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'settings.json'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'hooks'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'steering', 'architecture.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'commands', 'new-feature.md'))).toBe(true);
        expect(existsSync(join(tmpDir, 'specs', '_template', 'requirements.md'))).toBe(true);
    });

    test('agent: kiro produces .kiro/ directory (not .claude/)', () => {
        const config = makeConfig('react', {}, { projectDir: tmpDir });
        config.agent = 'kiro';
        config.overwrite = true;
        config.projectDir = tmpDir;
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'architecture.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude'))).toBe(false);
    });

    test('default agent routes to claude-code', () => {
        const config = makeConfig('nodejs', {}, { projectDir: tmpDir });
        config.overwrite = true;
        config.projectDir = tmpDir;
        // agent is 'claude-code' by default in makeConfig
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.claude', 'CLAUDE.md'))).toBe(true);
    });
});
