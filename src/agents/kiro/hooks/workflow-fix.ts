import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowFix(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const testCmd = c.profile.testCmd || 'run tests';

    return JSON.stringify({
        name: 'Fix',
        version: c.hookVersion,
        description: 'Diagnose and fix a bug with root-cause analysis',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `FIX — Bug diagnosis and fix workflow for ${stackDisplay}.

Test command: ${testCmd}

Ask the user: "What is the bug? (symptoms, error message, or failing test)"

Then execute:

STEP 1 — REPRODUCE
Identify the failing condition. If a test exists, run it. If not, identify the code path.

STEP 2 — ROOT CAUSE
Read the relevant files. Trace the data flow to find where the bug originates.
Present:
- Root cause: [one sentence]
- File(s) affected: [list]
- Why it happens: [explanation]

STEP 3 — FIX
Apply the minimal fix. Do not refactor surrounding code.
Do not add features. Fix only the reported bug.

STEP 4 — VERIFY
Run: ${testCmd}
If tests pass: "Bug fixed. Root cause was X. Changed N files."
If tests fail: diagnose the new failure.

STEP 5 — REGRESSION TEST
If no test existed for this bug, write one that would have caught it.
Run: ${testCmd} again to confirm the new test passes.`,
        },
    }, null, 2) + '\n';
}
