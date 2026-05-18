import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleCommand } from '../../../utils/knowledge-preamble.js';
import { generateSilentCaptureInstructionFix } from '../../../utils/knowledge-capture.js';

export function generateFixCommand(c: GovernanceConfig): string {
  const { profile } = c;
  const testCmd = profile.testCmd || 'run tests';
  const stackDisplay = profile.stackDisplay;

  return `# /fix — Bug Fix (Plan Mode · 1 Gate)

**Stack:** ${stackDisplay}

> Read and diagnose in plan mode. One gate before any file is written.
> "The app doesn't have X" is not a bug — use \`/new-feature\` instead.
> "This code is messy" is not a bug — use \`/refactor\` instead.
${generateKnowledgePreambleCommand()}
## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately. No files written until the developer approves the proposed fix.

---

## STEP 2 — Read Before Touching Anything (in plan mode)

1. Read the file(s) most likely to contain the bug
2. If the bug involves a network call, read the service/API layer too
3. If the bug involves state, read the state management file too

Then output:
\`\`\`
━━━ ROOT CAUSE ━━━
  File:    [path/to/file.ext]
  Line ~N: [the problematic code or logic]
  Cause:   [one clear sentence — exactly what is wrong and why]
\`\`\`

---

## STEP 3 — Scope Check (still in plan mode)

Count how many files the fix requires changing.

If > 3 files, output this before the proposed fix:
\`\`\`
⚠️  Scope: this fix touches [N] files — more than 3.
    This may be a structural issue rather than a simple bug.
    Files: file1, file2, ...
\`\`\`

---

## STEP 4 — Proposed Fix (THE GATE — still in plan mode)

\`\`\`
━━━ PROPOSED FIX ━━━
  Files to change:
    • [file1] — [what changes]
    • [file2] — [what changes, if any]

  Change: [exactly what to change and why this resolves the root cause]

  What will NOT change: [explicitly state what is out of scope]

Say apply to proceed.
Wrong type? Redirect:
  /refactor    — if this is a structural issue, not a bug
  /new-feature — if this capability is missing entirely
  /hotfix      — if this is a live production emergency
  stop         — cancel
\`\`\`

**DO NOT write any file until the developer says apply.**

---

## STEP 5 — Apply Fix (after gate)

Call \`ExitPlanMode\`. Then apply the fix — minimum change only.

Do not clean up surrounding code. Do not refactor. Fix only what is broken.
${generateSilentCaptureInstructionFix()}
## STEP 6 — Verify

\`\`\`
━━━ VERIFICATION ━━━
  How to confirm: [reproduce steps → should no longer happen]
  Tests: [run ${testCmd} — result, or "no test coverage for this area"]
\`\`\`

---

## RULES

- \`EnterPlanMode\` before reading — never write before the gate
- Root cause must be stated before proposing a fix
- Minimum change: fix the bug, do not clean up surrounding code
- Do not refactor while fixing — that is \`/refactor\`
- Do not add features while fixing — that is \`/new-feature\`
- If the bug is more complex than it appeared, say so at the gate before applying
`;
}
