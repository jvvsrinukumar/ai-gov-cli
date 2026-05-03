import type { GovernanceConfig } from '../../../types.js';

export function generateRefactorCommand(c: GovernanceConfig): string {
    const { profile } = c;
    const testCmd = profile.testCmd || 'run tests';
    const stackDisplay = profile.stackDisplay;
    const layerFlow = profile.layerFlow;

    return `# /refactor — Refactor (Plan Mode · 1 Gate · Tests After Gate)

**Stack:** ${stackDisplay}
**Layer flow:** ${layerFlow}

> Read and map impact in plan mode. One gate before any file is written or command is run.
> Tests run immediately after the gate — before refactoring begins.

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately. No files written, no bash commands run until the gate is passed.

---

## STEP 2 — Read All Affected Files (in plan mode)

Read every file in scope before listing anything.

Scope is whatever \`$ARGUMENTS\` describes. If scope is unclear, ask:
> "To confirm scope — are we refactoring [X] only, or also [Y]?"

---

## STEP 3 — Impact Analysis (THE GATE — in plan mode)

\`\`\`
━━━ IMPACT ANALYSIS ━━━
  Scope: $ARGUMENTS

  Files that WILL change:
  | File                  | Current pattern      | After refactor       |
  |-----------------------|----------------------|----------------------|
  | path/to/file1.ext     | [current]            | [after]              |
  | path/to/file2.ext     | [current]            | [after]              |

  Files that will NOT change (callers/dependents stay the same):
    • [file] — [why it is unaffected]

  Behaviour change: None — structural refactor only.
  Test risk: [low / medium — explain why]

Say approved to proceed. Tests will run before refactoring begins.
Wrong type? Redirect:
  /fix     — if this is actually just a bug
  /hotfix  — if this is breaking production right now
  stop     — cancel
\`\`\`

**DO NOT write any file or run any command until the developer says approved.**

---

## STEP 4 — Run Tests Before Refactoring (after gate)

Call \`ExitPlanMode\`. Then immediately run tests:

\`\`\`bash
${testCmd}
\`\`\`

If tests are failing BEFORE the refactor, stop:
> "Tests are failing before the refactor begins. Fix the failing tests first (\`/fix\`), then refactor."

---

## STEP 5 — Apply Refactor

Apply changes file by file in the order listed in Step 3.

After each file, confirm what changed in one sentence.

If an unexpected dependency is found during refactoring: stop and report before continuing.

---

## STEP 6 — Run Tests After Refactoring

\`\`\`bash
${testCmd}
\`\`\`

If tests pass:
> "Refactor complete. Tests pass. [N] files changed. Behaviour unchanged."

If tests fail — diagnose and fix before closing the task.

---

## RULES

- \`EnterPlanMode\` before reading — no writes or bash until gate is passed
- One gate: the impact analysis — no other pauses unless scope expands unexpectedly
- No behaviour changes — if a bug is found while refactoring, note it but do not fix it (create a \`/fix\` task)
- No feature additions during refactor
- Tests must pass at the end — if they fail, fix before closing
`;
}
