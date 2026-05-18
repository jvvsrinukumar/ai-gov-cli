# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [20.0.0] — 2026-05-18

### Production-Ready Release — Review Loop Closed

v20 is defined by 8 acceptance criteria (AC-1 through AC-8), mechanically verified by `/doctor production-ready`. Once it says PASSING, the framework ships and further audits are informational only.

### Added

- **`src/schemas/governance-state.schema.ts`** — canonical JSON schema (v1) shared by audit, assess, backlog, and doctor. TypeScript types + JSON Schema Draft 07. Includes: `AuditRun`, `DeadCodeEntry`, `DeveloperAction`, `AssessmentState`, `BacklogStory`, `Assumption`, `ParseGap`, `AcceptanceCriterion`, `ScannerSnapshot` with confidence fields. (AC-2)
- **`src/utils/state-writer.ts`** — writes initial `governance-state.json` at init time. Preserves existing audit runs, dead code, and developer actions on re-init. Refreshes scanner snapshot and project metadata only.
- **`src/utils/state-migration.ts`** — lenient markdown → JSON migration. Reads v19 `audit-report.md`, `dead-code.md`, `developer-actions.md`, parses tables and run blocks, hydrates JSON. Anything unparseable becomes a `parseGap` — never a thrown error. Markdown files are never deleted. (AC-2)
- **`src/commands/migrate-state.ts`** — `ai-gov migrate-state` CLI command. Idempotent, non-destructive. Requires `--force` to overwrite existing state file.
- **`src/commands/doctor-production-ready.ts`** — `/doctor production-ready` mechanical AC verification. Evaluates 8 acceptance criteria against project state. Returns exactly PASSING or BLOCKING with the item list. No prose verdicts. (AC-5)
- **`src/utils/scanner-snapshot.ts`** — wraps 15 scanner fields (stateFramework, diFramework, ORM, testFramework, linter, formatter, router, httpClient, archPattern, serviceStyle, featuresDir, sourceDir, layerNames, localStorageName, scaffoldTool) with `{ value, confidence, source }`. Confidence: high (manifest/file-pattern), medium (heuristic), low (profile default), unknown (blank). Includes `diffSnapshot()` for structured audit deltas. (AC-7)
- **`src/generators/assess-content.ts`** — shared assess prompt body consumed by both Claude Code (`/assess`) and Kiro (`workflow-assess`). Single source of truth — drift between agents becomes a CI failure. (AC-1, AC-3)
- **`src/generators/backlog-content.ts`** — shared backlog prompt body consumed by both agents. Same drift-prevention pattern. (AC-1, AC-4)
- **`src/agents/kiro/hooks/workflow-assess.ts`** — Kiro workflow hook for assess. Wraps shared content with `.kiro/` paths and Kiro-native JSON envelope. Registered in hooks/index.ts. (AC-1)
- **`src/agents/kiro/hooks/workflow-backlog.ts`** — Kiro workflow hook for backlog. Same pattern. (AC-1)
- **`tests/audit.test.ts`** — 49 assertions covering prompt structure, scorecard surgery, DO NOT STOP collapse, completion contract, Kiro parity, and cross-stack generation. (AC-6)
- **`tests/assess.test.ts`** — 51 assertions covering structure, Business Pressure rubric signals, ASSUMPTIONS block schema, completion contract, no human-input gates, Kiro parity, and cross-stack. (AC-6)
- **`tests/doctor.test.ts`** — 43 assertions covering each AC check (PASSING and BLOCKING conditions), overall verdict logic, exit code behavior. (AC-6)
- **Completion contracts** — audit emits `AUDIT_COMPLETE: persist-files=N/3 steps=N/12 verdict=<V>`, assess emits `ASSESS_COMPLETE: docs-written=N/11 recommendation=<R> confidence=<C>`, backlog emits `BACKLOG_COMPLETE: stories=N skip-list=M p1=N p2=N p3=N`. Runner greps for these — absent = run incomplete. (AC-8)

### Changed

- **`/assess` Business Pressure** — replaced `<!-- HUMAN INPUT REQUIRED -->` placeholder with evidence-based rubric: 6 observable signals (bug commits, aged developer-actions, contributor churn, EOL deps, revert/hotfix density, core staleness), composite → bucket → score 1-4. Confidence = High (≥3 signals) / Medium (2) / Low (≤1). Pipeline never blocks. Low-confidence outputs flagged `reviewRequired: true`. (AC-3)
- **`/backlog` priority derivation** — replaced `⚠️ HUMAN INPUT NEEDED` priority checklist with computed priority: `0.4 × debt_severity + 0.3 × dependency_count + 0.3 × commit_frequency`. Buckets: ≥2.4→P1, 1.5-2.3→P2, <1.5→P3. Skip-list reads developer-actions.md (excludes KEPT, surfaces OPEN). Net-new features default to "parity rebuild" with logged assumption. (AC-4)
- **`/audit` scorecard surgery** — Test Coverage split out of OVERALL into separate PROJECT MATURITY block (informational only). OVERALL is now the mean of 4 governance categories. Greenfield projects stop being penalized for having no tests.
- **`/audit` DO NOT STOP collapse** — reduced from 10× repetition to one canonical execution rule (#9) + one completion contract line. Stronger signal with less token cost.
- **`/audit` completion contract** — Rule #12 added. Final line must be `AUDIT_COMPLETE: persist-files=<N>/3 steps=<N>/12 verdict=<ALIGNED|UPDATED|ACTION_NEEDED>`.
- **Kiro hooks/index.ts** — registered `generateWorkflowAssess` and `generateWorkflowBacklog`. Both write `.kiro/hooks/workflow-assess.kiro.hook` and `workflow-backlog.kiro.hook`.
- **`package.json` version** bumped to 20.0.0.

### Migration

- **Existing v19 projects:** Run `npx ai-gov migrate-state` to hydrate `governance-state.json` from existing markdown artifacts. Non-destructive — markdown files preserved as rendered views.
- **Existing v19 projects (alternative):** Run `npx ai-gov init` — the state-writer detects absence and creates a fresh state file. Existing audit history from markdown is not auto-migrated; use `migrate-state` for that.
- **Scoring change:** If your project previously scored poorly on OVERALL due to low test coverage, your governance grade will likely improve in v20 (Test Coverage no longer penalizes the governance score).

### Deferred to v21 (Non-Goals)

- Knowledge → audit feedback loop
- Workspace-level Kiro commands
- Dead-code visual dedup across audit/assess
- Full ScannerSnapshot confidence wrapping for remaining 55+ ScanResult fields
- Prompt-token optimization beyond Phase D
- Real-time `/doctor` daemon
- Localized prompts
- Cursor/Aider/other agent support

---

## [19.1.0] — 2026-05-18

### Added — Knowledge Hub hardening

- **Pre-commit guard on `[CONFIRMED]` entries.** New `knowledge-confirmed.sh` check (wired into pre-commit, default block). Blocks commits that remove `[CONFIRMED]` lines from `knowledge/*.md`. Skips files with no `HEAD` version (first-time adds). Bypass: `AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m '<message>'` — env var is the only reliable mechanism at pre-commit time, because git writes the commit message after pre-commit runs.
- **Mechanical drift detection.** `/tech-knowledge`, `/product-knowledge`, and the `/audit` knowledge-health section now run `git diff --stat OLD_HASH..HEAD` against the paths covered by each knowledge file. Thresholds: > 10 files changed OR > 200 lines delta → flagged as significant drift. Replaces the prior fuzzy "many commits passed" judgment.
- **`/fix` silent-capture DO-NOT-CAPTURE blocklist.** Default is now "no business rules extracted." Captures only when the root cause is a misunderstood requirement, an unenforced constraint, or a missing role check. Explicit blocklist covers null checks, off-by-one, typo, missing await, type coercion, wrong import, test-only change, log/format change, lint cleanup, dependency upgrade, config tweak.
- **Shared HTML export scaffold.** New `src/utils/knowledge-html-template.ts` exposes `KNOWLEDGE_HTML_CSS` and `wrapKnowledgePage()`. Both `/tech-knowledge` and `/product-knowledge` source CSS from the shared util — single source of truth.
- **Slug normalization util.** New `src/utils/knowledge-slug.ts` exports `normalizeSlug()` — single source of truth for the lowercase / hyphenate / strip-punctuation / cap-at-40 rule.
- **Dynamic onboard listing.** `npx ai-gov onboard` now groups every `knowledge/*.md` file by prefix instead of hard-coding `tech-` and `product-`. New file types (e.g. `decision-*`, `runbook-*`) appear automatically.
- **Honest Mermaid wording.** HTML export now says "requires internet to render diagrams" instead of "self-contained" — the export depends on the Mermaid CDN.

### Changed

- `VERSION` and `HOOK_VERSION` bumped to `19.1.0`. CI install steps for GitHub Actions, GitLab CI, and Bitbucket Pipelines reference `ai-gov@19.1.0`.

### Deferred to v19.2

- `/knowledge dedupe` for `merge=union` duplicates — waiting for real-world accumulation evidence.
- `slugHintsFromScan()` — waiting for evidence of cross-capture slug drift.
- `--vendor-mermaid` flag for offline HTML export.

---

## [17.2.0] — 2026-05-07

### Added — Knowledge Hub (5 phases)

- **Phase 1 — Extract:** `/tech-knowledge` and `/product-knowledge` slash commands (Claude Code) + `workflow-tech-knowledge` and `workflow-product-knowledge` hooks (Kiro). On-demand codebase extraction to `knowledge/tech-[scope].md` and `knowledge/product-[scope].md`. Stack-adaptive reading strategies for Angular, React, Flutter, Kotlin, SwiftUI, Python, Java, NestJS, and Node.js. All entries tagged `[INFERRED]` until human-promoted.
- **Phase 2 — Context Builder:** Knowledge preamble injected into `/new-feature`, `/edit-feature`, `/fix`, `/explore`, `/refactor`, `/assess` (Claude Code) and equivalent Kiro workflow hooks. AI reads `knowledge/` before acting — slug-matched from `$ARGUMENTS` with overview fallback.
- **Phase 3 — Silent Capture:** After Gate 1 approval in `/new-feature` and `/edit-feature`, AI silently extracts `[CONFIRMED]` entries from approved requirements and merges them into `knowledge/product-[slug].md`. Merge rules: `[CONFIRMED]` entries never overwritten; `[INFERRED]` entries upgraded when confirmed; new entries appended.
- **Phase 4 — Drift Detection:** `/audit` and `workflow-audit` include a Knowledge Health Check section. Classifies each entry as Current / `[STALE]` / `[UNVERIFIABLE]`. Read-only — reports only, never modifies knowledge files.
- **Phase 5 — Conflict Detection:** `/detect-conflicts` (Claude Code) and `workflow-detect-conflicts` (Kiro). Cross-feature conflict detection across all `knowledge/product-*.md` files. Writes decision inbox to `knowledge/conflicts/[slug-a]-vs-[slug-b].md`. Four conflict types: permission, domain object, business state, flow assumption. Conservative threshold — only flags clear contradictions. Resolution tracking with `[x] Resolved` markers.

### Added — Documentation
- `docs/knowledge_hub_guide.md` — shipped guide with full examples for Claude Code and Kiro, confidence model reference, team workflow patterns, stack-specific examples.

---

## [17.1.4] — 2026-05-07

### Changed
- **Architecture check now enabled by default** — safe because the hook exits silently (exit 0) when no `arch-layer:` lines exist in `architecture.md`. Projects without architecture docs see zero false positives.
- **Architecture hook fully data-driven** — rewrote `checks/architecture.ts` to parse `arch-layer:` and `arch-rule:` lines from steering dynamically. Zero hardcoded layer names or path patterns. Supports three rule types: `cannot-import`, `no-network`, `no-framework`.

### Added
- **`generateArchLayersBlock()` helper** in `architecture.ts` — emits a machine-readable `## Hook Data — Architecture Layers` section appended to every generated `architecture.md`. Stack-specific layers and rules for Flutter, Kotlin, SwiftUI, React, Angular, NestJS, Node.js, Python, and Java.
- **Audit Step 7 Hook Data sync** — `/audit` now explicitly instructs Claude to update the Hook Data section whenever layer paths are corrected, keeping the pre-commit hook in sync as the project evolves.

---

## [17.1.3] — 2026-05-06

### Changed
- **file-size git hook downgraded to warning** — large files no longer block commits; team lead reviews in PR instead.

### Added
- **Architecture compliance git hook** — new `architecture.sh` check that validates layer boundaries (UI→data, data→presentation, UI→network, domain→framework). Ships as `enabled: false` (opt-in), blocks when enabled. Supports `exclude-patterns` in config and respects `legacy:` markers in steering docs.
- Architecture check uses colon-suffixed markers (`architecture:`, `arch-flow:`) to avoid false positives from prose mentions.
- Architecture check supports multiple flows per project — each path validated against its documented pattern.

---

## [17.1.2] — 2026-05-06

### Fixed
- **Kiro audit hook stops before writing persist files** — `workflow-audit.kiro.hook` completed Steps 1–11 (analysis, gap fixes, scorecard) but Kiro stopped before writing `.kiro/audit-report.md`, `.kiro/dead-code.md`, and `.kiro/developer-actions.md`. Added Rule 8 to EXECUTION RULES making persist a mandatory, non-skippable step. Strengthened the persist instruction block to announce each file write and explicitly state the audit is incomplete until all three files exist.

---

## [17.1.0] — 2026-05-06

### Fixed
- **Kiro workspace hooks missing from Kiro tab** — `ai-gov workspace --agent kiro` previously created hooks only in per-project subdirectories (e.g. `backend/accushield-kiosk-apis/.kiro/hooks/`), which Kiro IDE cannot see. Kiro reads hooks from the workspace root `.kiro/hooks/` only. The workspace root `.kiro/hooks/` was never created, so the Hooks tab was always empty in multi-repo workspaces.

### Added
- **`src/generators/workspace/hooks/kiro-workspace-hooks.ts`** — generates 12 workspace-root `.kiro/hooks/` files for Kiro workspaces:
  - **5 automated hooks** (`preToolUse` / `fileEdited` / `promptSubmit`): `block-dangerous-commands`, `pre-write-secrets-gate`, `check-secrets`, `require-task-type`, `session-continuity` — all workspace-wide, covering all projects simultaneously.
  - **7 `userTriggered` workflow hooks** visible in the Kiro Agent Hooks tab: `workspace-new-feature`, `workspace-fix`, `workspace-edit-feature`, `workspace-refactor`, `workspace-hotfix`, `workspace-explore`, `workspace-audit`. Each hook presents the full project list and asks which project to target before running the workflow.
- **`session-continuity` workspace hook** checks in-progress specs across ALL project `.kiro/specs/` directories and the workspace root `.kiro/specs/` in a single session start.
- **`workspace-audit` hook** supports single-project or full workspace sweep mode, writing per-project audit records and a workspace-level summary at `.kiro/audit-report.md`.

---

## [17.0.0] — 2026-05-02

### Added
- **Kiro agent support** — `ai-gov init --agent kiro` generates governance files in `.kiro/` with Kiro-native formats: steering files with YAML front-matter (`inclusion: always`), JSON hooks auto-discovered by Kiro IDE, and spec templates in `.kiro/specs/_template/`.
- **`--agent` flag** on `init`, `workspace`, `upgrade`, and `doctor` commands. Accepts `claude-code` or `kiro`. Auto-detects from existing `.kiro/` or `.claude/` directories when not specified.
- **Agent auto-detection** — CLI detects which agent to target based on existing governance directories. Defaults to `claude-code` for backward compatibility.
- **12 Kiro JSON hooks** — `block-dangerous-commands`, `protect-files`, `spec-first-gate` (conditional), `format-code`, `analyze-code`, `check-file-size`, `check-secrets`, `session-continuity`, `post-task-checklist`, `check-feature-readme`, `check-consistency`, `require-task-type`.
- **6 Kiro workflow hooks** — `userTriggered` hooks equivalent to Claude Code slash commands: `workflow-audit`, `workflow-new-feature`, `workflow-fix`, `workflow-refactor`, `workflow-hotfix`, `workflow-explore`. Triggered from the Agent Hooks panel in Kiro.
- **Pre-write secrets gate** — `preToolUse` hook (`pre-write-secrets-gate.json`) that catches hardcoded credentials BEFORE they are written to disk. Complements the post-hoc `check-secrets` fileEdited hook.
- **`src/agents/` directory** — new agent-specific modules: `src/agents/claude-code/` (extracted from generators), `src/agents/kiro/` (new Kiro orchestrator, steering wrapper, JSON hook generators).
- **`src/agents/detect-agent.ts`** — agent detection logic with interactive prompt for ambiguous cases.
- **`src/agents/kiro/steering.ts`** — `wrapWithFrontMatter()` utility for Kiro YAML front-matter.

### Changed
- **`src/generators/index.ts`** — now a thin dispatcher routing to agent-specific orchestrators.
- **`src/generators/monorepo.ts`** — accepts optional `steeringDir` parameter for agent-aware output paths.
- **`src/generators/git-hooks/index.ts`** — uses `config.agent` to write to `.kiro/git-hooks/` or `.claude/git-hooks/`.
- **`src/commands/workspace-init.ts`** — agent-aware workspace generation, injection, and git hook installation.
- **`src/commands/upgrade.ts`** — agent-aware upgrade with Kiro-specific hook regeneration and steering upgrade.
- **`src/commands/onboard.ts`** — auto-detects agent from existing directories, agent-aware messages.
- **`GovernanceConfig`** — added `agent: Agent` field (`'claude-code' | 'kiro'`).
- **Version bumped** to 17.0.0 across CLI, hooks, CI templates, and workspace scripts.

### Refactored
- Claude Code-specific generators moved from `src/generators/` to `src/agents/claude-code/` (hooks, commands, claude-md, settings-json, extensions).
- Shared content generators (architecture, coding-standards, constitution, etc.) remain in `src/generators/` — used by both agents.

---

## [16.0.0] — 2026-04-27

### Added
- **Java stack support** — `ai-gov init` now auto-detects Java projects (Maven via `pom.xml`, Gradle via `build.gradle`/`build.gradle.kts`) and generates fully tailored governance files.
- **`src/scanners/java.ts`** — new scanner detecting: build system (Maven/Gradle), Java version (8–21+), preview features, web framework (Spring Boot/WebFlux/Quarkus/Micronaut/JAX-RS/Javalin/Spark), DI (Spring DI/Guice/OSGi SCR/CDI/Dagger), UI (Swing/JavaFX with desktop layer flow override), ORM (JPA/Hibernate/MyBatis/jOOQ/Spring JDBC), testing (JUnit 5/4/TestNG + Mockito/AssertJ/Testcontainers/WireMock/ArchUnit), linter (Checkstyle/SpotBugs/PMD/Error Prone), formatter (Spotless/Google Java Format), OSGi bundles (Felix/Equinox/bnd), multi-module, logging (SLF4J/Logback/Log4j2), API docs (springdoc-openapi/springfox), Lombok, MapStruct.
- **`pomHas()` + `readPom()` helpers** in `src/utils/file-helpers.ts` — reads root and child module POMs for dependency detection.
- **Java profile** in `src/profiles.ts` — default layer flow `Controller → Service → Repository → Entity`, Maven commands, Spring DI defaults. Scanner overrides for Gradle builds, desktop apps, and OSGi bundles.
- **Java detection** in `src/detect-stack.ts` — disambiguates Java vs Kotlin for both Maven (`kotlin-maven-plugin` check) and Gradle (`kotlin` plugin check) projects.
- **Java-specific content** in generators: architecture (Spring/OSGi/desktop project structures), format-code hook (`mvn spotless:apply`/`./gradlew spotlessApply`), no-debug patterns (`System.out.print`, `.printStackTrace()`), audit command (3 switch blocks), new-feature command (Java phases + file templates).
- **Java `isBackend` logic** — Java is conditionally backend (Spring/JAX-RS/Quarkus/Micronaut) or desktop (Swing/JavaFX/OSGi-only), affecting content blocks, architecture, and task phases.

### Changed
- `Stack` union type now includes `'java'` (8 stacks total).
- `ScanResult` has 6 new Java-specific fields: `detectedJavaVersion`, `detectedPreviewFeatures`, `detectedBuildSystem`, `detectedOSGi`, `detectedLombok`, `detectedMapStruct`.
- Version bumped to 16.0.0 in `package.json`, `src/cli.ts`, CI generators, README, and all docs.
- README, `docs/cli_README.md`, `docs/complete_usage_guide.md`, `docs/cli_deep_dive.md` updated with Java detection details, debug patterns, and active stack lists.

### Fixed
- **`isJavaBackend()` default logic** — rewrote to treat desktop as the exception. Java is now desktop only when Swing or JavaFX is detected with no web framework (`detectedSubtype`) and no OSGi. All other cases (plain Maven libraries, CLI tools, batch processors, OSGi platforms like Weasis) correctly default to backend governance rules. Previously, any project without an explicit web framework subtype returned `false`, causing the OSGi architecture block and Spring-style content to never render for OSGi or plain Java projects.
- **Gradle Java detection false positive** — the Gradle branch now requires an explicit `java` plugin declaration (`apply plugin: 'java'`, `id 'java'`, or `plugins { java }`) before returning `'java'`. Previously any Gradle project without Kotlin markers was silently detected as Java, including Groovy-only Gradle builds.
- **Multi-module Gradle threshold** — changed `includes.length > 1` to `>= 1` in `detectMultiModule`. A Gradle project with a single `include(':app')` in `settings.gradle` now correctly sets `detectedMultimodule = true`.

---

## [15.2.0] — 2026-04-26

### Added
- **`ai-gov init --git-hooks`** — generates 8 bash scripts in `.claude/git-hooks/` (pre-commit orchestrator, commit-msg validator, 6 individual check scripts: file-size, secrets, no-todos, no-debug, format-check, lint-check) plus thin wrappers in `.git/hooks/`. Detects existing hook systems (husky / lefthook / pre-commit) and prints integration guidance instead of overwriting; use `--force` to override.
- **`ai-gov init --ci github|gitlab|bitbucket`** — generates CI pipeline config that runs `ai-gov pr-check` on every PR/MR and posts results as a comment.
- **`ai-gov pr-check`** — runs 8 governance checks against the current branch diff (architecture layer boundaries, file size, credentials, spec coverage, test coverage, TODOs, conventional commit messages, PR description). Output formats: `terminal` (colored, default), `github` (collapsible markdown), `gitlab` (MR note markdown), `json` (machine-readable).
- **`src/utils/git.ts`** — `getChangedFiles`, `getDiff`, `getCommitMessages` helpers using `git diff`.
- **`src/pr-check/`** — full PR check module with 8 checks, 4 formatters, and shared `CheckResult` / `CheckItem` types.
- **`src/generators/git-hooks/`** — generators for all git hook files (stack-aware `no-debug.sh`, config-driven thresholds).
- **`src/generators/ci/`** — GitHub, GitLab, Bitbucket CI config generators.

### Changed
- Version bumped to 15.2.0 in `package.json`, `src/cli.ts` (VERSION + HOOK_VERSION), and README.

### Fixed
- **`--dry-run` now respected by `installGitHookWrappers`** — previously, `ai-gov init --git-hooks --dry-run` would still write `.git/hooks/pre-commit` and `.git/hooks/commit-msg`. The `dryRun` flag is now passed through and the function logs `[dry-run]` lines instead of writing files.
- **CI generators use `npm install -g ai-gov@15.2.0` instead of `git clone`** — the generated GitHub, GitLab, and Bitbucket CI configs previously cloned the source repo and built from source, creating a dependency on GitHub availability and adding ~60s build time. They now install the published package directly, which is faster, versioned, and works offline if the npm registry is cached.

---

## [15.1.0] — 2026-04-25

### Added
- **7 slash commands** — `.claude/commands/` now includes `new-feature`, `edit-feature`, `fix`, `refactor`, `hotfix`, `explore`, `audit`. Claude Code reads these when a developer uses the corresponding `/command` in chat.
- **`/new-feature` plan mode + 3-gate spec** — enters plan mode immediately, requires explicit developer approval at Requirements → Design → Tasks gates before any file is written.
- **`/audit` 11-step governance audit** — inventories features, reads actual code, compares against steering files, checks spec/test coverage, scans for dead files, writes dated `docs/governance-audit-YYYY-MM-DD.md`.
- **`require-task-type.sh` hook** — `UserPromptSubmit` hook that detects unclassified development tasks and injects governance command suggestions. Runs in warn mode (exit 0) by default; change to exit 1 to block.
- **Flutter legacy zone detection** — scanner detects dual-zone projects (`lib/screens/` legacy MVC + `lib/features/` clean arch), sets `hasLegacyZones`, `legacyZones`, `cleanZones`, `legacyZoneNote` in `ScanResult`.
- **`flutter-legacy` test fixture** — adds `tests/fixtures/flutter-legacy/` with dual-zone structure for scanner tests.

### Fixed
- **g/k/o conflict resolution** — when `.claude/` already exists, `ai-gov init` prompts: Generate (ask per file with diff preview), Keep (skip existing), or Overwrite (replace all). Uses `/dev/tty` for reliable TTY input; falls back to `process.stdin` on Windows/CI.
- **110/110 tests pass** — `flutter-legacy` fixture added to unblock 3 previously failing scanner tests.

---

## [15.0.0] — 2026-04-24

### Added
- **Persistent audit records** — `/audit` command writes a dated markdown file to `docs/` so governance findings survive across sessions.
- **Honest README** — README updated to accurately describe what the CLI generates vs. what Claude Code reads at runtime.
- **Plan mode enforcement in commands** — `EnterPlanMode` / `ExitPlanMode` tool calls embedded directly in slash command markdown so Claude Code enforces them automatically.

---

## [14.3.0] — 2026-04-24

### Production Readiness

### Added
- **Generator smoke tests** — 103 tests covering all generators and hook scripts across React, Angular, Node.js, Flutter, Kotlin, Python stacks. Tests use `makeConfig(stack, scanOverrides)` helper and assert key output strings.
- **ESLint 9 flat config** — `eslint.config.js` with `typescript-eslint` for TypeScript-aware linting. Replaces legacy `.eslintrc.*` format.
- **Error boundary in `runGovernance()`** — uncaught exceptions now print a clean error message and exit 1 instead of dumping a raw stack trace. Set `DEBUG=1` to see full stack.
- **`check-secrets.sh` in doctor** — doctor now verifies the secrets hook exists on disk.
- **`/audit` command generator** — `ai-gov init` writes `.claude/commands/audit.md` with project-specific data baked in (arch pattern, detected tools, hook versions, high-risk files). Used for first-run governance verification and post-update delta checks.

### Fixed
- **`architecture.md` structure contradiction** — `structBlock` now adapts based on `detectedArchPattern` (`routes-models`, `routes-only`, `mixed`). Previously always showed 4-layer structure even for 2-layer `Route → Model` projects.
- **`check-file-size.sh` no-op for Node.js/Python** — added `nodejs` and `python` to active stacks; backend skip pattern doesn't skip `routes/` so God-route files get caught.
- **`analyze-code.sh` silent exit** — now emits a WARNING comment when linter is in deps but has no config file, instead of silently generating a no-op hook.
- **`format-code.sh` bypassing config check** — was re-deriving `fmtCmd` from `detectedFormatter` even when no formatter config existed. Now reads `profile.formatCmd` which is set by the scanner only when the formatter is usable.

### Removed
- **Unused `glob` and `yaml` dependencies** — were never imported in source; removed from `package.json`.

### Changed
- All lint errors resolved: removed unused imports (`readFileSync`, `countFiles`, `basename`, `existsSync`), prefixed unused parameters with `_`, removed dead closures.
- **Full scanner audit** — Flutter, Kotlin, React, Angular, SwiftUI, Python, and shared-js scanners audited: 0 ESLint errors, all detection logic confirmed correct. Two pre-existing non-breaking limitations noted (Python `has()` substring match, React service-style regex) — both produce correct default output.

---

## [14.2.0] — 2026-04-24

### Scanner Accuracy Fixes (Node.js)

All fixes target the Node.js scanner only. Flutter, Kotlin, React, Angular, SwiftUI, and Python scanners were fully audited in v14.3 and confirmed production-ready — no equivalent issues exist in those stacks.

### Fixed
- **pkg_has() false positives** — now parses JSON dependency sections (`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`) instead of raw regex matching the entire package.json. Prevents false matches on scripts, description, or comment fields. Results cached for performance.
- **ESM vs CommonJS false positive** — for TypeScript projects, reads `tsconfig.json` `"module"` field as source of truth. Previously counted `import`/`export` statements in `.ts` files, which always look like ESM even when `module: "commonjs"` compiles them to `require()`.
- **NestJS false positive** — now verifies `@Module()`/`@Injectable()`/`@Controller()` decorators exist in source code. Previously, just having `@nestjs/core` in package.json was enough — but it could be unused, a devDependency for testing, or a false match.
- **Architecture detection misses** — recursive directory scan at any depth (up to 6 levels) under `src/` instead of only checking top-level `src/controllers`, `src/services`. Also counts file name patterns (`*Controller*`, `*Repository*`, `*Service*`) as fallback when directory names don't match (e.g. `src/model/repositories/` instead of `src/repositories/`).
- **High-risk files basenames** — now stores relative paths (`src/api/index.ts`) instead of just basenames (`index.ts`). Detects entry points from `package.json` `"main"` field and router aggregator files (`src/routes/index.ts`, `src/api/index.ts`).
- **Model layer description** — for routes-models pattern, Model layer now correctly says "Business logic + data access" instead of "no business logic" (which was wrong for Express-style projects where models contain both).
- **Mixed arch typo** — `controller_file_count` → `ctrl_file_count` in mixed architecture warning message.

### Added
- **API Documentation scanner** — new dedicated scanner that distinguishes decorator-based (`@nestjs/swagger`), JSDoc-based (`swagger-jsdoc`), TSOA, Fastify JSON Schema (`@fastify/swagger`), and manual/static (`swagger-ui-express`). Emits correct guidance per style in `architecture.md` instead of generic "all DTOs need @ApiProperty()".
- **DI detection for non-NestJS** — detects tsyringe, Inversify, Awilix, TypeDI, BottleJS. Previously hardcoded `N/A` for all non-NestJS/non-AdonisJS projects.
- **`detectedSwaggerStyle`** field in ScanResult — tracks which API documentation approach the project uses.

---

## [14.1.0] — 2025-12-01

### TypeScript CLI Release

Complete rewrite from bash (5,695 lines) to TypeScript (4,100 lines, 44 source files).
Same detections, same output files, now type-safe, testable, and cross-platform.

### Added
- `ai-gov init` command with `--stack`, `--overwrite`, `--dry-run`, `--update-hooks`, `--dir` flags
- `ai-gov doctor` command — diagnoses governance setup issues (missing files, jq check)
- 40 scanner tests across 6 stack fixtures (Flutter BLoC, Flutter Riverpod, React Next.js, Node.js NestJS, Angular 17, Python FastAPI)
- chalk-based colored output (replaces bash escape codes)
- ESM module system throughout

### Fixed (from bash v14.0 → v14.1)
- `bash` prefix on all settings.json hook commands — Windows Git Bash compatibility
- `$1` argument for extension event passing — replaces `VAR=value command` syntax that fails on Windows
- Merged duplicate check-spec-exists registration (was running twice on Edit/Write)
- Python FEATURES_DIR deep path scanning — now finds `app/api/v1/endpoints/` not just `app/api/`
- Dual-path feature extraction in hooks — FEATURES_DIR + SOURCE_DIR fallback for Python/Node.js layered projects
- Template label: Phase 5 → "API Layer" for backend stacks (was hardcoded "UI")
- Design layer table blank row fix (leading `\n` on first row)
- Spec-first workflow step numbering gap when no scaffold tool detected
- NestJS architecture detection no longer requires `src/` directory to exist — detected from package.json subtype
- verify/run.sh guard — silently exits if analyzer binary not on PATH

---

## [14.0.0] — 2024-XX-XX (bash script)

### Added
- 200-line file size rule for frontend stacks (Flutter, Kotlin, React, Angular)
  - `check-file-size.sh` hook: warns >200, blocks >300
  - Stack-specific decomposition guidance in coding-standards.md
  - Auto-excludes tests, generated files, config, barrel/index files
  - Backend stacks (Node.js, Python) and SwiftUI get a no-op hook

### Fixed
- Spec enforcement widened — `check-spec-exists.sh` catches ALL source file writes, not just FEATURES_DIR
- Feature name extraction from SOURCE_DIR path with infrastructure directory exclusion list
- `tasks.md` now required — `validate_spec()` checks it exists and has actual task items (`- [ ]` lines)
- `design.md` placeholder detection — catches `_replace_`, `_describe_`, `_e.g.` (not just requirements.md)
- Actionable block messages — when hook blocks, tells Claude exactly what steps to take (5-step numbered list)
- CLAUDE.md "Before Every Task" rewritten with MUST/STOP language, explicit stop gates
- spec-first-workflow.md — STOP gates, "What Complete Means" section, "Common Mistakes" section

---

## [13.0.0] — 2024-XX-XX (bash script)

### Added
- Spec update detection — hooks detect when specs need updating (code >24h newer than spec, file count drift)
- Hook versioning — `# HOOK_VERSION=X.Y.Z` in every hook, `--update-hooks` flag for selective updates
- Monorepo support — per-package governance for Node.js monorepos (Lerna, Nx, Turborepo, pnpm workspaces)
- Custom hook injection — `custom-hooks.json` (never overwritten) merged into settings.json on each run
- Dry-run diff — `--dry-run` shows what would change vs what exists (unified diff output)

---

## [12.0.0] — 2024-XX-XX (bash script)

### Added
- Extensions system (jira-sync, retrospective, verify)
- Spec templates with compliance tables and conditional task phases
- Python stack support (FastAPI, Django, Flask)

---

## [11.0.0] — 2024-XX-XX (bash script)

### Added
- SwiftUI stack support (TCA, @Observable, Alamofire, SwiftData)
- Angular Signals detection (v17+)

---

## [10.0.0] — 2024-XX-XX (bash script)

### Added
- Node.js comprehensive scanner (17 detection categories, 40+ detection points)
- Architecture pattern detection (layered, routes-models, NestJS standard/clean, mixed)
- Cloud provider detection (AWS, Firebase, GCP)
- Real-time, scheduler, upload, email, logging, validation detection
