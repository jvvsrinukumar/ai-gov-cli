# Deep Dive — Complete Technical Reference

**Version:** 14.3.0 · **CLI:** TypeScript · **Runtime:** Node.js 18+

---

## Architecture

```
ai-gov init
    │
    ▼
detect-stack.ts    → Scans pubspec.yaml / package.json / build.gradle.kts / pyproject.toml
    │
    ▼
profiles.ts        → Loads base profile (layer flow, naming, commands, extensions)
    │
    ▼
scanners/<stack>.ts → Deep scan: state mgmt, DI, ORM, router, test framework, 60+ detections
    │
    ▼
content-blocks.ts  → Computes hard rules, type naming, task phases, compliance tables
    │
    ▼
generators/*.ts    → Outputs 30+ files: CLAUDE.md, steering, hooks, specs, extensions, commands
```

Data flows one direction. Zero circular dependencies. Each scanner fills a `ScanResult` object, generators read from `GovernanceConfig`.

---

## Stack Detection Priority & Mixed Projects

`detect-stack.ts` returns exactly **one** stack. The priority order:

```
pubspec.yaml          → flutter   (native manifest, unambiguous)
Package.swift         → swiftui   (native manifest, unambiguous)
build.gradle[.kts]   → kotlin    (native manifest, unambiguous)
pyproject.toml / requirements.txt → python (native manifest, wins over package.json)
package.json with @angular/core   → angular
package.json with "react"         → react  ← Next.js full-stack lands here
package.json with express/nestjs  → nodejs
package.json (fallback)           → nodejs
```

### How real-world mixed projects are handled

**Next.js full-stack (React + Prisma + NextAuth + tRPC):**
Stack = `react`. `scanReact` runs. When `next` is detected in package.json, a dedicated **Next.js backend scan** also runs — detects ORM (Prisma/Drizzle/TypeORM/Mongoose/pg), auth (NextAuth.js/Clerk/Supabase/Lucia), and API layer (tRPC/GraphQL). These populate `scan.detectedORM`, `scan.detectedAuth`, `scan.detectedAPIType` so generators produce accurate architecture.md and coding-standards.md.

**Python + React (Django/FastAPI backend + React frontend):**
`pyproject.toml` or `requirements.txt` is checked before `package.json` — Python wins. The React frontend (typically in `frontend/` or `client/`) is not scanned. Run `ai-gov init` from the Python project root.

**Angular + NestJS (Nx monorepo):**
Stack = `angular`. The Angular scanner runs. Nx is detected via `@nrwl/angular`/`@nx/angular` and sets `scan.detectedMonorepo = 'Nx'`, which triggers monorepo governance files. For NestJS backend governance, run `ai-gov init` separately inside the NestJS app directory (`apps/api/`).

**React SPA + Express (same package.json):**
Stack = `react`. If Express is the backend, use `ai-gov init --stack nodejs` from the project root instead, or structure as a monorepo with separate `package.json` files.

**General rule:** Run `ai-gov init` from the **primary application root**. For true monorepos, run once at the root (monorepo governance is generated) and optionally again inside each app directory for per-app governance.

---

## Stack Detection Depth

### Flutter (scanners/flutter.ts)
State (BLoC/Riverpod/Provider/GetX), DI (get_it/injectable), Router (go_router/auto_route/beamer), Network (Dio/http/Chopper/retrofit), Local DB (Isar/Drift/Hive/sqflite), Code gen (freezed/json_serializable), FVM, Mason, Flavors, i18n, Error pattern (either_dart/dartz/fpdart)

### Kotlin (scanners/kotlin.ts)
UI (Compose/XML — counts @Composable files vs XML layouts), DI (Hilt/Koin/Dagger), State (StateFlow count vs LiveData count), ORM (Room/Realm/SQLDelight), Linter (detekt/ktlint/spotless), Navigation Component, WorkManager, Firebase (Crashlytics/Analytics/FCM/Auth), SDK versions, Multi-module, Flavors

### Node.js (scanners/nodejs.ts) — 17 categories
Language (TS/JS), Framework (NestJS/Express/Fastify/Koa/Hapi + @Module verify), Architecture pattern (nestjs-standard/nestjs-usecase/controller-service/layered/routes-models/routes-only — recursive depth 6), DI (NestJS/awilix/tsyringe/inversify/typedi), API type (REST/GraphQL/gRPC), ORM (7 ORMs + raw drivers), Auth, Real-time, Upload/Media, Email, Cloud/Infra, Logging, Tooling/DX, Testing, Naming, Validation, Swagger style (6 styles), Module system (ESM/CJS from tsconfig), Node layout detection

### React (scanners/react.ts)
Next.js (App Router/Pages Router), RSC detection, State (Zustand/Redux Toolkit/Jotai/MobX + React Query), CSS (Tailwind/styled-components/Emotion), UI component libs (MUI/@mui/joy, Mantine, Chakra UI, Ant Design), Router (TanStack/React Router DOM), Forms (react-hook-form/formik + Zod), Build (Vite/CRA/Next.js), Service style (function vs class), Features/source dir detection, Scaffold (Plop/Hygen)

**Next.js backend scan (runs automatically when `next` detected):** ORM (Prisma/Drizzle/TypeORM/Mongoose/pg), Auth (NextAuth.js/Clerk/Supabase/Lucia), API layer (tRPC/GraphQL)

### Angular (scanners/angular.ts)
Version detection, Signals (17+ — counts signal()/toSignal()/input()/linkedSignal() files), State (NgRx/NGXS/Akita/Angular Signals/RxJS BehaviorSubjects), SSR (@angular/ssr), UI libs (Angular Material/PrimeNG/ng-bootstrap/ng-select), i18n (ngx-translate), Test framework (Jest/Karma+Jasmine/Playwright), Monorepo (Nx), Architecture depth (simple Component→Service vs full UseCase+Repository), Source dir, Scaffold (ng generate)

### Python (scanners/python.ts)
Framework (FastAPI/Django/Flask), ORM (SQLModel/SQLAlchemy/Tortoise ORM/Peewee), Migrations (Alembic), Auth (JWT via python-jose/pyjwt/authlib, passlib), Cache (Redis), Queue (Celery), Linter/formatter (ruff/black), Test (pytest), Validation (Pydantic), HTTP client (httpx/aiohttp), Logging (structlog/loguru), Package manager (poetry/uv/pipenv/pip), Deep API path detection (app/api/v1/endpoints/, etc.)

---

## 11 Hooks — How Each Works

### check-spec-exists.sh (PreToolUse: Edit|Write|Bash)
- Checks ALL source files (not just FEATURES_DIR) — v14 fix
- Extracts feature name from FEATURES_DIR path first, SOURCE_DIR fallback
- Excludes infrastructure dirs: core, common, shared, config, utils, di, middleware, etc.
- validate_spec(): requirements.md + design.md + tasks.md must exist and have real content
- tasks.md must have `- [ ]` task items
- Spec freshness: warns when code >24h newer than spec
- Actionable 5-step block message when spec missing

### check-secrets.sh (PreToolUse: Edit|Write|Bash)
- 3 regex patterns:
  1. AWS AKIA keys: `AKIA[0-9A-Z]{16}`
  2. Credential-named vars with values: `(secret_key|api_key|password|...) = "long_value"`
  3. Base64 config values with credential variable names
- Hard block (exit 2) with "Use environment variables or secrets manager"

### check-file-size.sh (PostToolUse: Edit|Write)
- Active stacks: Flutter, Kotlin, React, Angular, Node.js, Python — SwiftUI = no-op
- Backend skip pattern: excludes config/index/app/server/main files but keeps routes/ in scope (God-route files are caught)
- Frontend skip pattern: excludes theme/config/routes/di/module/index/barrel/main/app files
- 200-300 lines: imperative warning "You MUST refactor NOW"
- 300+ lines: hard block (exit 2)
- Excludes: test files, generated files (*.g.dart, *.freezed.dart), type definition files

### block-dangerous-commands.sh (PreToolUse: Bash)
- Blocks: git push --force, git reset --hard, git clean -fd
- Blocks: stack-specific package install (npm install, pip install, flutter pub add, etc.)
- Blocks: rm -rf on source directories

### All other hooks
- **protect-files.sh**: Warns on high-risk file edits (dynamically discovered during scan)
- **session-continuity.sh**: Reads tasks.md, reports done/remaining, shows next task
- **format-code.sh**: Runs detected formatter (dart format, prettier, ruff, etc.)
- **analyze-code.sh**: Runs detected linter (dart analyze, eslint, ruff check, etc.)
- **check-feature-readme.sh**: Warns if feature dir has no README or file not listed
- **check-consistency.sh**: Detects drift between spec, code, and README
- **post-task-checklist.sh**: Reminds of post-task steps when Claude stops

---

## Governance Features

### SPEC_FIRST_ENABLED (v14.2+)
Universal for all stacks. Checks if project has spec history (any dirs in specs/ besides _template, or git commits touching specs/). If no history → spec enforcement disabled, check-spec-exists removed from settings.json, CLAUDE.md shows "opt-in" language.

### 5 Task Types (v14.2+)
New Feature, Edit Feature, Bug Fix, Refactor, Hotfix. Edit Feature reads existing spec, updates it, shows changes, waits for confirmation, implements only new tasks.

### Conditional Test Rule (v14.2+)
When detectedHasTests=false, shows stack-aware "No test runner configured" with actual TEST_CMD and setup hint per stack.

### Mixed-Arch Dual-Mode (v14.2+)
Node.js with both routes/ and controllers/: replaces single layer flow with dual guidance — legacy path (Route → Model) for bug fixes, new standard (Route → Controller → Service → Repo) for new features.

### Error Boundary in runGovernance() (v14.3+)
All generator errors are caught. Prints clean `Error: <message>` then exits 1. Set `DEBUG=1` to get the full stack trace. Prevents raw Node.js stack dumps reaching the user.

### format-code.sh Config Awareness (v14.3+)
Hook reads `profile.formatCmd` which the scanner sets **only** when the formatter is usable (has config file or needs none). If formatter is in `package.json` but has no config, the hook emits a WARNING comment instead of silently running a broken command or being a no-op.

### analyze-code.sh Warn Mode (v14.3+)
Same pattern as format-code.sh. When linter is in deps but no config file exists on disk, the hook emits a WARNING comment explaining the situation rather than silently doing nothing.

### /audit Command (v14.3+)
`ai-gov init` writes `.claude/commands/audit.md` — a Claude Code custom slash command activated by typing `/audit`. This is the **project truth check** — not just a governance file check. Claude reads actual source files, counts real code patterns, detects structural gaps, and directly updates `.claude/steering/` files to reflect reality.

**Design principle:** `ai-gov init` uses a fast structural scan (folder names). `/audit` does the deep behavioral scan (reads code). Together they produce 100% accurate steering before development starts — with no round-trip back to the CLI needed.

**12 audit steps:**

| Step | What Claude does |
|------|-----------------|
| 1 | Reads governance files — exist & non-empty |
| 2 | Checks hook versions — STALE/missing |
| 3 | Checks architecture alignment — steering matches detected flow |
| 4 | Checks settings.json hook registration |
| 5 | Spot-checks steering freshness (ORM, test, linter coverage) |
| 6 | **Deep code pattern scan** — reads actual source files, counts legacy vs modern signals per folder (setState/BLoC for Flutter, class/functional for React, fat/thin components for Angular, fat routes/layered for Node.js, fat routers/service layer for Python) |
| 7 | **Feature folder structure audit** — every feature folder matches expected layer structure? Missing layers flagged per feature |
| 8 | **Directory accuracy check** — did init scan detect the right sourceDir/featuresDir? Lists undocumented significant directories |
| 9 | **Dead code scan** — empty folders, orphaned files, tests without source, placeholder-named files |
| 10 | **New feature blueprint** — exact folder/file tree for the next feature, using actual patterns found in Step 6 |
| 11 | **Steering self-update** — Claude directly writes accurate zone rules, undocumented dirs, and correct patterns into `.claude/steering/architecture.md` and `.claude/steering/coding-standards.md` |
| 12 | Final report with Health Score (A–D) and VERDICT |

**VERDICT types:**
- `PASS` — everything accurate, development can start
- `PASS WITH UPDATES` — steering gaps were auto-fixed by the audit, development can start
- `ACTION NEEDED` — developer must decide something (dead code, incomplete features) — steering gaps already fixed

**`ai-gov init --overwrite` is NOT suggested for code pattern gaps** — Claude fixes those directly in Step 11. Only `--update-hooks` is suggested when hook versions are stale.

### Legacy Zone Detection (v14.3+)
Scanners detect when a project has both legacy and clean-architecture zones coexisting. Detected at `ai-gov init` time and baked into steering files — Claude reads correct patterns for each zone on every prompt.

**Flutter:** `lib/screens/` or `lib/pages/` alongside `lib/features/` → dual-mode (legacy MVC + clean arch)
**React:** Class components (`extends Component`) in `src/components/` alongside `src/features/` → dual-mode
**Angular:** `app.module.ts` (NgModule) alongside `app.config.ts` (standalone) → migration in progress
**Node.js:** `routes/ + controllers/` coexistence → already handled via `mixedArch` flag (v14.2)

**Steering files updated:**
- `architecture.md` → adds "Zone Rules — Dual-Mode Project" table with per-zone rules
- `coding-standards.md` → adds "Zone Rules" section: legacy zone (match existing), clean zone (follow layer flow)

**Hard rules baked in:** new features go in clean zone; bug fixes in legacy zone must not refactor.

**`/audit` Step 6** verifies zone rules are still present in steering files after being detected at init. Missing → −10 health score penalty.

**New scan fields:** `hasLegacyZones: boolean`, `legacyZones: string[]`, `cleanZones: string[]`, `legacyZoneNote: string`

### 200-Line File Size (v14.3+, all stacks)
All stacks active: Flutter, Kotlin, React, Angular, Node.js, Python. SwiftUI = no-op.
200-300 = imperative warning, 300+ = hard block. Backend uses a different skip pattern (catches God-route files, skips config/index/server/main). Frontend skips theme/config/routes/di/barrel/index/main. Excludes test files, generated files, type definitions.

---

## settings.json Structure

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|Bash",
      "hooks": [
        "bash .claude/hooks/protect-files.sh",
        "bash .claude/hooks/check-secrets.sh",
        "bash .claude/hooks/session-continuity.sh",
        "bash .claude/hooks/block-dangerous-commands.sh",
        "bash .claude/hooks/check-spec-exists.sh"    ← removed when specFirstEnabled=false
      ]
    }],
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [
        "bash .claude/hooks/format-code.sh",
        "bash .claude/hooks/analyze-code.sh",
        "bash .claude/hooks/check-feature-readme.sh",
        "bash .claude/hooks/check-consistency.sh",
        "bash .claude/hooks/check-file-size.sh",
        "bash .claude/extensions/load-extensions.sh PostToolUse"
      ]
    }],
    "Stop": [{
      "hooks": [
        "bash .claude/hooks/post-task-checklist.sh",
        "bash .claude/extensions/load-extensions.sh Stop"
      ]
    }]
  }
}
```

All commands use `bash` prefix for Windows compatibility. custom-hooks.json entries are merged after governance hooks.

---

## Test Suite (v14.3+)

**110 tests across 2 test files.**

### tests/scanners.test.ts — 43 tests
Stack fixtures in `tests/fixtures/` (minimal manifest files per stack):

| Fixture | File | Key assertions |
|---|---|---|
| flutter-bloc | pubspec.yaml | state=BLoC, DI=get_it+injectable, router=go_router |
| flutter-riverpod | pubspec.yaml | state=Riverpod, DI=Riverpod |
| flutter-legacy | pubspec.yaml + lib/screens,models,services,features | hasLegacyZones=true, legacyZones, cleanZones |
| react-nextjs | package.json | nextRouter=App Router, RSC=true, state=Zustand+React Query |
| nodejs-nestjs | package.json | subtype=nestjs, ORM=Prisma, lang=TypeScript |
| kotlin-compose | app/build.gradle.kts | UISystem=compose, DI=Hilt, state=StateFlow |
| angular-17 | package.json | signalState=true, state=NgRx |
| python-fastapi | pyproject.toml | subtype=fastapi, ORM=SQLAlchemy, packageManager=poetry |

### tests/generators.test.ts — 67 tests
Uses `makeConfig(stack, scanOverrides?, extras?)` helper — builds a minimal `GovernanceConfig` from a stack name and optional scan field overrides, then calls the generator and asserts key output strings.

**Suites:**
- `generateArchitecture` (10) — verifies structBlock adapts per `detectedArchPattern` (routes-models, layered, mixedArch, nestjs-standard, nestjs-usecase, python, flutter, kotlin); verifies legacy zone section emitted/absent
- `generateRootClaudeMd` (1), `generateMasterClaudeMd` (4), `generateCodingStandards` (6), `generateConstitution` (2)
- `generateWorkflow` (3), `generateAIUsagePolicy` (2), `generateSpecFirstWorkflow` (2)
- `generateSettingsJson` (4) — writes to tmpdir, asserts JSON structure and hook registration
- `generateCheckFileSize` (6) — verifies active vs no-op per stack, backend vs frontend skip patterns
- `generateCheckSecrets` (4), `generateProtectFiles` (3)
- `generateAnalyzeCode` (5) — verifies active, no-op, and WARN mode (linter in deps, no config)
- `generateFormatCode` (6) — verifies active, no-op, and WARN mode (formatter in deps, no config)
- `generateBlockDangerous` (2), `generatePostTaskChecklist` (2)
- `computeContentBlocks` (5) — verifies hardRules, layerResps, mixedArch DUAL architecture block

**Key design decisions baked into tests:**
- Bash regex `secret_?key` is asserted with `toContain('secret_?key')` not JS regex (literal `?` in bash regex)
- `mixedArch` hardRules assert `'DUAL architecture'` string, not arch pattern name
- `generateSettingsJson` tests use a real tmpdir (`mkdtempSync`) because the function writes files directly

---

## Priority Hierarchy

```
constitution.md > CLAUDE.md > steering files > specs
```

If any rule conflicts, constitution.md wins.
