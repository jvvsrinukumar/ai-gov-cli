# Changelog

All notable changes to the AI Governance Framework.

## [15.1.0] — 2026-04-25

### Changed — /audit: Complete steering file coverage + persistent audit records

#### Step 6 gap analysis now checks ALL steering files (was: 4 files, now: 9 files)
- **Before**: Step 6 explicitly checked architecture.md, coding-standards.md, naming-conventions.md, workflow.md only — constitution.md, ai-usage-policy.md, spec-first-workflow.md, feature-readme.md, prompt-templates.md were silently skipped
- **After**: Every steering file has explicit per-file check instructions. Ghost file entries (e.g. `src/routes/index.ts` in a JS project), contradictory layer flow rules in constitution.md, and wrong FEATURES_DIR in spec-first-workflow.md will now be caught on first run instead of second
- **Root cause that exposed this**: Real-world audit of bigbeeai (Node.js) — first run missed constitution.md contradiction ("Route → Model always" vs "new features use Controller → Service → Repo") and ghost `src/routes/index.ts` entry. Second run caught them. After this fix, first run catches them.
- **New per-file checks added**:
  - **constitution.md**: layer flow vs dual-zone reality, ghost files in high-risk list, internal contradictions between sections
  - **ai-usage-policy.md**: new feature rules vs actual architecture, ghost file entries
  - **spec-first-workflow.md**: FEATURES_DIR and SOURCE_DIR path accuracy
  - **feature-readme.md**: directory path references
  - **prompt-templates.md**: path and layer name consistency

#### Three persistent audit record files (new — written/updated after every run)
- **`.claude/audit-report.md`** — append-only run history. Each run adds one entry: scorecard table with "vs Previous" delta column, gaps fixed this run, verdict. On second run, developer sees "Governance Accuracy: 20 → 100 (+80)" rather than re-reading 12 steps to understand progress.
- **`.claude/dead-code.md`** — dead code registry with status tracking. Columns: File, Reason flagged, First detected, Status (`[ ] PENDING` / `[x] DELETED` / `[~] KEPT — reason`). Second run only adds NEW candidates — preserves developer-updated statuses. Auto-marks [x] DELETED if file no longer exists.
- **`.claude/developer-actions.md`** — developer decision checklist. Items that Claude cannot resolve automatically (test setup, zone architecture decisions, file renames, stale custom hooks). Second run adds only NEW items — does not reset statuses of open/resolved items. Marks [x] DONE if issue no longer applicable.

#### Behaviour on second run (governance already aligned)
- Steps 1-6 confirm governance accurate quickly (no verbose gap output)
- Step 11: "Governance was accurate. No changes needed."
- Step 12: scorecard shows score improvement vs audit-report.md previous entry
- Persistent files updated: only new dead code and action items appended
- VERDICT: ALIGNED (if no new issues) or ACTION NEEDED (if dead code/specs/tests still unresolved)

## [15.0.0] — 2026-04-25

### Changed — /audit Complete Rewrite (governance accuracy, not code quality)

#### New audit philosophy
- **Was**: scored code against fixed legacy/modern patterns (LEGACY = bad, MODERN = good) — penalised projects for not following a prescribed architecture
- **Now**: discovers what the project actually IS, compares to `.claude/steering/`, fixes every mismatch — no quality judgements, no pattern scoring

#### New 6-phase structure
- **Phase 1** (Steps 1-3): Governance inventory — files, hooks, settings wiring
- **Phase 2** (Steps 4-5): Project discovery — stack-aware directory map + deep code observation, compiled into PROJECT REALITY REPORT
- **Phase 3** (Step 6): Gap analysis — compare each `.claude/steering/` file to PROJECT REALITY REPORT; record every mismatch with "what Claude would have done wrong"
- **Phase 4** (Step 7): Fix governance — update steering files to match reality directly; add Zone Rules for multi-zone projects
- **Phase 5** (Steps 8-10): Spec coverage (informational), test coverage (3 scenarios), dead file scan
- **Phase 6** (Steps 11-12): Gap summary with before/after/impact/fix blocks, final accuracy scorecard

#### Observation questions — per stack, not generic
- **React**: Next.js App Router vs Pages Router detection; `'use client'` boundary mapping; orphaned Redux slices / Zustand stores; SSR vs client-side data fetching zone split
- **Angular**: Angular version (14 vs 17+ — Signals only exist in 17+); Nx workspace detection (features live in `libs/`, not `src/app/`); lazy loading route map
- **Node.js**: Monorepo detection (Turborepo/Nx/workspaces) first; middleware chain observation; error handling pattern; ESM vs CJS re-verification from `tsconfig.json`
- **Python**: Framework detection (FastAPI vs Django — observation questions adapt); `Depends()` injection pattern; Celery/background tasks; Alembic migration check; `pytest-asyncio` warning
- **Kotlin**: Compose vs XML UI split asked first (changes everything); KMP structure; sealed class state representation; `StandardTestDispatcher` (not deprecated `TestCoroutineDispatcher`)
- **Flutter**: Unchanged — already production-grade

#### Dead code signals — per stack, verifiable
- **React**: Barrel `index.ts` re-exporting deleted files; unused Redux slices (not imported anywhere); unused Zustand stores; Next.js Pages Router unlinked pages
- **Angular**: NgModule orphan check reads every `@NgModule declarations` array; Nx unused library detection via tsconfig paths
- **Node.js**: Removed unverifiable "route files not mounted" check; added service files not imported anywhere; unused NestJS `@Module()` with empty arrays
- **Python**: Django `urls.py` not included from root; Alembic migrations referencing deleted model columns
- **Kotlin**: Removed unverifiable "Retrofit endpoints not called"; added XML layout orphans during Compose migration; `@HiltViewModel` not injected anywhere
- **All stacks**: `_old`, `_backup`, `_deprecated`, `_v1`, `_copy` filename patterns

#### New scorecard (5 scored categories — Spec Coverage removed from score)
- **Governance Files** (0-100): steering files present + hooks at correct version + settings.json wired
- **Governance Accuracy** (0-100): how accurately `.claude/` described the project BEFORE this audit — deduct 15 per significant gap
- **Steering Coverage** (0-100): does steering cover all significant directories? — deduct 10 per undocumented directory with >10 files
- **Test Coverage** (0-100): SCENARIO A (0) / SCENARIO B (proportional) / SCENARIO C (90-100)
- **Dead File Risk** (0-100): start 100, deduct 5 per dead code candidate
- **Spec Coverage**: informational only — listed separately, not scored. "Reflects developer process maturity, not governance accuracy."

#### VERDICT types changed
- **ALIGNED**: governance was accurate before this audit, no changes needed
- **UPDATED — N gaps fixed**: most common outcome — steering files now accurately describe the project
- **ACTION NEEDED**: governance updated, but developer decisions required (missing specs, no test infra, dead files to confirm)

#### Other improvements
- **Mandatory execution banner**: prevents Claude stopping early after clean Steps 1-3 ("Governance scaffolding present — proceeding to code discovery (Step 4)")
- **Step 4 stack-aware directory map**: different root paths for Flutter/React/Angular/Python/Kotlin/SwiftUI + monorepo handling
- **Step 6 adds workflow.md check**: `FEATURES_DIR` and `SOURCE_DIR` accuracy — if wrong, Claude creates every new feature in the wrong path
- **Step 7 Zone Rules**: includes React Next.js App+Pages Router zone example alongside Flutter example
- **PROJECT REALITY REPORT**: added `Framework/Router` field; `ORM/Schema` replaces `Models`; `File size range` with frontend/backend thresholds
- **Init-detected header**: marked as "(baked at init time — Step 5 will re-discover actual state)" to avoid confusion

## [14.3.0] — 2026-04-25

### Added

#### Legacy Zone Detection (init-time, all stacks)
- **Flutter**: detects `lib/screens/`, `lib/pages/`, `lib/models/` + `lib/services/` alongside `lib/features/` — flags as dual-mode migration project
- **React**: scans `src/components/` for class components (`extends Component`) alongside `src/features/` — counts ratio, flags hybrid if both exist
- **Angular**: detects `app.module.ts` (NgModule) alongside `app.config.ts` (standalone) — NgModule-only = legacy, both = migration in progress
- **ScanResult fields**: `hasLegacyZones`, `legacyZones[]`, `cleanZones[]`, `legacyZoneNote` — baked into steering at init time
- **architecture.md Zone Rules section**: auto-generated when legacy zones detected — per-zone table with "match existing" vs "follow layer flow" rules
- **coding-standards.ts Zone Rules section**: companion section showing file conventions per zone
- **Test fixture**: `tests/fixtures/flutter-legacy/` — dual-mode Flutter project for scanner coverage
- **Test count**: 110 tests (was 103) — 7 new tests across scanner + generator suites

#### Governance Slash Commands (5 commands)
- **`/new-feature [name]`** — plan mode + 3-gate spec approval (requirements → design → tasks) + phase-selective implementation. Claude calls `EnterPlanMode` immediately — zero file writes until all 3 gates approved and `ExitPlanMode` called
- **`/edit-feature [name]`** — same 3-gate flow for updating existing features; preserves all existing checked tasks and spec content exactly
- **`/fix [description]`** — fast path: read file → state root cause → confirm scope if >3 files → minimum change fix
- **`/refactor [scope]`** — impact file list approval gate → tests before → refactor → tests after
- **`/hotfix [issue]`** — immediate fix, no gates, mandatory post-fix summary block
- **`require-task-type.sh`** — `UserPromptSubmit` hook that detects unclassified development task requests and recommends the correct command. Default: warn mode. Configurable to block mode (change `exit 0` → `exit 1`)
- **`docs/cli_governance_commands.md`** — full reference doc: plan mode mechanics, 3-gate flow, phase-selective implementation, stack-specific phase breakdown (6 stacks), enforcement chain diagram, FAQ

#### /audit Command — 12-Step Project Truth Check
- **Self-healing**: Claude directly updates `.claude/steering/` files in Step 11 — no `ai-gov init --overwrite` round-trip needed
- **Rerunnable**: safe to run after every sprint; health scorecard improves as issues are fixed
- **12-step workflow**:
  1. Governance file inventory (all 8 steering files + settings.json + hooks)
  2. Stack detection accuracy (re-scan vs. baked values)
  3. Steering file content review (stale values, missing fields)
  4. Hook version check (current vs. installed version)
  5. Spec coverage (features with code but no spec)
  6. Deep code scan (reads actual files — counts BLoC vs setState, class vs functional, etc.)
  7. Feature folder structure + test coverage (per-feature breakdown)
  8. Directory accuracy (did scanner pick the right paths?)
  9. Dead code detection (unreachable exports, orphaned files, unused DI tokens)
  10. New feature blueprint (example correct structure for next feature)
  11. Steering self-update (Claude writes accurate content to `.claude/steering/` directly)
  12. Final health scorecard report

#### 6-Category Health Scorecard
- **Governance** (0-100): steering files present + hook versions + settings.json
- **Architecture** (0-100): layer violations, god files, fat components
- **Code Patterns** (0-100): % of code following detected architecture pattern
- **Feature Structure** (0-100): feature folders with spec + README + proper layer split
- **Test Coverage** (0-100): proportional to covered features/layers
- **Dead Code** (0-100): penalty per orphaned file/export
- Each category scored A (90-100) / B (75-89) / C (60-74) / D (<60). Overall = average.

#### 3-Scenario Test Coverage Analysis
- **SCENARIO A** (no tests): score 0, per-stack setup instructions (flutter test / vitest / pytest / etc.)
- **SCENARIO B** (partial): proportional score, per-feature/per-layer breakdown showing gaps
- **SCENARIO C** (comprehensive): checks for scaffold-only specs (describe blocks with no assertions)

#### VERDICT System
- **PASS**: all 6 categories B or above
- **PASS WITH UPDATES**: steering files updated by Step 11, no code changes needed
- **ACTION NEEDED**: code-level issues found — specific remediation steps listed per finding
- `ai-gov init --overwrite` only suggested when hook versions are stale (not for code pattern gaps)

#### Existing 14.3.0 Features (previously released)
- **check-secrets.sh hook** — blocks AWS keys (AKIA pattern), credential-named variables, base64 config values
- **Edit Feature task type** — 5th task type, 10-step workflow (read existing spec → update → STOP → implement new tasks only)
- **SPEC_FIRST_ENABLED opt-out** — universal for all stacks
- **Conditional test rule** — stack-aware setup hints per stack when no test runner detected
- **Mixed-arch dual-mode hard rules** — Node.js projects with both routes/ and controllers/
- **pkg_has() jq-based parsing** — actual dependency section parsing (no false positives)
- **NestJS @Module() verification** — confirms decorators in source, not just package.json
- **DI detection expanded** — tsyringe, inversify, typedi for non-NestJS Node.js projects
- **ESM/CJS from tsconfig.json** — `module` field as source of truth
- **Swagger style detection** — 6 styles: decorators, jsdoc, tsoa, fastify-schema, manual, static-file
- **Architecture recursive depth** — scans up to 6 levels under src/ (was 1-2)
- **Entry point from package.json main** — added to high-risk files list

### Fixed
- check-secrets HOOK_VERSION now dynamic (was hardcoded in single-quoted heredoc)
- Node.js-specific spec-first check replaced with universal check in scanners/index.ts
- Test rule now shows stack-specific setup hints instead of hardcoded "npm install jest"
- `detectedLogger` field name corrected in python scanner (was `detectedLogging`)

## [14.2.0] — 2026-04-23

### Added
- Edit Feature task type (classification, steering table, workflow, templates, checklist)
- SPEC_FIRST_ENABLED universal for all stacks (moved from Node.js only)
- check-secrets hook (credential leak prevention)
- Conditional test rule (stack-aware)
- Mixed-arch dual-mode rules (Node.js)
- DETECTED_NODE_LAYOUT (flat-by-layer vs feature-per-dir)

### Fixed
- check-secrets heredoc: HOOK_VERSION now dynamic
- Test rule: stack-aware messages with actual TEST_CMD

## [14.1.0] — 2026-04-22

### Fixed
- **Windows**: bash prefix on ALL 13 settings.json hook commands
- **Windows**: CLAUDE_HOOK_EVENT env var → $1 argument for extensions
- **Windows**: load-extensions.sh uses bash for sub-extension execution
- **Python**: FEATURES_DIR scans actual depth (v1/endpoints, v1, etc.)
- **Python**: architecture.md, type naming, design files use detected FEATURES_DIR
- **All hooks**: session-continuity, check-feature-readme, check-consistency match both FEATURES_DIR and SOURCE_DIR paths
- tasks.md Phase 5: "API Layer" for backend, "UI" for frontend
- design.md: fixed blank row in layer mapping table
- spec-first-workflow.md: fixed step 7 gap when no scaffold tool
- settings.json: merged duplicate check-spec-exists registration
- hooks/README.md: corrected counts, triggers, Windows note

## [14.0.0] — 2026-04-21

### Added
- **200-line file size rule** — frontend stacks (Flutter, Kotlin, React, Angular) enforce max 200 lines per source file; two-tier: 200-300 warn, 300+ block; backend exempt
- **Spec enforcement widened** — check-spec-exists.sh catches ALL source file writes, not just FEATURES_DIR
- **tasks.md required** — validate_spec() checks tasks.md exists with actual task items
- **design.md placeholders checked** — catches _replace_, _describe_, _e.g. in design.md
- **Actionable block messages** — 5-step numbered action plan when hook blocks
- **CLAUDE.md imperative tone** — "You MUST follow these rules" replaces documentation style
- **spec-first-workflow.md STOP gates** — explicit pause points, "What Complete Means", "Common Mistakes"
- **constitution.md imperative tone** — "You must never violate these"

## [13.0.0] — 2026-04-20

### Added
- **Spec freshness detection** — warns when code is >24h newer than spec
- **Hook versioning** — `# HOOK_VERSION=X.Y.Z` in every hook, `--update-hooks` for selective updates
- **Monorepo support** — Node.js per-package governance, monorepo.md steering file
- **Custom hooks** — custom-hooks.json (never overwritten), auto-merged into settings.json
- **Dry-run diff** — `--dry-run` shows unified diff of what would change

## [10.0.0] — 2026-04-18

### Added
- Initial release — 6 stack scanners, 9 hooks, 8 steering files, spec templates, extensions system
- Full governance: steering, hooks, extensions, spec templates
- All foundation code adapts to project scan results
