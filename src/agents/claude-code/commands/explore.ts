import type { GovernanceConfig } from '../../../types.js';

export function generateExploreCommand(c: GovernanceConfig): string {
  const { profile } = c;
  const stackDisplay = profile.stackDisplay;

  return `# /explore — Understand Before Acting (Plan Mode · Read-Only Phase)

**Stack:** ${stackDisplay}

> Use when you need to understand a feature or module before deciding what to do.
> The entire reading phase is in plan mode — nothing is written until you choose a next action.
> Transitions seamlessly into /fix, /refactor, create spec, or update spec — without re-reading files.

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately. You will stay in plan mode throughout the entire reading phase.
No files written or modified until the developer chooses a next action at the gate.

---

## STEP 2 — Read All Files in Scope (in plan mode)

Scope is whatever \`$ARGUMENTS\` describes — a feature name, a module, a directory, or a file.

Read every relevant file:
- Source files (all layers — entry point, logic, data, UI if applicable)
- Spec files in \`specs/$ARGUMENTS/\` (if they exist)
- Test files (if they exist)
- Feature README (if it exists)

If scope is unclear: "To confirm — are we exploring [X] only, or also [Y]?"

---

## STEP 3 — Code Map (output while still in plan mode)

\`\`\`
━━━ CODE MAP — $ARGUMENTS ━━━

  Layer structure observed:
    [layer] → [directory/file] — [what it does in one sentence]
    [layer] → [directory/file] — [what it does]

  Data flow (entry → logic → data source):
    [entry file] → [logic file] → [data file / DB / API]

  Patterns in use:
    HTTP/Network: [client or framework pattern]
    State:        [state approach — or "N/A (server-side)"]
    Data access:  [ORM / raw SQL / SDK / none]
    Naming:       [file + class naming convention observed]
    DI:           [injection pattern — or "module-level singletons" / "none"]

  File sizes:
    [file] — [N] lines  [flag if >200 frontend / >500 backend]

  External dependencies used by this feature:
    [packages or services this feature calls]
\`\`\`

---

## STEP 4 — Findings (output while still in plan mode)

\`\`\`
━━━ FINDINGS ━━━

  Spec:
    [ ] MISSING — specs/$ARGUMENTS/ not found
    [ ] EXISTS — specs/$ARGUMENTS/ present (requirements / design / tasks)
    [ ] STALE — spec exists but code has drifted from what it describes

  Tests:
    [ ] SCENARIO A — no tests found
    [ ] SCENARIO B — partial ([N] of [total] layers have tests)
    [ ] SCENARIO C — comprehensive

  Issues noticed while reading (not a formal audit — what stood out):
    • [issue, e.g. "service calls DB directly, bypassing the repo layer"]
    • [issue, e.g. "validation logic duplicated across 3 model files"]
    • [or "None spotted"]

  Architecture match:
    [ ] Matches steering — code follows the zone rules in architecture.md
    [ ] Zone mismatch — [specific deviation]
\`\`\`

---

## STEP 5 — Next Action Gate (still in plan mode)

Based on findings above, show only the relevant options:

\`\`\`
━━━ WHAT WOULD YOU LIKE TO DO? ━━━

  [show "create spec" only if Spec = MISSING above]
  create spec   → I'll write specs/[name]/ documenting what exists RIGHT NOW.
                  This is a reverse spec — it records reality, not a new design.

  [show "update spec" only if Spec = STALE above]
  update spec   → I'll update specs/[name]/ to match what the code actually does.
                  Drifted sections will be marked <!-- UPDATED -->.

  fix [desc]    → Tell me what bug to fix. Files are already loaded — no re-reading.

  refactor      → Describe the structural change. Impact table is ready — straight
                  to the approval gate, no re-reading.

  done          → You have the context you needed. No changes.
\`\`\`

**DO NOT write any file until the developer states their choice.**

---

## STEP 6A — Developer says: create spec

Call \`ExitPlanMode\`.

Write spec files documenting what ALREADY EXISTS — not a new design.
Use the Code Map from Step 3 as the source of truth.

**\`specs/[name]/requirements.md\`** — derived from observed behaviour:
- Feature overview: what the code does (observed, not intended)
- Acceptance criteria: derived from actual endpoints / functions / outputs read in Step 2
- API contracts: from actual route or endpoint files
- Out of scope: what was NOT found in the code

**\`specs/[name]/design.md\`** — from the Code Map:
- Layer map: actual layers observed (file → responsibility)
- Data flow: actual flow traced in Step 3
- Dependencies: actual external packages observed
- Deviations: any issues from Findings — document them, do not hide them

**\`specs/[name]/tasks.md\`** — what needs to happen next:
- Phase 1: address Findings issues (layer violations, duplication, etc.)
- Phase 2: add test coverage (list what SCENARIO A/B is missing)
- Phase 3: any cleanup or naming improvements identified

After writing:
> "Spec created from observed code in specs/[name]/.
> This documents what exists — review and update any sections that don't match your intent."

---

## STEP 6B — Developer says: update spec

Call \`ExitPlanMode\`.

Transition into the \`/edit-feature\` update flow.
Files are already loaded — skip the read step.
Use the Code Map from Step 3 as the source of truth for what changed.
Mark updated sections \`<!-- UPDATED -->\` so the developer can see exactly what drifted.

---

## STEP 6C — Developer says: fix [desc]

Call \`ExitPlanMode\`.

Transition into the \`/fix\` flow. Files already loaded — skip Step 2 of \`/fix\`.
Go directly to root cause statement and proposed fix gate.

---

## STEP 6D — Developer says: refactor

Call \`ExitPlanMode\`.

Transition into the \`/refactor\` flow. Files already loaded — skip Step 2 of \`/refactor\`.
The Code Map already has the file list — go directly to the impact table and approval gate.
Then run tests before applying.

---

## STEP 6E — Developer says: done

Call \`ExitPlanMode\`. No files written. Developer has the context they needed.

---

## RULES

- \`EnterPlanMode\` immediately — the entire exploration phase is read-only
- The Code Map is derived from what you actually read — not from init assumptions or steering files
- Do not make quality judgements during exploration — observe and record, do not evaluate
- Do not fix or change anything during exploration — note it in Findings, act after the gate
- If \`$ARGUMENTS\` matches a feature in \`specs/\` — read the spec too and include it in Findings
- \`create spec\` is only offered when no spec was found — not as an alternative to \`update spec\`
- When transitioning to fix/refactor after explore: do not re-read files already loaded in Step 2
`;
}
