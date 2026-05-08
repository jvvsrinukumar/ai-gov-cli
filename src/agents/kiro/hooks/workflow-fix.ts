import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleHook } from '../../../utils/knowledge-preamble.js';

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

> This is a new session — you have no conversation history. Get context from disk first.

## STEP 0 — Orient from disk before asking anything

Run: ${testCmd}
- If any tests are currently failing, list them — the bug may already have a failing test.
- Check .kiro/specs/ for any tasks.md with a Bug Fix task that is not yet done.

Then ask exactly ONE question:

If failing tests found or a Bug Fix task found in specs:
  "I found:
   [list failing tests or in-progress bug fix tasks]

   Is this the bug you want to fix, or is there a different issue?"

If nothing found:
  "What is the bug?
   — Symptoms (what the user sees happen)
   — Error message or stack trace (paste it)
   — Steps to reproduce (if known)
   — File or feature area (if known)"

Do not ask follow-up questions. Use whatever the user gives you to proceed.
${generateKnowledgePreambleHook()}

## STEP 1 — REPRODUCE

Identify the failing condition from what the user described.
If a test covers it: run that test. Note the failure output.
If no test: identify the code path from the user's description. Read those files.

---

## STEP 2 — ROOT CAUSE

Read the relevant files. Trace the data flow to find where the bug originates.
Present:
- Root cause: [one sentence — the actual problem in the code]
- File(s) affected: [list with line numbers]
- Why it happens: [precise technical explanation]

Do not start fixing yet. Confirm: "Is this the root cause? Say **ok** to apply the fix."
Wait for confirmation.

---

## STEP 3 — FIX

Apply the minimal fix. Rules:
- Do not refactor surrounding code
- Do not add features
- Do not change anything outside the root cause
- Fix only what is broken

Show what changed: file name, line range, before → after.

---

## STEP 4 — VERIFY

Run: ${testCmd}
If tests pass: report "Bug fixed. Root cause was [X]. Changed [N] files."
If tests fail: diagnose the new failure before closing.

---

## STEP 5 — REGRESSION TEST

If no test existed for this bug, write one that would have caught it.
Run: ${testCmd} again. New test must pass.
If a test already existed (was failing in Step 0): confirm it now passes.`,
        },
    }, null, 2) + '\n';
}
