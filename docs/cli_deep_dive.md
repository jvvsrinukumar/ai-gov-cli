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
generators/*.ts    → Outputs 25+ files: CLAUDE.md, steering, hooks, specs, extensions
```

Data flows one direction. Zero circular dependencies. Each scanner fills a `ScanResult` object, generators read from `GovernanceConfig`.

---

## Stack Detection Depth

### Flutter (scanners/flutter.ts)
State (BLoC/Riverpod/Provider/GetX), DI (get_it/injectable), Router (go_router/auto_route/beamer), Network (Dio/http/Chopper/retrofit), Local DB (Isar/Drift/Hive/sqflite), Code gen (freezed/json_serializable), FVM, Mason, Flavors, i18n, Error pattern (either_dart/dartz/fpdart)

### Kotlin (scanners/kotlin.ts)
UI (Compose/XML — counts @Composable files vs XML layouts), DI (Hilt/Koin/Dagger), State (StateFlow count vs LiveData count), ORM (Room/Realm/SQLDelight), Linter (detekt/ktlint/spotless), Navigation Component, WorkManager, Firebase (Crashlytics/Analytics/FCM/Auth), SDK versions, Multi-module, Flavors

### Node.js (scanners/nodejs.ts) — 17 categories
Language (TS/JS), Framework (NestJS/Express/Fastify/Koa/Hapi + @Module verify), Architecture pattern (nestjs-standard/nestjs-usecase/controller-service/layered/routes-models/routes-only — recursive depth 6), DI (NestJS/awilix/tsyringe/inversify/typedi), API type (REST/GraphQL/gRPC), ORM (7 ORMs + raw drivers), Auth, Real-time, Upload/Media, Email, Cloud/Infra, Logging, Tooling/DX, Testing, Naming, Validation, Swagger style (6 styles), Module system (ESM/CJS from tsconfig), Node layout detection

### React (scanners/react.ts)
Next.js (App Router/Pages Router), RSC detection, State (Zustand/Redux/Jotai/MobX + React Query), CSS (Tailwind/styled-components/Emotion/CSS Modules), Router, Forms (react-hook-form/formik), Build (Vite/CRA), UI libs (shadcn/MUI/Mantine/Chakra), Lazy loading

### Angular (scanners/angular.ts)
Version, Signals (17+), State (NgRx/NGXS/Akita), Standalone components, UI (Material/PrimeNG/ng-bootstrap), Test (Karma+Jasmine/Jest), i18n, CLI/Nx

### Python (scanners/python.ts)
Framework (FastAPI/Django/Flask), ORM (SQLAlchemy async/sync, Tortoise, SQLModel), Auth (JWT/passlib), Cache (Redis), Queue (Celery), Linter (ruff/black/mypy), Test (pytest), Package manager (poetry/uv/pipenv/pip), HTTP client (httpx/aiohttp), Logging (structlog), API depth detection (v1/endpoints/, v1/, etc.)

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

### check-secrets.sh (PreToolUse: Edit|Write|Bash) — v14.3 NEW
- 3 regex patterns:
  1. AWS AKIA keys: `AKIA[0-9A-Z]{16}`
  2. Credential-named vars with values: `(secret_key|api_key|password|...) = "long_value"`
  3. Base64 config values with credential variable names
- Hard block (exit 2) with "Use environment variables or secrets manager"

### check-file-size.sh (PostToolUse: Edit|Write)
- Frontend only (Flutter/Kotlin/React/Angular) — backend/SwiftUI = no-op
- 200-300 lines: imperative warning "You MUST refactor NOW"
- 300+ lines: hard block (exit 2)
- Excludes: test files, generated files, config/theme/barrel/index, type definitions

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

### 200-Line File Size (v14.0+)
Frontend stacks: 200-300 = imperative warning, 300+ = hard block. Backend = exempt. Excludes tests, generated files, config, types.

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

## Priority Hierarchy

```
constitution.md > CLAUDE.md > steering files > specs
```

If any rule conflicts, constitution.md wins.
