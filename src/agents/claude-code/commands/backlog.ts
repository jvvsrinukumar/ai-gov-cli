import type { GovernanceConfig } from '../../../types.js';

const BACKEND_STACKS = new Set(['nodejs', 'python', 'java']);

function storyPrefix(stack: string): string {
    return BACKEND_STACKS.has(stack) ? 'BACK' : 'FRONT';
}

export function generateBacklogCommand(c: GovernanceConfig): string {
    const { project, profile } = c;
    const stackDisplay = profile.stackDisplay;
    const prefix = storyPrefix(c.stack);

    return `# /backlog — Rewrite Backlog Generator

> **Project:** ${project.appName}
> **Stack:** ${stackDisplay}

---

> ## ⚠️ EXECUTION RULES
>
> 1. **This is a read-only extraction tool.** Do NOT modify any source code or assessment docs.
> 2. **All 6 phases are REQUIRED.** Run every phase. Do not stop early.
> 3. **You extract what EXISTS.** Do not invent features, infer priorities, or add new functionality.
> 4. **HUMAN INPUT sections are placeholders — not questions to ask now.** Generate them as-is; the developer fills them in later.
> 5. **Output goes to \`docs/backlog/\`.** Overwrites on re-run — it is regenerated from current assessments.

---

## WHAT THIS COMMAND DOES

This is NOT a product backlog tool. It mines \`docs/assessment/\` for rebuild-able units,
orders them by technical dependency, and formats them as \`/new-feature\`-ready story prompts.

It marks where human input is required (priority, skip/keep decisions) but does NOT fill those in.

---

## PHASE 1 — DISCOVER ASSESSMENT

Check whether \`docs/assessment/\` exists in this project.

**Required docs (command stops if either is missing):**
- \`docs/assessment/01_current_state_analysis.md\`
- \`docs/assessment/02_decision.md\`

**Optional docs (stories still generated without them, but noted):**
- \`docs/assessment/03_implementation_phases.md\`
- \`docs/assessment/07_technical_debt_inventory.md\`
- \`docs/assessment/08_dependency_impact.md\`
- \`docs/assessment/09_dead_code_removal.md\`
- \`docs/assessment/11_migration_compatibility.md\`

**If \`docs/assessment/\` does not exist or Doc 01 / Doc 02 is missing:**
Print: "⚠️ Run /assess in ${project.appName} first — docs/assessment/ is missing or incomplete."
Stop. Do not proceed.

**If Doc 02 recommendation is "Leave It":**
Print: "Recommendation for ${project.appName} is Leave It — no rebuild stories generated."
Write \`docs/backlog/00_index.md\` with decision, reason, review date, and reassessment triggers.
Stop. Do not write other backlog files.

**Stale check:**
Read the date from Doc 01. If assessment is older than 30 days, print:
"⚠️ Assessment is more than 30 days old — consider re-running /assess before generating backlog."
Continue anyway; this is a warning, not a blocker.

**Also check for API contract data:**
Check whether \`.claude/steering/cross-project-rules.md\` exists.
- If found: use it as the primary source for API endpoint data in stories.
- If not found: print "cross-project-rules.md not found — API contracts will be sparse. Run /audit at workspace root for richer contract data." Continue.

---

## PHASE 2 — EXTRACT FEATURE INVENTORY

Read \`docs/assessment/01_current_state_analysis.md\` and \`docs/assessment/09_dead_code_removal.md\` (if available).

**From Doc 01 — build a feature unit list:**

A "feature unit" is any significant module or directory group that represents a coherent piece of functionality. Extract from:
- The DIRECTORY MAP section: each directory with meaningful file counts
- The layer structure description (e.g. services/, controllers/, repositories/)
- Any module or feature names explicitly called out

\`\`\`
FEATURE INVENTORY
  <module-name>   path: <path>   layer: <layer name>
  ...
\`\`\`

**From Doc 09 — build the skip list:**

Read the dead code registry table. Extract entries where Status is \`[ ] PENDING\` only.
- Do NOT include \`[~] KEPT\` entries — the developer chose to keep them.
- Do NOT include \`[x] DELETED\` entries — they are already gone.

\`\`\`
SKIP LIST (from Doc 09)
  <path>   Reason: <from Doc 09>
  ...
\`\`\`

If Doc 09 is missing: note "⚠️ No dead code analysis found — all modules will get stories. Run /assess to identify dead code before rebuilding."

**Cross-reference:** Remove any feature unit from the inventory whose path appears in the skip list.

---

## PHASE 3 — GENERATE REBUILD STORIES

For each feature unit in the inventory (not on the skip list):

**Step 1 — API contract:**
- Check \`.claude/steering/cross-project-rules.md\` for endpoints owned by this module.
- If found: include them in the story.
- If not found: set contract to "⚠️ not found — run /audit for extraction or fill manually".

**Step 2 — Debt items** (Doc 07 if available):
- Find all rows in \`07_technical_debt_inventory.md\` where the File:Line path falls under this module's directory.
- List their IDs and severity. If none: "none".

**Step 3 — Dependency impact** (Doc 08 if available):
- Flag libraries used by this module that Doc 08 marks "Replace" or "Upgrade".
- If none or Doc 08 missing: "none".

**Step 4 — Phase and dependencies** (Doc 03 if available):
- Map this module to its phase in Doc 03.
- List story IDs that must be done first.
- If Doc 03 missing: derive phase from layer position (infra → data → service → api/ui).

**Story IDs:** Use \`${prefix}-NN\` numbered sequentially per layer group.

**Story format (use for every story):**

\`\`\`
${prefix}-NN — Rebuild <module name>

Rebuild:           <module name and its responsibility>
Source module:     <file paths from Doc 01>
Why rebuild:       <debt pattern from Doc 07, OR "Clean architecture rewrite">
Debt items:        <IDs and severity from Doc 07, OR "none">
Dependency impact: <libraries to change from Doc 08, OR "none">
Dependencies:      <story IDs that must complete first, OR "none">
Phase:             <phase number — project-internal, see note below>
Parallel-safe:     yes / no (depends on <STORY-ID>)
\`\`\`

**For /new-feature prompt** (copy this block directly into /new-feature):

\`\`\`
Story: ${prefix}-NN
Feature: <module name>

<context: what layer this is and what it does>
Existing contract: <extracted endpoints OR "⚠️ not found — fill manually">
Constraints: <migration constraints from Doc 11 if applicable, OR "none">
\`\`\`

**⚠️ HUMAN INPUT NEEDED** (fill before running /new-feature):
- [ ] Business priority: P1 / P2 / P3?
- [ ] Keep all functionality or drop anything?
- [ ] Any new requirements to add while rebuilding?
- [ ] Acceptance criteria beyond contract compliance?

> **Phase numbering note:** Phase numbers here are project-internal (layer-based ordering within this project). They do NOT map to workspace phase numbers. In a workspace context, all backend project stories belong to workspace Phase 2; all frontend project stories belong to workspace Phase 3.

---

## PHASE 4 — ORDER BY DEPENDENCY

Order all stories using this priority:

1. **Inherit from Doc 03** (primary): use its phase numbers.
2. **Derive from layer position** (when Doc 03 is missing):
   - Phase 1: Shared infrastructure (config, database connections, auth utilities)
   - Phase 2: Data layer (repositories, schemas, migrations, seeds)
   - Phase 3: Service / business logic layer
   - Phase 4: API / route / controller layer
   - Phase 5: UI layer (frontend only — components, pages, state)
3. **Mark parallel-safe:** stories in the same phase with no dependencies between each other = parallel-safe.

---

## PHASE 5 — WRITE OUTPUT FILES

Write all files to \`docs/backlog/\`. Overwrite if they exist.

### \`docs/backlog/00_index.md\`

\`\`\`markdown
# Backlog — ${project.appName}

**Generated:** <today>
**Stack:** ${stackDisplay}
**Source:** docs/assessment/ (assessed: <date from Doc 01>)
**Recommendation:** <from Doc 02>
**Assessment age:** <N days>  [⚠️ add warning if >30 days]

## How to use this backlog

1. Open \`docs/backlog/combined-backlog.md\`
2. Fill in Priority (P1 / P2 / P3) for each story
3. Mark any stories SKIP if you decide not to rebuild them
4. Pick a story → copy its \`/new-feature prompt\` block
5. Run \`/new-feature\` and paste the prompt block

## Story counts

| Phase | Stories | Parallel-safe |
|-------|---------|---------------|
| [each phase] | [N] | [N] |
| **Total** | **[N]** | **[N]** |

## Human review checklist

- [ ] Business priority assigned for all stories
- [ ] Skip/keep decisions confirmed
- [ ] New features added manually if needed
- [ ] Acceptance criteria added to P1 stories
\`\`\`

### \`docs/backlog/stories.md\`

All stories in dependency order. Use the story format from Phase 3.
Group by phase with a heading for each phase.

### \`docs/backlog/combined-backlog.md\`

\`\`\`markdown
# Combined Backlog — ${project.appName}

| ID | Feature | Phase | Source Module | Debt Items | Dependencies | Priority | Status |
|----|---------|-------|--------------|-----------|--------------|----------|--------|
| ${prefix}-01 | ... | 1 | src/... | #1 (High) | none | ⚠️ TBD | [ ] not started |
\`\`\`

### \`docs/backlog/skip-list.md\`

\`\`\`markdown
# Skip List — ${project.appName}

> Modules excluded from the rebuild backlog.
> Source: docs/assessment/09_dead_code_removal.md (PENDING entries only).
> To reinstate a module: move it to stories.md manually.

| Module / Path | Reason | Dead Code Status | Decision |
|---------------|--------|-----------------|----------|
| src/... | [reason from Doc 09] | PENDING | [ ] confirm skip / [ ] reinstate |
\`\`\`

If Doc 09 was missing: write a note explaining no skip list was generated and dead code was not identified.

### \`docs/backlog/phases.md\`

\`\`\`markdown
# Implementation Phases — ${project.appName}

> Technical dependency order — NOT business priority order.
> Reorder within a phase based on your business priorities.
> Stories marked "Parallel-safe: yes" can be worked simultaneously.

## Phase 1 — [name from Doc 03 OR "Infrastructure"]
[stories in this phase]

## Phase 2 — [name]
[stories]
...
\`\`\`

---

## PHASE 6 — SUMMARY

\`\`\`
━━━ BACKLOG GENERATED — ${project.appName} ━━━

  Stack:             ${stackDisplay}
  Rebuild stories:   [N] total
  Skipped modules:   [N] (from dead code analysis)
  Phases:            [N]
  Parallel-safe:     [N] stories can run simultaneously

  ⚠️  Human review needed:
    - [N] stories need business priority (P1/P2/P3)
    - [N] stories have "keep or drop?" questions
    - [N] stories have sparse API contracts (run /audit for richer data)
    - 0 new features included (add manually to docs/backlog/stories.md)

  Assessment age:         [N] days  [⚠️ add flag if >30]
  Cross-project rules:    [found / not found]
  Doc 07 (debt):          [found / not found]
  Doc 09 (dead code):     [found / not found]

  Next steps:
    1. Review docs/backlog/combined-backlog.md
    2. Fill in Priority column + keep/drop decisions
    3. Pick a story → copy its /new-feature prompt block
    4. Run /new-feature (or workspace /new-feature for cross-project)
\`\`\`

---

## WHAT THIS COMMAND DOES NOT DO

| Temptation | Why not |
|------------|---------|
| Assign business priority | Cannot know what matters to users from code alone |
| Write "As a user..." stories | Product framing requires domain knowledge |
| Decide what to skip | Marks candidates; human confirms |
| Add new features | Only extracts what exists today |
| Create specs | Stories are prompts for /new-feature, which creates specs |
| Read source files directly | Reads docs/assessment/ and cross-project-rules.md only |
`;
}
