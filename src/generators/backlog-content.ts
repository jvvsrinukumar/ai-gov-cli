/**
 * Shared backlog prompt body — consumed by Claude Code (/backlog) and Kiro
 * (workflow-backlog) so the two agents cannot drift.
 *
 * v20 plan §5 risk register: shared content prevents the Kiro/Claude drift
 * that re-opens the parity gap over time.
 */
import type { GovernanceConfig } from '../types.js';

const BACKEND_STACKS = new Set(['nodejs', 'python', 'java']);

function storyPrefix(stack: string): string {
    return BACKEND_STACKS.has(stack) ? 'BACK' : 'FRONT';
}

export interface BacklogContentParams {
    config: GovernanceConfig;
    /** User-facing command name in headings and prose. */
    commandName: string;
    /** Cross-references to sibling commands, written agent-correctly. */
    crossRefs: {
        assess: string;       // '/assess' or 'workflow-assess'
        audit: string;        // '/audit' or 'workflow-audit'
        newFeature: string;   // '/new-feature' or 'workflow-new-feature'
    };
    /** Path to workspace cross-project rules, agent-specific. */
    crossProjectRulesPath: string;
    /** Path the skip-list reads for OPEN items, agent-specific. */
    developerActionsPath: string;
}

export function generateBacklogContent(p: BacklogContentParams): string {
    const { config: c, commandName, crossRefs, crossProjectRulesPath, developerActionsPath } = p;
    const { project, profile } = c;
    const stackDisplay = profile.stackDisplay;
    const prefix = storyPrefix(c.stack);

    return `# ${commandName} — Rewrite Backlog Generator

> **Project:** ${project.appName}
> **Stack:** ${stackDisplay}

---

> ## ⚠️ EXECUTION RULES — READ BEFORE STARTING
>
> 1. **This is a read-only extraction tool.** Do NOT modify any source code or assessment docs.
> 2. **All 6 phases are REQUIRED.** Run every phase. Do not stop early.
> 3. **You extract what EXISTS.** Do not invent features or add new functionality. Priority IS derived (Phase 3) — that is not "inventing"; it is evidence-based scoring.
> 4. **No human-input gates.** Every decision (priority, keep/drop, net-new-features default) is derived from observable evidence and logged as an \`assumptions\` entry with confidence and evidence sources. The developer can override post-generation; the pipeline does not wait for input.
> 5. **Output goes to \`docs/backlog/\`.** Overwrites on re-run — it is regenerated from current assessments.
> 6. **DO NOT STOP between phases.** Phase headings (## PHASE N) are section labels — not stopping points. After every transition marker below, continue to the next phase immediately without waiting for user input or confirmation.
> 7. **Completion contract — emit on the very last line of the run, exactly:**
>     \`BACKLOG_COMPLETE: stories=<N> skip-list=<M> p1=<N> p2=<N> p3=<N>\`
>     The contract is the structural signal that the run finished. The runner greps for it; an absent contract means the run did not complete.

---

## WHAT THIS COMMAND DOES

This is NOT a product backlog tool. It mines \`docs/assessment/\` for rebuild-able units,
orders them by technical dependency, derives priority from evidence, and formats them as
\`${crossRefs.newFeature}\`-ready story prompts.

Priority, skip/keep, and net-new-feature decisions are all **derived** from observable evidence
(debt severity, import-graph hubs, commit frequency, dead-code status). The pipeline runs
end-to-end with no human-input gates; every derived value carries an \`assumptions\` entry the
developer can review and override after generation.

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
Print: "⚠️ Run ${crossRefs.assess} in ${project.appName} first — docs/assessment/ is missing or incomplete."
Stop. Do not proceed.

**If Doc 02 recommendation is "Leave It":**
Print: "Recommendation for ${project.appName} is Leave It — no rebuild stories generated."
Write \`docs/backlog/00_index.md\` with decision, reason, review date, and reassessment triggers.
Stop. Do not write other backlog files.

**Stale check:**
Read the date from Doc 01. If assessment is older than 30 days, print:
"⚠️ Assessment is more than 30 days old — consider re-running ${crossRefs.assess} before generating backlog."
Continue anyway; this is a warning, not a blocker.

**Also check for API contract data:**
Check whether \`${crossProjectRulesPath}\` exists.
- If found: use it as the primary source for API endpoint data in stories.
- If not found: print "cross-project-rules.md not found — API contracts will be sparse. Run ${crossRefs.audit} at workspace root for richer contract data." Continue.

> **After Phase 1:** Say exactly: "Assessment validated — proceeding to feature inventory extraction (Phase 2)." Then begin Phase 2 immediately. DO NOT stop. DO NOT wait for user input.

---

## PHASE 2 — EXTRACT FEATURE INVENTORY

Read \`docs/assessment/01_current_state_analysis.md\` and \`docs/assessment/09_dead_code_removal.md\` (if available).

**From Doc 01 — build a feature unit list:**

A "feature unit" is any significant module or directory group that represents a coherent piece of functionality. Extract from:
- The DIRECTORY MAP section: each directory with meaningful file counts
- The layer structure description (e.g. services/, controllers/, repositories/)
- Any module or feature names explicitly called out

> ⚠️ **OUTPUT THIS TABLE NOW — before continuing to story generation.** The feature inventory must be a visible intermediate result. Do not merge this step with Phase 3. If the table is not printed here, features will be silently lost.

| # | Module Name | Path | Layer | Notes |
|---|-------------|------|-------|-------|
| 1 | \`<module-name>\` | \`<path>\` | \`<layer name>\` | — |
| … | | | | |

**From Doc 09 + \`developer-actions.md\` — build the skip list:**

The skip list contains modules that should NOT receive a rebuild story.

From \`docs/assessment/09_dead_code_removal.md\`:
- Include entries with Status = \`[ ] PENDING\` → flagged as dead, awaiting verification
- Include entries with Status = \`[~] KEPT\` → developer explicitly kept it as-is; do not rebuild
- Do NOT include \`[x] DELETED\` entries — they are already gone

From \`${developerActionsPath}\`:
- Surface entries with Status = \`[ ] OPEN\` as **informational** in each story they touch — these are unresolved decisions the developer must act on before or during rebuild. Do NOT auto-skip them; flag them.

\`\`\`
SKIP LIST (from Doc 09)
  <path>   Reason: <from Doc 09>
  ...
\`\`\`

If Doc 09 is missing: note "⚠️ No dead code analysis found — all modules will get stories. Run ${crossRefs.assess} to identify dead code before rebuilding."

**Cross-reference:** Remove any feature unit from the inventory whose path appears in the skip list.

> **After Phase 2:** Say exactly: "Feature inventory complete — [N] modules identified, [M] on skip list, [N−M] proceeding to story generation (Phase 3)." Then begin Phase 3 immediately. DO NOT stop. DO NOT wait for user input.

---

## PHASE 3 — GENERATE REBUILD STORIES

For each feature unit in the inventory (not on the skip list):

**Step 1 — API contract:**
- Check \`${crossProjectRulesPath}\` for endpoints owned by this module.
- If found: include them in the story.
- If not found: set contract to "⚠️ not found — run ${crossRefs.audit} for extraction or fill manually".

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

**For ${crossRefs.newFeature} prompt** (copy this block directly into ${crossRefs.newFeature}):

\`\`\`
Story: ${prefix}-NN
Feature: <module name>

<context: what layer this is and what it does>
Existing contract: <extracted endpoints OR "⚠️ not found — fill manually">
Constraints: <migration constraints from Doc 11 if applicable, OR "none">
\`\`\`

**Priority Derivation** (no human gate — computed from evidence):

\`\`\`
priority_composite = 0.4 × debt_severity_score
                   + 0.3 × dependency_count_score
                   + 0.3 × commit_frequency_score

  debt_severity_score:     High=3, Medium=2, Low=1   (max severity across module's Doc 07 rows; 0 if no debt rows)
  dependency_count_score:  hub_importers / 5         (capped at 3 — from Doc 01 IMPORT GRAPH hub files)
  commit_frequency_score:  commits_last_6mo / 10     (capped at 3 — \`git log --since="6 months ago" -- <module>\`)
\`\`\`

**Bucket → priority:** \`≥ 2.4 → P1\` · \`1.5–2.3 → P2\` · \`< 1.5 → P3\`

**Keep / drop derivation:**
- 0 importers (orphan) AND no debt items → flag **DROP-candidate** (story still listed; status defaults to SKIP)
- Otherwise → **KEEP** (default — parity rebuild)

**Net-new features:** Default to "no new features — rebuild parity only". This is recorded as an explicit assumption (see ASSUMPTIONS block); developers may add features manually to \`docs/backlog/stories.md\` after this command finishes.

**Acceptance criteria:** Default to "contract compliance + existing test coverage parity" unless Doc 11 (Migration Compatibility) specifies otherwise.

**Emit an ASSUMPTIONS entry per story** (machine-readable — Phase D wiring appends to \`governance-state.json\` \`assumptions[]\`):

\`\`\`yaml
- field: backlog.story.<STORY-ID>.priority
  inferredValue: <P1|P2|P3>
  evidence:
    - "debt severity: <max severity from Doc 07 rows under <module path>>"
    - "hub importers: <N> (Doc 01 IMPORT GRAPH)"
    - "commits last 6mo: <N>"
    - "composite: <number>"
  confidence: <high if ≥2 non-zero signals, medium if 1, low if all zero>
  reviewRequired: <true if confidence=low>
  timestamp: <ISO 8601>
\`\`\`

> **Phase numbering note:** Phase numbers here are project-internal (layer-based ordering within this project). They do NOT map to workspace phase numbers. In a workspace context, all backend project stories belong to workspace Phase 2; all frontend project stories belong to workspace Phase 3.

> **After Phase 3:** Say exactly: "All rebuild stories generated — proceeding to dependency ordering (Phase 4)." Then begin Phase 4 immediately. DO NOT stop. DO NOT wait for user input.

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

> **After Phase 4:** Say exactly: "Stories ordered by dependency — proceeding to write output files (Phase 5)." Then begin Phase 5 immediately. DO NOT stop. DO NOT wait for user input.

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

1. Open \`docs/backlog/combined-backlog.md\` — priorities are pre-filled via the derivation rubric
2. Skim any stories flagged \`reviewRequired: true\` — these were derived from low-confidence signals
3. Pick the highest-priority story → copy its \`${crossRefs.newFeature} prompt\` block
4. Run \`${crossRefs.newFeature}\` and paste the prompt block

## Story counts

| Phase | Stories | Parallel-safe |
|-------|---------|---------------|
| [each phase] | [N] | [N] |
| **Total** | **[N]** | **[N]** |

## Optional human review (overrides only)

- [ ] Override any derived priorities where the evidence is wrong
- [ ] Confirm \`DROP-candidate\` stories before deletion
- [ ] Add net-new features manually (default: parity rebuild only)
- [ ] Add extra acceptance criteria for P1 stories if needed
\`\`\`

### \`docs/backlog/stories.md\`

All stories in dependency order. Use the story format from Phase 3.
Group by phase with a heading for each phase.

### \`docs/backlog/combined-backlog.md\`

\`\`\`markdown
# Combined Backlog — ${project.appName}

| ID | Feature | Phase | Source Module | Debt Items | Dependencies | Priority | Confidence | Status |
|----|---------|-------|--------------|-----------|--------------|----------|------------|--------|
| ${prefix}-01 | ... | 1 | src/... | #1 (High) | none | P1 (composite=2.7) | high | [ ] not started |
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

> **After Phase 5:** Say exactly: "All 5 backlog files written to docs/backlog/ — proceeding to summary (Phase 6)." Then begin Phase 6 immediately. DO NOT stop. DO NOT wait for user input.

---

## PHASE 6 — SUMMARY

\`\`\`
━━━ BACKLOG GENERATED — ${project.appName} ━━━

  Stack:             ${stackDisplay}
  Rebuild stories:   [N] total
  Skipped modules:   [N] (from dead code analysis)
  Phases:            [N]
  Parallel-safe:     [N] stories can run simultaneously

  Priorities derived: [N] P1 / [N] P2 / [N] P3
  Low-confidence priorities (reviewRequired=true): [N]
  DROP-candidate stories (auto-flagged): [N]
  Sparse API contracts: [N] stories (run ${crossRefs.audit} for richer data)
  Net-new features: 0 included by default — add manually to docs/backlog/stories.md if needed

  Assessment age:         [N] days  [⚠️ add flag if >30]
  Cross-project rules:    [found / not found]
  Doc 07 (debt):          [found / not found]
  Doc 09 (dead code):     [found / not found]

  Next steps:
    1. Review docs/backlog/combined-backlog.md (priorities pre-filled)
    2. Override only the derived priorities where the evidence is clearly wrong
    3. Pick a story → copy its ${crossRefs.newFeature} prompt block
    4. Run ${crossRefs.newFeature} (or workspace /new-feature for cross-project)
\`\`\`

---

## WHAT THIS COMMAND DOES NOT DO

| Temptation | Why not |
|------------|---------|
| Write "As a user..." stories | Product framing requires domain knowledge |
| Add new features | Only extracts what exists today (parity rebuild) |
| Create specs | Stories are prompts for ${crossRefs.newFeature}, which creates specs |
| Read source files directly | Reads docs/assessment/, developer-actions.md, and cross-project-rules.md only |

> Priority is **derived** from debt severity × dependency count × commit frequency.
> Skip/keep decisions are **derived** from dead-code status (\`[~] KEPT\` and \`[ ] PENDING\`).
> Both can be overridden by the developer post-generation but are not gated on human input.

---

## FINAL OUTPUT — completion contract

The very last line of this run must be exactly:

\`\`\`
BACKLOG_COMPLETE: stories=<N> skip-list=<M> p1=<N> p2=<N> p3=<N>
\`\`\`

Substitute the actual counts. No other text after it.
`;
}
