import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowRefactor(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const layerFlow = c.profile.layerFlow;
    const testCmd = c.profile.testCmd || 'run tests';

    return JSON.stringify({
        name: 'Refactor',
        version: c.hookVersion,
        description: 'Plan and execute a structural refactor with impact analysis gate',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `REFACTOR — Plan-first refactor workflow for ${stackDisplay}.

Layer flow: ${layerFlow}
Test command: ${testCmd}

Ask the user: "What is the refactor scope?" (which files/patterns to change)

Then execute:

STEP 1 — READ ALL AFFECTED FILES
Read every file in scope before proposing changes.

STEP 2 — IMPACT ANALYSIS (THE GATE)
Present:
- Files that WILL change (current pattern → after pattern)
- Files that will NOT change (and why they're unaffected)
- Behaviour change: None (structural only) or describe what changes
- Test risk: low / medium / high

Wait for explicit "approved" before proceeding.

STEP 3 — RUN TESTS BEFORE REFACTORING
Run: ${testCmd}
If tests fail before the refactor, stop and report.

STEP 4 — APPLY REFACTOR
Apply changes file by file. Confirm each change in one sentence.
If unexpected dependency found, stop and report.

STEP 5 — RUN TESTS AFTER
Run: ${testCmd}
If pass: "Refactor complete. Tests pass. N files changed."
If fail: diagnose and fix before closing.

RULES:
- No behaviour changes — if a bug is found, note it but don't fix it
- No feature additions during refactor
- Tests must pass at the end`,
        },
    }, null, 2) + '\n';
}
