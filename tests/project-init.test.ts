/**
 * Unit tests for the project-init orchestrator, buildGovernanceConfig,
 * DummyAdapter, registry, and CLI flag validation.
 *
 * Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 3.9, 13.4, 14.1,
 *            15.7, 15.8, 15.9, 19.3–19.10
 */

// Mock @inquirer/prompts before any imports that transitively use it
jest.mock('@inquirer/prompts', () => ({
    select: jest.fn().mockResolvedValue('react'),
    confirm: jest.fn().mockResolvedValue(true),
    input: jest.fn().mockResolvedValue('test-app'),
}));

import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

import { buildGovernanceConfig } from '../src/commands/project-init.js';
import { createDefaultScanResult } from '../src/types.js';
import type { ScaffoldContext, StackAdapter } from '../src/stacks/adapter.js';
import type { ScanResult, Stack } from '../src/types.js';
import { DummyAdapter } from '../src/stacks/dummy/adapter.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestContext(overrides: Partial<ScaffoldContext> = {}): ScaffoldContext {
    return {
        appName: 'my-test-app',
        displayName: 'My Test App',
        outputDir: '/tmp',
        projectDir: '/tmp/my-test-app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
        ...overrides,
    };
}

function createMockAdapter(id: Stack, scanHintsOverride?: Partial<ScanResult>): StackAdapter {
    return {
        id,
        displayName: `Mock ${id}`,
        nameHint: 'kebab-case (e.g. my-app)',
        validateName: () => true,
        runPrompts: async (base) => base,
        scaffold: async () => { },
        scanHints: () => scanHintsOverride ?? { detectedPackageManager: 'npm', detectedSSR: false },
        postSetup: async () => { },
    };
}

// Silence console output during tests
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Registry Tests ─────────────────────────────────────────────────────────

describe('Registry (via DummyAdapter import)', () => {
    // DummyAdapter self-registers with id 'nodejs' on import

    it('getAdapter returns the DummyAdapter for "nodejs"', () => {
        const { getAdapter } = require('../src/stacks/registry.js');
        const adapter = getAdapter('nodejs');
        expect(adapter).toBeInstanceOf(DummyAdapter);
        expect(adapter.id).toBe('nodejs');
    });

    it('getAllAdapters includes the DummyAdapter', () => {
        const { getAllAdapters } = require('../src/stacks/registry.js');
        const all = getAllAdapters();
        const dummyFound = all.find((a: StackAdapter) => a.id === 'nodejs');
        expect(dummyFound).toBeDefined();
        expect(dummyFound).toBeInstanceOf(DummyAdapter);
    });

    it('getSupportedStackIds includes "nodejs"', () => {
        const { getSupportedStackIds } = require('../src/stacks/registry.js');
        const ids = getSupportedStackIds();
        expect(ids).toContain('nodejs');
    });

    it('getAdapter throws for unregistered stack with correct message', () => {
        const { getAdapter } = require('../src/stacks/registry.js');
        expect(() => getAdapter('kotlin')).toThrow(
            'No adapter registered for stack: kotlin'
        );
    });

    it('registerAdapter throws on duplicate id with correct message', () => {
        const { registerAdapter } = require('../src/stacks/registry.js');
        const duplicate = createMockAdapter('nodejs');
        expect(() => registerAdapter(duplicate)).toThrow(
            'Adapter already registered for stack: nodejs'
        );
    });
});

// ─── buildGovernanceConfig Tests ────────────────────────────────────────────

describe('buildGovernanceConfig', () => {
    const dummyAdapter = new DummyAdapter();

    describe('stack field (Req 19.3)', () => {
        it('sets config.stack to adapter.id', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.stack).toBe(dummyAdapter.id);
            expect(config.stack).toBe('nodejs');
        });

        it('sets config.stack correctly for different adapters', () => {
            const mockNext = createMockAdapter('next');
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, mockNext, {});
            expect(config.stack).toBe('next');
        });
    });

    describe('scan merge (Req 19.5)', () => {
        it('merges adapter scanHints over default ScanResult', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            // DummyAdapter returns { detectedPackageManager: 'npm', detectedSSR: false }
            expect(config.scan.detectedPackageManager).toBe('npm');
            expect(config.scan.detectedSSR).toBe(false);
        });

        it('retains default values for fields not overridden by scanHints', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            const defaults = createDefaultScanResult();
            // Fields not overridden by DummyAdapter should match defaults
            expect(config.scan.detectedState).toBe(defaults.detectedState);
            expect(config.scan.detectedDI).toBe(defaults.detectedDI);
            expect(config.scan.detectedNetwork).toBe(defaults.detectedNetwork);
            expect(config.scan.detectedRouter).toBe(defaults.detectedRouter);
            expect(config.scan.detectedORM).toBe(defaults.detectedORM);
        });

        it('adapter scanHints override defaults correctly', () => {
            const customAdapter = createMockAdapter('next', {
                detectedSSR: true,
                detectedNextRouter: 'app',
                detectedRSC: true,
                detectedCSSApproach: 'tailwind',
                detectedPackageManager: 'pnpm',
            });
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, customAdapter, {});
            expect(config.scan.detectedSSR).toBe(true);
            expect(config.scan.detectedNextRouter).toBe('app');
            expect(config.scan.detectedRSC).toBe(true);
            expect(config.scan.detectedCSSApproach).toBe('tailwind');
            expect(config.scan.detectedPackageManager).toBe('pnpm');
        });
    });

    describe('project fields (Req 19.6, 19.7)', () => {
        it('sets config.project.appName to ctx.displayName', () => {
            const ctx = createTestContext({ displayName: 'AccuShield' });
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.appName).toBe('AccuShield');
        });

        it('sets config.project.packageName to ctx.appName', () => {
            const ctx = createTestContext({ appName: 'accu-shield' });
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.packageName).toBe('accu-shield');
        });

        it('sets project.appDescription to empty string', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.appDescription).toBe('');
        });

        it('sets project.ticketSystem to Jira', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.ticketSystem).toBe('Jira');
        });

        it('sets project.ticketPrefix to TICKET', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.ticketPrefix).toBe('TICKET');
        });

        it('sets project.legacyDescription to "No legacy code"', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.project.legacyDescription).toBe('No legacy code');
        });
    });

    describe('agent field (Req 19.8)', () => {
        it('sets config.agent to ctx.agent (claude-code)', () => {
            const ctx = createTestContext({ agent: 'claude-code' });
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.agent).toBe('claude-code');
        });

        it('sets config.agent to ctx.agent (kiro)', () => {
            const ctx = createTestContext({ agent: 'kiro' });
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.agent).toBe('kiro');
        });
    });

    describe('projectDir field (Req 19.9)', () => {
        it('sets config.projectDir to ctx.projectDir', () => {
            const ctx = createTestContext({ projectDir: '/home/user/projects/my-app' });
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.projectDir).toBe('/home/user/projects/my-app');
        });
    });

    describe('conflictMode always "keep" (Req 14.1, 19.10)', () => {
        it('sets config.conflictMode to "keep"', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.conflictMode).toBe('keep');
        });

        it('conflictMode is "keep" regardless of options', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {
                dryRun: true,
                overwrite: true,
            });
            expect(config.conflictMode).toBe('keep');
        });
    });

    describe('options passthrough', () => {
        it('sets dryRun from options', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, { dryRun: true });
            expect(config.dryRun).toBe(true);
        });

        it('defaults dryRun to false when not provided', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.dryRun).toBe(false);
        });

        it('sets overwrite from options', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, { overwrite: true });
            expect(config.overwrite).toBe(true);
        });

        it('defaults overwrite to false when not provided', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.overwrite).toBe(false);
        });

        it('sets updateHooks from options', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, { updateHooks: true });
            expect(config.updateHooks).toBe(true);
        });
    });

    describe('profile and blocks', () => {
        it('sets config.profile from loadBaseProfile(adapter.id)', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            // DummyAdapter uses 'nodejs' stack
            expect(config.profile).toBeDefined();
            expect(config.profile.stackDisplay).toBeTruthy();
        });

        it('sets config.blocks from computeContentBlocks', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.blocks).toBeDefined();
            expect(typeof config.blocks.keyPackages).toBe('string');
        });

        it('sets specFirstEnabled to true', () => {
            const ctx = createTestContext();
            const config = buildGovernanceConfig(ctx, dummyAdapter, {});
            expect(config.specFirstEnabled).toBe(true);
        });
    });
});

// ─── DummyAdapter Tests ─────────────────────────────────────────────────────

describe('DummyAdapter', () => {
    let tmpDir: string;
    const adapter = new DummyAdapter();

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'dummy-adapter-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('has correct id, displayName, and nameHint', () => {
        expect(adapter.id).toBe('nodejs');
        expect(adapter.displayName).toBe('Node.js (Dummy)');
        expect(adapter.nameHint).toBe('kebab-case (e.g. my-app)');
    });

    it('scaffold creates projectDir with README.md and package.json', async () => {
        const projectDir = join(tmpDir, 'test-project');
        const ctx = createTestContext({
            appName: 'test-project',
            displayName: 'Test Project',
            outputDir: tmpDir,
            projectDir,
        });

        await adapter.scaffold(ctx);

        expect(existsSync(projectDir)).toBe(true);
        expect(existsSync(join(projectDir, 'README.md'))).toBe(true);
        expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
    });

    it('scaffold creates README.md with display name as heading', async () => {
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createTestContext({
            appName: 'my-app',
            displayName: 'My App',
            outputDir: tmpDir,
            projectDir,
        });

        await adapter.scaffold(ctx);

        const readme = readFileSync(join(projectDir, 'README.md'), 'utf-8');
        expect(readme).toBe('# My App\n');
    });

    it('scaffold creates package.json with correct name and version', async () => {
        const projectDir = join(tmpDir, 'cool-project');
        const ctx = createTestContext({
            appName: 'cool-project',
            displayName: 'Cool Project',
            outputDir: tmpDir,
            projectDir,
        });

        await adapter.scaffold(ctx);

        const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
        expect(pkg.name).toBe('cool-project');
        expect(pkg.version).toBe('0.1.0');
    });

    it('scanHints returns detectedPackageManager: npm and detectedSSR: false', () => {
        const ctx = createTestContext();
        const hints = adapter.scanHints(ctx);
        expect(hints.detectedPackageManager).toBe('npm');
        expect(hints.detectedSSR).toBe(false);
    });

    it('runPrompts adds dummyFlag: true to context', async () => {
        const ctx = createTestContext();
        const result = await adapter.runPrompts(ctx);
        expect((result as Record<string, unknown>).dummyFlag).toBe(true);
    });

    it('runPrompts preserves all base context fields', async () => {
        const ctx = createTestContext({
            appName: 'preserved-app',
            displayName: 'Preserved App',
            agent: 'kiro',
        });
        const result = await adapter.runPrompts(ctx);
        expect(result.appName).toBe('preserved-app');
        expect(result.displayName).toBe('Preserved App');
        expect(result.agent).toBe('kiro');
    });

    it('postSetup is a no-op (does not throw)', async () => {
        const ctx = createTestContext();
        await expect(adapter.postSetup(ctx)).resolves.toBeUndefined();
    });
});

// ─── Directory-Already-Exists Guard ─────────────────────────────────────────

describe('Directory-already-exists guard (Req 13.4)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'dir-guard-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('runProjectInit throws when projectDir already exists', async () => {
        // Create the directory that would conflict
        const projectDir = join(tmpDir, 'existing-project');
        mkdirSync(projectDir);

        const { runProjectInit } = require('../src/commands/project-init.js');

        // The DummyAdapter is already registered (id: 'nodejs')
        // Provide --type, --name, --yes, --dir to skip all prompts
        await expect(
            runProjectInit({
                type: 'nodejs',
                name: 'existing-project',
                yes: true,
                dir: tmpDir,
            })
        ).rejects.toThrow(/already exists/);
    });
});

// ─── CLI Flag Validation Tests ──────────────────────────────────────────────

describe('CLI flag validation', () => {
    const cliPath = resolve(__dirname, '..', 'src', 'cli.ts');

    describe('invalid --type flag (Req 15.7)', () => {
        it('rejects invalid stack type and lists valid stacks', () => {
            try {
                execSync(
                    `npx tsx "${cliPath}" project init --type invalid-stack --yes 2>&1`,
                    { encoding: 'utf-8', timeout: 15000 }
                );
                // Should not reach here
                fail('Expected command to exit with non-zero status');
            } catch (err: unknown) {
                const error = err as { stdout?: string; stderr?: string; status?: number };
                const output = (error.stdout || '') + (error.stderr || '');
                expect(output).toMatch(/Invalid stack.*"invalid-stack"|invalid-stack/i);
                expect(error.status).not.toBe(0);
            }
        });
    });

    describe('invalid --name flag (Req 15.8)', () => {
        it('rejects name that violates naming convention for next adapter', () => {
            try {
                execSync(
                    `npx tsx "${cliPath}" project init --type next --name "INVALID_NAME!" --yes 2>&1`,
                    { encoding: 'utf-8', timeout: 15000 }
                );
                fail('Expected command to exit with non-zero status');
            } catch (err: unknown) {
                const error = err as { stdout?: string; stderr?: string; status?: number };
                const output = (error.stdout || '') + (error.stderr || '');
                expect(output).toMatch(/Invalid name|naming/i);
                expect(error.status).not.toBe(0);
            }
        });

        it('rejects name with uppercase characters', () => {
            try {
                execSync(
                    `npx tsx "${cliPath}" project init --type next --name "MyApp" --yes 2>&1`,
                    { encoding: 'utf-8', timeout: 15000 }
                );
                fail('Expected command to exit with non-zero status');
            } catch (err: unknown) {
                const error = err as { stdout?: string; stderr?: string; status?: number };
                const output = (error.stdout || '') + (error.stderr || '');
                expect(output).toMatch(/Invalid name|naming/i);
                expect(error.status).not.toBe(0);
            }
        });
    });

    describe('invalid --dir flag (Req 15.9)', () => {
        it('rejects non-existent directory', () => {
            try {
                execSync(
                    `npx tsx "${cliPath}" project init --type next --name my-app --dir /nonexistent/path/xyz --yes 2>&1`,
                    { encoding: 'utf-8', timeout: 15000 }
                );
                fail('Expected command to exit with non-zero status');
            } catch (err: unknown) {
                const error = err as { stdout?: string; stderr?: string; status?: number };
                const output = (error.stdout || '') + (error.stderr || '');
                expect(output).toMatch(/does not exist|not found|invalid/i);
                expect(error.status).not.toBe(0);
            }
        });

        it('rejects path that is a file, not a directory', () => {
            const tmpFile = join(tmpdir(), `not-a-dir-${Date.now()}.txt`);
            writeFileSync(tmpFile, 'test');
            try {
                execSync(
                    `npx tsx "${cliPath}" project init --type next --name my-app --dir "${tmpFile}" --yes 2>&1`,
                    { encoding: 'utf-8', timeout: 15000 }
                );
                fail('Expected command to exit with non-zero status');
            } catch (err: unknown) {
                const error = err as { stdout?: string; stderr?: string; status?: number };
                const output = (error.stdout || '') + (error.stderr || '');
                expect(output).toMatch(/not a directory/i);
                expect(error.status).not.toBe(0);
            } finally {
                rmSync(tmpFile, { force: true });
            }
        });
    });
});
