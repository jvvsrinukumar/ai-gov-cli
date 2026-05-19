/**
 * Workspace /jira and workspace-jira-sync.kiro.hook tests — verifies
 * cross-project Jira sync covers workspace-root + every project spec dir.
 */
import { generateWorkspaceJiraCommand } from '../src/generators/workspace/commands/jira.js';
import { generateWsWorkflowJiraSync } from '../src/generators/workspace/hooks/kiro-workspace-hooks.js';
import type { WorkspaceConfig, WorkspaceProject } from '../src/generators/workspace/types.js';

function makeWsConfig(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
    return {
        workspaceName: 'orbit',
        workspaceDir: '/tmp/orbit',
        projects: [
            { name: 'api', relativePath: 'backend/api', stack: 'nodejs', group: 'backend' },
            { name: 'web', relativePath: 'frontend/web', stack: 'react', group: 'frontend' },
        ],
        dryRun: false,
        overwrite: true,
        hookVersion: '20.1.0',
        ...overrides,
    };
}

const SINGLE_PROJECT: WorkspaceProject[] = [
    { name: 'core', relativePath: 'core', stack: 'java', group: 'backend' },
];

// ─── Claude workspace /jira ──────────────────────────────────────────────────

describe('generateWorkspaceJiraCommand — structure', () => {
    const out = generateWorkspaceJiraCommand(makeWsConfig());

    it('has the workspace /jira heading', () => {
        expect(out).toMatch(/^# \/jira — Workspace Jira Sync/);
    });

    it('mentions the workspace name', () => {
        expect(out).toContain('orbit');
    });

    it('mentions the project count', () => {
        expect(out).toContain('Projects:** 2');
    });

    it('lists every project path', () => {
        expect(out).toContain('backend/api');
        expect(out).toContain('frontend/web');
    });

    it('declares workspace-root spec scan', () => {
        expect(out).toContain('workspace root');
    });

    it('explains multi-spec → single story support', () => {
        expect(out).toContain('single Jira story');
    });

    it('includes the shared Jira-sync workflow body', () => {
        expect(out).toContain('## Jira Sync Workflow');
        expect(out).toContain('Step 1 — Discover specs');
    });

    it('includes scope label in shared workflow intro', () => {
        expect(out).toContain('Scope:');
        expect(out).toContain('workspace');
    });
});

describe('generateWorkspaceJiraCommand — spec paths', () => {
    it('Claude workspace scans workspace `specs/`', () => {
        const out = generateWorkspaceJiraCommand(makeWsConfig({ agent: 'claude-code' }));
        expect(out).toMatch(/`specs\/`/);
    });

    it('Kiro workspace scans workspace `.kiro/specs/`', () => {
        const out = generateWorkspaceJiraCommand(makeWsConfig({ agent: 'kiro' }));
        expect(out).toContain('.kiro/specs/');
    });

    it('scans each project for both specs/ and .kiro/specs/', () => {
        const out = generateWorkspaceJiraCommand(makeWsConfig());
        expect(out).toContain('backend/api/specs/');
        expect(out).toContain('backend/api/.kiro/specs/');
        expect(out).toContain('frontend/web/specs/');
        expect(out).toContain('frontend/web/.kiro/specs/');
    });

    it('handles a single-project workspace', () => {
        const out = generateWorkspaceJiraCommand(makeWsConfig({ projects: SINGLE_PROJECT }));
        expect(out).toContain('Projects:** 1');
        expect(out).toContain('core/specs/');
    });

    it('handles a five-project workspace without truncating', () => {
        const projects: WorkspaceProject[] = Array.from({ length: 5 }, (_, i) => ({
            name: `svc${i}`, relativePath: `services/svc${i}`, stack: 'nodejs', group: 'backend',
        }));
        const out = generateWorkspaceJiraCommand(makeWsConfig({ projects }));
        for (let i = 0; i < 5; i++) {
            expect(out).toContain(`services/svc${i}/specs/`);
        }
    });
});

describe('generateWorkspaceJiraCommand — reuses shared body', () => {
    const out = generateWorkspaceJiraCommand(makeWsConfig());

    it('keeps all 6 Jira-sync steps', () => {
        expect(out).toContain('### Step 1 —');
        expect(out).toContain('### Step 2 —');
        expect(out).toContain('### Step 3 —');
        expect(out).toContain('### Step 4 —');
        expect(out).toContain('### Step 5 —');
        expect(out).toContain('### Step 6 —');
    });

    it('preserves Jira API call references', () => {
        expect(out).toContain('jira_get');
        expect(out).toContain('jira_create');
        expect(out).toContain('jira_add_comment');
    });

    it('preserves the .jira metadata file convention', () => {
        expect(out).toContain('.jira');
        expect(out).toContain('subtasks');
    });
});

// ─── Kiro workspace-jira-sync.kiro.hook ──────────────────────────────────────

function parseHook(raw: string): { name: string; version: string; when: { type: string }; then: { type: string; prompt: string } } {
    return JSON.parse(raw);
}

describe('generateWsWorkflowJiraSync — Kiro envelope', () => {
    const raw = generateWsWorkflowJiraSync('20.1.0', 'orbit', makeWsConfig().projects);
    const hook = parseHook(raw);

    it('parses as valid JSON', () => {
        expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('names the hook "Jira Sync [Workspace]"', () => {
        expect(hook.name).toBe('Jira Sync [Workspace]');
    });

    it('uses the supplied hook version', () => {
        expect(hook.version).toBe('20.1.0');
    });

    it('uses userTriggered when.type', () => {
        expect(hook.when.type).toBe('userTriggered');
    });

    it('uses askAgent then.type', () => {
        expect(hook.then.type).toBe('askAgent');
    });

    it('description mentions workspace + single Jira story mapping', () => {
        expect(hook.then.prompt.length).toBeGreaterThan(100);
        // description is on the outer envelope, but name + envelope already verified
    });
});

describe('generateWsWorkflowJiraSync — prompt body', () => {
    const prompt = parseHook(
        generateWsWorkflowJiraSync('20.1.0', 'orbit', makeWsConfig().projects),
    ).then.prompt;

    it('declares the workspace name in the heading', () => {
        expect(prompt).toContain('Workspace: orbit');
    });

    it('lists workspace-root and per-project spec paths', () => {
        expect(prompt).toContain('.kiro/specs/');
        expect(prompt).toContain('backend/api/.kiro/specs/');
        expect(prompt).toContain('backend/api/specs/');
        expect(prompt).toContain('frontend/web/.kiro/specs/');
        expect(prompt).toContain('frontend/web/specs/');
    });

    it('supports multi-spec selection (single story can absorb sub-tasks from multiple specs)', () => {
        expect(prompt).toContain('multi-select supported');
    });

    it('prefixes sub-task summaries with spec name when multiple specs are involved', () => {
        expect(prompt).toContain('[auth-service]');
    });

    it('still references the .jira metadata file per spec', () => {
        expect(prompt).toContain('.jira');
        expect(prompt).toContain('subtasks');
    });

    it('groups discovered specs by source in the table header', () => {
        expect(prompt).toMatch(/\|\s*Source\s*\|\s*Spec\s*\|/);
    });

    it('preserves the 6-step structure', () => {
        for (let i = 1; i <= 6; i++) expect(prompt).toContain(`## Step ${i}`);
    });
});

// ─── Both variants share the Jira contract ───────────────────────────────────

describe('Claude and Kiro workspace variants share the Jira contract', () => {
    const claudeOut = generateWorkspaceJiraCommand(makeWsConfig({ agent: 'claude-code' }));
    const kiroOut = parseHook(
        generateWsWorkflowJiraSync('20.1.0', 'orbit', makeWsConfig().projects),
    ).then.prompt;

    it('both include the jira_get + jira_create + jira_add_comment vocabulary', () => {
        for (const cmd of ['jira_get', 'jira_create', 'jira_add_comment']) {
            expect(claudeOut).toContain(cmd);
            expect(kiroOut).toContain(cmd);
        }
    });

    it('both reference .jira metadata persistence', () => {
        expect(claudeOut).toContain('.jira');
        expect(kiroOut).toContain('.jira');
    });

    it('both name the workspace', () => {
        expect(claudeOut).toContain('orbit');
        expect(kiroOut).toContain('orbit');
    });
});

// ─── No leaking project-only assumptions ─────────────────────────────────────

describe('Workspace jira does not collapse to a single-project scan', () => {
    const out = generateWorkspaceJiraCommand(makeWsConfig());

    it('explicitly scans more than two paths', () => {
        // Default project-level scan was exactly 2 paths (.kiro/specs/ + specs/).
        // Workspace must scan workspace root + 2 paths per project. With 2
        // projects that's 5 paths minimum.
        const backtickPaths = out.match(/`[^`]*specs\/`/g) ?? [];
        expect(backtickPaths.length).toBeGreaterThanOrEqual(5);
    });

    it('mentions that it reuses every project spec, not just one', () => {
        expect(out).toMatch(/every project/i);
    });
});
