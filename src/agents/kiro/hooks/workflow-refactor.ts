import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleHook } from '../../../utils/knowledge-preamble.js';

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

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Test command: ${testCmd}

> This is a new session — you have no conversation history. Get context from disk first.

## STEP 0 — Orient from disk before asking anything

Read .kiro/specs/ for any Refactor tasks that are in progress.
Check .kiro/steering/architecture.md for the current layer structure.

Then ask exactly ONE question:

If an in-progress Refactor task found:
  "I found an in-progress refactor: [name — N tasks remaining].
   Continue this, or describe a new refactor scope?"

If nothing found:
  "What is the refactor scope?
   — What pattern or structure to change (e.g. 'extract service layer', 'rename X to Y', 'split large file')
   — Which files or directories are in scope
   — Goal: what the code should look like after"

Do not ask follow-up questions. Use the user's answer to proceed directly to Step 1.
${generateKnowledgePreambleHook()}

## STEP 1 — READ ALL FILES IN SCOPE

Read every file the user mentioned. Also read files that import from or are imported by scope files.
Do not propose changes yet. Map the full dependency surface.

---

## STEP 2 — IMPACT ANALYSIS GATE

Present (do NOT make any changes yet):

\`\`\`
IMPACT ANALYSIS

Files that WILL change:
  <file>: [current pattern] → [after pattern]
  ...

Files that will NOT change:
  <file>: [reason it is unaffected]
  ...

Behaviour change: None (structural only) / [describe if any]
Test risk: low / medium / high
  Reason: [why]

Estimated file count: N files
\`\`\`

Ask: "Does this look right? Say **ok** to proceed, or tell me what to adjust."
Do NOT touch any file until user says ok / approved / proceed.

---

## STEP 3 — RUN TESTS BEFORE REFACTORING

Run: ${testCmd}
If any tests fail before the refactor starts: STOP. Report the failures.
Do not proceed with a refactor on a broken baseline.

---

## STEP 4 — APPLY REFACTOR

Apply changes file by file. After each file: one-sentence confirmation of what changed.
If you discover an unexpected dependency mid-refactor: STOP. Report it. Ask how to proceed.

Rules:
- No behaviour changes — if you spot a bug, note it but do not fix it
- No feature additions during refactor
- No dependency version changes

---

## STEP 5 — RUN TESTS AFTER

Run: ${testCmd}
If pass: "Refactor complete. Tests pass. N files changed."
If fail: diagnose which test broke and why before closing. Fix test failures caused by the refactor.`,
    },
  }, null, 2) + '\n';
}
