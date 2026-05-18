/**
 * Kiro workflow-assess and workflow-backlog hook tests (v20 Phase B parity).
 *
 * Verifies:
 *   - JSON envelope is well-formed and matches Kiro schema
 *   - Prompt body is agent-correct (no /assess or /new-feature slash refs)
 *   - Shared content prevents Claude/Kiro drift — same fixture produces both
 *     variants with only the agent-specific tokens differing
 *   - Cross-stack: every supported stack generates valid hooks
 */
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, Stack } from '../src/types.js';

import { generateWorkflowAssess } from '../src/agents/kiro/hooks/workflow-assess.js';
import { generateWorkflowBacklog } from '../src/agents/kiro/hooks/workflow-backlog.js';
import { generateAssessCommand } from '../src/agents/claude-code/commands/assess.js';
import { generateBacklogCommand } from '../src/agents/claude-code/commands/backlog.js';

const DEFAULT_PROJECT = {
    packageName: 'test-app',
    appName: 'test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeKiroConfig(stack: Stack = 'nodejs'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'kiro', stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '17.0.0', projectDir: '/tmp/test',
        specFirstEnabled: false, conflictMode: 'keep',
        overwrite: false, dryRun: false, updateHooks: false,
    };
}

function makeClaudeConfig(stack: Stack = 'nodejs'): GovernanceConfig {
    return { ...makeKiroConfig(stack), agent: 'claude-code' };
}

function parseHook(raw: string): { name: string; version: string; when: { type: string }; then: { type: string; prompt: string } } {
    return JSON.parse(raw);
}

// ─── workflow-assess.kiro.hook ───────────────────────────────────────────────

describe('workflow-assess hook envelope', () => {
    const raw = generateWorkflowAssess(makeKiroConfig());
    const hook = parseHook(raw);

    it('parses as valid JSON', () => {
        expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('has name "Assess"', () => {
        expect(hook.name).toBe('Assess');
    });

    it('has version matching config.hookVersion', () => {
        expect(hook.version).toBe('17.0.0');
    });

    it('uses userTriggered when type', () => {
        expect(hook.when.type).toBe('userTriggered');
    });

    it('uses askAgent then type', () => {
        expect(hook.then.type).toBe('askAgent');
    });

    it('has a non-empty prompt', () => {
        expect(hook.then.prompt.length).toBeGreaterThan(100);
    });

    it('description mentions Rewrite/Refactor/Strangler/Leave It', () => {
        expect(generateWorkflowAssess(makeKiroConfig())).toMatch(/Strangler Fig.*Leave It/);
    });
});

describe('workflow-assess prompt body', () => {
    const prompt = parseHook(generateWorkflowAssess(makeKiroConfig())).then.prompt;

    it('uses the Kiro command name in heading', () => {
        expect(prompt).toMatch(/^# workflow-assess/);
    });

    it('credits Kiro in the Assessed by line, not Claude Code', () => {
        expect(prompt).toContain('Assessed by:** Kiro via workflow-assess');
        expect(prompt).not.toContain('Claude Code via /assess');
    });

    it('contains all 11 assessment documents', () => {
        for (const n of ['00 — Index', '01 — Current State', '02 — Decision',
                         '03 — Implementation', '04 — Risk', '05 — Governance',
                         '06 — Effort', '07 — Technical Debt', '08 — Dependency',
                         '09 — Dead Code', '10 — Performance', '11 — Migration']) {
            expect(prompt).toContain(n);
        }
    });

    it('contains the 6-step Phase 1 measurement plan', () => {
        for (let i = 1; i <= 6; i++) expect(prompt).toContain(`### Step ${i} —`);
    });

    it('mentions the project name', () => {
        expect(prompt).toContain('test-app');
    });

    it('includes the four valid recommendations', () => {
        for (const r of ['Rewrite', 'Refactor', 'Strangler Fig', 'Leave It']) {
            expect(prompt).toContain(r);
        }
    });

    it('includes the THE HONEST TRUTHS section', () => {
        expect(prompt).toContain('THE HONEST TRUTHS');
    });
});

// ─── workflow-backlog.kiro.hook ──────────────────────────────────────────────

describe('workflow-backlog hook envelope', () => {
    const raw = generateWorkflowBacklog(makeKiroConfig());
    const hook = parseHook(raw);

    it('parses as valid JSON', () => {
        expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('has name "Backlog"', () => {
        expect(hook.name).toBe('Backlog');
    });

    it('has version matching config.hookVersion', () => {
        expect(hook.version).toBe('17.0.0');
    });

    it('uses userTriggered when type', () => {
        expect(hook.when.type).toBe('userTriggered');
    });

    it('uses askAgent then type', () => {
        expect(hook.then.type).toBe('askAgent');
    });
});

describe('workflow-backlog prompt body', () => {
    const prompt = parseHook(generateWorkflowBacklog(makeKiroConfig())).then.prompt;

    it('uses workflow-backlog in heading', () => {
        expect(prompt).toMatch(/^# workflow-backlog/);
    });

    it('references workflow-assess for the prerequisite', () => {
        expect(prompt).toContain('Run workflow-assess in');
        expect(prompt).not.toContain('Run /assess in');
    });

    it('references workflow-audit for cross-project rules extraction', () => {
        expect(prompt).toContain('workflow-audit at workspace root');
        expect(prompt).not.toContain('/audit at workspace root');
    });

    it('references workflow-new-feature as the downstream command', () => {
        expect(prompt).toContain('workflow-new-feature');
        // Project-level new-feature refs swap; the workspace `/new-feature` note
        // remains as a documented escape hatch.
        const projectRefs = prompt.match(/copy its `workflow-new-feature prompt`/);
        expect(projectRefs).not.toBeNull();
    });

    it('uses the .kiro/ cross-project-rules path', () => {
        expect(prompt).toContain('.kiro/steering/cross-project-rules.md');
        expect(prompt).not.toContain('.claude/steering/cross-project-rules.md');
    });

    it('uses BACK story prefix for backend stacks', () => {
        expect(prompt).toContain('BACK-NN');
    });

    it('uses FRONT story prefix for frontend stacks', () => {
        const reactPrompt = parseHook(generateWorkflowBacklog(makeKiroConfig('react'))).then.prompt;
        expect(reactPrompt).toContain('FRONT-NN');
    });

    it('contains all 5 phases plus a summary phase', () => {
        for (let i = 1; i <= 6; i++) expect(prompt).toContain(`## PHASE ${i}`);
    });
});

// ─── Drift prevention: Claude and Kiro share the same body ───────────────────

describe('shared content prevents Kiro/Claude drift', () => {
    it('Claude assess and Kiro assess differ ONLY in agent-specific tokens', () => {
        const claude = generateAssessCommand(makeClaudeConfig());
        const kiro = parseHook(generateWorkflowAssess(makeKiroConfig())).then.prompt;
        // Normalize: swap the agent-specific tokens then compare structure.
        // The knowledge preamble has two stylistic variants by design (Command
        // vs Hook framing) so we collapse both to a single marker.
        const normalized = (s: string) => s
            .replace(/^# (\/assess|workflow-assess)/m, '# CMD')
            .replace(/Claude Code via \/assess|Kiro via workflow-assess/g, 'AGENT via CMD')
            .replace(/\.claude\/developer-actions\.md|\.kiro\/developer-actions\.md/g, 'DEV_ACTIONS')
            .replace(/\n+---\n+## KNOWLEDGE CONTEXT[\s\S]*?(?=\n##|\nPHASE)/m, '\nKB\n')
            .replace(/\n{3,}/g, '\n\n');
        expect(normalized(kiro)).toBe(normalized(claude));
    });

    it('Claude backlog and Kiro backlog differ ONLY in agent-specific tokens', () => {
        const claude = generateBacklogCommand(makeClaudeConfig());
        const kiro = parseHook(generateWorkflowBacklog(makeKiroConfig())).then.prompt;
        const normalized = (s: string) => s
            .replace(/^# (\/backlog|workflow-backlog)/m, '# CMD')
            .replace(/\/assess|workflow-assess/g, 'ASSESS')
            .replace(/\/audit|workflow-audit/g, 'AUDIT')
            .replace(/\/new-feature|workflow-new-feature/g, 'NEW_FEATURE')
            .replace(/\.claude\/steering\/cross-project-rules\.md|\.kiro\/steering\/cross-project-rules\.md/g, 'XPRJ')
            .replace(/\.claude\/developer-actions\.md|\.kiro\/developer-actions\.md/g, 'DEV_ACTIONS');
        expect(normalized(kiro)).toBe(normalized(claude));
    });
});

// ─── Cross-stack ─────────────────────────────────────────────────────────────

describe('workflow-assess across all stacks', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        it(`generates valid JSON for ${stack}`, () => {
            const raw = generateWorkflowAssess(makeKiroConfig(stack));
            const hook = parseHook(raw);
            expect(hook.name).toBe('Assess');
            expect(hook.then.prompt.length).toBeGreaterThan(100);
        });
    }
});

describe('workflow-backlog across all stacks', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        it(`generates valid JSON for ${stack}`, () => {
            const raw = generateWorkflowBacklog(makeKiroConfig(stack));
            const hook = parseHook(raw);
            expect(hook.name).toBe('Backlog');
            expect(hook.then.prompt.length).toBeGreaterThan(100);
        });
    }
});

// ─── No Claude Code artifacts in Kiro output ─────────────────────────────────

describe('Kiro hooks carry no Claude Code artifacts', () => {
    const assessPrompt = parseHook(generateWorkflowAssess(makeKiroConfig())).then.prompt;
    const backlogPrompt = parseHook(generateWorkflowBacklog(makeKiroConfig())).then.prompt;

    it('workflow-assess does not mention .claude/', () => {
        expect(assessPrompt).not.toContain('.claude/');
    });

    it('workflow-backlog does not mention .claude/', () => {
        expect(backlogPrompt).not.toContain('.claude/');
    });

    it('workflow-assess does not call itself /assess in any prose', () => {
        expect(assessPrompt).not.toMatch(/^# \/assess/m);
    });

    it('workflow-backlog does not call itself /backlog in headings', () => {
        expect(backlogPrompt).not.toMatch(/^# \/backlog/m);
    });
});
