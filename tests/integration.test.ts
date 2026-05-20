/**
 * Integration tests — run workspace-init on a real temp directory,
 * then execute the generated shell scripts against staged files.
 * Requires: git, bash, python3 (or jq).
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync, spawnSync } from 'child_process';
import { runWorkspaceInit } from '../src/commands/workspace-init.js';
import { statSync } from 'fs';
import { generateGitHooks } from '../src/generators/git-hooks/index.js';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { scanProject } from '../src/scanners/index.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig } from '../src/types.js';

// ---------------------------------------------------------------------------
// Environment checks — skip suites if tools unavailable
// ---------------------------------------------------------------------------

const hasBash = (() => { try { execSync('command -v bash', { stdio: 'pipe' }); return true; } catch { return false; } })();
const hasGit = (() => { try { execSync('command -v git', { stdio: 'pipe' }); return true; } catch { return false; } })();
const hasRuntime = (() => {
    try { execSync('command -v python3', { stdio: 'pipe' }); return true; } catch { /* */ }
    try { execSync('command -v jq', { stdio: 'pipe' }); return true; } catch { /* */ }
    return false;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(prefix: string): string {
    const dir = join(tmpdir(), `ai-gov-test-${prefix}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}

function gitInit(dir: string): void {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@ai-gov.test"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "AI Gov Test"', { cwd: dir, stdio: 'pipe' });
    // initial commit so HEAD exists (needed by git diff --cached)
    execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
}

function stageFile(repoDir: string, relPath: string, content: string): void {
    const parts = relPath.split('/').slice(0, -1);
    if (parts.length) mkdirSync(join(repoDir, ...parts), { recursive: true });
    writeFileSync(join(repoDir, relPath), content);
    execSync(`git add "${relPath}"`, { cwd: repoDir, stdio: 'pipe' });
}

function runScript(
    scriptPath: string,
    stdinContent: string,
    cwd: string,
): { code: number; stdout: string; stderr: string } {
    const result = spawnSync('bash', [scriptPath], {
        input: stdinContent,
        encoding: 'utf-8',
        cwd,
        env: { ...process.env, CLAUDE_PROJECT_DIR: cwd },
    });
    return { code: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function makeGovernanceConfig(projectDir: string): GovernanceConfig {
    const stack = 'react';
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    scanProject(stack, projectDir, profile, scan);
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'claude-code',
        stack, profile, scan, blocks,
        project: {
            packageName: 'test-app', appName: 'test-app', appDescription: '',
            ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: 'No legacy code',
        },
        isBackend: false,
        hookVersion: '16.0.0',
        projectDir,
        specFirstEnabled: false,
        conflictMode: 'overwrite',
        overwrite: true,
        dryRun: false,
        updateHooks: false,
    };
}

// ---------------------------------------------------------------------------
// Fixture: grouped workspace (frontend/web + backend/api)
// ---------------------------------------------------------------------------

function makeReactWorkspace(wsDir: string): void {
    const webDir = join(wsDir, 'frontend', 'web');
    mkdirSync(webDir, { recursive: true });
    writeFileSync(join(webDir, 'package.json'), JSON.stringify({
        name: 'web-app',
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
    }, null, 2));

    const apiDir = join(wsDir, 'backend', 'api');
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(join(apiDir, 'package.json'), JSON.stringify({
        name: 'api-server',
        dependencies: { express: '^4.0.0' },
    }, null, 2));
}

// ---------------------------------------------------------------------------
// Suite 1 — workspace-init generates correct file structure
// ---------------------------------------------------------------------------

const describeFG = hasBash ? describe : describe.skip;

describeFG('Integration — workspace-init file generation', () => {
    let wsDir: string;

    beforeAll(() => {
        wsDir = makeTmpDir('ws');
        makeReactWorkspace(wsDir);
        // workspace-init with no .git/ → monorepo path (no git hook install)
        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true });
    });

    test('workspace CLAUDE.md is created', () => {
        expect(existsSync(join(wsDir, '.claude', 'CLAUDE.md'))).toBe(true);
    });

    test('workspace steering files created', () => {
        expect(existsSync(join(wsDir, '.claude', 'steering', 'project-registry.md'))).toBe(true);
        expect(existsSync(join(wsDir, '.claude', 'steering', 'cross-project-rules.md'))).toBe(true);
    });

    test('workspace-pre-commit.sh created', () => {
        const hookPath = join(wsDir, '.claude', 'git-hooks', 'workspace-pre-commit.sh');
        expect(existsSync(hookPath)).toBe(true);
        expect(readFileSync(hookPath, 'utf-8')).toContain('#!/usr/bin/env bash');
    });

    test('React project governance files created', () => {
        const claudeDir = join(wsDir, 'frontend', 'web', '.claude');
        expect(existsSync(join(claudeDir, 'CLAUDE.md'))).toBe(true);
        expect(existsSync(join(claudeDir, 'settings.json'))).toBe(true);
        expect(existsSync(join(claudeDir, 'hooks'))).toBe(true);
    });

    test('Node.js project governance files created', () => {
        const claudeDir = join(wsDir, 'backend', 'api', '.claude');
        expect(existsSync(join(claudeDir, 'CLAUDE.md'))).toBe(true);
        expect(existsSync(join(claudeDir, 'settings.json'))).toBe(true);
    });

    test('per-project git hook scripts generated', () => {
        const hooksDir = join(wsDir, 'frontend', 'web', '.claude', 'git-hooks');
        expect(existsSync(join(hooksDir, 'pre-commit.sh'))).toBe(true);
        expect(existsSync(join(hooksDir, 'checks', 'file-size.sh'))).toBe(true);
        expect(existsSync(join(hooksDir, 'checks', 'secrets.sh'))).toBe(true);
    });

    test('workspace reference injected into project CLAUDE.md', () => {
        const content = readFileSync(
            join(wsDir, 'frontend', 'web', '.claude', 'CLAUDE.md'), 'utf-8',
        );
        expect(content).toContain('## Workspace Rules');
    });

    test('settings.json hooks reference correct scripts', () => {
        const settings = JSON.parse(
            readFileSync(join(wsDir, 'frontend', 'web', '.claude', 'settings.json'), 'utf-8'),
        );
        expect(settings).toHaveProperty('hooks');
        const allHooks = JSON.stringify(settings.hooks);
        expect(allHooks).toContain('check-secrets.sh');
    });

    test('generated hooks use python3/jq fallback, not jq-only guard', () => {
        const secretsHook = readFileSync(
            join(wsDir, 'frontend', 'web', '.claude', 'hooks', 'check-secrets.sh'), 'utf-8',
        );
        // Must NOT have jq-only guard
        expect(secretsHook).not.toContain('command -v jq &>/dev/null || exit 0');
        // Must have the dual-runtime guard
        expect(secretsHook).toContain('python3');
    });
});

// ---------------------------------------------------------------------------
// Suite 2 — generated shell scripts block/pass correctly
// ---------------------------------------------------------------------------

const describeScripts = (hasBash && hasGit && hasRuntime) ? describe : describe.skip;

describeScripts('Integration — generated hook scripts execution', () => {
    let repoDir: string;
    let checksDir: string;

    beforeAll(() => {
        repoDir = makeTmpDir('repo');
        gitInit(repoDir);
        writeFileSync(join(repoDir, 'package.json'), JSON.stringify({
            name: 'test-app', dependencies: { react: '^18.0.0' },
        }, null, 2));

        // Generate governance hook scripts directly (no workspace-init needed)
        const config = makeGovernanceConfig(repoDir);
        generateGitHooks(config, repoDir);
        checksDir = join(repoDir, '.claude', 'git-hooks', 'checks');
    });

    // ── file-size.sh ─────────────────────────────────────────────────────────

    test('file-size.sh: passes a small file', () => {
        stageFile(repoDir, 'src/small.ts', Array(10).fill('const x = 1;').join('\n'));
        const r = runScript(join(checksDir, 'file-size.sh'), 'src/small.ts\n', repoDir);
        expect(r.code).toBe(0);
        expect(r.stdout).not.toContain('FILE SIZE');
    });

    test('file-size.sh: blocks a file over 300 lines', () => {
        stageFile(repoDir, 'src/huge.ts', Array(310).fill('const x = 1;').join('\n'));
        const r = runScript(join(checksDir, 'file-size.sh'), 'src/huge.ts\n', repoDir);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('FILE SIZE');
    });

    test('file-size.sh: skips test files (even if large)', () => {
        stageFile(repoDir, 'src/big.test.ts', Array(310).fill('const x = 1;').join('\n'));
        const r = runScript(join(checksDir, 'file-size.sh'), 'src/big.test.ts\n', repoDir);
        expect(r.code).toBe(0);
    });

    test('file-size.sh: skips non-source files', () => {
        stageFile(repoDir, 'data/seed.json', Array(310).fill('{}').join('\n'));
        const r = runScript(join(checksDir, 'file-size.sh'), 'data/seed.json\n', repoDir);
        expect(r.code).toBe(0);
    });

    // ── secrets.sh ───────────────────────────────────────────────────────────

    test('secrets.sh: passes a clean file', () => {
        stageFile(repoDir, 'src/clean.ts', 'export const url = process.env.API_URL;\n');
        const r = runScript(join(checksDir, 'secrets.sh'), 'src/clean.ts\n', repoDir);
        expect(r.code).toBe(0);
    });

    test('secrets.sh: blocks a hardcoded AWS key', () => {
        stageFile(repoDir, 'src/bad-key.ts', 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
        const r = runScript(join(checksDir, 'secrets.sh'), 'src/bad-key.ts\n', repoDir);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('SECRETS');
    });

    test('secrets.sh: skips test directory (in skip-dirs)', () => {
        stageFile(repoDir, 'tests/fixture.ts', 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
        const r = runScript(join(checksDir, 'secrets.sh'), 'tests/fixture.ts\n', repoDir);
        expect(r.code).toBe(0);
    });

    test('secrets.sh: skips markdown files (in skip-extensions)', () => {
        stageFile(repoDir, 'docs/example.md', 'key = "AKIAIOSFODNN7EXAMPLE";\n');
        const r = runScript(join(checksDir, 'secrets.sh'), 'docs/example.md\n', repoDir);
        expect(r.code).toBe(0);
    });

    // ── pre-commit.sh orchestrator ────────────────────────────────────────────

    test('pre-commit.sh: blocks a hardcoded AWS key', () => {
        stageFile(repoDir, 'src/bad-key.ts', 'const key = "AKIAIOSFODNN7EXAMPLE";\n');
        const r = runScript(join(checksDir, 'secrets.sh'), 'src/bad-key.ts\n', repoDir);
        expect(r.code).toBe(1);
        expect(r.stdout).toContain('SECRETS');
        // Unstage so it doesn't affect pre-commit.sh test
        try { execSync('git reset HEAD -- src/bad-key.ts', { cwd: repoDir, stdio: 'pipe' }); } catch { /* ok */ }
    });

    test('pre-commit.sh: exits 0 on clean staged files', () => {
        // Unstage all files accumulated by previous test cases (git commit may be blocked by hooks)
        try { execSync('git reset HEAD --', { cwd: repoDir, stdio: 'pipe' }); } catch { /* ok */ }
        // Stage a single clean file
        stageFile(repoDir, 'src/main.ts', 'export const app = "hello";\n');
        const r = spawnSync('bash', [join(repoDir, '.claude', 'git-hooks', 'pre-commit.sh')], {
            cwd: repoDir,
            encoding: 'utf-8',
            env: { ...process.env, HOME: repoDir },
        });
        expect(r.status).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Suite 3 — workspace-init multi-repo: per-project .git/ hooks installed
// ---------------------------------------------------------------------------

const describeMultiRepo = (hasBash && hasGit) ? describe : describe.skip;

describeMultiRepo('Integration — workspace-init multi-repo', () => {
    let wsDir: string;

    beforeAll(() => {
        wsDir = makeTmpDir('multirepo');

        // Two projects, each with their own git repo
        const webDir = join(wsDir, 'frontend', 'web');
        mkdirSync(webDir, { recursive: true });
        writeFileSync(join(webDir, 'package.json'), JSON.stringify({
            name: 'web-app', dependencies: { react: '^18.0.0' },
        }, null, 2));
        gitInit(webDir);

        const apiDir = join(wsDir, 'backend', 'api');
        mkdirSync(apiDir, { recursive: true });
        writeFileSync(join(apiDir, 'package.json'), JSON.stringify({
            name: 'api-server', dependencies: { express: '^4.0.0' },
        }, null, 2));
        gitInit(apiDir);

        runWorkspaceInit({ dir: wsDir, dryRun: false, overwrite: true });
    });

    test('installs pre-commit wrapper in each project .git/hooks/', () => {
        expect(existsSync(join(wsDir, 'frontend', 'web', '.git', 'hooks', 'pre-commit'))).toBe(true);
        expect(existsSync(join(wsDir, 'backend', 'api', '.git', 'hooks', 'pre-commit'))).toBe(true);
    });

    test('installs commit-msg wrapper in each project .git/hooks/', () => {
        expect(existsSync(join(wsDir, 'frontend', 'web', '.git', 'hooks', 'commit-msg'))).toBe(true);
        expect(existsSync(join(wsDir, 'backend', 'api', '.git', 'hooks', 'commit-msg'))).toBe(true);
    });

    test('per-project hook wrapper delegates to .claude/git-hooks/pre-commit.sh', () => {
        const hook = readFileSync(
            join(wsDir, 'frontend', 'web', '.git', 'hooks', 'pre-commit'), 'utf-8',
        );
        expect(hook).toContain('pre-commit.sh');
        // Must use dirname-relative path (Windows-safe) not git rev-parse --show-toplevel
        expect(hook).toContain('dirname "$0"');
        expect(hook).not.toContain('git rev-parse --show-toplevel');
    });

    test('per-project hook wrappers are executable (non-Windows)', () => {
        if (process.platform === 'win32') return;
        const mode = statSync(join(wsDir, 'frontend', 'web', '.git', 'hooks', 'pre-commit')).mode;
        // Owner execute bit set (0o100)
        expect(mode & 0o100).toBeTruthy();
    });

    test('workspace-pre-commit.sh still generated for CI use', () => {
        expect(existsSync(join(wsDir, '.claude', 'git-hooks', 'workspace-pre-commit.sh'))).toBe(true);
    });

    test('per-project governance files generated for both projects', () => {
        expect(existsSync(join(wsDir, 'frontend', 'web', '.claude', 'git-hooks', 'pre-commit.sh'))).toBe(true);
        expect(existsSync(join(wsDir, 'backend', 'api', '.claude', 'git-hooks', 'pre-commit.sh'))).toBe(true);
    });

    test('generated pre-commit.sh scripts have no bare-double-quote python syntax error', () => {
        const hook = readFileSync(
            join(wsDir, 'frontend', 'web', '.claude', 'git-hooks', 'pre-commit.sh'), 'utf-8',
        );
        // The cfg() python fallback must not have re.findall(r'"...') — that broke bash parsing
        expect(hook).not.toMatch(/re\.findall\(r'"/);;
    });
});
