import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleCommand } from '../../../utils/knowledge-preamble.js';

function getAssessObservationGuide(c: GovernanceConfig): string {
  const { profile } = c;
  const sourceDir = profile.sourceDir || 'src/';

  const stackSpecific: Record<string, string> = {
    flutter: `- Check \`pubspec.yaml\` for dependency versions and SDK constraints
- Count \`.dart\` files per directory under \`lib/\`
- Check for dual-zone patterns: \`lib/screens/\` (legacy) vs \`lib/features/\` (clean arch)
- Look for generated files: \`.g.dart\`, \`.freezed.dart\`, \`.chopper.dart\` — are source files still present?
- Check \`test/\` structure: mirrors \`lib/\` or flat?`,

    react: `- Check \`package.json\` for dependency versions — note any pinned to major versions 2+ behind current
- Is this Next.js? Check for \`next.config.js/ts\`. If yes: App Router (\`app/\`) or Pages Router (\`pages/\`) or both?
- Count components per directory under \`${sourceDir}\`
- Check for barrel files (\`index.ts\`) that re-export — are all re-exported symbols still used?
- Look for \`__tests__/\` or \`.test.tsx\` files — ratio to source files`,

    angular: `- Check \`package.json\` for Angular version — is it current LTS?
- Is this an Nx workspace? Check for \`nx.json\` or \`libs/\` directory
- Count components: standalone (\`standalone: true\`) vs NgModule-declared
- Check for lazy-loaded routes vs eagerly loaded modules
- Look for \`.spec.ts\` files — ratio to \`.component.ts\` and \`.service.ts\` files`,

    nodejs: `- Check \`package.json\` for dependency versions — note any with "don't upgrade" comments
- Is this a monorepo? Check for \`workspaces\`, \`turbo.json\`, \`nx.json\`
- Check \`tsconfig.json\` for module system (ESM vs CJS) and target version
- Count route/controller files vs service files vs test files
- Look for middleware chain in \`app.ts\`/\`server.ts\` — how many middleware registered?
- Check for \`.env.example\` or config files — how is configuration managed?`,

    python: `- Check \`pyproject.toml\` or \`requirements.txt\` for dependency versions
- Is this FastAPI, Django, or Flask? Check imports in main entry file
- Count router/view files vs service files vs test files
- Check for \`alembic/\` — are migrations up to date?
- Look for \`Dockerfile\` — what Python version is pinned?
- Check for type hints: are function signatures annotated?`,

    kotlin: `- Check \`build.gradle.kts\` for dependency versions and Kotlin version
- Is this Jetpack Compose, XML layouts, or both?
- Is this KMP (Kotlin Multiplatform)? Check for \`commonMain/\`
- Count feature packages and their internal structure
- Check for \`src/test/\` — ratio of test files to source files`,

    swiftui: `- Check \`Package.swift\` or Xcode project for dependency versions
- Count View files vs ViewModel files vs Service files
- Check for test targets — are they populated?
- Look for \`@Observable\` (modern) vs \`ObservableObject\` (legacy) usage`,

    java: `- Check \`pom.xml\` or \`build.gradle\` for dependency versions and Java version
- Is this Spring Boot? What starters are used?
- Is this multi-module? Count modules and their dependencies
- Check for \`src/test/java/\` — ratio of test files to source files
- Look for Lombok usage, MapStruct, or other annotation processors
- Check for \`Dockerfile\` — what JDK version is pinned?`,
  };

  return stackSpecific[c.stack] || `- Read manifest files for dependency versions
- Count source files per directory under \`${sourceDir}\`
- Check for test files — ratio to source files
- Look for configuration and build files`;
}

function getDebtPatterns(c: GovernanceConfig): string {
  const { profile } = c;
  const sourceDir = profile.sourceDir || 'src/';

  return `**Pattern detection — check for each:**

1. **Working Spaghetti** — Core modules with high file sizes (>500 lines), low test coverage, and last-modified dates >6 months ago. Nobody touches them because they work.
   Signal: \`git log --oneline -5 -- ${sourceDir}<core-dir>\` shows no recent commits.

2. **Copy-Paste Expansion** — Multiple files with near-identical structure but subtle differences. Look for 3+ files with the same function signatures but different implementations.
   Signal: Files named \`*-v2\`, \`*-new\`, or directories like \`payments/\`, \`payments-legacy/\`.

3. **Version Pinning Trap** — Dependencies pinned to old major versions with no upgrade path. Check manifest for versions 2+ majors behind current.
   Signal: Comments like "don't upgrade", "breaks if updated", "pinned for compatibility".

4. **Abandoned Abstraction** — Clever infrastructure code (event bus, DSL, meta-programming) that other code routes around instead of through.
   Signal: A module with many exports but few importers. \`git log\` shows original author left (no commits in 12+ months).

5. **Layer Boundary Erosion** — Controllers/routes containing business logic or database queries. Services importing HTTP request/response types.
   Signal: Import statements that cross layer boundaries (e.g., a service file importing \`express.Request\`).`;
}

export function generateAssessCommand(c: GovernanceConfig): string {
  const { profile, project } = c;
  const stackDisplay = profile.stackDisplay;
  const sourceDir = profile.sourceDir || 'src/';
  const _featuresDir = profile.featuresDir || sourceDir;
  const layerFlow = profile.layerFlow;

  const observationGuide = getAssessObservationGuide(c);
  const debtPatterns = getDebtPatterns(c);

  return `# /assess — Refactor vs Rewrite Decision Framework

> **Project:** ${project.appName}
> **Stack:** ${stackDisplay}
> **Layer flow:** ${layerFlow}

---

> ## ⚠️ EXECUTION RULES
>
> 1. **This is a read-only assessment. Do NOT modify any source code.**
> 2. **All 11 documents are REQUIRED. Generate every one.**
> 3. **Measure first, recommend second.** Doc 01 (metrics) must be complete before Doc 02 (decision).
> 4. **Four options exist: Rewrite, Refactor, Strangler Fig, Leave It.** All four are valid outcomes.
> 5. **"Leave It" is not failure.** It is the correct answer when debt is stable and not costing velocity.
> 6. **Output goes to \`docs/assessment/\`.** If the directory exists, this is a re-run — preserve previous metrics.

---

## WHAT THIS ASSESSMENT DOES

Someone asked: "Should we rewrite this?" or "Should we refactor?" or "Why is everything so slow?"

This assessment answers that question with evidence. It reads the actual codebase, measures what is there, identifies which debt patterns apply, and recommends one of four options with a scoring matrix.

By the end, the team has 11 documents that replace opinion with measurement.
${generateKnowledgePreambleCommand()}
## PHASE 1 — MEASURE THE CODEBASE

### Step 1 — Directory map and file metrics

Map every significant directory under \`${sourceDir}\` (or project root if no source directory).

\`\`\`
DIRECTORY MAP
  <path>/    [N] files    largest: [N] lines    last modified: [date]
  <path>/    [N] files    largest: [N] lines    last modified: [date]
  ...

TOTALS
  Total source files:     [N]
  Files > 300 lines:      [N]  (list the top 10 largest)
  Files > 500 lines:      [N]  (list all — these are refactor candidates)
  Empty directories:      [N]  (list all)
\`\`\`

### Step 2 — Dependency health

Read the manifest file (\`package.json\`, \`pom.xml\`, \`pubspec.yaml\`, \`pyproject.toml\`, \`build.gradle\`).

For each dependency:
- Current declared version
- Is it pinned to an exact version or a range?
- Is the major version 2+ behind current? (flag as OUTDATED)
- Is the package EOL or unmaintained? (flag as EOL)
- Are there "don't upgrade" comments in the manifest or lock file?

Stack-specific checks:
${observationGuide}

\`\`\`
DEPENDENCY HEALTH
  Total dependencies:     [N] runtime + [N] dev
  Current (within 1 major): [N]
  Outdated (2+ major behind): [N] — list each
  EOL / unmaintained:     [N] — list each
  Pinned with warnings:   [N] — list each with the warning comment
\`\`\`

### Step 3 — Test coverage assessment

Check for test files and test infrastructure.

**Scenario A — No tests:**
If no test directory, no test files, no test framework in dependencies → Score: 0%.
Note: "No test infrastructure. Cannot safely refactor or rewrite without adding tests first."

**Scenario B — Partial tests:**
Count test files vs source files. For each major module/feature directory, note whether tests exist.
Score: (modules with tests / total modules) × 100.

**Scenario C — Comprehensive tests:**
Spot-check 5 test files. Real assertions or scaffold stubs?
Score: 80-100% based on quality.

\`\`\`
TEST COVERAGE
  Scenario: A / B / C
  Test file count:    [N]
  Source file count:   [N]
  Ratio:              [N]%
  Modules with tests: [list]
  Modules without:    [list]
\`\`\`

### Step 4 — Git archaeology

Run these git commands to understand the codebase history:

\`\`\`bash
# Who has touched the core modules?
git shortlog -sn -- ${sourceDir}

# When were core modules last modified?
git log --format="%ai %s" -1 -- ${sourceDir}<each-major-dir>

# How many authors are active in the last 6 months?
git shortlog -sn --since="6 months ago" -- ${sourceDir}
\`\`\`

Record:
\`\`\`
GIT ARCHAEOLOGY
  Total contributors (all time):    [N]
  Active contributors (6 months):   [N]
  Knowledge concentration:          [top contributor]% of commits
  Core modules last modified:
    <module>: [date] — [N] months ago
    <module>: [date] — [N] months ago
  Modules untouched >6 months:      [list]
  Modules untouched >12 months:     [list] — these are STABLE, not broken
\`\`\`

### Step 5 — Import graph and circular dependencies

Trace import/require statements across source files. Identify:
- Circular dependencies (A imports B, B imports A)
- Hub files (imported by >10 other files — high blast radius for changes)
- Orphan files (not imported by anything — dead code candidates)

\`\`\`
IMPORT GRAPH
  Circular dependencies:  [N] — list each cycle
  Hub files (>10 importers): [list with importer count]
  Orphan files (0 importers): [list] — verify these aren't entry points
\`\`\`

### Step 6 — Debt pattern identification

${debtPatterns}

Record which patterns were found:
\`\`\`
DEBT PATTERNS DETECTED
  [ ] Working Spaghetti — modules: [list]
  [ ] Copy-Paste Expansion — examples: [list]
  [ ] Version Pinning Trap — dependencies: [list]
  [ ] Abandoned Abstraction — modules: [list]
  [ ] Layer Boundary Erosion — violations: [list]
  [ ] None of the above — debt is distributed, not patterned
\`\`\`

---

## PHASE 2 — GENERATE THE ASSESSMENT DOCUMENTS

Using the measurements from Phase 1, generate all 11 documents in \`docs/assessment/\`.

**If \`docs/assessment/01_current_state_analysis.md\` already exists:** This is a re-run. Read the existing file, preserve its metrics as a "Previous" column, and add current metrics as "Current" with a delta column.

### Document 00 — Index

Write \`docs/assessment/00_index.md\`:

\`\`\`markdown
# Assessment — ${project.appName}

**Date:** <today>
**Stack:** ${stackDisplay}
**Assessed by:** Claude Code via /assess

## Documents

| # | Document | Summary |
|---|----------|---------|
| 01 | Current State Analysis | Codebase metrics and measurements |
| 02 | Decision | Recommended option with scoring matrix |
| 03 | Implementation Phases | Phase plan (if proceeding) |
| 04 | Risk Assessment | Risk matrix + rollback plan |
| 05 | Governance | Rules during migration |
| 06 | Effort Estimation | Timeline + cost-benefit |
| 07 | Technical Debt Inventory | Debt items with file:line references |
| 08 | Dependency Impact | Libraries: keep / upgrade / replace |
| 09 | Dead Code Removal | Candidates for safe deletion |
| 10 | Performance Impact | Before/after targets |
| 11 | Migration Compatibility | How old and new coexist |

## Recommendation

> [Filled after Doc 02 is generated]
\`\`\`

### Document 01 — Current State Analysis

Write \`docs/assessment/01_current_state_analysis.md\` using ALL measurements from Phase 1.

Include the full metrics table:

| Metric | Value | Threshold | Signal |
|--------|-------|-----------|--------|
| Total source files | [from Step 1] | — | Baseline |
| Files > 300 lines | [from Step 1] | > 20 | Refactor candidates |
| Test coverage | [from Step 3] | < 40% | No safety net |
| Circular dependencies | [from Step 5] | > 3 | Architecture problem |
| Last modified (core) | [from Step 4] | > 6 months | Stable — don't touch |
| Active contributors | [from Step 4] | < 25% of team | Knowledge cliff |
| Outdated dependencies | [from Step 2] | > 30% | Upgrade pressure |
| EOL dependencies | [from Step 2] | > 0 | Forced migration |
| Hub files (>10 importers) | [from Step 5] | > 5 | High blast radius |
| Orphan files | [from Step 5] | > 0 | Dead code |

Include the debt patterns section from Step 6.

**If this is a re-run**, add Previous and Delta columns.

### Document 02 — Decision

Write \`docs/assessment/02_decision.md\` with the scoring matrix.

**Score each dimension (1-4):**

| Dimension | Score | Evidence |
|-----------|:-----:|----------|
| Test coverage | [1-4] | [from Step 3: <10%=1, 10-30%=2, >40%=3, >70%=4] |
| Architecture | [1-4] | [from Step 6 patterns: sound+stable=1, limiting=2, messy=3, wrong=4] |
| Dependency health | [1-4] | [from Step 2: working=1, mixed=2, upgradeable=3, EOL=4] |
| Team knowledge | [1-4] | [from Step 4: stable=1, mixed=2, understood=3, lost=4] |
| Business pressure | [1-4] | **← HUMAN INPUT REQUIRED** |
| Codebase scope | [1-4] | [from Step 1: >100K=1, 50-100K=2, 20-50K=3, <20K=4] |
| Stability | [1-4] | [from Step 4: untouched=1, mixed=2, active=3, patched=4] |

**Scoring rules:**

1. **Veto: Test coverage.** If score = 1, recommendation cannot be Rewrite or Refactor.
2. **Majority wins.** Most scores in one column → that option.
3. **Ties → lower risk wins.** Leave It > Strangler > Refactor > Rewrite.
4. **Three-way split → Strangler Fig.** Only option with safe exit ramp.

**Red flags:**
- Test coverage = 1 + Rewrite → BLOCKED. Add tests first.
- Codebase scope = 1 + Rewrite → BLOCKED. Use Strangler Fig.
- Refactor estimated > 6 months → It's a rewrite. Re-score.

**Mark "Business pressure" as:**
\`\`\`
<!-- HUMAN INPUT REQUIRED -->
Business pressure: [ ] No complaints (1) / [ ] Features blocked (2) / [ ] Slowing delivery (3) / [ ] Platform change needed (4)
<!-- /HUMAN -->
\`\`\`

**State the recommendation clearly:**
\`\`\`
RECOMMENDATION: [Rewrite / Refactor / Strangler Fig / Leave It]
CONFIDENCE: [High / Medium / Low — Low if Business pressure not yet scored]
\`\`\`

### Document 03 — Implementation Phases

Write \`docs/assessment/03_implementation_phases.md\`.

**If recommendation is Leave It:** Write a short doc: "Decision: Leave It. Review date: [6 months from today]. Triggers to reassess: [list from Doc 01 thresholds]."

**If recommendation is Refactor:**
- Phase 0: Add tests to critical paths (if coverage < 40%)
- Phase 1-N: One phase per debt pattern identified in Step 6, ordered by impact
- Each phase: scope, files affected, deployable checkpoint, success metric

**If recommendation is Strangler Fig:**
- Phase 0: Define routing between old and new
- Phase 1: First module to migrate (lowest risk)
- Phase 2-N: Subsequent modules ordered by dependency graph
- Each phase: what stays old, what moves to new, rollback plan

**If recommendation is Rewrite:**
- Phase 0: Test coverage of current system (mandatory)
- Phase 1: Strangler boundary — old and new run side by side
- Phase 2-N: Feature-by-feature migration
- Each phase: rollback plan, feature parity checkpoint

### Document 04 — Risk Assessment

Write \`docs/assessment/04_risk_assessment.md\` with a risk matrix per phase from Doc 03.

| Risk | Likelihood | Impact | Mitigation |
|------|:----------:|:------:|------------|
| [risk] | H/M/L | H/M/L | [mitigation] |

### Document 05 — Governance

Write \`docs/assessment/05_governance.md\` with rules for AI agents and developers during the migration.

Include:
- Which files/modules are frozen (don't touch during migration)
- Which patterns to follow in new code vs old code
- How to handle the boundary between old and new
- Review requirements for migration PRs

### Document 06 — Effort Estimation

Write \`docs/assessment/06_effort_estimation.md\`.

Based on Phase 1 measurements:
- Estimated duration per phase
- Team size required
- Cost-benefit: cost of doing this vs cost of not doing this
- Break-even point: when does the investment pay off?

### Document 07 — Technical Debt Inventory

Write \`docs/assessment/07_technical_debt_inventory.md\`.

For each debt item identified in Phase 1:
\`\`\`
| # | File:Line | Debt Type | Severity | Pattern | Effort to Fix |
|---|-----------|-----------|:--------:|---------|:-------------:|
| 1 | src/payment/handler.ts:45 | Layer violation | High | Boundary Erosion | 2h |
\`\`\`

### Document 08 — Dependency Impact

Write \`docs/assessment/08_dependency_impact.md\` using Step 2 data.

| Dependency | Current | Latest | Action | Breaking Changes | Effort |
|------------|---------|--------|--------|-----------------|:------:|
| [name] | [ver] | [ver] | Keep / Upgrade / Replace / Remove | [notes] | [est] |

### Document 09 — Dead Code Removal

Write \`docs/assessment/09_dead_code_removal.md\` using Step 5 orphan files.

**⚠️ Every candidate needs human verification before deletion.**

| # | File | Reason | Confidence | Detection Method | Status |
|---|------|--------|:----------:|-----------------|--------|
| 1 | [path] | [reason] | High/Med/Low | [method] | [ ] PENDING |

> **Do not bulk-delete this list.** Dynamic imports, reflection, config-driven loading, and convention-based frameworks (Spring scanning, Angular lazy routes) can make live code appear unused. Review each item. When in doubt, leave it.

### Document 10 — Performance Impact

Write \`docs/assessment/10_performance_impact.md\`.

| Metric | Current (observed) | Target (after) | How to Measure |
|--------|:------------------:|:--------------:|----------------|
| Build time | [from Step 1 or N/A] | [target] | \`time ${profile.buildCmd}\` |
| Test suite time | [observed or N/A] | [target] | \`time ${profile.testCmd}\` |
| Bundle size | [if frontend, observed or N/A] | [target] | [tool] |

### Document 11 — Migration Compatibility

Write \`docs/assessment/11_migration_compatibility.md\`.

**If Leave It:** Not applicable — no migration.

**If Refactor/Strangler/Rewrite:**
- How do old and new coexist during transition?
- API compatibility: versioning strategy
- Data migration: schema changes, backfill strategy
- Feature flags: what flags are needed?
- Rollback: how to revert each phase independently

---

## PHASE 3 — SUMMARY

### Step 7 — Update index and present summary

Update \`docs/assessment/00_index.md\` with the recommendation from Doc 02.

Present the summary:

\`\`\`
━━━ ASSESSMENT COMPLETE — ${project.appName} ━━━

  Recommendation:  [Rewrite / Refactor / Strangler Fig / Leave It]
  Confidence:      [High / Medium / Low]
  Key metrics:
    Files > 300 lines:    [N]
    Test coverage:        [scenario + %]
    Circular deps:        [N]
    Outdated deps:        [N]
    Active contributors:  [N] of [total]
    Debt patterns:        [list detected patterns]

  Documents generated: docs/assessment/ (11 files)

  Next steps:
    1. Review 02_decision.md — fill in Business Pressure score
    2. Review 09_dead_code_removal.md — verify candidates before deletion
    3. Share docs/assessment/ with the team for decision review
    4. Decision meeting: 02_decision.md scoring matrix as the agenda
\`\`\`

---

## THE HONEST TRUTHS

These are embedded in the generated docs so teams see them at decision time:

1. **Most proposed rewrites are refactors in disguise.** Same domain model, same business rules, same user flows = refactor, not rewrite.
2. **Rewrites take 2-3x longer than estimated. Always.**
3. **"The code is ugly" is not a reason to rewrite.** "The code can't support the next 3 features we need" is.
4. **Refactoring without tests is surgery without anesthesia.** Add tests first.
5. **The safest first move:** Delete dead code (Doc 09), upgrade safe deps (Doc 08), add tests. Then reassess.
6. **Leave It is not failure.** It is a conscious decision. Set a review date and move on.
`;
}
