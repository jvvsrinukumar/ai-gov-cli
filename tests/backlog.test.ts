/**
 * Backlog command generator tests.
 * Covers: project-level generateBacklogCommand and workspace-level generateWorkspaceBacklogCommand.
 * Strategy: build minimal configs, call generators, assert key strings are present.
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';
import type { WorkspaceConfig } from '../src/generators/workspace.js';

import { generateBacklogCommand } from '../src/agents/claude-code/commands/backlog.js';
import { generateWorkspaceBacklogCommand } from '../src/generators/workspace/commands/backlog.js';
import { generateWorkspaceFiles } from '../src/generators/workspace.js';
import { generateClaudeCode } from '../src/agents/claude-code/index.js';
import type { WriteOptions } from '../src/utils/safe-write.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        projectDir: '/tmp/test-project',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
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

function mkTmp(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-backlog-test-'));
}

const WS_OPTS: WriteOptions = {
    overwrite: true, dryRun: false, updateHooks: false,
    hookVersion: '16.0.0', projectDir: '/tmp/test', conflictMode: 'overwrite',
};

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Project-level: basic structure ──────────────────────────────────────────

describe('generateBacklogCommand — basic structure', () => {
    test('returns a non-empty string', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
    });

    test('contains /backlog heading', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('# /backlog');
    });

    test('contains project name', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('test-app');
    });

    test('contains stack display name', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('Node.js');
    });

    test('contains all 6 phases', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        for (let i = 1; i <= 6; i++) {
            expect(out).toContain(`PHASE ${i}`);
        }
    });

    test('declares this is NOT a product backlog tool', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('NOT a product backlog tool');
    });
});

// ─── Project-level: assessment discovery ─────────────────────────────────────

describe('generateBacklogCommand — assessment discovery', () => {
    test('references docs/assessment/ as input', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('docs/assessment/');
    });

    test('instructs to stop and run /assess if assessment missing', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('Run /assess');
        expect(out).toContain('missing or incomplete');
    });

    test('references both required assessment docs', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('01_current_state_analysis.md');
        expect(out).toContain('02_decision.md');
    });

    test('references optional assessment docs', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('07_technical_debt_inventory.md');
        expect(out).toContain('09_dead_code_removal.md');
        expect(out).toContain('03_implementation_phases.md');
        expect(out).toContain('08_dependency_impact.md');
        expect(out).toContain('11_migration_compatibility.md');
    });

    test('handles Leave It recommendation — no stories generated', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('Leave It');
        expect(out).toContain('no rebuild stories generated');
    });

    test('warns if assessment is older than 30 days', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('30 days');
    });

    test('references cross-project-rules.md as API contract source', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('cross-project-rules.md');
    });

    test('warns when cross-project-rules.md is not found', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('API contracts will be sparse');
    });
});

// ─── Project-level: feature inventory ────────────────────────────────────────

describe('generateBacklogCommand — feature inventory', () => {
    test('references Doc 09 for dead code skip list', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('09_dead_code_removal.md');
    });

    test('respects KEPT status — does not skip developer-kept items', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('KEPT');
    });

    test('does not include DELETED entries in skip list', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('DELETED');
    });

    test('warns when Doc 09 is missing', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('No dead code analysis found');
    });
});

// ─── Project-level: story format ─────────────────────────────────────────────

describe('generateBacklogCommand — story format', () => {
    test('backend stack uses BACK- story ID prefix', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('BACK-');
        expect(generateBacklogCommand(makeConfig('python'))).toContain('BACK-');
        expect(generateBacklogCommand(makeConfig('java'))).toContain('BACK-');
    });

    test('frontend stack uses FRONT- story ID prefix', () => {
        expect(generateBacklogCommand(makeConfig('react'))).toContain('FRONT-');
        expect(generateBacklogCommand(makeConfig('angular'))).toContain('FRONT-');
    });

    test('mobile stacks use FRONT- story ID prefix', () => {
        expect(generateBacklogCommand(makeConfig('flutter'))).toContain('FRONT-');
        expect(generateBacklogCommand(makeConfig('swiftui'))).toContain('FRONT-');
    });

    test('contains /new-feature prompt block', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('/new-feature prompt');
    });

    test('contains HUMAN INPUT NEEDED section', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('HUMAN INPUT NEEDED');
    });

    test('human input asks for business priority P1/P2/P3', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('P1 / P2 / P3');
    });

    test('story format includes parallel-safe field', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Parallel-safe');
    });

    test('story format includes debt items field', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Debt items');
    });

    test('story format includes dependencies field', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Dependencies');
    });
});

// ─── Project-level: output files ─────────────────────────────────────────────

describe('generateBacklogCommand — output files', () => {
    test('output goes to docs/backlog/', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('docs/backlog/');
    });

    test('lists all 5 output files', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('00_index.md');
        expect(out).toContain('stories.md');
        expect(out).toContain('combined-backlog.md');
        expect(out).toContain('skip-list.md');
        expect(out).toContain('phases.md');
    });

    test('combined-backlog has Status column', () => {
        const out = generateBacklogCommand(makeConfig('nodejs'));
        expect(out).toContain('Status');
        expect(out).toContain('not started');
    });

    test('states output overwrites on re-run', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Overwrites on re-run');
    });
});

// ─── Project-level: "does not do" boundaries ─────────────────────────────────

describe('generateBacklogCommand — explicit boundaries', () => {
    test('states it does not assign business priority', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Assign business priority');
    });

    test('states it does not add new features', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Add new features');
    });

    test('states it does not read source files directly', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Read source files directly');
    });

    test('states it does not create specs', () => {
        expect(generateBacklogCommand(makeConfig('nodejs'))).toContain('Create specs');
    });
});

// ─── Project-level: all stacks generate valid output ─────────────────────────

describe('generateBacklogCommand — all stacks', () => {
    const stacks: Stack[] = ['nodejs', 'react', 'python', 'flutter', 'angular', 'java', 'kotlin', 'swiftui'];

    for (const stack of stacks) {
        test(`generates valid output for ${stack}`, () => {
            const out = generateBacklogCommand(makeConfig(stack));
            expect(out).toContain('# /backlog');
            expect(out).toContain('docs/assessment/');
            expect(out).toContain('HUMAN INPUT NEEDED');
            expect(out).toContain('docs/backlog/');
        });
    }
});

// ─── Workspace-level: basic structure ────────────────────────────────────────

describe('generateWorkspaceBacklogCommand — basic structure', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('returns a non-empty string', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
    });

    test('contains /backlog heading', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('# /backlog');
    });

    test('contains workspace name', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('test-workspace');
    });

    test('lists all project paths', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('backend/api-server');
        expect(out).toContain('frontend/web-app');
    });

    test('contains all 6 phases', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        for (let i = 1; i <= 6; i++) {
            expect(out).toContain(`PHASE ${i}`);
        }
    });

    test('declares this is NOT a product backlog tool', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('NOT a product backlog tool');
    });
});

// ─── Workspace-level: assessment discovery ───────────────────────────────────

describe('generateWorkspaceBacklogCommand — assessment discovery', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('checks assessment for each project', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('backend/api-server');
        expect(out).toContain('frontend/web-app');
    });

    test('instructs to run /assess for missing assessments', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('Run /assess in');
    });

    test('continues with remaining projects when one assessment is missing', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Exclude that project');
        // should not say "Stop"
        expect(out).not.toMatch(/MISSING.*Stop\./);
    });

    test('references cross-project-rules.md', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('cross-project-rules.md');
    });

    test('warns about stale assessments older than 30 days', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('30 days');
    });

    test('handles Leave It recommendation per project', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('Leave It');
    });
});

// ─── Workspace-level: story IDs ──────────────────────────────────────────────

describe('generateWorkspaceBacklogCommand — story IDs', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('backend projects use BACK- prefix', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('BACK-');
    });

    test('frontend projects use FRONT- prefix', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('FRONT-');
    });
});

// ─── Workspace-level: phase ordering ─────────────────────────────────────────

describe('generateWorkspaceBacklogCommand — phase ordering', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('Phase 0 is API Contract', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Phase 0');
        expect(out).toContain('API Contract');
    });

    test('Phase 2 is Backend', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Phase 2');
        expect(out).toContain('Backend');
    });

    test('Phase 3 is Frontend', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Phase 3');
        expect(out).toContain('Frontend');
    });

    test('backend phase appears before frontend phase in content', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out.indexOf('Phase 2')).toBeLessThan(out.indexOf('Phase 3'));
    });

    test('states backend always before frontend — non-negotiable', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('non-negotiable');
    });
});

// ─── Workspace-level: output files ───────────────────────────────────────────

describe('generateWorkspaceBacklogCommand — output files', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('output goes to workspace-root docs/backlog/', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('docs/backlog/');
    });

    test('lists all 6 output files', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('00_index.md');
        expect(out).toContain('backend-stories.md');
        expect(out).toContain('frontend-stories.md');
        expect(out).toContain('combined-backlog.md');
        expect(out).toContain('skip-list.md');
        expect(out).toContain('phases.md');
    });

    test('combined-backlog has Cross-project column', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('Cross-project');
    });

    test('combined-backlog has Status column with not-started default', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Status');
        expect(out).toContain('not started');
    });

    test('states output never goes inside a project directory', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('never inside a project directory');
    });

    test('states output overwrites on re-run', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('Overwrites on re-run');
    });
});

// ─── Workspace-level: cross-project dependencies ─────────────────────────────

describe('generateWorkspaceBacklogCommand — cross-project dependencies', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('frontend stories note dependency on backend stories', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('Depends on BACK-');
    });

    test('warns when backend endpoint not found in backlog', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).toContain('backend endpoint not in backlog');
    });

    test('mentions parallel-safe stories', () => {
        expect(generateWorkspaceBacklogCommand(makeWsConfig(root))).toContain('Parallel-safe');
    });
});

// ─── Workspace-level: mobile projects ────────────────────────────────────────

describe('generateWorkspaceBacklogCommand — mobile projects', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('no mobile section when no mobile projects', () => {
        const out = generateWorkspaceBacklogCommand(makeWsConfig(root));
        expect(out).not.toContain('Mobile Implementation');
        expect(out).not.toContain('MOB-');
    });

    test('includes mobile project paths when mobile project present', () => {
        const config = makeWsConfig(root, {
            projects: [
                { name: 'api', relativePath: 'backend/api', stack: 'nodejs', group: 'backend' },
                { name: 'app', relativePath: 'mobile/app', stack: 'flutter', group: 'mobile' },
            ],
        });
        const out = generateWorkspaceBacklogCommand(config);
        expect(out).toContain('mobile/app');
    });

    test('includes mobile phase when mobile project present', () => {
        const config = makeWsConfig(root, {
            projects: [
                { name: 'api', relativePath: 'backend/api', stack: 'nodejs', group: 'backend' },
                { name: 'app', relativePath: 'mobile/app', stack: 'flutter', group: 'mobile' },
            ],
        });
        const out = generateWorkspaceBacklogCommand(config);
        expect(out).toContain('Mobile');
    });

    test('verify phase number increments when mobile project present', () => {
        const withMobile = makeWsConfig(root, {
            projects: [
                { name: 'api', relativePath: 'backend/api', stack: 'nodejs', group: 'backend' },
                { name: 'web', relativePath: 'frontend/web', stack: 'react', group: 'frontend' },
                { name: 'app', relativePath: 'mobile/app', stack: 'flutter', group: 'mobile' },
            ],
        });
        const withoutMobile = makeWsConfig(root);
        const outWith = generateWorkspaceBacklogCommand(withMobile);
        const outWithout = generateWorkspaceBacklogCommand(withoutMobile);
        // with mobile: verify phase is 5; without: verify phase is 4
        expect(outWith).toContain('Phase 5');
        expect(outWithout).not.toContain('Phase 5');
    });
});

// ─── Workspace-level: single project edge case ───────────────────────────────

describe('generateWorkspaceBacklogCommand — single project', () => {
    let root: string;
    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('works with a single backend project', () => {
        const config = makeWsConfig(root, {
            projects: [{ name: 'api', relativePath: 'api', stack: 'nodejs', group: '' }],
        });
        const out = generateWorkspaceBacklogCommand(config);
        expect(out).toContain('# /backlog');
        expect(out).toContain('api');
        expect(out).toContain('BACK-');
    });

    test('mentions single-project works fine in rules', () => {
        const config = makeWsConfig(root, {
            projects: [{ name: 'api', relativePath: 'api', stack: 'nodejs', group: '' }],
        });
        expect(generateWorkspaceBacklogCommand(config)).toContain('Single-project workspace');
    });
});

// ─── Integration: generateWorkspaceFiles writes backlog.md ───────────────────

describe('generateWorkspaceFiles — backlog command written', () => {
    let root: string;

    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('writes .claude/commands/backlog.md', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'commands', 'backlog.md'))).toBe(true);
    });

    test('backlog.md contains workspace name', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'commands', 'backlog.md'), 'utf-8');
        expect(content).toContain('test-workspace');
    });

    test('backlog.md lists all project paths', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'commands', 'backlog.md'), 'utf-8');
        expect(content).toContain('backend/api-server');
        expect(content).toContain('frontend/web-app');
    });

    test('backlog.md references docs/backlog/ output path', () => {
        generateWorkspaceFiles(makeWsConfig(root), { ...WS_OPTS, projectDir: root });
        const content = readFileSync(join(root, '.claude', 'commands', 'backlog.md'), 'utf-8');
        expect(content).toContain('docs/backlog/');
    });

    test('backlog.md is not written for Kiro agent', () => {
        generateWorkspaceFiles(makeWsConfig(root, { agent: 'kiro' }), { ...WS_OPTS, projectDir: root });
        expect(existsSync(join(root, '.claude', 'commands', 'backlog.md'))).toBe(false);
    });
});

// ─── Integration: generateClaudeCode writes project-level backlog.md ─────────

describe('generateClaudeCode — backlog command written', () => {
    let root: string;

    beforeEach(() => { root = mkTmp(); });
    afterEach(() => rmSync(root, { recursive: true, force: true }));

    test('writes .claude/commands/backlog.md for nodejs project', () => {
        generateClaudeCode({ ...makeConfig('nodejs'), projectDir: root, overwrite: true, conflictMode: 'overwrite' });
        expect(existsSync(join(root, '.claude', 'commands', 'backlog.md'))).toBe(true);
    });

    test('backlog.md contains project name', () => {
        generateClaudeCode({ ...makeConfig('nodejs'), projectDir: root, overwrite: true, conflictMode: 'overwrite' });
        const content = readFileSync(join(root, '.claude', 'commands', 'backlog.md'), 'utf-8');
        expect(content).toContain('test-app');
    });

    test('backlog.md references docs/assessment/', () => {
        generateClaudeCode({ ...makeConfig('nodejs'), projectDir: root, overwrite: true, conflictMode: 'overwrite' });
        const content = readFileSync(join(root, '.claude', 'commands', 'backlog.md'), 'utf-8');
        expect(content).toContain('docs/assessment/');
    });

    test('backlog.md written alongside assess.md', () => {
        generateClaudeCode({ ...makeConfig('nodejs'), projectDir: root, overwrite: true, conflictMode: 'overwrite' });
        expect(existsSync(join(root, '.claude', 'commands', 'assess.md'))).toBe(true);
        expect(existsSync(join(root, '.claude', 'commands', 'backlog.md'))).toBe(true);
    });

    test('upgradeClaudeCode also writes backlog.md', () => {
        const { upgradeClaudeCode } = require('../src/agents/claude-code/index.js');
        const opts: WriteOptions = { overwrite: true, dryRun: false, updateHooks: false, hookVersion: '16.0.0', projectDir: root, conflictMode: 'overwrite' };
        mkdirSync(join(root, '.claude', 'commands'), { recursive: true });
        upgradeClaudeCode({ ...makeConfig('nodejs'), projectDir: root }, opts, false);
        expect(existsSync(join(root, '.claude', 'commands', 'backlog.md'))).toBe(true);
    });
});
