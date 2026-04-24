# Changelog

All notable changes to the AI Governance Framework.

## [14.3.0] — 2026-04-24

### Added
- **check-secrets.sh hook** — blocks AWS keys (AKIA pattern), credential-named variables, and base64 config values in source code
- **Edit Feature task type** — 5th task type with 10-step workflow for updating existing features (read existing spec → update → STOP → implement new tasks only)
- **SPEC_FIRST_ENABLED opt-out** — universal for all stacks; disables spec enforcement for projects with no spec history (opt-in when first spec created)
- **Conditional test rule** — stack-aware "No test runner configured" message when detectedHasTests=false (shows actual TEST_CMD + setup hint per stack)
- **Mixed-arch dual-mode hard rules** — Node.js projects with both routes/ and controllers/ get separate guidance for legacy vs new code paths
- **pkg_has() jq-based parsing** — parses actual dependency sections instead of grep (prevents false positives)
- **NestJS @Module() verification** — confirms decorators exist in source, not just deps in package.json
- **DI detection expanded** — tsyringe, inversify, typedi for non-NestJS projects
- **ESM/CJS from tsconfig.json** — reads module field as source of truth instead of counting import/export syntax
- **Swagger style detection** — 6 styles: decorators, jsdoc, tsoa, fastify-schema, manual, static-file
- **Architecture recursive depth** — scans up to 6 levels under src/ (was 1-2)
- **Entry point from package.json main** — added to high-risk files

### Fixed
- check-secrets HOOK_VERSION now dynamic (was hardcoded in single-quoted heredoc)
- Node.js-specific spec-first check replaced with universal check in scanners/index.ts
- Test rule now shows stack-specific setup hints instead of hardcoded "npm install jest"

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
