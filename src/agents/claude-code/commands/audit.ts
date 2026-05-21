import type { GovernanceConfig } from '../../../types.js';
import { getObservationQuestions, getDeadCodeSignals, getTestCoverageInstructions } from '../../../generators/audit-content.js';
import { generateKnowledgeHealthCheck } from '../../../utils/knowledge-health-check.js';

export function generateAuditCommand(c: GovernanceConfig): string {
  const { profile, scan, project } = c;
  const hookVer = c.hookVersion;
  const featuresDir = profile.featuresDir || profile.sourceDir || 'src/features/';
  const layerFlow = profile.layerFlow;
  const taskTypes = 'New Feature · Edit Feature · Bug Fix · Refactor · Hotfix';

  const expectedHooks = [
    'protect-files.sh', 'block-dangerous-commands.sh', 'check-secrets.sh',
    'session-continuity.sh', 'format-code.sh', 'analyze-code.sh', 'post-task-checklist.sh',
  ].join(', ');

  const specHookNote = `check-spec-exists.sh — conditional: registered in settings.json only when \`specs/\` has feature directories beyond \`_template/\`. Intentionally absent on a fresh project.`;

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

  const specExample = featuresDir.includes('api') || featuresDir.includes('routes')
    ? `specs/user-auth/` : `specs/user-profile/`;
  const specActivationCmd = `cp -r specs/_template/ ${specExample}`;

  const observationQuestions = getObservationQuestions(c);
  const deadCodeSignals = getDeadCodeSignals(c);
  const testCoverage = getTestCoverageInstructions(c);

  return `# /audit — Project Truth Check

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
> 4. **This audit does NOT score code quality or best practices.** It discovers what the project actually is and checks whether \`.claude/\` accurately describes it.
> 5. **The goal is: when this audit finishes, Claude has correct information about this project.** That is the only measure of success.
> 6. **Do not judge patterns as legacy or modern.** Observe and record what is actually there.
> 7. **GAPS MUST BE FIXED, NOT JUST REPORTED.** If Step 6 finds gaps, Step 7 MUST edit the steering files to close them. A gap that appears on two consecutive audit runs is a failure of the audit process itself. The audit's job is to leave the project with ZERO steering gaps when it finishes.
> 8. **Code-level issues (security, architecture violations) that CANNOT be fixed by editing steering files go to developer-actions.md.** Everything else is fixed immediately in Step 7.
> 9. **DO NOT STOP between phases.** Phase headings (## PHASE N) are section labels — not stopping points. After every step transition marker below, continue to the next step immediately without waiting for user input or confirmation.
> 10. **ALL 12 steps AND all 3 persist operations MUST complete in a single run.** The audit is not complete until audit-report.md, dead-code.md, and developer-actions.md have all been written.
> 11. **For large or multi-module projects:** summarize observations per module/zone rather than per file — but complete ALL steps. Project size is not a reason to skip any step.
> 12. **Completion contract — emit on the very last line of the run, exactly:**
>     \`AUDIT_COMPLETE: persist-files=<N>/3 steps=<N>/12 verdict=<ALIGNED|UPDATED|ACTION_NEEDED>\`
>     The contract is the structural signal that the audit finished. The runner greps for it; an absent contract means the run did not complete and the verdict is incomplete regardless of any prose summary above it.

---

## WHAT THIS AUDIT DOES

This is NOT a code quality assessment.

It reads your actual project, discovers what patterns, tools, layers, and conventions are actually in use, then compares that to what \`.claude/steering/\` currently says. Every mismatch is a gap where Claude would generate code that doesn't fit your project.

By the end, \`.claude/steering/\` will accurately describe your project — whatever your project actually is.

---

## PHASE 1 — GOVERNANCE INVENTORY
*(Does the scaffolding exist?)*

### Step 1 — Governance files

Read and confirm each file exists and is non-empty:

- \`.claude/CLAUDE.md\`
- \`.claude/settings.json\`
- \`.claude/steering/constitution.md\`
- \`.claude/steering/architecture.md\`
- \`.claude/steering/coding-standards.md\`
- \`.claude/steering/workflow.md\`
- \`.claude/steering/developer-reference.md\`

Report: ✓ present / ✗ MISSING / ⚠ empty for each file.

> **Note (v20.4+):** The following files were consolidated and are no longer separate files. Do NOT mark them missing — their content now lives in the 5 files above:
> - ai-usage-policy.md → merged into workflow.md
> - naming-conventions.md → merged into architecture.md
> - spec-first-workflow.md → merged into workflow.md
> - feature-readme.md → merged into developer-reference.md
> - prompt-templates.md → merged into developer-reference.md
> - task-estimates.md → merged into developer-reference.md

### Step 2 — Hooks

Check each expected hook in \`.claude/hooks/\`:
\`\`\`
${expectedHooks}
\`\`\`
Conditional: ${specHookNote}

For each hook: file exists? ✓ · version matches \`${hookVer}\`? ✓ or STALE [found: X.Y.Z] · file non-empty? ✓

Extra hooks not in the list: report as CUSTOM, note if wired in settings.json.

### Step 3 — Settings.json wiring

Read \`.claude/settings.json\`. Confirm:
- PreToolUse hooks registered (protect-files, check-secrets, session-continuity, block-dangerous)
- PostToolUse hooks registered (format-code)
- Stop hooks registered (analyze-code, post-task-checklist)
- check-spec-exists.sh: present AND registered only if \`specs/\` has active feature dirs

> **After Step 3:** Say exactly: "Governance scaffolding checked — proceeding to project discovery (Step 4)." Then begin Step 4 (no verdict yet — per rule #2).

---

## PHASE 2 — PROJECT DISCOVERY
*(What does this project actually look like?)*

### Step 4 — Directory map

Map the project structure by listing all significant directories and their file counts.

**Root to scan by stack:**
- Flutter: \`lib/\`
- React / Node.js: \`src/\` — but first check for monorepo: if \`packages/\`, \`apps/\`, or \`services/\` exist at root, list those packages first, then drill into the package under audit
- Angular: \`src/app/\` — if \`nx.json\` or \`libs/\` exists at root, list \`apps/\` and \`libs/\` packages instead
- Python: \`src/\` or the main module directory (whichever holds the source)
- Kotlin: \`app/src/main/\` — if \`commonMain/\` exists, list KMP modules
- SwiftUI: \`Sources/\`
- Java: \`src/main/java/\` — if multi-module Maven/Gradle, list all modules first, then drill into each module's \`src/main/java/\`. If OSGi: list bundles and note which provide services vs UI vs API

\`\`\`
DIRECTORY MAP
  <path>/    [N] files
  <path>/    [N] files
  ...
\`\`\`

Note:
- Any directory with >100 files that is not mentioned in \`.claude/steering/architecture.md\`
- Any directory that looks like a second architecture zone (different patterns)
- If monorepo: which package is the focus of this audit

> **After Step 4:** Say exactly: "Directory map complete — proceeding to code observation (Step 5)." Then begin Step 5.

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

> **After Step 5:** Say exactly: "Project reality mapped — proceeding to gap analysis (Step 6)." Then begin Step 6 (still no verdict — per rule #2).

---

## PHASE 3 — GAP ANALYSIS
*(Does .claude/ accurately describe this project?)*

### Step 6 — Compare reality to governance

Read \`.claude/CLAUDE.md\` AND each \`.claude/steering/\` file and compare every factual claim to the PROJECT REALITY REPORT from Step 5.

> ⚠️ **Check CLAUDE.md first — it has the highest priority. Claude reads it before any steering file. Wrong paths or layer rules here override everything else.**

**CLAUDE.md — check (highest priority):**
- Do the high-risk files listed match actual file paths observed in Step 4? Remove any ghost entries (files that don't exist on disk). Correct any root-relative paths that should be src/-prefixed.
- Do any "While Coding" or layer flow rules match the actual zone structure observed in Step 5? If the project is dual-zone, a single "Route → Model" rule is wrong.
- Are any directory paths, file counts, or tool names referenced that are incorrect or stale?

**architecture.md — check:**
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

**architecture.md — check naming conventions section:**
- Do the naming rules in the Naming Conventions section match what files are actually named in the project?
- Are class/function naming patterns consistent with what Step 5 observed?

**workflow.md — check:**
- Does \`FEATURES_DIR\` in workflow.md match the actual feature directory found in Step 4?
- Does \`SOURCE_DIR\` match the actual source directory?
- Does the layer flow description match what you traced in Step 5?
- Does the layer build order match what Step 5 observed (especially if dual-zone)?
- Do the AI usage policy prerequisites match the project's actual ticket system and spec folder location?
- Do the spec-first STOP gates reference the correct specs directory path?
- If wrong: this is critical — Claude will create every new feature in the wrong path

**constitution.md — check:**
- Does the stated layer flow match what Step 5 actually traced? If the project is dual-zone, does constitution.md acknowledge both zone flows — or does it state only one as absolute?
- Does the high-risk files list reference files that actually exist on disk? Ghost entries confuse Claude when it searches for them and finds nothing.
- Are any hard rules internally inconsistent?
- Do the architecture invariants in constitution.md align with the Zone Rules in architecture.md?

**developer-reference.md — check:**
- Does the Feature README template reference the correct feature directory path for this project?
- Are any paths or directory names referenced that don't match Step 4 findings?
- Are layer names in the prompt templates consistent with what Step 5 observed?

> **Check ALL files above. Do not skip any. A steering file not checked is a file that can silently mislead Claude.**

**For each mismatch found, record:**
\`\`\`
GAP: <steering file> says "<what it claims>"
     Reality: <what the code actually does>
     Impact: If Claude reads this and then writes code, it will <specific wrong behaviour>
\`\`\`

**Example gap entries — Flutter:**
\`\`\`
GAP: architecture.md says "HTTP: Dio"
     Reality: lib/services/ has 21 files using Chopper (APIService.chopper.dart pattern)
     Impact: Claude will generate Dio calls when working in lib/screens/, which won't
             compile — that zone uses Chopper and BuiltValue models

GAP: coding-standards.md says "state: BLoC/Cubit"
     Reality: lib/screens/ uses setState throughout (87 files), only lib/features/ uses BLoC
     Impact: Claude will add Cubit to lib/screens/ widgets that use setState
\`\`\`

**Example gap entries — React (Next.js):**
\`\`\`
GAP: architecture.md says "data fetching: React Query hooks in components"
     Reality: app/ directory uses Server Components with async fetch() — no React Query
     Impact: Claude will add useQuery() to Server Components, breaking the build

GAP: coding-standards.md does not mention pages/ directory (43 files)
     Reality: pages/ exists alongside app/ — migration is in progress
     Impact: Claude has no rules for pages/ — will apply App Router patterns to Pages Router files
\`\`\`

**Example gap entries — Node.js:**
\`\`\`
GAP: architecture.md says "ORM: Prisma"
     Reality: src/repositories/ has 12 files using raw pg (node-postgres) queries directly
     Impact: Claude will import PrismaClient in new repositories instead of using pg pool

GAP: workflow.md shows FEATURES_DIR=src/modules/ but actual directory is src/features/
     Impact: Claude will create every new feature in src/modules/ which does not exist
\`\`\`

> **After Step 6:**
> - If NO gaps found → say exactly: "No governance gaps — proceeding to spec coverage (Step 8)." Begin Step 8.
> - If gaps found → say exactly: "Found [N] gap(s) — fixing steering files now (Step 7)." Begin Step 7 by opening the first affected file and writing the correction. Do not produce a "gaps to fix" list as a substitute; do not ask for permission (per rule #7).

---

## PHASE 4 — FIX GOVERNANCE (MANDATORY — NOT OPTIONAL)
*(Update .claude/ to match reality — no approval needed)*

### Step 7 — Update steering files

> ⚠️ **THIS STEP IS A FILE-WRITING STEP — NOT A LISTING STEP.**
>
> For each gap from Step 6: open the steering file and write the corrected content now.
>
> **Failure modes to avoid:**
> - If you output a list of "gaps that should be fixed" without calling the file-write tool: you have failed this step. Go back and write the files.
> - If you write "consider updating architecture.md": you have failed this step. Open architecture.md and update it now.
> - If you defer a steering mismatch to developer-actions.md: you have failed this step. Steering mismatches belong here, not in developer-actions.
>
> DO NOT ask for permission. Steering fixes are always safe — they only change documentation to match what the code already does.

Fix every gap identified in Step 6. Update directly — do not ask for permission.

**Rules for updates:**
- Do not remove correct content — only add missing facts or correct wrong facts
- Do not write file counts (e.g. "48 files") in directory annotations — counts change every sprint and immediately become stale. Use qualitative descriptions instead: "route handlers (dominant)", "business logic + data access", "thin HTTP handlers"
- If the project has multiple zones (e.g. lib/screens/ + lib/features/), add a Zone Rules section to both architecture.md and coding-standards.md that describes each zone separately
- Use language that tells Claude what to DO in each zone, not just that the zone exists
- Do not judge one zone as better than another — describe what to do in each

**Verification after Step 7:**
After writing all fixes, re-read each modified file to confirm the gap text no longer appears.
If a gap from Step 6 still exists after Step 7, you have a bug — fix it before proceeding.

> **After Step 7:** Say exactly: "All steering fixes applied and verified — proceeding to spec coverage (Step 8)." Begin Step 8.

**Categorizing gaps — what goes WHERE:**
- **Steering mismatch** (docs say X, code does Y) → FIX THE STEERING FILE in Step 7. Done.
- **Code-level security issue** (hardcoded secrets, exposed credentials) → Add to developer-actions.md as \`auto\` type with CRITICAL priority. Also add a note to the relevant steering file (e.g., constitution.md: "Never hardcode API keys — use environment variables via config").
- **Code-level architecture violation** (one module bypasses the pattern all others follow) → Add to developer-actions.md as \`decision\` type. The developer decides whether to refactor or accept the inconsistency.
- **Missing infrastructure** (no tests, no CI, no specs) → Add to developer-actions.md as \`auto\` type. Audit will auto-close when infrastructure appears.

**Zone Rules format (if multi-zone project):**
\`\`\`markdown
## Zone Rules

This project has multiple code zones. When working in a zone, match its existing patterns.

| Zone | Pattern | When to use |
|------|---------|-------------|
| lib/features/ | BLoC/Cubit · Dio · clean arch layers | New features |
| lib/screens/  | setState · Chopper · BuiltValue | Editing existing screens |
\`\`\`

For React (Next.js App + Pages Router migration):
\`\`\`markdown
## Zone Rules

This project has two rendering zones. Match the zone's existing approach.

| Zone    | Pattern | When to use |
|---------|---------|-------------|
| app/    | Server Components · fetch in component · no useState at top level | New features |
| pages/  | Client-side · React Query · useEffect data fetching | Editing existing pages |
\`\`\`

For any stack: describe each zone's tools, state approach, and data flow — not just the directory name.

**Hook Data section (architecture.md only):**
After correcting layer flow or directory paths in architecture.md, also update (or add) the \`## Hook Data — Architecture Layers\` section at the bottom of that file. This section is parsed by the pre-commit architecture hook at commit time — if it's stale, the hook enforces wrong layers.

Format:
\`\`\`markdown
## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: <name> | paths: <dir1>/, <dir2>/
arch-layer: <name> | paths: <dir1>/

arch-rule: <layerA> | cannot-import | <layerB> | <hint>
arch-rule: <layer>  | no-network    | <hint>
arch-rule: <layer>  | no-framework  | <hint>
\`\`\`

Rules:
- Use the actual directory paths discovered in Step 4 — not assumed names.
- \`cannot-import\` — the hook checks if a file in layerA's paths imports from layerB's paths.
- \`no-network\` — the hook checks if a file in the named layer makes direct HTTP client calls.
- \`no-framework\` — the hook checks if a file in the named layer imports framework packages (android, react, angular, etc.).
- If a layer was renamed or paths changed, update both the human-readable Layer Flow section AND the Hook Data section in the same edit.
- If the project has no layered architecture (e.g. flat scripts), omit the Hook Data section entirely.

**After each file update, record:**
\`\`\`
UPDATED: .claude/steering/architecture.md
  Added: Zone Rules section (lib/screens/ and lib/features/)
  Corrected: HTTP client for lib/screens/ zone (Chopper, not Dio)
  Added: lib/models/ and lib/services/ directories to Project Structure
\`\`\`

---

## PHASE 5 — SPEC AND DEAD CODE
*(Additional project health checks)*

### Step 8 — Spec coverage

List every feature-sized directory in \`${featuresDir}\`. For each:
- Does \`specs/<feature-name>/\` exist with requirements.md, design.md, tasks.md?
- If no spec exists: note it (not a blocker unless check-spec-exists.sh is registered)

If spec-first is active (check-spec-exists.sh in settings.json), flag features with code but no spec as ACTION NEEDED — Claude will be blocked when trying to edit those files.

> **After Step 8:** Continue to Step 9 (test coverage).

### Step 9 — Test coverage

${testCoverage}

**Per feature/module test status:**
\`\`\`
<feature>: TESTED / PARTIAL [missing: which layers] / UNTESTED / SCAFFOLD-ONLY
\`\`\`

> **After Step 9:** Continue to Step 10 (dead file scan).

### Step 10 — Dead file scan

Look for files that are likely unused or abandoned:

${deadCodeSignals}

For each candidate:
\`\`\`
DEAD CODE CANDIDATE: <path>
  Reason: <why it's likely dead>
  Risk: <could this confuse Claude? e.g. "Claude might try to import this model that no longer has a matching endpoint">
\`\`\`

> **After Step 10:** Continue to Step 11 (governance gap summary).

---
${generateKnowledgeHealthCheck()}
## PHASE 6 — REPORT
*(What was wrong, what's fixed, what Claude will now do correctly)*

### Step 11 — Governance gap summary

This is the most important output. For each gap that was found and fixed:

\`\`\`
━━━ GOVERNANCE GAP FIXED ━━━

What was wrong:
  <steering file> claimed: "<exact wrong claim>"

What the code actually does:
  <exact observed reality from Step 5>

What Claude would have done wrong (before this fix):
  <specific wrong behaviour — wrong imports, wrong patterns, wrong file locations>

What Claude will now do correctly:
  <specific correct behaviour after the fix>

Fix applied:
  <exact change made to which steering file>
\`\`\`

If no gaps were found: "Governance was accurate. No changes needed."

> **After Step 11:** Continue to Step 12 (scorecard and persist).

### Step 12 — Final scorecard and persist records

> Use this exact format. Score each category independently.

\`\`\`
PROJECT TRUTH AUDIT — ${project.appName}
Stack: ${profile.stackDisplay} | Hook version: v${hookVer}
Date: <today>

━━━ GOVERNANCE SCORECARD (4 categories — audit's responsibility) ━━━

  Governance Files    <score>/100  <Grade>
    Start: 100
    −20 per MISSING steering file (Step 1) · −10 per empty (⚠) steering file
    −10 per MISSING hook (Step 2) · −15 per STALE hook (version mismatch)
    −15 if settings.json missing one or more required hook categories (Step 3)
    Floor: 0

  Governance Accuracy <score>/100  <Grade>
    Measures how accurately .claude/ described the project BEFORE this audit.
    Start: 100
    −20 per gap where a steering file stated the WRONG tool/pattern (e.g. "ORM: Prisma" when code uses raw SQL)
    −10 per gap where a steering file OMITTED a significant pattern present in code (e.g. no Zone Rules for a second zone)
    −5 per gap where a steering file had a stale path or ghost file reference
    Floor: 0. Score 100 = zero gaps found in Step 6.

  Steering Coverage   <score>/100  <Grade>
    Measures whether steering covers all significant directories found in Steps 4–5.
    Start: 100
    −10 per directory with >10 files found in Step 4 that has no mention in architecture.md
    −5 per directory with 5–10 files found in Step 4 that has no mention in architecture.md
    Floor: 0

  Dead File Risk      <score>/100  <Grade>
    Start: 100 · −5 per dead code candidate found in Step 10 · Floor: 0

  OVERALL             <score>/100  Grade: <A/B/C/D>
    Arithmetic mean of the 4 categories above. Test Coverage and other maturity
    signals are reported separately (PROJECT MATURITY block below) and do NOT
    factor into governance accuracy.

━━━ PROJECT MATURITY (informational — not part of governance grade) ━━━

  Test Coverage       <score>/100
    SCENARIO A (no test infrastructure found in Step 9): 0
    SCENARIO B (partial): score = round((features/modules with ≥1 test file ÷ total active features/modules) × 100)
      PARTIAL features (some layers tested, not all) count as 50% of full credit
    SCENARIO C (comprehensive, real assertions confirmed in spot-check): 95

  Note: A greenfield project with no tests yet can still have a perfect
  Governance grade. Maturity grows as the project ages; governance accuracy
  is the audit's only scored concern.

━━━ GRADE SCALE ━━━
  A: 90-100  B: 75-89  C: 60-74  D: <60

━━━ GOVERNANCE GAPS (before this audit) ━━━
  [N] gaps found and fixed — see Step 11 for detail
  OR: "None — governance was accurate"

━━━ SPEC COVERAGE (informational — not scored) ━━━
  Spec coverage reflects developer process maturity, not governance accuracy.
  It is listed here for awareness only — it does not affect the scorecard.
  Features with spec: [N] / [total active features]
  Features missing spec: [list, or "none"]
  Note: if check-spec-exists.sh is registered, Claude will be blocked editing
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
  State: <actual state management approach observed — e.g. BLoC, Zustand, NgRx, StateFlow>
  HTTP/API: <actual HTTP client (frontend) or framework endpoint pattern (backend) observed>
  Tests go in: <actual test directory path observed>
  Naming: <actual file and class naming convention observed>

━━━ VERDICT ━━━
  ALIGNED
    Governance accurately described the project.
    [N] hooks at v${hookVer}. Development can start.
  OR
  UPDATED — [N] governance gaps fixed
    .claude/steering/ now accurately describes this project.
    Development can start. Rerun /audit after major refactors.
  OR
  ACTION NEEDED
    Governance updated, but developer decisions required:
    • <specific item needing a decision — e.g. "specs/ missing for X features that have code">
    • <specific item — e.g. "test infrastructure not set up">
    • <specific item — e.g. "dead files confirmed? delete? archive?">
    ai-gov init --update-hooks  (only if hooks were STALE)
\`\`\`

> **After printing the scorecard above, write the three persistent audit records below.**
> **Do not ask permission — these are audit records, not governance files.**
> **Announce each write explicitly: "Writing .claude/audit-report.md...", "Writing .claude/dead-code.md...", "Writing .claude/developer-actions.md..." so the developer can confirm all three were updated.**

---

### Persist: .claude/audit-report.md

**Step 1 — Determine run number:**
- If audit-report.md does not exist: this is Run 1. All "vs Previous" values are "—".
- If it exists: count every line that starts with \`## Run \` (the heading pattern). Call this count N_prev. This entry is Run N_prev + 1. Do NOT guess the run number from dates or entry content — count the headings.
- Read the most recent \`## Run N_prev\` block to extract its scores for the "vs Previous" delta column.

**Step 2 — Append** a new run entry. Do not overwrite or delete previous entries — the file is an append-only history log.

Format for each run entry:
\`\`\`markdown
## Run [N] — <date>

**Governance scorecard** (the audit's only scored concern):

| Category           | Score   | Grade | vs Previous |
|--------------------|---------|-------|-------------|
| Governance Files   | xx/100  | X     | +N / −N / — |
| Governance Accuracy| xx/100  | X     | +N / −N / — |
| Steering Coverage  | xx/100  | X     | +N / −N / — |
| Dead File Risk     | xx/100  | X     | +N / −N / — |
| **OVERALL**        | **xx/100** | **X** | **+N / −N / —** |

**Project maturity** (informational — not part of grade):

| Metric             | Value   | vs Previous |
|--------------------|---------|-------------|
| Test Coverage      | xx/100  | +N / −N / — |

**VERDICT:** ALIGNED / UPDATED — N gaps fixed / ACTION NEEDED
**Gaps fixed this run:** [N] — [list titles, e.g. "architecture.md missing Zone Rules", "constitution.md ghost file entry"]
**Gaps remaining:** [N or "none"]
**Dead code candidates:** [N] (see dead-code.md)
**Open developer actions:** [N] (see developer-actions.md)

---
\`\`\`

> ⚠️ If the developer deleted this file between runs, recreate it starting at Run 1 — prior history cannot be recovered.

---

### Persist: .claude/dead-code.md

**Step 1 — Read the file first** (if it exists). Load all existing entries and their statuses. You need this to avoid adding duplicates and to update statuses for resolved items.

**Step 2 — Update statuses for existing entries:**
- For each row that is still \`[ ] PENDING\`: check whether the file/path still exists on disk based on your Step 4 and Step 10 findings.
  - File no longer exists → mark \`[x] DELETED\` with today's date
  - File still exists and still flagged → leave \`[ ] PENDING\`
  - File still exists but developer marked \`[~] KEPT\` → **preserve the developer's decision, do not change it**
- Do not re-open or re-flag any entry the developer has already marked \`[x]\` or \`[~]\` — those are deliberate decisions.

**Step 3 — Add only NEW candidates** found in Step 10 that are not already listed in any status. If a candidate was removed from the file by the developer without marking it, but the underlying issue still exists in code: **re-add it** — deleting a row does not resolve the issue.

**Step 4 — Write the updated file.**

Format:
\`\`\`markdown
# Dead Code Registry — ${project.appName}

> Resolve by: fixing the code (audit auto-detects and marks DELETED) OR marking [~] KEPT with a reason.
> Simply deleting a row will cause it to reappear next audit run if the issue still exists in code.
> Status: [ ] PENDING · [x] DELETED <date> · [~] KEPT — <reason>

| # | File / Path | Reason flagged | First detected | Status |
|---|-------------|----------------|----------------|--------|
| 1 | src/routes/deprecated.js | Misleading name — actively mounted but named "deprecated" | 2026-04-25 | [ ] PENDING |
| 2 | .claude/hooks/arch-linter.sh | STALE v14.1.0, unwired in settings.json | 2026-04-25 | [ ] PENDING |
\`\`\`

> ⚠️ If the developer deleted this file between runs, recreate it from current scan findings — prior resolution history is lost.

---

### Persist: .claude/developer-actions.md

**Step 1 — Read the file first** (if it exists). Load all existing action items and statuses.

**Step 2 — Auto-resolve items where the underlying issue is now gone.** Check each \`[ ] OPEN\` item against your Step 1-10 findings. Two categories:

**Auto-resolvable** (audit can verify from code observation):
- "Set up test infrastructure" → Step 9 now shows Scenario B or C → mark \`[x] DONE <date>\`
- "File X no longer found / renamed" → Step 4/10 confirms file is gone → mark \`[x] DONE <date>\`
- "Update stale hook to vX" → Step 2 confirms hook now at correct version → mark \`[x] DONE <date>\`
- "Register hook in settings.json" → Step 3 confirms hook now wired → mark \`[x] DONE <date>\`

**Decision-only** (audit cannot verify — only the developer knows):
- Architectural decisions: "Decide whether dual NFT zone is intentional long-term"
- Naming decisions: "Decide on zone naming convention"
- Strategic choices: "Choose test framework (Jest/Mocha/Vitest)"
- For these: if developer marked \`[x] DONE\` or \`[→] DEFERRED\` → **preserve the decision**. If still \`[ ] OPEN\` → leave open, issue still unresolved from audit perspective.

**Step 3 — Add only NEW action items** found this run that are not already listed in any status. If an item was deleted from the file by the developer without marking it, but the underlying issue still exists: **re-add it**.

**Step 4 — Write the updated file.**

Format:
\`\`\`markdown
# Developer Actions — ${project.appName}

> These items require a developer decision — Claude cannot resolve them automatically.
> Resolve by: fixing the underlying issue (audit auto-detects next run) OR marking [x] DONE / [→] DEFERRED.
> Simply deleting a row will cause it to reappear next audit run if the issue still exists.
> Status: [ ] OPEN · [x] DONE <date> · [→] DEFERRED <reason>

| # | Type | Action required | Why it matters | Added | Status |
|---|------|----------------|----------------|-------|--------|
| 1 | auto | Set up test infrastructure (Jest/Mocha + supertest) | SCENARIO A — zero tests, npm test exits with error | 2026-04-25 | [ ] OPEN |
| 2 | decision | Resolve dual NFT implementation intent (legacy + new zone both exist) | Unclear which zone to extend for new NFT work | 2026-04-25 | [ ] OPEN |
| 3 | auto | Rename or remove src/routes/deprecated.js | Misleading name causes Claude to ignore live endpoints | 2026-04-25 | [ ] OPEN |
\`\`\`

> **Type column:** \`auto\` = audit will detect when resolved and mark DONE automatically. \`decision\` = only the developer can mark this done — audit will not auto-close it.

---

## How specs work in ${project.appName}

Code lives in \`${featuresDir}\`. Each feature follows the layer flow: \`${layerFlow}\`

Before writing code, spec:
- **${uiLayer} layer** — inputs, outputs, events the user triggers
- **${logicLayer} layer** — business rules, validation, what can fail
- **${dataLayer} layer** — data shape, queries, external calls

**Task types:** ${taskTypes}

**To activate spec-first workflow:**
\`\`\`bash
${specActivationCmd}
# Fill requirements.md, design.md, tasks.md
# Once specs/<feature>/ exists, check-spec-exists.sh activates on next ai-gov init
\`\`\`

---

## FINAL OUTPUT — completion contract

After the scorecard and the three persist writes, emit on the very last line, exactly:

\`\`\`
AUDIT_COMPLETE: persist-files=<N>/3 steps=<N>/12 verdict=<ALIGNED|UPDATED|ACTION_NEEDED>
\`\`\`

Substitute the actual counts and verdict. No other text after it. The runner uses this line to verify the audit finished; without it the run is treated as incomplete.
`;
}
