/**
 * Audit command generator tests — covers both Claude /audit and Kiro
 * workflow-audit. Verifies prompt structure, scorecard surgery (Test Coverage
 * split out of OVERALL — v20 §D), DO NOT STOP collapse, completion contract,
 * persist instructions, and cross-stack output.
 */
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateAuditCommand } from '../src/agents/claude-code/commands/audit.js';
import { generateWorkflowAudit } from '../src/agents/kiro/hooks/workflow-audit.js';

const DEFAULT_PROJECT = {
    packageName: 'audit-test-app',
    appName: 'audit-test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(stack: Stack = 'nodejs', scanOverrides: Partial<ScanResult> = {}, agent: 'claude-code' | 'kiro' = 'claude-code'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
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
    const raw = generateWorkflowAudit(makeConfig(stack, {}, 'kiro'));
    return JSON.parse(raw).then.prompt;
}

// ─── Claude /audit: structure ────────────────────────────────────────────────

describe('generateAuditCommand — structure', () => {
    const out = generateAuditCommand(makeConfig('nodejs'));

    it('heading uses /audit', () => { expect(out).toMatch(/^# \/audit/); });
    it('mentions the project name', () => { expect(out).toContain('audit-test-app'); });
    it('mentions the hook version', () => { expect(out).toContain('v20.0.0'); });
    it('declares this is a project truth check', () => { expect(out).toContain('Project Truth Check'); });
    it('contains 6 numbered phase markers', () => {
        const phases = out.match(/^## PHASE \d+/gm) ?? [];
        expect(phases.length).toBe(6);
    });
    it('contains 12 numbered step headings', () => {
        for (let i = 1; i <= 12; i++) expect(out).toContain(`### Step ${i} —`);
    });
    it('references the three persist files', () => {
        expect(out).toContain('audit-report.md');
        expect(out).toContain('dead-code.md');
        expect(out).toContain('developer-actions.md');
    });
});

describe('generateAuditCommand — scorecard surgery (v20 §D)', () => {
    const out = generateAuditCommand(makeConfig('nodejs'));

    it('uses GOVERNANCE SCORECARD label (4 categories)', () => {
        expect(out).toContain('GOVERNANCE SCORECARD');
    });
    it('includes the four governance categories', () => {
        expect(out).toContain('Governance Files');
        expect(out).toContain('Governance Accuracy');
        expect(out).toContain('Steering Coverage');
        expect(out).toContain('Dead File Risk');
    });
    it('separates Project Maturity from the governance grade', () => {
        expect(out).toContain('PROJECT MATURITY');
        expect(out).toContain('informational');
    });
    it('OVERALL is the arithmetic mean of 4 categories (not 5)', () => {
        expect(out).toContain('mean of the 4 categories');
    });
    it('Test Coverage is no longer scored in the OVERALL', () => {
        // It still appears in the maturity block.
        expect(out).toContain('Test Coverage');
        // But it's not part of the scored mean.
        expect(out).not.toContain('mean of the 5 category scores');
    });
});

describe('generateAuditCommand — DO NOT STOP collapse (v20 §D)', () => {
    const out = generateAuditCommand(makeConfig('nodejs'));

    it('keeps the canonical Rule #9 DO NOT STOP', () => {
        expect(out).toContain('9. **DO NOT STOP between phases.**');
    });
    it('does not duplicate "DO NOT stop" at every step transition', () => {
        const occurrences = (out.match(/DO NOT/g) ?? []).length;
        // Canonical rule #9 + one Step 7 "DO NOT ask for permission" — both legit.
        // The v19 build had 10. v20 should have ≤ 3.
        expect(occurrences).toBeLessThanOrEqual(3);
    });
});

describe('generateAuditCommand — completion contract (v20 AC-8)', () => {
    const out = generateAuditCommand(makeConfig('nodejs'));

    it('declares the completion contract in execution rules', () => {
        expect(out).toContain('AUDIT_COMPLETE:');
    });
    it('contract specifies persist-files=N/3 and steps=N/12', () => {
        expect(out).toContain('persist-files=<N>/3');
        expect(out).toContain('steps=<N>/12');
    });
    it('contract enumerates the three verdict outcomes', () => {
        expect(out).toMatch(/verdict=<ALIGNED\|UPDATED\|ACTION_NEEDED>/);
    });
    it('has a FINAL OUTPUT section', () => {
        expect(out).toContain('FINAL OUTPUT — completion contract');
    });
});

describe('generateAuditCommand — verdict and blueprint', () => {
    const out = generateAuditCommand(makeConfig('nodejs'));

    it('lists ALIGNED, UPDATED, and ACTION NEEDED verdicts', () => {
        expect(out).toContain('ALIGNED');
        expect(out).toContain('UPDATED');
        expect(out).toContain('ACTION NEEDED');
    });
    it('produces a NEW FEATURE BLUEPRINT block', () => {
        expect(out).toContain('NEW FEATURE BLUEPRINT');
    });
    it('grade scale is A/B/C/D', () => {
        expect(out).toContain('A: 90-100');
        expect(out).toContain('D: <60');
    });
});

// ─── Kiro workflow-audit: parity ─────────────────────────────────────────────

describe('generateWorkflowAudit — Kiro envelope', () => {
    const raw = generateWorkflowAudit(makeConfig('nodejs', {}, 'kiro'));

    it('parses as valid JSON', () => { expect(() => JSON.parse(raw)).not.toThrow(); });
    it('has name "Audit"', () => { expect(JSON.parse(raw).name).toBe('Audit'); });
    it('uses userTriggered when.type', () => { expect(JSON.parse(raw).when.type).toBe('userTriggered'); });
    it('uses askAgent then.type', () => { expect(JSON.parse(raw).then.type).toBe('askAgent'); });
});

describe('generateWorkflowAudit — prompt body parity', () => {
    const prompt = kiroPrompt();

    it('heading uses workflow-audit', () => { expect(prompt).toMatch(/^# workflow-audit/); });
    it('references .kiro/ paths (not .claude/)', () => {
        expect(prompt).toContain('.kiro/steering/');
        expect(prompt).not.toContain('.claude/steering/');
    });
    it('includes the same scorecard split as Claude variant', () => {
        expect(prompt).toContain('GOVERNANCE SCORECARD');
        expect(prompt).toContain('PROJECT MATURITY');
    });
    it('includes the completion contract', () => {
        expect(prompt).toContain('AUDIT_COMPLETE:');
    });
});

// ─── Cross-stack: every supported stack produces valid output ────────────────

describe('generateAuditCommand — cross-stack', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        it(`generates a non-trivial prompt for ${stack}`, () => {
            const out = generateAuditCommand(makeConfig(stack));
            expect(out.length).toBeGreaterThan(5000);
            expect(out).toContain('# /audit');
            expect(out).toContain('GOVERNANCE SCORECARD');
        });
    }
});

describe('generateWorkflowAudit — cross-stack', () => {
    const stacks: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];
    for (const stack of stacks) {
        it(`generates a valid Kiro hook for ${stack}`, () => {
            const prompt = kiroPrompt(stack);
            expect(prompt.length).toBeGreaterThan(5000);
            expect(prompt).toContain('AUDIT_COMPLETE:');
        });
    }
});

// ─── Stack-specific observation questions ────────────────────────────────────

describe('generateAuditCommand — stack-specific observations', () => {
    it('flutter audit mentions Dart/lib/ specifics', () => {
        const out = generateAuditCommand(makeConfig('flutter'));
        expect(out.toLowerCase()).toMatch(/dart|flutter|lib\//);
    });
    it('react audit references components and hooks', () => {
        const out = generateAuditCommand(makeConfig('react'));
        expect(out.toLowerCase()).toMatch(/component|hook|jsx|tsx/);
    });
    it('nodejs audit references route/controller patterns', () => {
        const out = generateAuditCommand(makeConfig('nodejs'));
        expect(out.toLowerCase()).toMatch(/route|controller|middleware|service/);
    });
});
