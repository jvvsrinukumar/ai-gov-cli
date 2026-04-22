# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [14.2.0] — 2025-04-XX

### Scanner Accuracy Fixes (Node.js)

All fixes target the Node.js scanner only. Flutter, Kotlin, React, Angular, SwiftUI, and Python scanners are untouched.

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

## [14.1.0] — 2024-12-XX

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
