/**
 * Kiro end-to-end integration tests.
 * Tests init, workspace, upgrade, and doctor flows for Kiro agent.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { runGovernance } from '../src/generators/index.js';
import { runWorkspaceInit } from '../src/commands/workspace-init.js';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';
import { generateAllKiroHooks } from '../src/agents/kiro/hooks/index.js';
import { wrapWithFrontMatter } from '../src/agents/kiro/steering.js';
import { generateArchitecture } from '../src/generators/architecture.js';
import { safeWrite } from '../src/utils/safe-write.js';

// Mock TTY
jest.mock('../src/utils/tty.js', () => ({
    isInteractiveTTY: () => false,
    readTTYLine: () => '',
}));

const DEFAULT_PROJECT = {
    packageName: 'test-app', appName: 'test-app', appDescription: '',
    ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: 'No legacy code',
};

function makeKiroConfig(
    stack: Stack = 'react',
    scanOverrides: Partial<ScanResult> = {},
    extras: { specFirstEnabled?: boolean; projectDir?: string } = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'kiro', stack, profile, scan, project: DEFAULT_PROJECT, blocks,
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

// ─── Init integration ─────────────────────────────────────────────────────────

describe('Kiro init integration', () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-init-')); });
    afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

    test('fresh kiro init on React project: all expected .kiro/ files exist', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'architecture.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'constitution.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'coding-standards.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'workflow.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'developer-reference.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'block-dangerous-commands.kiro.hook'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'protect-files.kiro.hook'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'check-secrets.kiro.hook'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'hooks', 'workflow-jira-sync.kiro.hook'))).toBe(true);
    });

    test('kiro init generates valid workflow-jira-sync.kiro.hook', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        const hookPath = join(tmpDir, '.kiro', 'hooks', 'workflow-jira-sync.kiro.hook');
        const hook = JSON.parse(readFileSync(hookPath, 'utf-8'));
        expect(hook.name).toBe('Jira Sync');
        expect(hook.when.type).toBe('userTriggered');
        expect(hook.then.type).toBe('askAgent');
        expect(hook.then.prompt).toContain('jira_get');
    });

    test('kiro init generates developer-reference.md with front-matter', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        const content = readFileSync(join(tmpDir, '.kiro', 'steering', 'developer-reference.md'), 'utf-8');
        expect(content.startsWith('---')).toBe(true);
        expect(content).toContain('[~');
        expect(content).toContain('[S]');
    });

    test('fresh kiro init on Flutter project: steering contains Flutter content', () => {
        const config = makeKiroConfig('flutter', {}, { projectDir: tmpDir });
        runGovernance(config);
        const arch = readFileSync(join(tmpDir, '.kiro', 'steering', 'architecture.md'), 'utf-8');
        expect(arch).toContain('Flutter');
    });

    test('fresh kiro init on Node.js project: hooks reference .js extensions', () => {
        const config = makeKiroConfig('nodejs', {}, { projectDir: tmpDir });
        runGovernance(config);
        const secrets = readFileSync(join(tmpDir, '.kiro', 'hooks', 'check-secrets.kiro.hook'), 'utf-8');
        expect(secrets).toContain('.js');
    });

    test('kiro init does NOT create .claude/ directory', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.claude'))).toBe(false);
    });

    test('kiro init creates .kiro/specs/_template/ with all 3 files', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'requirements.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'design.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'tasks.md'))).toBe(true);
    });

    test('kiro init does NOT create root-level specs/ directory', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, 'specs'))).toBe(false);
    });

    test('kiro init creates .kiro/.gitattributes', () => {
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
        expect(existsSync(join(tmpDir, '.kiro', '.gitattributes'))).toBe(true);
    });
});

// ─── Workspace integration ────────────────────────────────────────────────────

describe('Kiro workspace integration', () => {
    let wsDir: string;
    beforeEach(() => {
        wsDir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-ws-'));
        // Create a React project
        const webDir = join(wsDir, 'frontend', 'web');
        mkdirSync(webDir, { recursive: true });
        writeFileSync(join(webDir, 'package.json'), JSON.stringify({
            name: 'web-app', dependencies: { react: '^18.0.0' },
        }, null, 2));
        // Create a Node.js project
        const apiDir = join(wsDir, 'backend', 'api');
        mkdirSync(apiDir, { recursive: true });
        writeFileSync(join(apiDir, 'package.json'), JSON.stringify({
            name: 'api-server', dependencies: { express: '^4.0.0' },
        }, null, 2));
    });
    afterEach(() => { rmSync(wsDir, { recursive: true, force: true }); });

    test('workspace kiro init creates per-project .kiro/steering/', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        expect(existsSync(join(wsDir, 'frontend', 'web', '.kiro', 'steering', 'architecture.md'))).toBe(true);
        expect(existsSync(join(wsDir, 'backend', 'api', '.kiro', 'steering', 'architecture.md'))).toBe(true);
    });

    test('workspace kiro init creates workspace-level .kiro/steering/', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        expect(existsSync(join(wsDir, '.kiro', 'steering', 'workspace-policy.md'))).toBe(true);
        expect(existsSync(join(wsDir, '.kiro', 'steering', 'cross-project-rules.md'))).toBe(true);
        expect(existsSync(join(wsDir, '.kiro', 'steering', 'project-registry.md'))).toBe(true);
    });

    test('workspace kiro init injects workspace reference into project steering', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        const constitution = readFileSync(
            join(wsDir, 'frontend', 'web', '.kiro', 'steering', 'constitution.md'), 'utf-8',
        );
        expect(constitution).toContain('## Workspace Rules');
        expect(constitution).toContain('.kiro/steering/workspace-policy.md');
    });

    test('workspace kiro init creates per-project .kiro/hooks/', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        expect(existsSync(join(wsDir, 'frontend', 'web', '.kiro', 'hooks', 'block-dangerous-commands.kiro.hook'))).toBe(true);
        expect(existsSync(join(wsDir, 'backend', 'api', '.kiro', 'hooks', 'block-dangerous-commands.kiro.hook'))).toBe(true);
    });

    test('workspace kiro init does NOT create .claude/ anywhere', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        expect(existsSync(join(wsDir, '.claude'))).toBe(false);
        expect(existsSync(join(wsDir, 'frontend', 'web', '.claude'))).toBe(false);
        expect(existsSync(join(wsDir, 'backend', 'api', '.claude'))).toBe(false);
    });

    test('workspace kiro init does NOT create root CLAUDE.md', () => {
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true, agent: 'kiro' });
        expect(existsSync(join(wsDir, 'CLAUDE.md'))).toBe(false);
    });
});

// ─── Upgrade integration ──────────────────────────────────────────────────────

describe('Kiro upgrade integration', () => {
    let tmpDir: string;
    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-upgrade-'));
        // Create a project with existing .kiro/ governance
        writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
            name: 'test-app', dependencies: { react: '^18.0.0' },
        }, null, 2));
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        runGovernance(config);
    });
    afterEach(() => { rmSync(tmpDir, { recursive: true, force: true }); });

    test('kiro upgrade regenerates hooks', () => {
        // Modify a hook to verify it gets regenerated
        const hookPath = join(tmpDir, '.kiro', 'hooks', 'block-dangerous-commands.kiro.hook');
        writeFileSync(hookPath, '{"modified": true}');

        // Re-run hooks generation (simulating upgrade)
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        const opts = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite' as const };
        generateAllKiroHooks(config, opts);

        const content = JSON.parse(readFileSync(hookPath, 'utf-8'));
        expect(content.name).toBe('Block Dangerous Commands');
        expect(content.modified).toBeUndefined();
    });

    test('kiro upgrade preserves steering (no --force)', () => {
        // Modify a steering file
        const steeringPath = join(tmpDir, '.kiro', 'steering', 'architecture.md');
        const original = readFileSync(steeringPath, 'utf-8');
        writeFileSync(steeringPath, '# Custom architecture rules\nDo not overwrite this.');

        // Re-run hooks only (simulating upgrade without --force)
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        const opts = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite' as const };
        generateAllKiroHooks(config, opts);

        // Steering should be preserved
        const after = readFileSync(steeringPath, 'utf-8');
        expect(after).toContain('Custom architecture rules');
        expect(after).not.toBe(original);
    });

    test('kiro upgrade with --force regenerates steering', () => {
        // Modify a steering file
        const steeringPath = join(tmpDir, '.kiro', 'steering', 'architecture.md');
        writeFileSync(steeringPath, '# Custom architecture rules');

        // Re-run with force (simulating upgrade --force)
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        const opts = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite' as const };
        safeWrite(steeringPath, wrapWithFrontMatter(generateArchitecture(config)), opts);

        const after = readFileSync(steeringPath, 'utf-8');
        expect(after).toContain('inclusion: always');
        expect(after).toContain('## Layer Flow');
    });

    test('kiro upgrade regenerates workflow-jira-sync.kiro.hook', () => {
        const hookPath = join(tmpDir, '.kiro', 'hooks', 'workflow-jira-sync.kiro.hook');
        writeFileSync(hookPath, '{"modified": true}');

        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        const opts = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite' as const };
        generateAllKiroHooks(config, opts);

        const hook = JSON.parse(readFileSync(hookPath, 'utf-8'));
        expect(hook.name).toBe('Jira Sync');
        expect(hook.modified).toBeUndefined();
    });

    test('kiro upgrade preserves .kiro/specs/', () => {
        // Verify specs still exist after hooks regeneration
        const config = makeKiroConfig('react', {}, { projectDir: tmpDir });
        const opts = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite' as const };
        generateAllKiroHooks(config, opts);

        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'requirements.md'))).toBe(true);
    });
});
