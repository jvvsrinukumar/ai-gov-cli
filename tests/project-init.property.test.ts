/**
 * Property-based tests for buildGovernanceConfig.
 *
 * Feature: project-init, Property 18: buildGovernanceConfig Pure Function Correctness
 *
 * Validates: Requirements 14.1, 19.1, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10
 */

// Mock @inquirer/prompts before any imports that transitively use it
jest.mock('@inquirer/prompts', () => ({
    select: jest.fn().mockResolvedValue('react'),
    confirm: jest.fn().mockResolvedValue(true),
    input: jest.fn().mockResolvedValue('test-app'),
}));

import * as fc from 'fast-check';
import { buildGovernanceConfig } from '../src/commands/project-init.js';
import { createDefaultScanResult } from '../src/types.js';
import type { ScaffoldContext, StackAdapter } from '../src/stacks/adapter.js';
import type { Stack, Agent, ScanResult } from '../src/types.js';

// ─── Arbitraries ────────────────────────────────────────────────────────────

const ALL_STACKS: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
const ALL_AGENTS: Agent[] = ['claude-code', 'kiro'];
const CI_OPTIONS = ['github', 'gitlab', 'bitbucket', 'none'] as const;

/** Arbitrary for a valid Stack id */
const arbStack = fc.constantFrom(...ALL_STACKS);

/** Arbitrary for a valid Agent */
const arbAgent = fc.constantFrom(...ALL_AGENTS);

/** Arbitrary for CI platform */
const arbCI = fc.constantFrom(...CI_OPTIONS);

/** Arbitrary for a valid app name (kebab-case or snake_case) */
const arbAppName = fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/);

/** Arbitrary for a display name (non-empty string) */
const arbDisplayName = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);

/** Arbitrary for a directory path */
const arbPath = fc.string({ minLength: 1, maxLength: 100 }).map(s => `/tmp/${s.replace(/[^a-zA-Z0-9_/-]/g, 'x')}`);

/** Arbitrary for a valid ScaffoldContext */
const arbScaffoldContext: fc.Arbitrary<ScaffoldContext> = fc.record({
    appName: arbAppName,
    displayName: arbDisplayName,
    outputDir: arbPath,
    projectDir: arbPath,
    agent: arbAgent,
    gitHooks: fc.boolean(),
    ci: arbCI,
});

/** Arbitrary for partial ScanResult (scan hints from adapter) */
const arbScanHints: fc.Arbitrary<Partial<ScanResult>> = fc.record({
    detectedPackageManager: fc.constantFrom('npm', 'yarn', 'pnpm', 'bun', 'pub', ''),
    detectedSSR: fc.boolean(),
    detectedState: fc.constantFrom('BLoC', 'Redux', 'Zustand', ''),
    detectedDI: fc.constantFrom('GetIt', 'InversifyJS', ''),
    detectedNetwork: fc.constantFrom('Dio', 'Axios', ''),
    detectedRouter: fc.constantFrom('GoRouter', 'app', 'pages', ''),
    detectedORM: fc.constantFrom('prisma', 'drizzle', ''),
    detectedAuth: fc.constantFrom('nextauth', 'clerk', ''),
    detectedSubtype: fc.constantFrom('frontend', 'fullstack', ''),
    detectedCSSApproach: fc.constantFrom('tailwind', 'css-modules', 'styled-components', ''),
    detectedNextRouter: fc.constantFrom('app', 'pages', ''),
    detectedRSC: fc.boolean(),
    detectedMason: fc.boolean(),
    detectedFVM: fc.boolean(),
}, { requiredKeys: [] });

/** Arbitrary for a StackAdapter with configurable id and scanHints */
function arbStackAdapter(stackId: Stack, scanHints: Partial<ScanResult>): StackAdapter {
    return {
        id: stackId,
        displayName: `Mock ${stackId}`,
        nameHint: 'test-hint',
        validateName: () => true,
        runPrompts: async (base) => base,
        scaffold: async () => { },
        scanHints: () => scanHints,
        postSetup: async () => { },
    };
}

/** Arbitrary for options */
const arbOptions = fc.record({
    dryRun: fc.boolean(),
    overwrite: fc.boolean(),
    updateHooks: fc.boolean(),
}, { requiredKeys: [] });

// ─── Property Test ──────────────────────────────────────────────────────────

describe('Feature: project-init, Property 18: buildGovernanceConfig Pure Function Correctness', () => {
    /**
     * **Validates: Requirements 14.1, 19.1, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10**
     *
     * For any valid ScaffoldContext and StackAdapter, buildGovernanceConfig(ctx, adapter, opts)
     * returns a GovernanceConfig where:
     * - config.stack === adapter.id
     * - config.agent === ctx.agent
     * - config.projectDir === ctx.projectDir
     * - config.project.appName === ctx.displayName
     * - config.project.packageName === ctx.appName
     * - config.conflictMode === 'keep'
     * - config.scan equals the merge of createDefaultScanResult() with adapter.scanHints(ctx)
     */
    it('output fields match expected mappings for any valid ScaffoldContext and StackAdapter', () => {
        fc.assert(
            fc.property(
                arbScaffoldContext,
                arbStack,
                arbScanHints,
                arbOptions,
                (ctx, stackId, scanHints, opts) => {
                    const adapter = arbStackAdapter(stackId, scanHints);
                    const config = buildGovernanceConfig(ctx, adapter, opts);

                    // config.stack === adapter.id (Req 19.3)
                    expect(config.stack).toBe(adapter.id);

                    // config.agent === ctx.agent (Req 19.8)
                    expect(config.agent).toBe(ctx.agent);

                    // config.projectDir === ctx.projectDir (Req 19.9)
                    expect(config.projectDir).toBe(ctx.projectDir);

                    // config.project.appName === ctx.displayName (Req 19.6)
                    expect(config.project.appName).toBe(ctx.displayName);

                    // config.project.packageName === ctx.appName (Req 19.7)
                    expect(config.project.packageName).toBe(ctx.appName);

                    // config.conflictMode === 'keep' (Req 14.1, 19.10)
                    expect(config.conflictMode).toBe('keep');

                    // config.scan equals merge of defaults with scanHints (Req 19.5)
                    const expectedScan = { ...createDefaultScanResult(), ...scanHints };
                    expect(config.scan).toEqual(expectedScan);
                }
            ),
            { numRuns: 100 }
        );
    });
});
