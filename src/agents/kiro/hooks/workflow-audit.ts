import type { GovernanceConfig } from '../../../types.js';
import {
  getObservationQuestions,
  getDeadCodeSignals,
  getTestCoverageInstructions,
} from '../../../generators/audit-content.js';
import { generateKnowledgeHealthCheck } from '../../../utils/knowledge-health-check.js';

export function generateWorkflowAudit(c: GovernanceConfig): string {
  const { profile, scan, project } = c;
  const hookVer = c.hookVersion;
  const featuresDir = profile.featuresDir || profile.sourceDir || 'src/features/';
  const layerFlow = profile.layerFlow;

  const expectedHooks = [
    'protect-files.kiro.hook',
    'block-dangerous-commands.kiro.hook',
    'pre-write-secrets-gate.kiro.hook',
    'check-secrets.kiro.hook',
    'session-continuity.kiro.hook',
    'require-task-type.kiro.hook',
    'check-feature-readme.kiro.hook',
    'check-consistency.kiro.hook',
    'check-file-size.kiro.hook',
    'post-task-checklist.kiro.hook',
  ].join(', ');

  const highRisk = scan.highRiskFiles.length
    ? scan.highRiskFiles.slice(0, 8).join(', ')
    : 'none detected';

  const detectedAtInit = [
    profile.stateFramework && `state: ${profile.stateFramework}`,
    profile.diFramework && profile.diFramework !== 'N/A' && `DI: ${profile.diFramework}`,
    scan.detectedORM && `ORM: ${scan.detectedORM}`,
    scan.detectedTestFramework && `tests: ${scan.detectedTestFramework}`,
    scan.detectedLinter && `linter: ${scan.detectedLinter}`,
    scan.detectedFormatter && `formatter: ${scan.detectedFormatter}`,
    scan.detectedRouter && `router: ${scan.detectedRouter}`,
  ].filter(Boolean).join(' · ') || 'standard';

  const layerNames = profile.layerNames?.length
    ? profile.layerNames : layerFlow.split('→').map(s => s.trim());
  const logicLayer = profile.layerLogic || layerNames[Math.floor(layerNames.length / 2)] || 'Service';
  const dataLayer = profile.layerData || layerNames[layerNames.length - 1] || 'DataSource';
  const uiLayer = profile.layerUI || layerNames[0] || 'Component';

  const observationQuestions = getObservationQuestions(c);
  const deadCodeSignals = getDeadCodeSignals(c);
  const testCoverage = getTestCoverageInstructions(c);

  const prompt = `# workflow-audit — Project Truth Check

> **Project:** ${project.appName}
> **Stack:** ${profile.stackDisplay}
> **Init detected:** ${detectedAtInit} *(baked at init time — Step 5 will re-discover actual state)*
> **Init structural note:** ${scan.hasLegacyZones ? scan.legacyZoneNote : 'No legacy zones detected at init — code scan will confirm'}
> **Hook version:** v${hookVer}
> **High-risk files:** ${highRisk}

---

> ## ⚠️ EXECUTION RULES — READ BEFORE STARTING
>
> 1. **ALL steps are REQUIRED. Run every step. Do not stop early.**
> 2. **Do NOT output a VERDICT until the final step.**
> 3. **If Steps 1-3 are all clean, say "Governance files present — proceeding to code discovery (Step 4)" and continue.**
> 4. **This audit does NOT score code quality or best practices.** It discovers what the project actually is and checks whether \`.kiro/steering/\` accurately describes it.
> 5. **The goal is: when this audit finishes, Kiro has correct information about this project.** That is the only measure of success.
> 6. **Do not judge patterns as legacy or modern.** Observe and record what is actually there.
> 7. **IMPORTANT: Persist records go to \`.kiro/\` — NOT \`.claude/\`.** This project uses Kiro governance.
> 8. **⚠️ THE AUDIT IS NOT COMPLETE UNTIL ALL THREE FILES ARE WRITTEN.** Printing the scorecard is NOT the end. You MUST write \`.kiro/audit-report.md\`, \`.kiro/dead-code.md\`, and \`.kiro/developer-actions.md\` before this audit is considered done. If you are running low on context, skip detail in earlier steps — do NOT skip the persist step.

---

## WHAT THIS AUDIT DOES

This is NOT a code quality assessment.

It reads your actual project, discovers what patterns, tools, layers, and conventions are actually in use, then compares that to what \`.kiro/steering/\` currently says. Every mismatch is a gap where Kiro would generate code that doesn't fit your project.

By the end, \`.kiro/steering/\` will accurately describe your project — whatever your project actually is.

---

## PHASE 1 — GOVERNANCE INVENTORY
*(Does the scaffolding exist?)*

### Step 1 — Governance files

Read and confirm each file exists and is non-empty:

- \`.kiro/steering/constitution.md\`
- \`.kiro/steering/architecture.md\`
- \`.kiro/steering/coding-standards.md\`
- \`.kiro/steering/workflow.md\`
- \`.kiro/steering/ai-usage-policy.md\`
- \`.kiro/steering/spec-first-workflow.md\`
- \`.kiro/steering/feature-readme.md\`
- \`.kiro/steering/prompt-templates.md\`

Report: ✓ present / ✗ MISSING / ⚠ empty for each file.

### Step 2 — Hooks

Check each expected hook in \`.kiro/hooks/\`:
\`\`\`
${expectedHooks}
\`\`\`
Conditional hooks (may be absent by design):
- \`spec-first-gate.kiro.hook\` — only present when spec-first is enabled
- \`format-code.kiro.hook\` — only present when a formatter was detected at init
- \`analyze-code.kiro.hook\` — only present when a linter was detected at init

Workflow hooks — also check:
\`workflow-audit.kiro.hook\`, \`workflow-new-feature.kiro.hook\`, \`workflow-fix.kiro.hook\`,
\`workflow-refactor.kiro.hook\`, \`workflow-hotfix.kiro.hook\`, \`workflow-explore.kiro.hook\`

For each hook: file exists? ✓ · version matches \`${hookVer}\`? ✓ or STALE [found: X.Y.Z] · valid JSON? ✓

Extra hooks not in the list: report as CUSTOM.

### Step 3 — Steering front-matter

Open each \`.kiro/steering/\` file and confirm it starts with:
\`\`\`
---
inclusion: always
---
\`\`\`
This tells Kiro to always load the file regardless of context.
If front-matter is missing or wrong: note as MISCONFIGURED — Kiro will not load the file automatically.

> **After Step 3:** If all governance files, hooks, and steering front-matter are present → say "Governance scaffolding present — proceeding to project discovery (Step 4)" and continue immediately. Do NOT output a verdict here.

---

## PHASE 2 — PROJECT DISCOVERY
*(What does this project actually look like?)*

### Step 4 — Directory map

Map the project structure by listing all significant directories and their file counts.

**Root to scan by stack:**
- Flutter: \`lib/\`
- React / Node.js: \`src/\` — but first check for monorepo: if \`packages/\`, \`apps/\`, or \`services/\` exist at root, list those packages first
- Angular: \`src/app/\` — if \`nx.json\` or \`libs/\` exists at root, list \`apps/\` and \`libs/\` packages instead
- Python: \`src/\` or the main module directory
- Kotlin: \`app/src/main/\` — if \`commonMain/\` exists, list KMP modules
- SwiftUI: \`Sources/\`
- Java: \`src/main/java/\` — if multi-module Maven/Gradle, list all modules first, then drill into each module

\`\`\`
DIRECTORY MAP
  <path>/    [N] files
  <path>/    [N] files
  ...
\`\`\`

Note:
- Any directory with >100 files not mentioned in \`.kiro/steering/architecture.md\`
- Any directory that looks like a second architecture zone (different patterns from the rest)
- If monorepo: which package is the focus of this audit

### Step 5 — Code observation

This is the core of the audit. Read actual source files — do NOT guess from filenames.

**Observation approach:**
${observationQuestions}

**Compile your observations into a PROJECT REALITY REPORT:**

\`\`\`
PROJECT REALITY — ${project.appName}

Framework/Router:  [Next.js App Router / Pages Router / NestJS / FastAPI / Django / etc.]
HTTP/Network:      [what client is used for external calls, and where called from — or "N/A" if none]
State management:  [what is actually used and where — per zone if multi-zone]
Data flow:         [trace: UI/Route file → ... → data source file — real file names]
Layer structure:   [what layers actually exist, named from code, not from init assumptions]
ORM/Schema:        [ORM used, where queries happen, how models/schemas are defined]
DI approach:       [injection pattern used — or "none / module-level singletons"]
Test approach:     [framework, where tests live, rough coverage estimate]
Naming:            [file naming pattern, class naming, folder structure as observed]
Multi-zone:        [if different directories use clearly different patterns — name each zone]
File size range:   [smallest to largest source file, flag any >300 lines (frontend) / >500 lines (backend)]
\`\`\`

> **After Step 5:** Do NOT output a verdict. Say "Project reality mapped — comparing to governance (Step 6)" and continue.

---

## PHASE 3 — GAP ANALYSIS
*(Does .kiro/steering/ accurately describe this project?)*

### Step 6 — Compare reality to governance

Read each \`.kiro/steering/\` file and compare every factual claim to the PROJECT REALITY REPORT from Step 5.

> ⚠️ **Check architecture.md and constitution.md first — they have the highest priority. Kiro reads these before other steering files. Wrong layer rules here override everything else.**

**architecture.md — check (highest priority):**
- Does the stated "Layer flow" match what you actually traced in Step 5?
- Does the directory structure section match actual directories found in Step 4?
- Are there directories in Step 4 that are not mentioned in architecture.md at all?
- If multiple zones exist, does architecture.md have Zone Rules for each?
- Are high-risk files listed correctly?

**coding-standards.md — check:**
- Does it reference the actual HTTP client used in code (found in Step 5)?
- Does it reference the actual state management used (found in Step 5)?
- Does it reference the actual ORM/data tool used (found in Step 5)?
- Does the test section match what's actually in the test directory?
- Does the naming section match actual file names observed in Step 5?
- If multiple zones exist, does it have different rules per zone?

**workflow.md — check:**
- Does \`FEATURES_DIR\` in workflow.md match the actual feature directory found in Step 4?
- Does \`SOURCE_DIR\` match the actual source directory?
- Does the layer flow description match what you traced in Step 5?
- If wrong: this is critical — Kiro will create every new feature in the wrong path

**constitution.md — check:**
- Does the stated layer flow match what Step 5 actually traced?
- Does the high-risk files list reference files that actually exist on disk?
- Are any hard rules internally inconsistent?

**ai-usage-policy.md — check:**
- Do the "New Feature Rules" or layer flow rules match the actual architecture observed in Step 5?
- Does the high-risk files list reference files that actually exist?

**spec-first-workflow.md, feature-readme.md, prompt-templates.md — check:**
- Are any file paths, directory names, or patterns referenced that don't exist in this project?
- Are layer names consistent with what Step 5 observed?

> **Check ALL files above. Do not skip any. A steering file not checked is a file that can silently mislead Kiro.**

**For each mismatch found, record:**
\`\`\`
GAP: <steering file> says "<what it claims>"
     Reality: <what the code actually does>
     Impact: If Kiro reads this and then writes code, it will <specific wrong behaviour>
\`\`\`

> **After Step 6:** If NO gaps were found → say "Governance accurately describes this project. Proceeding to spec and dead code checks." If gaps found → proceed to Step 7 to fix them.

---

## PHASE 4 — FIX GOVERNANCE
*(Update .kiro/steering/ to match reality — no approval needed)*

### Step 7 — Update steering files

Fix every gap identified in Step 6. Update directly — do not ask for permission.

**Rules for updates:**
- Do not remove correct content — only add missing facts or correct wrong facts
- Do not write file counts in directory annotations — counts change every sprint and immediately become stale
- If the project has multiple zones, add a Zone Rules section to both architecture.md and coding-standards.md
- Use language that tells Kiro what to DO in each zone, not just that the zone exists
- Do not judge one zone as better than another — describe what to do in each

**Zone Rules format (if multi-zone project):**
\`\`\`markdown
## Zone Rules

This project has multiple code zones. When working in a zone, match its existing patterns.

| Zone | Pattern | When to use |
|------|---------|-------------|
| zone-a/ | [tools, state, data approach] | [when to extend this zone] |
| zone-b/ | [tools, state, data approach] | [when to extend this zone] |
\`\`\`

**After each file update, record:**
\`\`\`
UPDATED: .kiro/steering/<file>.md
  Added: <what was added>
  Corrected: <what was corrected>
\`\`\`

---

## PHASE 5 — SPEC AND DEAD CODE
*(Additional project health checks)*

### Step 8 — Spec coverage

List every feature-sized directory in \`${featuresDir}\`. For each:
- Does \`.kiro/specs/<feature-name>/\` exist with requirements.md, design.md, tasks.md?
- If no spec exists: note it (not a blocker unless \`spec-first-gate.kiro.hook\` is present)

If spec-first is active (\`spec-first-gate.kiro.hook\` exists in \`.kiro/hooks/\`), flag features with code but no spec as ACTION NEEDED — Kiro will be blocked when trying to edit those files.

### Step 9 — Test coverage

${testCoverage}

**Per feature/module test status:**
\`\`\`
<feature>: TESTED / PARTIAL [missing: which layers] / UNTESTED / SCAFFOLD-ONLY
\`\`\`

### Step 10 — Dead file scan

Look for files that are likely unused or abandoned:

${deadCodeSignals}

For each candidate:
\`\`\`
DEAD CODE CANDIDATE: <path>
  Reason: <why it's likely dead>
  Risk: <could this confuse Kiro? e.g. "Kiro might try to import this model that no longer has a matching endpoint">
\`\`\`

---
${generateKnowledgeHealthCheck()}
## PHASE 6 — REPORT
*(What was wrong, what's fixed, what Kiro will now do correctly)*

### Step 11 — Governance gap summary

This is the most important output. For each gap that was found and fixed:

\`\`\`
━━━ GOVERNANCE GAP FIXED ━━━

What was wrong:
  <steering file> claimed: "<exact wrong claim>"

What the code actually does:
  <exact observed reality from Step 5>

What Kiro would have done wrong (before this fix):
  <specific wrong behaviour — wrong imports, wrong patterns, wrong file locations>

What Kiro will now do correctly:
  <specific correct behaviour after the fix>

Fix applied:
  <exact change made to which .kiro/steering/ file>
\`\`\`

If no gaps were found: "Governance was accurate. No changes needed."

### Step 12 — Final scorecard and persist records

> Use this exact format. Score each category independently.

\`\`\`
PROJECT TRUTH AUDIT — ${project.appName}
Stack: ${profile.stackDisplay} | Hook version: v${hookVer}
Date: <today>

━━━ HEALTH SCORECARD ━━━

  Governance Files    <score>/100  <Grade>
    (steering files present, hooks at correct version, front-matter correct)

  Governance Accuracy <score>/100  <Grade>
    (how accurately .kiro/steering/ described the project BEFORE this audit)
    (100 = perfect match, deduct 15 per significant gap found in Step 6)

  Steering Coverage   <score>/100  <Grade>
    (does steering cover all significant directories and patterns?)
    (deduct 10 per undocumented directory with >10 files)

  Test Coverage       <score>/100  <Grade>
    (SCENARIO A: 0 · SCENARIO B: proportional · SCENARIO C: 90-100)

  Dead File Risk      <score>/100  <Grade>
    (start 100, deduct 5 per dead code candidate found)

  OVERALL             <score>/100  Grade: <A/B/C/D>
    (average of the 5 scored categories above)

━━━ GRADE SCALE ━━━
  A: 90-100  B: 75-89  C: 60-74  D: <60

━━━ GOVERNANCE GAPS (before this audit) ━━━
  [N] gaps found and fixed — see Step 11 for detail
  OR: "None — governance was accurate"

━━━ SPEC COVERAGE (informational — not scored) ━━━
  Spec coverage reflects developer process maturity, not governance accuracy.
  Features with spec: [N] / [total active features]
  Features missing spec: [list, or "none"]
  Note: if spec-first-gate.kiro.hook is present, Kiro will be blocked editing
        feature files that have no spec — listed features need specs before work begins.

━━━ TEST COVERAGE ━━━
  Scenario: A (no tests) / B (partial) / C (comprehensive)
  [per-feature breakdown if Scenario B]

━━━ DEAD FILE CANDIDATES ━━━
  [list or "none found"]

━━━ NEW FEATURE BLUEPRINT ━━━
Based on Step 5 observations (actual patterns in use, not assumed):
  Path: <exact path for a new feature in this project>
  Zone: <which zone new features should go into — based on what exists, not init assumptions>
  Layer structure:
    <list the actual layers observed, with real directory names>
  Pattern to follow: <state/data approach observed in Step 5>
  State: <actual state management approach>
  HTTP/API: <actual HTTP client (frontend) or endpoint pattern (backend)>
  Tests go in: <actual test directory path>
  Naming: <actual file and class naming convention>

━━━ VERDICT ━━━
  ALIGNED
    Governance accurately described the project.
    [N] hooks at v${hookVer}. Development can start.
  OR
  UPDATED — [N] governance gaps fixed
    .kiro/steering/ now accurately describes this project.
    Development can start. Rerun workflow-audit after major refactors.
  OR
  ACTION NEEDED
    Governance updated, but developer decisions required:
    • <specific item needing a decision>
    ai-gov upgrade --agent kiro  (only if hooks were STALE)
\`\`\`

> **⚠️ MANDATORY FINAL STEP — DO NOT SKIP.**
> **After printing the scorecard above, you MUST write all three persistent audit records below.**
> **Do not ask permission — these are audit records, not governance files.**
> **Write to \`.kiro/\` — NOT \`.claude/\`. This project uses Kiro governance. If a \`.claude/\` folder exists in this project, IGNORE IT — it belongs to a different agent.**
> **Announce each write before doing it: say "Writing .kiro/audit-report.md..." then write the file. Say "Writing .kiro/dead-code.md..." then write the file. Say "Writing .kiro/developer-actions.md..." then write the file.**
> **If you have not written all three files, the audit is incomplete. Write them now.**

---

### Persist: .kiro/audit-report.md

**Step 1 — Read the file first** (if it exists). Extract the most recent run entry to get previous scores for the "vs Previous" delta column. If the file does not exist, this is Run 1 — all "vs Previous" values are "—".

**Step 2 — Append** a new run entry. Do not overwrite or delete previous entries — the file is an append-only history log.

Format for each run entry:
\`\`\`markdown
## Run [N] — <date>

| Category           | Score   | Grade | vs Previous |
|--------------------|---------|-------|-------------|
| Governance Files   | xx/100  | X     | +N / −N / — |
| Governance Accuracy| xx/100  | X     | +N / −N / — |
| Steering Coverage  | xx/100  | X     | +N / −N / — |
| Test Coverage      | xx/100  | X     | +N / −N / — |
| Dead File Risk     | xx/100  | X     | +N / −N / — |
| **OVERALL**        | **xx/100** | **X** | **+N / −N / —** |

**VERDICT:** ALIGNED / UPDATED — N gaps fixed / ACTION NEEDED
**Gaps fixed this run:** [N] — [list titles]
**Gaps remaining:** [N or "none"]
**Dead code candidates:** [N] (see dead-code.md)
**Open developer actions:** [N] (see developer-actions.md)

---
\`\`\`

> ⚠️ If the developer deleted this file between runs, recreate it starting at Run 1.

---

### Persist: .kiro/dead-code.md

**Step 1 — Read the file first** (if it exists). Load all existing entries and their statuses.

**Step 2 — Update statuses for existing entries:**
- For each row that is still \`[ ] PENDING\`: check whether the file/path still exists on disk.
  - File no longer exists → mark \`[x] DELETED\` with today's date
  - File still exists and still flagged → leave \`[ ] PENDING\`
  - Developer marked \`[~] KEPT\` → **preserve the developer's decision, do not change it**

**Step 3 — Add only NEW candidates** found in Step 10 that are not already listed.

**Step 4 — Write the updated file.**

Format:
\`\`\`markdown
# Dead Code Registry — ${project.appName}

> Resolve by: fixing the code (audit auto-detects and marks DELETED) OR marking [~] KEPT with a reason.
> Simply deleting a row will cause it to reappear next audit run if the issue still exists in code.
> Status: [ ] PENDING · [x] DELETED <date> · [~] KEPT — <reason>

| # | File / Path | Reason flagged | First detected | Status |
|---|-------------|----------------|----------------|--------|
\`\`\`

> ⚠️ If the developer deleted this file between runs, recreate it from current scan findings.

---

### Persist: .kiro/developer-actions.md

**Step 1 — Read the file first** (if it exists). Load all existing action items and statuses.

**Step 2 — Auto-resolve items where the underlying issue is now gone.** Check each \`[ ] OPEN\` item against your Step 1-10 findings:
- "Set up test infrastructure" → Step 9 now shows Scenario B or C → mark \`[x] DONE <date>\`
- "Update stale hook to vX" → Step 2 confirms hook now at correct version → mark \`[x] DONE <date>\`
- Architectural/naming/strategic decisions → only the developer can close these

**Step 3 — Add only NEW action items** found this run that are not already listed.

**Step 4 — Write the updated file.**

Format:
\`\`\`markdown
# Developer Actions — ${project.appName}

> These items require a developer decision — Kiro cannot resolve them automatically.
> Resolve by: fixing the underlying issue (audit auto-detects next run) OR marking [x] DONE / [→] DEFERRED.
> Simply deleting a row will cause it to reappear next audit run if the issue still exists.
> Status: [ ] OPEN · [x] DONE <date> · [→] DEFERRED <reason>

| # | Type | Action required | Why it matters | Added | Status |
|---|------|----------------|----------------|-------|--------|
\`\`\`

> **Type column:** \`auto\` = audit will detect when resolved and mark DONE automatically. \`decision\` = only the developer can mark this done.

---

## How specs work in ${project.appName}

Code lives in \`${featuresDir}\`. Each feature follows the layer flow: \`${layerFlow}\`

Before writing code, spec:
- **${uiLayer} layer** — inputs, outputs, events the user triggers
- **${logicLayer} layer** — business rules, validation, what can fail
- **${dataLayer} layer** — data shape, queries, external calls

**Task types:** New Feature · Edit Feature · Bug Fix · Refactor · Hotfix

**To activate spec-first workflow:**
Populate \`.kiro/specs/<feature-name>/\` with requirements.md, design.md, tasks.md.
Once a feature spec exists, \`spec-first-gate.kiro.hook\` will block edits to that feature's code until the spec is reviewed.
`;

  return JSON.stringify({
    name: 'Audit',
    version: c.hookVersion,
    description: 'Full governance audit: 6 phases / 12 steps — observe codebase, compare to .kiro/steering/, fix drift, write .kiro/audit-report.md',
    when: {
      type: 'userTriggered',
    },
    then: {
      type: 'askAgent',
      prompt,
    },
  }, null, 2) + '\n';
}
