/**
 * Assess command generator tests — covers both Claude /assess and Kiro
 * workflow-assess. Verifies prompt structure, the v20 evidence-based Business
 * Pressure rubric (replaces the v19 HUMAN INPUT gate), ASSUMPTIONS schema
 * emission, completion contract, and cross-stack behavior.
 */
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateAssessCommand } from '../src/agents/claude-code/commands/assess.js';
import { generateWorkflowAssess } from '../src/agents/kiro/hooks/workflow-assess.js';

const DEFAULT_PROJECT = {
    packageName: 'assess-test-app',
    appName: 'assess-test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(stack: Stack = 'nodejs', agent: 'claude-code' | 'kiro' = 'claude-code'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = createDefaultScanResult();
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent, stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '20.0.0', projectDir: '/tmp/test',
        specFirstEnabled: false, conflictMode: 'keep',
        overwrite: false, dryRun: false, updateHooks: false,
    };
}

function kiroPrompt(stack: Stack = 'nodejs'): string {
    const raw = generateWorkflowAssess(makeConfig(stack, 'kiro'));
    return JSON.parse(raw).then.prompt;
}

// ─── Structure ───────────────────────────────────────────────────────────────

describe('generateAssessCommand — structure', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('heading uses /assess', () => { expect(out).toMatch(/^# \/assess/); });
    it('mentions the project name', () => { expect(out).toContain('assess-test-app'); });
    it('declares this is a refactor-vs-rewrite framework', () => {
        expect(out).toContain('Refactor vs Rewrite Decision Framework');
    });
    it('contains 3 phase markers', () => {
        const phases = out.match(/^## PHASE \d+/gm) ?? [];
        expect(phases.length).toBe(3);
    });
    it('contains all 6 Phase 1 measurement steps', () => {
        for (let i = 1; i <= 6; i++) expect(out).toContain(`### Step ${i} —`);
    });
    it('Phase 2 enumerates all 11 documents', () => {
        for (let i = 0; i <= 11; i++) {
            const padded = i.toString().padStart(2, '0');
            expect(out).toContain(`Document ${padded} —`);
        }
    });
    it('writes output to docs/assessment/', () => {
        expect(out).toContain('docs/assessment/');
    });
});

describe('generateAssessCommand — four recommendations', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('Rewrite is listed', () => { expect(out).toContain('Rewrite'); });
    it('Refactor is listed', () => { expect(out).toContain('Refactor'); });
    it('Strangler Fig is listed', () => { expect(out).toContain('Strangler Fig'); });
    it('Leave It is listed', () => { expect(out).toContain('Leave It'); });
});

// ─── Business Pressure rubric (v20 §3.2, AC-3) ───────────────────────────────

describe('generateAssessCommand — Business Pressure rubric (AC-3)', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('no longer contains HUMAN INPUT REQUIRED gate', () => {
        expect(out).not.toContain('HUMAN INPUT REQUIRED');
    });
    it('does not contain the v19 "assume 2" placeholder shortcut', () => {
        expect(out).not.toMatch(/placeholder score of\s+\*\*2/);
    });
    it('declares the Business Pressure Inference rubric header', () => {
        expect(out).toContain('Business Pressure Inference');
    });
    it('lists the 6 signals from §3.2 — bug commits', () => {
        expect(out).toMatch(/--grep=.fix.+bug/);
    });
    it('lists the deferred-actions signal', () => {
        expect(out).toContain('developer-actions.md');
        expect(out).toContain('older than 60 days');
    });
    it('lists the contributor churn signal', () => {
        expect(out).toMatch(/Contributor churn/);
    });
    it('lists the EOL dependency signal', () => {
        expect(out).toMatch(/EOL or 2\+ major-behind/);
    });
    it('lists the revert/hotfix density signal', () => {
        expect(out).toMatch(/Revert \/ hotfix density/);
    });
    it('includes the "Core stable" negative signal worth −2', () => {
        expect(out).toContain('Core stable');
        expect(out).toContain('−2');
    });
    it('defines composite→bucket thresholds', () => {
        expect(out).toContain('≤ 0 → score **1**');
        expect(out).toContain('≥ 5 → score **4**');
    });
    it('CONFIDENCE rule maps signal-count to level', () => {
        expect(out).toContain('≥3 signals = High');
        expect(out).toContain('2 = Medium');
        expect(out).toContain('≤1 = Low');
    });
});

// ─── ASSUMPTIONS block (machine-readable) ────────────────────────────────────

describe('generateAssessCommand — ASSUMPTIONS block', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('emits an ASSUMPTIONS block matching the schema', () => {
        expect(out).toContain('ASSUMPTIONS block');
        expect(out).toContain('field: assessment.businessPressure');
    });
    it('schema includes evidence array', () => {
        expect(out).toContain('evidence:');
    });
    it('schema includes confidence and reviewRequired', () => {
        expect(out).toContain('confidence:');
        expect(out).toContain('reviewRequired:');
    });
    it('marks reviewRequired=true when confidence=low', () => {
        expect(out).toMatch(/reviewRequired:.*confidence=low/);
    });
});

// ─── Completion contract (AC-8) ──────────────────────────────────────────────

describe('generateAssessCommand — completion contract (AC-8)', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('declares the contract in execution rules', () => {
        expect(out).toContain('ASSESS_COMPLETE:');
    });
    it('contract specifies docs-written=N/11', () => {
        expect(out).toContain('docs-written=<N>/11');
    });
    it('contract lists all four recommendation values', () => {
        expect(out).toContain('recommendation=<Rewrite|Refactor|Strangler|Leave-It>');
    });
    it('has a FINAL OUTPUT section', () => {
        expect(out).toContain('FINAL OUTPUT — completion contract');
    });
});

// ─── No human-input gates ─────────────────────────────────────────────────────

describe('generateAssessCommand — no human-input gates rule', () => {
    const out = generateAssessCommand(makeConfig('nodejs'));

    it('includes execution rule #10 declaring no human-input gates', () => {
        expect(out).toContain('10. **No human-input gates.**');
    });
    it('the pipeline never waits for input', () => {
        expect(out).toContain('never waits for input');
    });
});

// ─── Kiro parity ─────────────────────────────────────────────────────────────

describe('generateWorkflowAssess — Kiro parity', () => {
    const raw = generateWorkflowAssess(makeConfig('nodejs', 'kiro'));

    it('parses as valid JSON', () => { expect(() => JSON.parse(raw)).not.toThrow(); });
    it('has name "Assess"', () => { expect(JSON.parse(raw).name).toBe('Assess'); });

    const prompt = kiroPrompt();
    it('Kiro prompt heading uses workflow-assess', () => { expect(prompt).toMatch(/^# workflow-assess/); });
    it('Kiro prompt credits Kiro in the Assessed by line', () => {
        expect(prompt).toContain('Assessed by:** Kiro via workflow-assess');
    });
    it('Kiro prompt references .kiro/developer-actions.md', () => {
        expect(prompt).toContain('.kiro/developer-actions.md');
        expect(prompt).not.toContain('.claude/developer-actions.md');
    });
    it('Kiro prompt has the Business Pressure rubric too', () => {
        expect(prompt).toContain('Business Pressure Inference');
    });
    it('Kiro prompt has the completion contract too', () => {
        expect(prompt).toContain('ASSESS_COMPLETE:');
    });
});

// ─── Cross-stack ─────────────────────────────────────────────────────────────

describe('generateAssessCommand — cross-stack', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        it(`generates a non-trivial prompt for ${stack}`, () => {
            const out = generateAssessCommand(makeConfig(stack));
            expect(out.length).toBeGreaterThan(5000);
            expect(out).toContain('# /assess');
        });
    }
});
