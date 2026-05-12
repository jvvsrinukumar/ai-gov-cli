/**
 * Unit tests for the Next.js adapter.
 *
 * Validates: Requirements 4.2, 9.1-9.15, 11.1-11.5, 12.1-12.9
 */

// Mock @inquirer/prompts before any imports
jest.mock('@inquirer/prompts', () => ({
    select: jest.fn().mockResolvedValue('next'),
    confirm: jest.fn().mockResolvedValue(true),
    input: jest.fn().mockResolvedValue('my-app'),
}));

// Mock node:child_process for postSetup tests
jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
}));

import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'node:child_process';

import { NextAdapter } from '../../src/stacks/next/adapter.js';
import { validateNextName } from '../../src/stacks/next/prompts.js';
import type { NextContext } from '../../src/stacks/next/prompts.js';
import type { ScaffoldContext } from '../../src/stacks/adapter.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

function createNextContext(overrides: Partial<NextContext> = {}): NextContext {
    const base: NextContext = {
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
    };
    return { ...base, ...overrides };
}

// Silence console output during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
afterAll(() => { jest.restoreAllMocks(); });


// ─── Naming Convention (Req 4.2) ────────────────────────────────────────────

describe('Next.js Naming Convention (Req 4.2)', () => {
    it('accepts valid kebab-case names', () => {
        expect(validateNextName('my-app')).toBe(true);
        expect(validateNextName('a')).toBe(true);
        expect(validateNextName('hello-world-123')).toBe(true);
        expect(validateNextName('app2')).toBe(true);
    });

    it('rejects names starting with a digit', () => {
        expect(validateNextName('2app')).not.toBe(true);
    });

    it('rejects names with uppercase letters', () => {
        expect(validateNextName('MyApp')).not.toBe(true);
        expect(validateNextName('my-App')).not.toBe(true);
    });

    it('rejects names with underscores', () => {
        expect(validateNextName('my_app')).not.toBe(true);
    });

    it('rejects empty string', () => {
        expect(validateNextName('')).not.toBe(true);
    });

    it('rejects names with special characters', () => {
        expect(validateNextName('my app')).not.toBe(true);
        expect(validateNextName('my.app')).not.toBe(true);
        expect(validateNextName('my@app')).not.toBe(true);
    });

    it('rejects names starting with hyphen', () => {
        expect(validateNextName('-my-app')).not.toBe(true);
    });
});

// ─── adapter.validateName (Req 4.2, StackAdapter interface) ─────────────────

describe('NextAdapter.validateName', () => {
    const adapter = new NextAdapter();

    it('returns true for valid kebab-case names', () => {
        expect(adapter.validateName('my-app')).toBe(true);
        expect(adapter.validateName('hello123')).toBe(true);
    });

    it('returns error string for names with uppercase letters', () => {
        expect(adapter.validateName('MyApp')).not.toBe(true);
        expect(typeof adapter.validateName('MyApp')).toBe('string');
    });

    it('returns error string for names with underscores', () => {
        expect(adapter.validateName('my_app')).not.toBe(true);
    });
});

// ─── Frontend Directory Structure (Req 9.1, 9.3) ───────────────────────────

describe('Next.js Frontend Directory Structure (Req 9.1, 9.3)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-frontend-'));
        projectDir = join(tmpDir, 'my-app');
        adapter = new NextAdapter();

        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createNextContext({
            outputDir: tmpDir,
            projectDir,
            projectType: 'frontend',
            router: 'app',
        });

        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    const requiredDirs = [
        'src/app',
        'src/features',
        'src/core/api',
        'src/core/config',
        'src/core/errors',
        'src/core/types',
        'src/core/utils',
        'src/shared/components',
        'src/shared/hooks',
    ];

    it.each(requiredDirs)('creates directory: %s', (dir) => {
        expect(existsSync(join(projectDir, dir))).toBe(true);
    });

    it('does NOT create src/app/api/ directory', () => {
        expect(existsSync(join(projectDir, 'src/app/api'))).toBe(false);
    });

    it('does NOT create src/lib/ directory', () => {
        expect(existsSync(join(projectDir, 'src/lib'))).toBe(false);
    });

    it('does NOT create src/middleware.ts', () => {
        expect(existsSync(join(projectDir, 'src/middleware.ts'))).toBe(false);
    });
});

// ─── Fullstack Directory Structure (Req 9.2) ────────────────────────────────

describe('Next.js Fullstack Directory Structure (Req 9.2)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-fullstack-'));
        projectDir = join(tmpDir, 'my-app');
        adapter = new NextAdapter();

        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createNextContext({
            outputDir: tmpDir,
            projectDir,
            projectType: 'fullstack',
            auth: 'nextauth',
            database: 'prisma',
        });

        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('creates src/app/api/health/route.ts', () => {
        expect(existsSync(join(projectDir, 'src/app/api/health/route.ts'))).toBe(true);
    });

    it('creates src/lib/ directory', () => {
        expect(existsSync(join(projectDir, 'src/lib'))).toBe(true);
    });

    it('creates src/middleware.ts', () => {
        expect(existsSync(join(projectDir, 'src/middleware.ts'))).toBe(true);
    });

    it('creates src/lib/db.ts', () => {
        expect(existsSync(join(projectDir, 'src/lib/db.ts'))).toBe(true);
    });

    it('creates src/lib/auth.ts', () => {
        expect(existsSync(join(projectDir, 'src/lib/auth.ts'))).toBe(true);
    });

    // Also verify frontend dirs still exist
    const frontendDirs = [
        'src/app',
        'src/features',
        'src/core/api',
        'src/core/config',
        'src/core/errors',
        'src/core/types',
        'src/core/utils',
        'src/shared/components',
        'src/shared/hooks',
    ];

    it.each(frontendDirs)('also creates frontend directory: %s', (dir) => {
        expect(existsSync(join(projectDir, dir))).toBe(true);
    });
});


// ─── package.json (Req 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10) ────────────────

describe('Next.js package.json (Req 9.4-9.10)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-pkg-'));
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function scaffoldAndReadPkg(overrides: Partial<NextContext>): Record<string, unknown> {
        const name = `app-${Math.random().toString(36).slice(2, 8)}`;
        const dir = join(tmpDir, name);
        const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, appName: name, ...overrides });
        // Synchronous-ish: scaffold returns a promise but we need to handle it
        return ctx as unknown as Record<string, unknown>;
    }

    describe('name field (Req 9.4)', () => {
        it('sets name to appName', async () => {
            const dir = join(tmpDir, 'name-test');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, appName: 'my-cool-app' });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.name).toBe('my-cool-app');
        });
    });

    describe('always-included dependencies (Req 9.4)', () => {
        it('includes next, react, react-dom, zod in dependencies', async () => {
            const dir = join(tmpDir, 'always-deps');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).toHaveProperty('next');
            expect(pkg.dependencies).toHaveProperty('react');
            expect(pkg.dependencies).toHaveProperty('react-dom');
            expect(pkg.dependencies).toHaveProperty('zod');
        });

        it('includes typescript, @types/react, @types/node in devDependencies', async () => {
            const dir = join(tmpDir, 'always-devdeps');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.devDependencies).toHaveProperty('typescript');
            expect(pkg.devDependencies).toHaveProperty('@types/react');
            expect(pkg.devDependencies).toHaveProperty('@types/node');
        });
    });

    describe('conditional deps: tailwind (Req 9.5, 9.6)', () => {
        it('includes tailwindcss when styling=tailwind', async () => {
            const dir = join(tmpDir, 'tailwind-yes');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, styling: 'tailwind' });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.devDependencies).toHaveProperty('tailwindcss');
            expect(pkg.devDependencies).toHaveProperty('postcss');
            expect(pkg.devDependencies).toHaveProperty('autoprefixer');
        });

        it('excludes tailwindcss when styling=css-modules', async () => {
            const dir = join(tmpDir, 'tailwind-no');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, styling: 'css-modules' });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.devDependencies).not.toHaveProperty('tailwindcss');
            expect(pkg.devDependencies).not.toHaveProperty('postcss');
            expect(pkg.devDependencies).not.toHaveProperty('autoprefixer');
        });
    });

    describe('conditional deps: tanstack-query (Req 9.7)', () => {
        it('includes @tanstack/react-query when serverState=tanstack-query', async () => {
            const dir = join(tmpDir, 'tanstack-yes');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, serverState: 'tanstack-query' });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).toHaveProperty('@tanstack/react-query');
        });

        it('excludes @tanstack/react-query when serverState=none', async () => {
            const dir = join(tmpDir, 'tanstack-no');
            const ctx = createNextContext({ outputDir: tmpDir, projectDir: dir, serverState: 'none' });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).not.toHaveProperty('@tanstack/react-query');
        });
    });

    describe('conditional deps: next-auth (Req 9.8)', () => {
        it('includes next-auth when auth=nextauth and fullstack', async () => {
            const dir = join(tmpDir, 'nextauth-yes');
            const ctx = createNextContext({
                outputDir: tmpDir, projectDir: dir,
                projectType: 'fullstack', auth: 'nextauth',
            });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).toHaveProperty('next-auth');
        });

        it('includes @clerk/nextjs when auth=clerk and fullstack', async () => {
            const dir = join(tmpDir, 'clerk-yes');
            const ctx = createNextContext({
                outputDir: tmpDir, projectDir: dir,
                projectType: 'fullstack', auth: 'clerk',
            });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).toHaveProperty('@clerk/nextjs');
        });
    });

    describe('conditional deps: prisma (Req 9.9)', () => {
        it('includes prisma and @prisma/client when database=prisma and fullstack', async () => {
            const dir = join(tmpDir, 'prisma-yes');
            const ctx = createNextContext({
                outputDir: tmpDir, projectDir: dir,
                projectType: 'fullstack', database: 'prisma',
            });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).toHaveProperty('@prisma/client');
            expect(pkg.devDependencies).toHaveProperty('prisma');
        });
    });

    describe('frontend excludes auth/database deps (Req 9.10)', () => {
        it('excludes next-auth even when auth=nextauth for frontend', async () => {
            const dir = join(tmpDir, 'frontend-no-auth');
            const ctx = createNextContext({
                outputDir: tmpDir, projectDir: dir,
                projectType: 'frontend', auth: 'nextauth', database: 'prisma',
            });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).not.toHaveProperty('next-auth');
            expect(pkg.dependencies).not.toHaveProperty('@prisma/client');
            expect(pkg.devDependencies).not.toHaveProperty('prisma');
        });

        it('excludes @clerk/nextjs even when auth=clerk for frontend', async () => {
            const dir = join(tmpDir, 'frontend-no-clerk');
            const ctx = createNextContext({
                outputDir: tmpDir, projectDir: dir,
                projectType: 'frontend', auth: 'clerk',
            });
            await adapter.scaffold(ctx);
            const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
            expect(pkg.dependencies).not.toHaveProperty('@clerk/nextjs');
        });
    });
});


// ─── tsconfig.json (Req 9.11) ───────────────────────────────────────────────

describe('Next.js tsconfig.json (Req 9.11)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-tsconfig-'));
        projectDir = join(tmpDir, 'my-app');
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createNextContext({ outputDir: tmpDir, projectDir });
        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('has strict: true', () => {
        const tsconfig = JSON.parse(readFileSync(join(projectDir, 'tsconfig.json'), 'utf8'));
        expect(tsconfig.compilerOptions.strict).toBe(true);
    });

    it('has @/* path alias pointing to ./src/*', () => {
        const tsconfig = JSON.parse(readFileSync(join(projectDir, 'tsconfig.json'), 'utf8'));
        expect(tsconfig.compilerOptions.paths).toEqual({ '@/*': ['./src/*'] });
    });
});

// ─── tailwind.config.ts (Req 9.5, 9.6) ─────────────────────────────────────

describe('Next.js tailwind.config.ts (Req 9.5, 9.6)', () => {
    let adapter: NextAdapter;

    beforeAll(() => {
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));
    });

    it('exists when styling=tailwind', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-tw-yes-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({ outputDir: tmpDir, projectDir, styling: 'tailwind' });
        await adapter.scaffold(ctx);
        expect(existsSync(join(projectDir, 'tailwind.config.ts'))).toBe(true);
        expect(existsSync(join(projectDir, 'postcss.config.js'))).toBe(true);
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('does NOT exist when styling=css-modules', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-tw-no-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({ outputDir: tmpDir, projectDir, styling: 'css-modules' });
        await adapter.scaffold(ctx);
        expect(existsSync(join(projectDir, 'tailwind.config.ts'))).toBe(false);
        expect(existsSync(join(projectDir, 'postcss.config.js'))).toBe(false);
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('does NOT exist when styling=styled-components', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-tw-sc-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({ outputDir: tmpDir, projectDir, styling: 'styled-components' });
        await adapter.scaffold(ctx);
        expect(existsSync(join(projectDir, 'tailwind.config.ts'))).toBe(false);
        rmSync(tmpDir, { recursive: true, force: true });
    });
});

// ─── .env.local, .env.example, .gitignore (Req 9.13) ────────────────────────

describe('Next.js env files (Req 9.13)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-env-'));
        projectDir = join(tmpDir, 'my-app');
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createNextContext({ outputDir: tmpDir, projectDir });
        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('.env.local exists', () => {
        expect(existsSync(join(projectDir, '.env.local'))).toBe(true);
    });

    it('.env.example exists', () => {
        expect(existsSync(join(projectDir, '.env.example'))).toBe(true);
    });

    it('.gitignore includes .env.local', () => {
        const gitignore = readFileSync(join(projectDir, '.gitignore'), 'utf8');
        expect(gitignore).toContain('.env.local');
    });
});

// ─── env.ts (Req 9.12) ─────────────────────────────────────────────────────

describe('Next.js env.ts (Req 9.12)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: NextAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'next-envts-'));
        projectDir = join(tmpDir, 'my-app');
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createNextContext({ outputDir: tmpDir, projectDir });
        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('uses zod for validation', () => {
        const envTs = readFileSync(join(projectDir, 'src/core/config/env.ts'), 'utf8');
        expect(envTs).toContain("import { z } from 'zod'");
    });

    it('exports typed env object', () => {
        const envTs = readFileSync(join(projectDir, 'src/core/config/env.ts'), 'utf8');
        expect(envTs).toContain('export const env');
    });

    it('throws on invalid env vars (parse call)', () => {
        const envTs = readFileSync(join(projectDir, 'src/core/config/env.ts'), 'utf8');
        expect(envTs).toContain('envSchema.parse(process.env)');
    });
});

// ─── globals.css (Req 9.15) ─────────────────────────────────────────────────

describe('Next.js globals.css (Req 9.15)', () => {
    let adapter: NextAdapter;

    beforeAll(() => {
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));
    });

    it('contains Tailwind directives when styling=tailwind', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-css-tw-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({ outputDir: tmpDir, projectDir, styling: 'tailwind' });
        await adapter.scaffold(ctx);
        const css = readFileSync(join(projectDir, 'src/app/globals.css'), 'utf8');
        expect(css).toContain('@tailwind base');
        expect(css).toContain('@tailwind components');
        expect(css).toContain('@tailwind utilities');
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('does NOT create globals.css when styling=css-modules', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-css-no-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({ outputDir: tmpDir, projectDir, styling: 'css-modules' });
        await adapter.scaffold(ctx);
        expect(existsSync(join(projectDir, 'src/app/globals.css'))).toBe(false);
        rmSync(tmpDir, { recursive: true, force: true });
    });
});

// ─── Health Route (Req 9.14) ────────────────────────────────────────────────

describe('Next.js Health Route (Req 9.14)', () => {
    let adapter: NextAdapter;

    beforeAll(() => {
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));
    });

    it('returns { status: "ok" } in fullstack mode', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-health-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({
            outputDir: tmpDir, projectDir,
            projectType: 'fullstack',
        });
        await adapter.scaffold(ctx);
        const route = readFileSync(join(projectDir, 'src/app/api/health/route.ts'), 'utf8');
        expect(route).toContain("{ status: 'ok' }");
        expect(route).toContain('status: 200');
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('does NOT create health route in frontend mode', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-health-no-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({
            outputDir: tmpDir, projectDir,
            projectType: 'frontend',
        });
        await adapter.scaffold(ctx);
        expect(existsSync(join(projectDir, 'src/app/api/health/route.ts'))).toBe(false);
        rmSync(tmpDir, { recursive: true, force: true });
    });
});


// ─── scanHints (Req 12.1-12.14) ─────────────────────────────────────────────

describe('Next.js scanHints (Req 12.1-12.14)', () => {
    const adapter = new NextAdapter();

    describe('static values (Req 12.1, 12.10, 12.11)', () => {
        it('returns detectedSSR: true (Req 12.2)', () => {
            const ctx = createNextContext();
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedSSR).toBe(true);
        });

        it('returns detectedLinter: eslint (Req 12.10)', () => {
            const ctx = createNextContext();
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedLinter).toBe('eslint');
        });

        it('returns detectedHasLinterConfig: true (Req 12.11)', () => {
            const ctx = createNextContext();
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedHasLinterConfig).toBe(true);
        });
    });

    describe('router-derived values (Req 12.3, 12.4, 12.12)', () => {
        it('returns detectedNextRouter: App Router when router=app (Req 12.3)', () => {
            const ctx = createNextContext({ router: 'app' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedNextRouter).toBe('App Router');
        });

        it('returns detectedNextRouter: Pages Router when router=pages (Req 12.3)', () => {
            const ctx = createNextContext({ router: 'pages' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedNextRouter).toBe('Pages Router');
        });

        it('returns detectedRSC: true when router=app (Req 12.4)', () => {
            const ctx = createNextContext({ router: 'app' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedRSC).toBe(true);
        });

        it('returns detectedRSC: false when router=pages (Req 12.4)', () => {
            const ctx = createNextContext({ router: 'pages' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedRSC).toBe(false);
        });

        it('returns detectedBuildTool: next-app when router=app (Req 12.12)', () => {
            const ctx = createNextContext({ router: 'app' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedBuildTool).toBe('next-app');
        });

        it('returns detectedBuildTool: next-pages when router=pages (Req 12.12)', () => {
            const ctx = createNextContext({ router: 'pages' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedBuildTool).toBe('next-pages');
        });
    });

    describe('styling-derived values (Req 12.5)', () => {
        it('returns detectedCSSApproach: Tailwind CSS for tailwind (Req 12.5)', () => {
            const ctx = createNextContext({ styling: 'tailwind' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedCSSApproach).toBe('Tailwind CSS');
        });

        it('returns detectedCSSApproach: css-modules (Req 12.5)', () => {
            const ctx = createNextContext({ styling: 'css-modules' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedCSSApproach).toBe('css-modules');
        });

        it('returns detectedCSSApproach: styled-components (Req 12.5)', () => {
            const ctx = createNextContext({ styling: 'styled-components' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedCSSApproach).toBe('styled-components');
        });
    });

    describe('subtype-derived values (Req 12.6)', () => {
        it('returns detectedSubtype: frontend for frontend projects', () => {
            const ctx = createNextContext({ projectType: 'frontend' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedSubtype).toBe('frontend');
        });

        it('returns detectedSubtype: fullstack for fullstack projects', () => {
            const ctx = createNextContext({ projectType: 'fullstack' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedSubtype).toBe('fullstack');
        });
    });

    describe('ORM-derived values (Req 12.7)', () => {
        it('returns detectedORM: Prisma for fullstack+prisma (Req 12.7)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', database: 'prisma' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedORM).toBe('Prisma');
        });

        it('returns detectedORM: Drizzle for fullstack+drizzle (Req 12.7)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', database: 'drizzle' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedORM).toBe('Drizzle');
        });

        it('returns detectedORM: empty string for fullstack+none', () => {
            const ctx = createNextContext({ projectType: 'fullstack', database: 'none' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedORM).toBe('');
        });

        it('returns detectedORM: empty string for frontend regardless of database', () => {
            const ctx = createNextContext({ projectType: 'frontend', database: 'prisma' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedORM).toBe('');
        });
    });

    describe('auth-derived values (Req 12.8)', () => {
        it('returns detectedAuth: NextAuth.js for fullstack+nextauth (Req 12.8)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', auth: 'nextauth' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAuth).toBe('NextAuth.js');
        });

        it('returns detectedAuth: Clerk for fullstack+clerk (Req 12.8)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', auth: 'clerk' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAuth).toBe('Clerk');
        });

        it('returns detectedAuth: empty string for fullstack+none', () => {
            const ctx = createNextContext({ projectType: 'fullstack', auth: 'none' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAuth).toBe('');
        });

        it('returns detectedAuth: empty string for frontend regardless of auth', () => {
            const ctx = createNextContext({ projectType: 'frontend', auth: 'nextauth' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAuth).toBe('');
        });
    });

    describe('API type-derived values (Req 12.13)', () => {
        it('returns detectedAPIType: tRPC for fullstack+trpc (Req 12.13)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', apiStyle: 'trpc' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAPIType).toBe('tRPC');
        });

        it('returns detectedAPIType: empty string for fullstack+rest (Req 12.13)', () => {
            const ctx = createNextContext({ projectType: 'fullstack', apiStyle: 'rest' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAPIType).toBe('');
        });

        it('returns detectedAPIType: empty string for frontend (Req 12.13)', () => {
            const ctx = createNextContext({ projectType: 'frontend' });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedAPIType).toBe('');
        });
    });

    describe('package manager (Req 12.9)', () => {
        it.each(['npm', 'yarn', 'pnpm', 'bun'] as const)('returns detectedPackageManager: %s', (pm) => {
            const ctx = createNextContext({ packageManager: pm });
            const hints = adapter.scanHints(ctx);
            expect(hints.detectedPackageManager).toBe(pm);
        });
    });
});


// ─── postSetup (Req 11.1-11.5) ──────────────────────────────────────────────

describe('Next.js postSetup (Req 11.1-11.5)', () => {
    const adapter = new NextAdapter();

    beforeEach(() => {
        mockedExecSync.mockReset();
    });

    describe('success path (Req 11.1, 11.2, 11.4)', () => {
        beforeEach(() => {
            mockedExecSync.mockImplementation(() => Buffer.from(''));
        });

        it('runs git init (Req 11.1)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git init',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('runs npm install for npm (Req 11.2)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'npm install',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('runs yarn install for yarn (Req 11.2)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'yarn' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'yarn install',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('runs pnpm install for pnpm (Req 11.2)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'pnpm' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'pnpm install',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('runs bun install for bun (Req 11.2)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'bun' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'bun install',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('runs git add -A and git commit (Req 11.4)', async () => {
            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git add -A',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git commit -m "chore: initial project scaffold"',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('executes commands in correct order for frontend', async () => {
            const calls: string[] = [];
            mockedExecSync.mockImplementation((cmd) => {
                calls.push(cmd as string);
                return Buffer.from('');
            });

            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'frontend',
            });
            await adapter.postSetup(ctx);

            expect(calls[0]).toBe('git init');
            expect(calls[1]).toBe('npm install');
            expect(calls[2]).toBe('git add -A');
            expect(calls[3]).toBe('git commit -m "chore: initial project scaffold"');
        });
    });

    describe('prisma init (Req 11.3)', () => {
        beforeEach(() => {
            mockedExecSync.mockImplementation(() => Buffer.from(''));
        });

        it('runs prisma init for fullstack+prisma', async () => {
            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'fullstack',
                database: 'prisma',
            });
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'npx prisma init --datasource-provider sqlite',
                expect.objectContaining({ cwd: '/tmp/my-app' }),
            );
        });

        it('does NOT run prisma init for frontend+prisma', async () => {
            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'frontend',
                database: 'prisma',
            });
            await adapter.postSetup(ctx);
            const prismaCall = mockedExecSync.mock.calls.find(
                ([cmd]) => (cmd as string).includes('prisma'),
            );
            expect(prismaCall).toBeUndefined();
        });

        it('does NOT run prisma init for fullstack+drizzle', async () => {
            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'fullstack',
                database: 'drizzle',
            });
            await adapter.postSetup(ctx);
            const prismaCall = mockedExecSync.mock.calls.find(
                ([cmd]) => (cmd as string).includes('prisma'),
            );
            expect(prismaCall).toBeUndefined();
        });

        it('runs prisma init after package install and before git commit', async () => {
            const calls: string[] = [];
            mockedExecSync.mockImplementation((cmd) => {
                calls.push(cmd as string);
                return Buffer.from('');
            });

            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'fullstack',
                database: 'prisma',
            });
            await adapter.postSetup(ctx);

            const installIdx = calls.indexOf('npm install');
            const prismaIdx = calls.indexOf('npx prisma init --datasource-provider sqlite');
            const commitIdx = calls.indexOf('git commit -m "chore: initial project scaffold"');

            expect(installIdx).toBeLessThan(prismaIdx);
            expect(prismaIdx).toBeLessThan(commitIdx);
        });
    });

    describe('abort on failure (Req 11.5)', () => {
        it('aborts remaining steps when git init fails', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string) === 'git init') {
                    throw new Error('git init failed');
                }
                return Buffer.from('');
            });

            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await expect(adapter.postSetup(ctx)).rejects.toThrow();

            // Should not have called npm install
            const installCall = mockedExecSync.mock.calls.find(
                ([cmd]) => (cmd as string) === 'npm install',
            );
            expect(installCall).toBeUndefined();
        });

        it('aborts remaining steps when package install fails', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string) === 'npm install') {
                    throw new Error('npm install failed');
                }
                return Buffer.from('');
            });

            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await expect(adapter.postSetup(ctx)).rejects.toThrow();

            // Should not have called git add
            const addCall = mockedExecSync.mock.calls.find(
                ([cmd]) => (cmd as string) === 'git add -A',
            );
            expect(addCall).toBeUndefined();
        });

        it('aborts remaining steps when prisma init fails', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string).includes('prisma init')) {
                    throw new Error('prisma init failed');
                }
                return Buffer.from('');
            });

            const ctx = createNextContext({
                projectDir: '/tmp/my-app',
                packageManager: 'npm',
                projectType: 'fullstack',
                database: 'prisma',
            });
            await expect(adapter.postSetup(ctx)).rejects.toThrow();

            // Should not have called git add
            const addCall = mockedExecSync.mock.calls.find(
                ([cmd]) => (cmd as string) === 'git add -A',
            );
            expect(addCall).toBeUndefined();
        });

        it('error message indicates which command failed', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string) === 'npm install') {
                    throw new Error('npm install failed');
                }
                return Buffer.from('');
            });

            const ctx = createNextContext({ projectDir: '/tmp/my-app', packageManager: 'npm' });
            await expect(adapter.postSetup(ctx)).rejects.toThrow(/npm install/);
        });
    });
});

// ─── displayName apostrophe escaping ────────────────────────────────────────

describe('Next.js appLayoutTsx displayName escaping', () => {
    let adapter: NextAdapter;

    beforeAll(() => {
        adapter = new NextAdapter();
        mockedExecSync.mockImplementation(() => Buffer.from(''));
    });

    it('escapes single quotes in displayName in generated layout.tsx', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-esc-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({
            outputDir: tmpDir,
            projectDir,
            displayName: "McDonald's App",
        });
        await adapter.scaffold(ctx);
        const layout = readFileSync(join(projectDir, 'src/app/layout.tsx'), 'utf8');
        expect(layout).toContain("title: 'McDonald\\'s App'");
        expect(layout).not.toMatch(/title: 'McDonald's App'/);
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('escapes backslashes in displayName in generated layout.tsx', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'next-esc-bs-'));
        const projectDir = join(tmpDir, 'my-app');
        const ctx = createNextContext({
            outputDir: tmpDir,
            projectDir,
            displayName: 'App\\Name',
        });
        await adapter.scaffold(ctx);
        const layout = readFileSync(join(projectDir, 'src/app/layout.tsx'), 'utf8');
        expect(layout).toContain("title: 'App\\\\Name'");
        rmSync(tmpDir, { recursive: true, force: true });
    });
});
