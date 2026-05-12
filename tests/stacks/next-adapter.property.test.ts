/**
 * Property-based tests for the Next.js adapter.
 *
 * Feature: project-init
 * Tests Properties 9, 15–17 from the design document.
 */

// Mock @inquirer/prompts before any imports
jest.mock('@inquirer/prompts', () => ({
    input: jest.fn(),
    confirm: jest.fn(),
    select: jest.fn(),
}));

// Mock node:child_process to prevent actual shell commands during scaffold
jest.mock('node:child_process', () => ({
    execSync: jest.fn(() => Buffer.from('')),
}));

import * as fc from 'fast-check';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { validateNextName } from '../../src/stacks/next/prompts.js';
import type { NextContext } from '../../src/stacks/next/prompts.js';
import { NextAdapter } from '../../src/stacks/next/adapter.js';
import { scaffoldNext } from '../../src/stacks/next/scaffold.js';

// ─── Arbitraries ────────────────────────────────────────────────────────────

/** Generates valid Next.js kebab-case app names */
const validNextName: fc.Arbitrary<string> = fc.tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
        fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyz0123456789-'.split('')
        ),
        { minLength: 0, maxLength: 20 }
    ),
).map(([first, rest]) => first + rest.join(''));

/** Generates invalid Next.js names (strings that don't match ^[a-z][a-z0-9-]*$) */
const invalidNextName: fc.Arbitrary<string> = fc.oneof(
    // Starts with digit
    fc.tuple(
        fc.constantFrom(...'0123456789'.split('')),
        fc.string({ minLength: 0, maxLength: 10 }),
    ).map(([d, rest]) => d + rest),
    // Starts with uppercase
    fc.tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
        fc.string({ minLength: 0, maxLength: 10 }),
    ).map(([u, rest]) => u + rest),
    // Contains underscore
    fc.tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.string({ minLength: 0, maxLength: 5 }),
        fc.constant('_'),
        fc.string({ minLength: 1, maxLength: 5 }),
    ).map(([f, mid, u, end]) => f + mid + u + end),
    // Contains space
    fc.tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constant(' '),
        fc.string({ minLength: 1, maxLength: 5 }),
    ).map(([f, sp, rest]) => f + sp + rest),
    // Empty string
    fc.constant(''),
    // Starts with hyphen
    fc.tuple(
        fc.constant('-'),
        fc.string({ minLength: 1, maxLength: 10 }),
    ).map(([h, rest]) => h + rest),
).filter(s => !/^[a-z][a-z0-9-]*$/.test(s));

/** Generates a valid NextContext projectType */
const projectTypeArb: fc.Arbitrary<'frontend' | 'fullstack'> =
    fc.constantFrom('frontend' as const, 'fullstack' as const);

/** Generates a valid package manager */
const packageManagerArb: fc.Arbitrary<'npm' | 'yarn' | 'pnpm' | 'bun'> =
    fc.constantFrom('npm' as const, 'yarn' as const, 'pnpm' as const, 'bun' as const);

/** Generates a valid router choice */
const routerArb: fc.Arbitrary<'app' | 'pages'> =
    fc.constantFrom('app' as const, 'pages' as const);

/** Generates a valid styling choice */
const stylingArb: fc.Arbitrary<'tailwind' | 'css-modules' | 'styled-components'> =
    fc.constantFrom('tailwind' as const, 'css-modules' as const, 'styled-components' as const);

/** Generates a valid server state choice */
const serverStateArb: fc.Arbitrary<'tanstack-query' | 'swr' | 'none'> =
    fc.constantFrom('tanstack-query' as const, 'swr' as const, 'none' as const);

/** Generates a valid client state choice */
const clientStateArb: fc.Arbitrary<'zustand' | 'redux-toolkit' | 'none'> =
    fc.constantFrom('zustand' as const, 'redux-toolkit' as const, 'none' as const);

/** Generates a valid auth choice */
const authArb: fc.Arbitrary<'nextauth' | 'clerk' | 'none'> =
    fc.constantFrom('nextauth' as const, 'clerk' as const, 'none' as const);

/** Generates a valid database choice */
const databaseArb: fc.Arbitrary<'prisma' | 'drizzle' | 'none'> =
    fc.constantFrom('prisma' as const, 'drizzle' as const, 'none' as const);

/** Generates a valid API style choice */
const apiStyleArb: fc.Arbitrary<'rest' | 'trpc' | 'none'> =
    fc.constantFrom('rest' as const, 'trpc' as const, 'none' as const);

/** Generates a complete valid NextContext */
const nextContextArb: fc.Arbitrary<NextContext> = fc.tuple(
    validNextName,
    projectTypeArb,
    packageManagerArb,
    routerArb,
    stylingArb,
    serverStateArb,
    clientStateArb,
    authArb,
    databaseArb,
    apiStyleArb,
).map(([appName, projectType, packageManager, router, styling, serverState, clientState, auth, database, apiStyle]) => ({
    appName,
    displayName: 'Test App',
    outputDir: '/tmp',
    projectDir: `/tmp/${appName}`,
    agent: 'claude-code' as const,
    gitHooks: true,
    ci: 'github' as const,
    projectType,
    packageManager,
    router,
    styling,
    serverState,
    clientState,
    auth,
    database,
    apiStyle,
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createNextContext(overrides: Partial<NextContext> = {}): NextContext {
    return {
        appName: 'my-app',
        displayName: 'My App',
        outputDir: '/tmp',
        projectDir: '/tmp/my-app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
        projectType: 'frontend',
        packageManager: 'npm',
        router: 'app',
        styling: 'tailwind',
        serverState: 'tanstack-query',
        clientState: 'zustand',
        auth: 'none',
        database: 'none',
        apiStyle: 'none',
        ...overrides,
    };
}

// Silence console output during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});
afterAll(() => { jest.restoreAllMocks(); });

// ─── Property 9: Next.js Naming Convention Validation ───────────────────────

describe('Feature: project-init, Property 9: Next.js Naming Convention Validation', () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any string, the Next.js name validator accepts it if and only if
     * it matches the regex ^[a-z][a-z0-9-]*$.
     */
    it('accepts valid kebab-case names matching ^[a-z][a-z0-9-]*$', () => {
        fc.assert(
            fc.property(validNextName, (name: string) => {
                const result = validateNextName(name);
                expect(result).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('rejects strings not matching ^[a-z][a-z0-9-]*$', () => {
        fc.assert(
            fc.property(invalidNextName, (name: string) => {
                const result = validateNextName(name);
                expect(result).not.toBe(true);
                expect(typeof result).toBe('string');
            }),
            { numRuns: 100 }
        );
    });

    it('validator result matches regex for arbitrary strings', () => {
        const anyString = fc.string({ minLength: 0, maxLength: 30 });
        fc.assert(
            fc.property(anyString, (name: string) => {
                const result = validateNextName(name);
                const matchesRegex = /^[a-z][a-z0-9-]*$/.test(name);
                if (matchesRegex) {
                    expect(result).toBe(true);
                } else {
                    expect(result).not.toBe(true);
                }
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 15: Next.js Conditional Directory Structure ───────────────────

describe('Feature: project-init, Property 15: Next.js Conditional Directory Structure', () => {
    /**
     * **Validates: Requirements 9.1, 9.2, 9.3**
     *
     * For any valid NextContext:
     * - When projectType is 'frontend', src/app/api/, src/lib/, and src/middleware.ts do NOT exist
     * - When projectType is 'fullstack', they exist alongside all frontend directories
     */
    it('frontend projects exclude api/lib/middleware directories', async () => {
        await fc.assert(
            fc.asyncProperty(
                validNextName,
                routerArb,
                stylingArb,
                serverStateArb,
                clientStateArb,
                authArb,
                databaseArb,
                async (appName, router, styling, serverState, clientState, auth, database) => {
                    const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop15f-'));
                    const projectDir = join(tmpDir, appName);

                    try {
                        const ctx = createNextContext({
                            appName,
                            projectDir,
                            outputDir: tmpDir,
                            projectType: 'frontend',
                            router,
                            styling,
                            serverState,
                            clientState,
                            auth,
                            database,
                        });

                        await scaffoldNext(ctx);

                        // Frontend must NOT have these
                        expect(existsSync(join(projectDir, 'src/app/api'))).toBe(false);
                        expect(existsSync(join(projectDir, 'src/lib'))).toBe(false);
                        expect(existsSync(join(projectDir, 'src/middleware.ts'))).toBe(false);

                        // Frontend must have base directories
                        expect(existsSync(join(projectDir, 'src/features'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/api'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/config'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/errors'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/types'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/utils'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/shared/components'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/shared/hooks'))).toBe(true);
                    } finally {
                        rmSync(tmpDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('fullstack projects include api/lib/middleware alongside frontend directories', async () => {
        await fc.assert(
            fc.asyncProperty(
                validNextName,
                routerArb,
                stylingArb,
                serverStateArb,
                clientStateArb,
                authArb,
                databaseArb,
                async (appName, router, styling, serverState, clientState, auth, database) => {
                    const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop15s-'));
                    const projectDir = join(tmpDir, appName);

                    try {
                        const ctx = createNextContext({
                            appName,
                            projectDir,
                            outputDir: tmpDir,
                            projectType: 'fullstack',
                            router,
                            styling,
                            serverState,
                            clientState,
                            auth,
                            database,
                        });

                        await scaffoldNext(ctx);

                        // Fullstack must have these
                        expect(existsSync(join(projectDir, 'src/app/api/health'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/lib'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/middleware.ts'))).toBe(true);

                        // Fullstack must also have base directories
                        expect(existsSync(join(projectDir, 'src/features'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/api'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/config'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/errors'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/types'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/core/utils'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/shared/components'))).toBe(true);
                        expect(existsSync(join(projectDir, 'src/shared/hooks'))).toBe(true);
                    } finally {
                        rmSync(tmpDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 16: Next.js Conditional Dependency Inclusion ──────────────────

describe('Feature: project-init, Property 16: Next.js Conditional Dependency Inclusion', () => {
    /**
     * **Validates: Requirements 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10**
     *
     * For any valid NextContext:
     * (a) next, react, react-dom, typescript, @types/react, @types/node, zod always present
     * (b) tailwindcss present iff styling === 'tailwind'
     * (c) @tanstack/react-query present iff serverState === 'tanstack-query'
     * (d) next-auth present iff auth === 'nextauth' AND projectType === 'fullstack'
     * (e) prisma and @prisma/client present iff database === 'prisma' AND projectType === 'fullstack'
     * (f) auth and database deps NOT present when projectType === 'frontend'
     */
    it('always-present dependencies are included regardless of context', async () => {
        await fc.assert(
            fc.asyncProperty(nextContextArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16a-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    // Always-present deps
                    expect(pkg.dependencies).toHaveProperty('next');
                    expect(pkg.dependencies).toHaveProperty('react');
                    expect(pkg.dependencies).toHaveProperty('react-dom');
                    expect(pkg.dependencies).toHaveProperty('zod');
                    expect(pkg.devDependencies).toHaveProperty('typescript');
                    expect(pkg.devDependencies).toHaveProperty('@types/react');
                    expect(pkg.devDependencies).toHaveProperty('@types/node');
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });

    it('tailwindcss present iff styling === tailwind', async () => {
        await fc.assert(
            fc.asyncProperty(nextContextArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16b-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    if (ctx.styling === 'tailwind') {
                        expect(pkg.devDependencies).toHaveProperty('tailwindcss');
                    } else {
                        expect(pkg.devDependencies).not.toHaveProperty('tailwindcss');
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });

    it('@tanstack/react-query present iff serverState === tanstack-query', async () => {
        await fc.assert(
            fc.asyncProperty(nextContextArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16c-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    // Note: trpc also adds @tanstack/react-query
                    const expectTanstack = ctx.serverState === 'tanstack-query' ||
                        (ctx.projectType === 'fullstack' && ctx.apiStyle === 'trpc');

                    if (expectTanstack) {
                        expect(pkg.dependencies).toHaveProperty('@tanstack/react-query');
                    } else {
                        expect(pkg.dependencies).not.toHaveProperty('@tanstack/react-query');
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });

    it('next-auth present iff auth === nextauth AND projectType === fullstack', async () => {
        await fc.assert(
            fc.asyncProperty(nextContextArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16d-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    if (ctx.auth === 'nextauth' && ctx.projectType === 'fullstack') {
                        expect(pkg.dependencies).toHaveProperty('next-auth');
                    } else {
                        expect(pkg.dependencies).not.toHaveProperty('next-auth');
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });

    it('prisma deps present iff database === prisma AND projectType === fullstack', async () => {
        await fc.assert(
            fc.asyncProperty(nextContextArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16e-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    if (ctx.database === 'prisma' && ctx.projectType === 'fullstack') {
                        expect(pkg.dependencies).toHaveProperty('@prisma/client');
                        expect(pkg.devDependencies).toHaveProperty('prisma');
                    } else {
                        expect(pkg.dependencies).not.toHaveProperty('@prisma/client');
                        expect(pkg.devDependencies).not.toHaveProperty('prisma');
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });

    it('frontend projects never include auth or database deps', async () => {
        // Generate only frontend contexts with various auth/database settings
        const frontendCtxArb = fc.tuple(
            validNextName,
            packageManagerArb,
            routerArb,
            stylingArb,
            serverStateArb,
            clientStateArb,
            authArb,
            databaseArb,
        ).map(([appName, packageManager, router, styling, serverState, clientState, auth, database]) => ({
            appName,
            displayName: 'Test App',
            outputDir: '/tmp',
            projectDir: `/tmp/${appName}`,
            agent: 'claude-code' as const,
            gitHooks: true,
            ci: 'github' as const,
            projectType: 'frontend' as const,
            packageManager,
            router,
            styling,
            serverState,
            clientState,
            auth,
            database,
            apiStyle: 'none' as const,
        }));

        await fc.assert(
            fc.asyncProperty(frontendCtxArb, async (ctx) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'next-prop16f-'));
                const projectDir = join(tmpDir, ctx.appName);
                const testCtx = { ...ctx, outputDir: tmpDir, projectDir };

                try {
                    await scaffoldNext(testCtx);
                    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf8'));

                    // Auth deps must not be present for frontend
                    expect(pkg.dependencies).not.toHaveProperty('next-auth');
                    expect(pkg.dependencies).not.toHaveProperty('@clerk/nextjs');

                    // Database deps must not be present for frontend
                    expect(pkg.dependencies).not.toHaveProperty('@prisma/client');
                    expect(pkg.devDependencies).not.toHaveProperty('prisma');
                    expect(pkg.dependencies).not.toHaveProperty('drizzle-orm');
                    expect(pkg.devDependencies).not.toHaveProperty('drizzle-kit');
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 17: Next.js scanHints Derivation ──────────────────────────────

describe('Feature: project-init, Property 17: Next.js scanHints Derivation', () => {
    /**
     * **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9**
     *
     * For any valid NextContext, scanHints(ctx) returns:
     * - detectedSSR: true
     * - detectedNextRouter as 'App Router' or 'Pages Router' (scanner-aligned labels)
     * - detectedRSC equal to ctx.router === 'app'
     * - detectedBuildTool as 'next-app' or 'next-pages'
     * - detectedCSSApproach as scanner-aligned label ('Tailwind CSS', 'styled-components', 'css-modules')
     * - detectedSubtype as 'fullstack' or 'frontend' matching ctx.projectType
     * - detectedORM as scanner-aligned label ('Prisma', 'Drizzle') or empty string
     * - detectedAuth as scanner-aligned label ('NextAuth.js', 'Clerk') or empty string
     * - detectedAPIType as 'tRPC' or empty string
     * - detectedPackageManager equal to ctx.packageManager
     * - detectedLinter: 'eslint', detectedHasLinterConfig: true
     */
    it('all scanHints fields correctly derived from context', () => {
        const adapter = new NextAdapter();

        const routerLabel: Record<string, string> = { app: 'App Router', pages: 'Pages Router' };
        const cssLabel: Record<string, string> = { tailwind: 'Tailwind CSS' };
        const ormLabel: Record<string, string> = { prisma: 'Prisma', drizzle: 'Drizzle' };
        const authLabel: Record<string, string> = { nextauth: 'NextAuth.js', clerk: 'Clerk' };
        const apiLabel: Record<string, string> = { trpc: 'tRPC' };

        fc.assert(
            fc.property(nextContextArb, (ctx) => {
                const hints = adapter.scanHints(ctx);

                // detectedSSR is always true
                expect(hints.detectedSSR).toBe(true);

                // detectedNextRouter is scanner-aligned label
                expect(hints.detectedNextRouter).toBe(routerLabel[ctx.router] ?? ctx.router);

                // detectedRSC is true iff router === 'app'
                expect(hints.detectedRSC).toBe(ctx.router === 'app');

                // detectedBuildTool derived from router
                expect(hints.detectedBuildTool).toBe(ctx.router === 'app' ? 'next-app' : 'next-pages');

                // detectedCSSApproach is scanner-aligned label
                expect(hints.detectedCSSApproach).toBe(cssLabel[ctx.styling] ?? ctx.styling);

                // detectedSubtype matches ctx.projectType
                expect(hints.detectedSubtype).toBe(ctx.projectType);

                // detectedORM: scanner-aligned label or '' for 'none', '' for frontend
                const expectedORM = ctx.projectType === 'fullstack'
                    ? (ormLabel[ctx.database] ?? (ctx.database === 'none' ? '' : ctx.database))
                    : '';
                expect(hints.detectedORM).toBe(expectedORM);

                // detectedAuth: scanner-aligned label or '' for 'none', '' for frontend
                const expectedAuth = ctx.projectType === 'fullstack'
                    ? (authLabel[ctx.auth] ?? (ctx.auth === 'none' ? '' : ctx.auth))
                    : '';
                expect(hints.detectedAuth).toBe(expectedAuth);

                // detectedAPIType: 'tRPC' for trpc, '' otherwise; '' for frontend
                const expectedAPI = ctx.projectType === 'fullstack'
                    ? (apiLabel[ctx.apiStyle] ?? '')
                    : '';
                expect(hints.detectedAPIType).toBe(expectedAPI);

                // detectedPackageManager matches ctx.packageManager
                expect(hints.detectedPackageManager).toBe(ctx.packageManager);

                // static linter fields
                expect(hints.detectedLinter).toBe('eslint');
                expect(hints.detectedHasLinterConfig).toBe(true);
            }),
            { numRuns: 100 }
        );
    });
});
