/**
 * Workspace init tests — discoverProjects(), tryDetectStack(), file generation, integration.
 * Uses temporary directories with minimal fixture files (same pattern as java.test.ts).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { discoverProjects, tryDetectStack } from '../src/commands/workspace-init.js';
import { generateWorkspaceFiles, type WorkspaceConfig } from '../src/generators/workspace.js';
import { generateWorkspacePreCommit } from '../src/generators/git-hooks/workspace-pre-commit.js';
import type { WriteOptions } from '../src/utils/safe-write.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkTmp(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-ws-test-'));
}

function touch(dir: string, relPath: string): void {
    const file = join(dir, relPath);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, '');
}

function write(dir: string, relPath: string, content: string): void {
    const file = join(dir, relPath);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, content);
}

function makeWsConfig(root: string, overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
    return {
        workspaceName: 'test-workspace',
        workspaceDir: root,
        projects: [
            { name: 'api-server', relativePath: 'backend/api-server', stack: 'nodejs', group: 'backend' },
            { name: 'web-app', relativePath: 'frontend/web-app', stack: 'react', group: 'frontend' },
        ],
        dryRun: false,
        overwrite: true,
        hookVersion: '16.0.0',
        ...overrides,
    };
}

const WS_OPTS: WriteOptions = {
    overwrite: true, dryRun: false, updateHooks: false,
    hookVersion: '16.0.0', projectDir: '/tmp/test', conflictMode: 'overwrite',
};

// Silence log output during tests
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Group 1: discoverProjects() ──────────────────────────────────────────────

describe('discoverProjects — GROUP_DIRS grouped layout', () => {
    let root: string;

    beforeEach(() => {
        root = mkTmp();
        write(root, 'backend/api-server/package.json', '{"name":"api-server","dependencies":{"express":"^4"}}');
        write(root, 'frontend/web-app/package.json', '{"name":"web-app","dependencies":{"react":"^18"}}');
        touch(root, 'mobile/app/pubspec.yaml');
        touch(root, 'services/worker/requirements.txt');
        touch(root, 'services/mailer/requirements.txt');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('discovers projects inside GROUP_DIRS (backend, frontend, mobile, services)', () => {
        const projects = discoverProjects(root);
        expect(projects).toHaveLength(5);
    });

    test('returns correct relativePath with group prefix', () => {
        const projects = discoverProjects(root);
        const paths = projects.map(p => p.relativePath).sort();
        expect(paths).toEqual([
            'backend/api-server',
            'frontend/web-app',
            'mobile/app',
            'services/mailer',
            'services/worker',
        ].sort());
    });

    test('returns correct group field for each project', () => {
        const projects = discoverProjects(root);
        expect(projects.find(p => p.name === 'api-server')?.group).toBe('backend');
        expect(projects.find(p => p.name === 'web-app')?.group).toBe('frontend');
        expect(projects.find(p => p.name === 'app')?.group).toBe('mobile');
    });

    test('handles multiple projects inside same GROUP_DIR', () => {
        const workers = discoverProjects(root).filter(p => p.group === 'services');
        expect(workers).toHaveLength(2);
        const names = workers.map(p => p.name).sort();
        expect(names).toEqual(['mailer', 'worker']);
    });

    test('skips node_modules inside group dirs', () => {
        write(root, 'backend/node_modules/some-pkg/package.json', '{"name":"some-pkg"}');
        const projects = discoverProjects(root);
        expect(projects.every(p => !p.relativePath.includes('node_modules'))).toBe(true);
    });

    test('skips hidden directories inside group dirs', () => {
        write(root, 'backend/.cache/package.json', '{"name":"hidden"}');
        const projects = discoverProjects(root);
        expect(projects.every(p => !p.relativePath.includes('.cache'))).toBe(true);
    });
});

describe('discoverProjects — flat layout (projects at workspace root)', () => {
    let root: string;

    beforeEach(() => {
        root = mkTmp();
        write(root, 'api-server/package.json', '{"name":"api-server","dependencies":{"express":"^4"}}');
        write(root, 'admin-portal/package.json', '{"name":"admin-portal","dependencies":{"react":"^18"}}');
        touch(root, 'data-service/requirements.txt');
        touch(root, 'billing-service/pom.xml');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('discovers all root-level projects with markers', () => {
        const projects = discoverProjects(root);
        expect(projects).toHaveLength(4);
    });

    test('relativePath equals folder name (no group prefix)', () => {
        const projects = discoverProjects(root);
        const paths = projects.map(p => p.relativePath).sort();
        expect(paths).toEqual(['admin-portal', 'api-server', 'billing-service', 'data-service'].sort());
    });

    test('group field is empty string for all flat projects', () => {
        const projects = discoverProjects(root);
        expect(projects.every(p => p.group === '')).toBe(true);
    });

    test('skips directories without project markers', () => {
        mkdirSync(join(root, 'empty-dir'));
        mkdirSync(join(root, 'docs'));
        const projects = discoverProjects(root);
        expect(projects.every(p => p.relativePath !== 'empty-dir' && p.relativePath !== 'docs')).toBe(true);
    });

    test('skips node_modules at workspace root', () => {
        write(root, 'node_modules/some-lib/package.json', '{"name":"some-lib"}');
        const projects = discoverProjects(root);
        expect(projects.every(p => !p.relativePath.includes('node_modules'))).toBe(true);
    });

    test('skips hidden directories at workspace root', () => {
        write(root, '.git/HEAD', 'ref: refs/heads/main');
        const projects = discoverProjects(root);
        expect(projects.every(p => !p.relativePath.startsWith('.'))).toBe(true);
    });

    test('returns empty array when workspace has no projects', () => {
        const empty = mkTmp();
        try {
            expect(discoverProjects(empty)).toHaveLength(0);
        } finally {
            rmSync(empty, { recursive: true, force: true });
        }
    });
});

describe('discoverProjects — mixed layout (grouped + flat)', () => {
    let root: string;

    beforeEach(() => {
        root = mkTmp();
        write(root, 'backend/core-api/package.json', '{"name":"core-api","dependencies":{"express":"^4"}}');
        write(root, 'analytics/pyproject.toml', '[tool.poetry]\nname = "analytics"\n');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('discovers both grouped and flat projects', () => {
        const projects = discoverProjects(root);
        expect(projects).toHaveLength(2);
        const paths = projects.map(p => p.relativePath).sort();
        expect(paths).toContain('backend/core-api');
        expect(paths).toContain('analytics');
    });

    test('grouped project has group set; flat project has empty group', () => {
        const projects = discoverProjects(root);
        expect(projects.find(p => p.name === 'core-api')?.group).toBe('backend');
        expect(projects.find(p => p.name === 'analytics')?.group).toBe('');
    });
});

// ─── Group 2: tryDetectStack() ────────────────────────────────────────────────

describe('tryDetectStack — returns correct stack from project markers', () => {
    let dir: string;

    beforeEach(() => { dir = mkTmp(); });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    test('flutter — pubspec.yaml', () => {
        touch(dir, 'pubspec.yaml');
        expect(tryDetectStack(dir)).toBe('flutter');
    });

    test('swiftui — Package.swift', () => {
        touch(dir, 'Package.swift');
        expect(tryDetectStack(dir)).toBe('swiftui');
    });

    test('java — pom.xml', () => {
        touch(dir, 'pom.xml');
        expect(tryDetectStack(dir)).toBe('java');
    });

    test('java — settings.gradle (no kotlin)', () => {
        touch(dir, 'settings.gradle');
        expect(tryDetectStack(dir)).toBe('java');
    });

    test('java — settings.gradle.kts (no kotlin)', () => {
        touch(dir, 'settings.gradle.kts');
        expect(tryDetectStack(dir)).toBe('java');
    });

    test('kotlin — build.gradle.kts with kotlin plugin', () => {
        write(dir, 'build.gradle.kts', 'plugins { kotlin("jvm") version "1.9.0" }\n');
        expect(tryDetectStack(dir)).toBe('kotlin');
    });

    test('kotlin — build.gradle with kotlin-android', () => {
        write(dir, 'build.gradle', 'apply plugin: "kotlin-android"\n');
        expect(tryDetectStack(dir)).toBe('kotlin');
    });

    test('java — build.gradle with java plugin only (not kotlin)', () => {
        write(dir, 'build.gradle', 'plugins { id "java" }\napply plugin: "java"\n');
        expect(tryDetectStack(dir)).toBe('java');
    });

    test('java — build.gradle with Spring Boot (no kotlin)', () => {
        write(dir, 'build.gradle',
            'plugins {\n  id "org.springframework.boot" version "3.0"\n  id "java"\n}\n');
        expect(tryDetectStack(dir)).toBe('java');
    });

    test('react — package.json with "react" dependency', () => {
        write(dir, 'package.json', '{"name":"web","dependencies":{"react":"^18"}}');
        expect(tryDetectStack(dir)).toBe('react');
    });

    test('angular — package.json with "@angular/core"', () => {
        write(dir, 'package.json', '{"name":"ng-app","dependencies":{"@angular/core":"^17"}}');
        expect(tryDetectStack(dir)).toBe('angular');
    });

    test('nodejs — package.json with "express"', () => {
        write(dir, 'package.json', '{"name":"api","dependencies":{"express":"^4"}}');
        expect(tryDetectStack(dir)).toBe('nodejs');
    });

    test('nodejs — package.json with "@nestjs/core"', () => {
        write(dir, 'package.json', '{"name":"api","dependencies":{"@nestjs/core":"^10"}}');
        expect(tryDetectStack(dir)).toBe('nodejs');
    });

    test('nodejs — plain package.json (no known framework)', () => {
        write(dir, 'package.json', '{"name":"app"}');
        expect(tryDetectStack(dir)).toBe('nodejs');
    });

    test('python — pyproject.toml', () => {
        write(dir, 'pyproject.toml', '[tool.poetry]\nname = "svc"\n');
        expect(tryDetectStack(dir)).toBe('python');
    });

    test('python — requirements.txt', () => {
        touch(dir, 'requirements.txt');
        expect(tryDetectStack(dir)).toBe('python');
    });

    test('returns null for directory with no markers', () => {
        expect(tryDetectStack(dir)).toBeNull();
    });

    test('returns null for directory that does not exist', () => {
        expect(tryDetectStack(join(dir, 'nonexistent'))).toBeNull();
    });
});

// ─── Group 3: Workspace file generation ──────────────────────────────────────

describe('generateWorkspaceFiles — CLAUDE.md files', () => {
    let root: string;

    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('generates CLAUDE.md redirect at workspace root', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('.claude/CLAUDE.md');
    });

    test('generates .claude/CLAUDE.md master rules file', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'CLAUDE.md'))).toBe(true);
    });

    test('.claude/CLAUDE.md contains workspace name', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('test-workspace');
    });

    test('.claude/CLAUDE.md lists all project paths', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('backend/api-server');
        expect(content).toContain('frontend/web-app');
    });

    test('.claude/CLAUDE.md lists stack for each project', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('nodejs');
        expect(content).toContain('react');
    });

    test('.claude/CLAUDE.md contains cross-project rules summary', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'CLAUDE.md'), 'utf-8');
        expect(content).toContain('Never** import directly from another project');
    });
});

describe('generateWorkspaceFiles — steering files', () => {
    let root: string;

    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('generates steering/workspace-policy.md', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'steering', 'workspace-policy.md'))).toBe(true);
    });

    test('workspace-policy.md mentions cross-project import rules', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'workspace-policy.md'), 'utf-8');
        expect(content).toContain('cross-project');
    });

    test('workspace-policy.md contains PR checklist', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'workspace-policy.md'), 'utf-8');
        expect(content).toContain('PR Checklist');
    });

    test('generates steering/cross-project-rules.md', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'steering', 'cross-project-rules.md'))).toBe(true);
    });

    test('cross-project-rules.md lists all projects in API table', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'cross-project-rules.md'), 'utf-8');
        expect(content).toContain('backend/api-server');
        expect(content).toContain('frontend/web-app');
    });

    test('generates steering/project-registry.md', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'steering', 'project-registry.md'))).toBe(true);
    });

    test('project-registry.md lists projects with correct stacks', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'project-registry.md'), 'utf-8');
        expect(content).toContain('backend/api-server');
        expect(content).toContain('nodejs');
        expect(content).toContain('frontend/web-app');
        expect(content).toContain('react');
    });

    test('project-registry.md total project count is correct', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'project-registry.md'), 'utf-8');
        expect(content).toContain('Total projects:** 2');
    });

    test('project-registry.md shows governance status as checked', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'steering', 'project-registry.md'), 'utf-8');
        expect(content).toContain('✓');
    });
});

// ─── Group 3b: Kiro workspace — agent-conditional content ────────────────────

describe('generateWorkspaceFiles (Kiro) — agent-conditional content', () => {
    let root: string;

    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    function runKiroWorkspace(): void {
        generateWorkspaceFiles(makeWsConfig(root, { agent: 'kiro' }), { ...WS_OPTS, projectDir: root });
    }

    test('writes to .kiro/steering/ not .claude/steering/', () => {
        runKiroWorkspace();
        expect(existsSync(join(root, '.kiro', 'steering', 'workspace-policy.md'))).toBe(true);
        expect(existsSync(join(root, '.claude', 'steering', 'workspace-policy.md'))).toBe(false);
    });

    test('workspace-policy.md says "Kiro was used" not "Claude Code was used"', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-policy.md'), 'utf-8');
        expect(content).toContain('- [ ] Kiro was used');
        expect(content).not.toContain('Claude Code was used');
    });

    test('workspace-policy.md references .kiro/steering/ not .claude/CLAUDE.md', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-policy.md'), 'utf-8');
        expect(content).not.toContain('.claude/CLAUDE.md');
        expect(content).toContain('.kiro/steering/');
    });

    test('workspace-policy.md spec path uses .kiro/specs/', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-policy.md'), 'utf-8');
        expect(content).toContain('.kiro/specs/<feature>/');
        expect(content).not.toMatch(/`specs\/<feature>\/`/);
    });

    test('project-registry.md governance status header uses .kiro/', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'project-registry.md'), 'utf-8');
        expect(content).toContain('.kiro/');
        expect(content).not.toContain('| .claude/');
    });

    test('workspace spec templates written to .kiro/specs/', () => {
        runKiroWorkspace();
        expect(existsSync(join(root, '.kiro', 'specs', '_cross-project-template', 'requirements.md'))).toBe(true);
        expect(existsSync(join(root, 'specs', '_cross-project-template', 'requirements.md'))).toBe(false);
    });

    test('workspace spec tasks reference .kiro/steering/cross-project-rules.md', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'specs', '_cross-project-template', 'tasks.md'), 'utf-8');
        expect(content).toContain('.kiro/steering/cross-project-rules.md');
        expect(content).not.toContain('.claude/steering/cross-project-rules.md');
    });

    test('does NOT write CLAUDE.md for Kiro workspace', () => {
        runKiroWorkspace();
        expect(existsSync(join(root, 'CLAUDE.md'))).toBe(false);
        expect(existsSync(join(root, '.kiro', 'CLAUDE.md'))).toBe(false);
    });

    test('workspace-overview.md references Kiro not Claude Code', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-overview.md'), 'utf-8');
        expect(content).toContain('Kiro');
        expect(content).not.toContain('Claude Code');
    });

    test('workspace-overview.md references .kiro/specs/ not specs/', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-overview.md'), 'utf-8');
        expect(content).toContain('.kiro/specs/');
        expect(content).not.toMatch(/at `specs\//);
    });

    test('workspace-overview.md references kiro hooks not cross-project-spec-check', () => {
        runKiroWorkspace();
        const content = readFileSync(join(root, '.kiro', 'steering', 'workspace-overview.md'), 'utf-8');
        expect(content).toContain('session-continuity.kiro.hook');
        expect(content).not.toContain('cross-project-spec-check');
    });
});

// ─── Group 4: Integration / --only filtering ──────────────────────────────────

describe('discoverProjects — --only filter simulation', () => {
    let root: string;

    beforeEach(() => {
        root = mkTmp();
        write(root, 'backend/api-server/package.json', '{"name":"api-server","dependencies":{"express":"^4"}}');
        write(root, 'frontend/web-app/package.json', '{"name":"web-app","dependencies":{"react":"^18"}}');
        touch(root, 'mobile/app/pubspec.yaml');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('--only filters to specified project paths', () => {
        const all = discoverProjects(root);
        const only = ['backend/api-server'];
        const filtered = all.filter(p => only.includes(p.relativePath));
        expect(filtered).toHaveLength(1);
        expect(filtered[0].name).toBe('api-server');
    });

    test('--only with multiple paths returns multiple projects', () => {
        const all = discoverProjects(root);
        const only = ['backend/api-server', 'mobile/app'];
        const filtered = all.filter(p => only.includes(p.relativePath));
        expect(filtered).toHaveLength(2);
    });

    test('--only with non-existent path returns empty array (triggers error path)', () => {
        const all = discoverProjects(root);
        const only = ['nonexistent/project'];
        const filtered = all.filter(p => only.includes(p.relativePath));
        expect(filtered).toHaveLength(0);
        // Verifies that the error guard in runWorkspaceInit would trigger
        expect(all.length).toBeGreaterThan(0); // projects do exist, just none matched
    });

    test('each discovered project has all required fields', () => {
        const projects = discoverProjects(root);
        for (const p of projects) {
            expect(p).toHaveProperty('name');
            expect(p).toHaveProperty('relativePath');
            expect(p).toHaveProperty('stack');
            expect(p).toHaveProperty('group');
            expect(typeof p.name).toBe('string');
            expect(typeof p.relativePath).toBe('string');
            expect(typeof p.stack).toBe('string');
            expect(typeof p.group).toBe('string');
        }
    });

    test('workspace CLAUDE.md references all project paths after generation', () => {
        const projects = discoverProjects(root);
        const wsRoot = mkTmp();
        try {
            const config: WorkspaceConfig = {
                workspaceName: 'test-ws',
                workspaceDir: wsRoot,
                projects,
                dryRun: false,
                overwrite: true,
                hookVersion: '16.0.0',
            };
            generateWorkspaceFiles(config, { ...WS_OPTS, projectDir: wsRoot });
            const content = readFileSync(join(wsRoot, '.claude', 'CLAUDE.md'), 'utf-8');
            for (const p of projects) {
                expect(content).toContain(p.relativePath);
            }
        } finally {
            rmSync(wsRoot, { recursive: true, force: true });
        }
    });
});

// ─── Improvement 3: generateWorkspacePreCommit() ──────────────────────────────

describe('generateWorkspacePreCommit — generated script content', () => {
    let script: string;

    beforeAll(() => { script = generateWorkspacePreCommit(); });

    test('is a valid bash script with shebang', () => {
        expect(script).toMatch(/^#!\/usr\/bin\/env bash/);
    });

    test('reads project-registry.md to discover projects', () => {
        expect(script).toContain('project-registry.md');
    });

    test('groups staged files by project path prefix', () => {
        expect(script).toContain('PROJ_PATHS');
        expect(script).toContain('proj_path');
        expect(script).toContain('proj_files');
    });

    test('uses stack-specific file-size rules for frontend stacks', () => {
        expect(script).toContain('react|angular|flutter');
        expect(script).toContain('300');
    });

    test('skips file-size check for backend stacks (java, nodejs, python, kotlin)', () => {
        // The case statement only matches frontend stacks; backend stacks fall through with no size check
        const caseBlock = script.slice(script.indexOf('case "$proj_stack"'), script.indexOf('esac'));
        expect(caseBlock).toContain('react|angular|flutter');
        expect(caseBlock).not.toContain('java');
        expect(caseBlock).not.toContain('nodejs');
    });

    test('includes secrets check for all stacks (outside stack case)', () => {
        expect(script).toContain('SECRETS');
        expect(script).toContain('AKIA');
    });

    test('skips test and fixture files in secrets check', () => {
        expect(script).toContain('test|spec|mock|fixture');
    });

    test('includes no-todos check for all stacks', () => {
        expect(script).toContain('TODO');
        expect(script).toContain('FIXME');
    });

    test('tracks files not matching any known project (UNMATCHED_FILES)', () => {
        expect(script).toContain('UNMATCHED_FILES');
    });

    test('falls back to single-project mode when no registry found', () => {
        expect(script).toContain('single-project mode');
        expect(script).toContain('pre-commit.sh');
    });

    test('reports grouped results per project with stack label', () => {
        expect(script).toContain('proj_path');
        expect(script).toContain('proj_stack');
    });

    test('exits 1 on blocking errors', () => {
        expect(script).toContain('exit 1');
        expect(script).toContain('blocking issue');
    });

    test('exits 0 with warning message on non-blocking issues', () => {
        expect(script).toContain('warning(s). Commit allowed');
    });

    test('skips during merge and rebase', () => {
        expect(script).toContain('MERGE_HEAD');
        expect(script).toContain('rebase-merge');
    });

    test('skips when no staged files', () => {
        expect(script).toContain('[[ -z "$STAGED" ]]');
    });

    test('workspace header output is distinct from single-project hook', () => {
        expect(script).toContain('workspace');
        expect(script).toContain('Pre-commit governance check (workspace)');
    });
});
