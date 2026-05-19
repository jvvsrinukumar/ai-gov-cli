/**
 * Plan-phases command generator tests.
 * Covers: project-level generatePlanPhasesCommand (Claude) and workflow-plan-phases (Kiro).
 * Strategy: build minimal configs, call generators, assert key strings are present.
 *
 * Verifies:
 *   - Content correctness (zero-hallucination rules, doc clarity, completion contract)
 *   - JSON envelope validity (Kiro hook schema)
 *   - Cross-stack: every supported stack generates valid output
 *   - Drift prevention: Claude and Kiro share the same content body
 *   - No Claude artifacts in Kiro output / no Kiro artifacts in Claude output
 */
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, Stack } from '../src/types.js';

import { generatePlanPhasesCommand } from '../src/agents/claude-code/commands/plan-phases.js';
import { generateWorkflowPlanPhases } from '../src/agents/kiro/hooks/workflow-plan-phases.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PROJECT = {
    packageName: 'test-app',
    appName: 'test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(stack: Stack = 'nodejs'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'claude-code',
        stack,
        profile,
        scan,
        project: DEFAULT_PROJECT,
        blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '20.0.0',
        projectDir: '/tmp/test-project',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

function makeKiroConfig(stack: Stack = 'nodejs'): GovernanceConfig {
    return { ...makeConfig(stack), agent: 'kiro' };
}

function parseHook(raw: string): { name: string; version: string; description: string; when: { type: string }; then: { type: string; prompt: string } } {
    return JSON.parse(raw);
}

beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Basic structure ─────────────────────────────────────────────────────────

describe('generatePlanPhasesCommand — basic structure', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('returns a non-empty string', () => {
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(100);
    });

    test('contains /plan-phases heading', () => {
        expect(out).toContain('# /plan-phases');
    });

    test('contains project name', () => {
        expect(out).toContain('test-app');
    });

    test('contains stack display name', () => {
        expect(out).toContain('Node.js');
    });

    test('contains docs/phases/ output path', () => {
        expect(out).toContain('docs/phases/');
    });

    test('does NOT contain tasks.md', () => {
        // Rule #7: no tasks.md generation
        expect(out).not.toMatch(/tasks\.md.*Implementation Order/);
        expect(out).toContain('No tasks.md');
    });

    test('references /new-feature as the downstream command', () => {
        expect(out).toContain('/new-feature');
    });
});

// ─── Zero hallucination discipline ──────────────────────────────────────────

describe('generatePlanPhasesCommand — zero hallucination', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('contains ZERO HALLUCINATION rule (Rule #2)', () => {
        expect(out).toContain('ZERO HALLUCINATION');
    });

    test('contains the golden rule about traceability', () => {
        expect(out).toContain('cannot point to a specific sentence or paragraph');
    });

    test('contains NOT IN DOC marker pattern', () => {
        expect(out).toContain('⚠️ NOT IN DOC — developer must provide');
    });

    test('contains source-mapping table in Step 0', () => {
        expect(out).toContain('Story title');
        expect(out).toContain('If missing in doc');
    });

    test('lists forbidden actions (invent, fabricate, guess, assume)', () => {
        expect(out).toContain('Invent user stories');
        expect(out).toContain('Fabricate acceptance criteria');
        expect(out).toContain('Guess API endpoints');
        expect(out).toContain('Assume business rules');
    });

    test('does NOT contain "Estimated size" field (removed — was an inference)', () => {
        expect(out).not.toContain('Estimated size');
    });

    test('story template requires verbatim source quote', () => {
        expect(out).toContain('Source (verbatim from doc)');
    });

    test('does NOT suggest filling defaults for missing info', () => {
        expect(out).not.toContain('reasonable defaults');
        expect(out).toContain('do not make that claim');
    });
});

// ─── Document clarity validation ─────────────────────────────────────────────

describe('generatePlanPhasesCommand — doc clarity', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('contains DOC CLARITY warning pattern', () => {
        expect(out).toContain('⚠️ DOC CLARITY');
    });

    test('contains DOCUMENT NOT IN CLEAR STATE stop condition', () => {
        expect(out).toContain('DOCUMENT NOT IN CLEAR STATE');
    });

    test('contains clarity standards table', () => {
        expect(out).toContain('STORY CLARITY STANDARDS');
    });

    test('lists specific fail conditions for clarity', () => {
        expect(out).toContain('appropriate');
        expect(out).toContain('TBD');
        expect(out).toContain('contradicts itself');
    });

    test('stories with clarity issues include questions the developer must answer', () => {
        expect(out).toContain('Questions the developer must answer');
    });
});

// ─── Completion contract ─────────────────────────────────────────────────────

describe('generatePlanPhasesCommand — completion contract', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('contains PHASES_COMPLETE: contract token', () => {
        expect(out).toContain('PHASES_COMPLETE:');
    });

    test('contract includes phases count', () => {
        expect(out).toContain('phases=<N>');
    });

    test('contract includes stories count', () => {
        expect(out).toContain('stories=<total>');
    });

    test('contract includes clarity_warnings count', () => {
        expect(out).toContain('clarity_warnings=<N>');
    });

    test('contract includes docs_generated count', () => {
        expect(out).toContain('docs_generated=<file_count>');
    });

    test('contract appears in both Rule #8 and FINAL OUTPUT section', () => {
        const matches = out.match(/PHASES_COMPLETE:/g);
        expect(matches).not.toBeNull();
        expect(matches!.length).toBeGreaterThanOrEqual(2);
    });
});

// ─── Knowledge hub integration ───────────────────────────────────────────────

describe('generatePlanPhasesCommand — knowledge hub', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('contains KNOWLEDGE CONTEXT section', () => {
        expect(out).toContain('KNOWLEDGE CONTEXT');
    });

    test('references knowledge/ directory', () => {
        expect(out).toContain('knowledge/');
    });

    test('references tech-overview.md for architecture context', () => {
        expect(out).toContain('tech-overview.md');
    });

    test('states knowledge hub helps ordering, not inventing stories', () => {
        expect(out).toContain('does NOT add new stories');
    });

    test('mentions CONFLICTS WITH KNOWLEDGE HUB warning', () => {
        expect(out).toContain('CONFLICTS WITH KNOWLEDGE HUB');
    });
});

// ─── No governance-state.json integration ────────────────────────────────────

describe('generatePlanPhasesCommand — governance-state boundary', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('explicitly states no governance-state.json writes', () => {
        expect(out).toContain('governance-state.json');
        expect(out).toContain('does NOT flow into governance-state.json');
    });
});

// ─── Rule #1 vs Rule #5 clarity ─────────────────────────────────────────────

describe('generatePlanPhasesCommand — no mid-run human gates', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('Rule #1 clarifies it is only a start-gate', () => {
        expect(out).toContain('This is the only gate');
        expect(out).toContain('Rule #5 takes over');
    });

    test('does not contain HUMAN INPUT REQUIRED literal', () => {
        expect(out).not.toContain('HUMAN INPUT REQUIRED');
    });

    test('does not contain stop-and-wait language mid-pipeline', () => {
        // After Step 1 validation, should NOT say "STOP and wait"
        expect(out).not.toContain('STOP. Wait for');
    });
});

// ─── Kiro hook envelope ──────────────────────────────────────────────────────

describe('workflow-plan-phases hook envelope', () => {
    const raw = generateWorkflowPlanPhases(makeKiroConfig());
    const hook = parseHook(raw);

    test('parses as valid JSON', () => {
        expect(() => JSON.parse(raw)).not.toThrow();
    });

    test('has name "Plan Phases"', () => {
        expect(hook.name).toBe('Plan Phases');
    });

    test('has version matching config.hookVersion', () => {
        expect(hook.version).toBe('20.0.0');
    });

    test('uses userTriggered when type', () => {
        expect(hook.when.type).toBe('userTriggered');
    });

    test('uses askAgent then type', () => {
        expect(hook.then.type).toBe('askAgent');
    });

    test('has a non-empty prompt', () => {
        expect(hook.then.prompt.length).toBeGreaterThan(100);
    });

    test('description mentions phases and documents', () => {
        expect(hook.description).toContain('phase');
        expect(hook.description).toContain('document');
    });
});

// ─── Kiro prompt body ────────────────────────────────────────────────────────

describe('workflow-plan-phases prompt body', () => {
    const prompt = parseHook(generateWorkflowPlanPhases(makeKiroConfig())).then.prompt;

    test('uses workflow-plan-phases in heading', () => {
        expect(prompt).toMatch(/^# workflow-plan-phases/);
    });

    test('references workflow-new-feature as downstream command', () => {
        expect(prompt).toContain('workflow-new-feature');
    });

    test('references workflow-backlog as sibling command', () => {
        expect(prompt).toContain('workflow-backlog');
    });

    test('contains zero hallucination discipline', () => {
        expect(prompt).toContain('ZERO HALLUCINATION');
    });

    test('contains PHASES_COMPLETE: contract', () => {
        expect(prompt).toContain('PHASES_COMPLETE:');
    });
});

// ─── Drift prevention: Claude and Kiro share the same body ───────────────────

describe('shared content prevents Kiro/Claude drift', () => {
    test('Claude plan-phases and Kiro plan-phases differ ONLY in agent-specific tokens', () => {
        const claude = generatePlanPhasesCommand(makeConfig());
        const kiro = parseHook(generateWorkflowPlanPhases(makeKiroConfig())).then.prompt;
        // Normalize agent-specific tokens
        const normalized = (s: string) => s
            .replace(/^# (\/plan-phases|workflow-plan-phases)/m, '# CMD')
            .replace(/re-run (\/plan-phases|workflow-plan-phases)/g, 're-run CMD')
            .replace(/\/backlog|workflow-backlog/g, 'BACKLOG')
            .replace(/\/new-feature|workflow-new-feature/g, 'NEW_FEATURE')
            .replace(/\/assess|workflow-assess/g, 'ASSESS');
        expect(normalized(kiro)).toBe(normalized(claude));
    });
});

// ─── Cross-stack ─────────────────────────────────────────────────────────────

describe('generatePlanPhasesCommand across all stacks', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        test(`generates valid output for ${stack}`, () => {
            const out = generatePlanPhasesCommand(makeConfig(stack));
            expect(out.length).toBeGreaterThan(100);
            expect(out).toContain('# /plan-phases');
            expect(out).toContain('PHASES_COMPLETE:');
            expect(out).toContain('ZERO HALLUCINATION');
        });
    }
});

describe('workflow-plan-phases across all stacks', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        test(`generates valid JSON for ${stack}`, () => {
            const raw = generateWorkflowPlanPhases(makeKiroConfig(stack));
            const hook = parseHook(raw);
            expect(hook.name).toBe('Plan Phases');
            expect(hook.then.prompt.length).toBeGreaterThan(100);
        });
    }
});

// ─── No Claude Code artifacts in Kiro output ─────────────────────────────────

describe('Kiro hook carries no Claude Code artifacts', () => {
    const prompt = parseHook(generateWorkflowPlanPhases(makeKiroConfig())).then.prompt;

    test('does not mention .claude/', () => {
        expect(prompt).not.toContain('.claude/');
    });

    test('does not call itself /plan-phases in heading', () => {
        expect(prompt).not.toMatch(/^# \/plan-phases/m);
    });

    test('does not reference /new-feature (slash form)', () => {
        expect(prompt).not.toContain('/new-feature');
    });

    test('does not reference /backlog (slash form)', () => {
        expect(prompt).not.toContain('/backlog');
    });
});

// ─── No Kiro artifacts in Claude output ──────────────────────────────────────

describe('Claude command carries no Kiro artifacts', () => {
    const out = generatePlanPhasesCommand(makeConfig());

    test('does not mention .kiro/', () => {
        expect(out).not.toContain('.kiro/');
    });

    test('does not reference workflow-new-feature', () => {
        expect(out).not.toContain('workflow-new-feature');
    });

    test('does not reference workflow-backlog', () => {
        expect(out).not.toContain('workflow-backlog');
    });
});
