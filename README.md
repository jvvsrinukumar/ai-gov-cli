# AI Governance CLI

> Scan-adaptive governance framework for Claude Code. Detects your stack, generates steering files, hooks, spec templates, and a master CLAUDE.md — all tailored to what's actually in your project.

**Version:** 14.1.0
**Stacks:** Flutter · Kotlin · Node.js · React · Angular · SwiftUI · Python
**Agent:** Claude Code

---

## What It Does

You run one command. The CLI:

1. **Scans** your project — reads `pubspec.yaml`, `package.json`, `build.gradle.kts`, `pyproject.toml`, or `Package.swift`
2. **Detects** 40+ things: state management, DI framework, ORM, router, linter, formatter, test framework, auth, queues, cloud provider, architecture pattern, monorepo tool, and more
3. **Generates** 31 files inside `.claude/` and `specs/` — all adapted to your detected stack

What you get:

| Category | Files | Purpose |
|----------|-------|---------|
| `CLAUDE.md` | 2 | Master rules file — Claude reads this before every task |
| `settings.json` | 1 | Hook registrations (10 hooks, all with `bash` prefix for Windows) |
| Steering files | 8 | constitution, architecture, coding-standards, ai-usage-policy, workflow, spec-first-workflow, feature-readme, prompt-templates |
| Hooks | 10 + README | protect-files, block-dangerous, check-spec-exists, session-continuity, format-code, analyze-code, check-feature-readme, check-consistency, check-file-size, post-task-checklist |
| Extensions | 4 | jira-sync, retrospective, verify, load-extensions |
| Spec templates | 3 | requirements.md, design.md, tasks.md |
| Custom hooks | 1 | custom-hooks.json (never overwritten — your hooks survive re-runs) |

---

## Installation

### Prerequisites

- **Node.js** >= 18
- **jq** — all hooks depend on it

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt install jq

# Windows (winget)
winget install jqlang.jq
```

### Option 1: npx (no install)

```bash
# Run directly from npm — nothing to install
npx ai-gov init
npx ai-gov init --stack flutter --dry-run
npx ai-gov doctor
```

### Option 2: Global install

```bash
npm install -g ai-gov

# Now available everywhere
ai-gov init
ai-gov doctor
```

### Option 3: From source

```bash
git clone <repo-url>
cd ai-governance
npm install
npm run build
npm link    # makes ai-gov available globally
```

---

## Usage

### Generate governance for your project

```bash
# cd into your project, then:
ai-gov init

# Or point at a directory
ai-gov init --dir /path/to/your/project

# Specify stack explicitly (skips auto-detection)
ai-gov init --stack flutter

# Preview what would be generated (no files written)
ai-gov init --dry-run

# Overwrite existing files
ai-gov init --overwrite

# Update only stale hooks (version mismatch detection)
ai-gov init --update-hooks
```

### Diagnose setup issues

```bash
ai-gov doctor
```

Checks: CLAUDE.md exists, settings.json valid, all 10 hooks present, jq installed.

### Example output (Flutter)

```
============================================
 AI Governance v14.1.0 (Scan-Adaptive · Claude Code)
============================================

--- Scanning project ---
  + State: flutter_bloc
  + DI: injectable
  + Router: go_router
  + Network: Dio
  + DB: Hive
  + Code gen: freezed, json_serializable, injectable_generator

Scan complete — 1 high-risk file(s).

Root:       CLAUDE.md, .claude/CLAUDE.md, settings.json
Steering:   8 files (constitution, architecture, coding-standards, ...)
Hooks:      10 scripts + README
Extensions: 4 scripts
Specs:      3 templates

  Stack:      Flutter
  Flow:       Widget → Cubit → UseCase → Repository → Service
  State:      flutter_bloc / Cubit
  DI:         get_it + injectable
  Router:     go_router
```

---

## What Gets Detected Per Stack

### Flutter
State (Riverpod / BLoC / Provider / GetX), DI (get_it / injectable / Riverpod), router (go_router / auto_route / beamer), network (Dio / http / Chopper), local DB (Hive / Drift / Isar / sqflite), code gen (freezed / json_serializable), i18n, Mason, FVM, flavors, error pattern (Either / dartz / fpdart)

### Kotlin
UI system (Compose vs XML), DI (Hilt / Koin / Dagger), state (StateFlow vs LiveData), ORM (Room / Realm / SQLDelight), linter (detekt / ktlint / spotless), navigation, WorkManager, Firebase services, SDK versions, multi-module, flavors

### Node.js
Language (TS/JS), module system (ESM/CJS), framework (NestJS / Express / Fastify / Koa / Hapi / Hono / AdonisJS), ORM (Prisma / TypeORM / Drizzle / Mongoose / Sequelize / MikroORM), DB drivers, auth (Passport / JWT / Auth0 / Firebase / Cognito), API type (REST / GraphQL / gRPC), queues (BullMQ / RabbitMQ / Kafka / SQS), real-time (Socket.IO / ws), schedulers, upload libs, email, cloud (AWS / Firebase / GCP), logging (winston / pino / morgan), validation (class-validator / Joi / Zod / Yup), architecture pattern (layered / routes-models / NestJS standard / NestJS clean), monorepo (Lerna / Nx / Turborepo / pnpm workspaces), mixed architecture detection

### React
Next.js (App Router / Pages Router), RSC detection, state (Zustand / Redux Toolkit / Jotai / MobX + React Query), router (TanStack / React Router), forms (React Hook Form / Formik + Zod), CSS (Tailwind / styled-components / Emotion), build tool (Vite / CRA / Next.js), service style (function vs class)

### Angular
Version detection, Signals support, state (NgRx / NGXS / Angular Signals / RxJS), SSR, UI libs (Angular Material / PrimeNG), i18n (ngx-translate), architecture depth (simple vs full with UseCase + Repository)

### Python
Framework (FastAPI / Django / Flask), ORM (SQLAlchemy / Tortoise / Peewee), migrations (Alembic), auth (JWT), cache (Redis), queue (Celery), linter/formatter (ruff / black), test (pytest), validation (Pydantic), HTTP client (httpx / aiohttp), package manager (poetry / uv / pipenv / pip), deep API path detection (v14.1)

### SwiftUI
TCA detection, DI (Resolver / Swinject / Factory), state (@Observable / ObservableObject), async/await, network (Alamofire / Moya / URLSession), local DB (SwiftData / GRDB / Realm), @MainActor, min iOS version

---

## How Specs Work

The spec-first workflow is the core governance mechanism. Here's how it works in practice:

### The Flow

```
Developer says "build user profile feature"
    ↓
Claude checks: does specs/user-profile/ exist?
    ↓ NO
Hook BLOCKS the write. Claude must:
    1. cp -r specs/_template specs/user-profile
    2. Fill requirements.md (user stories, data source, API endpoints)
    3. Fill design.md (layer mapping, file list, hard rules compliance table)
    4. Fill tasks.md (phased breakdown with size estimates)
    5. Show the plan to the developer
    6. WAIT for "go ahead"
    ↓ YES (and spec is complete)
Claude implements in phase order: Data → Logic → State → UI → Tests
    ↓
Hooks run after every file write:
    - format-code.sh auto-formats
    - analyze-code.sh runs linter
    - check-feature-readme.sh ensures README is updated
    - check-consistency.sh detects spec/code drift
    - check-file-size.sh warns if >200 lines (frontend stacks)
    ↓
When Claude stops:
    - post-task-checklist.sh reminds to list files, confirm arch, flag risks
```

### The Three Spec Files

**requirements.md** — What to build
- User stories with Given/When/Then scenarios
- Data source selection (Remote API / Local DB / In-Memory)
- API endpoint table with readiness status
- Out of scope list, open questions

**design.md** — How to build it
- Hard rules compliance table (every rule gets a Yes/No — forces Claude to think about architecture before coding)
- Layer mapping table (which layers are involved)
- File list (actual filenames, not placeholders)
- State design or API flow diagram

**tasks.md** — Build order
- Phased tasks: Setup → Data → Logic → State → UI → Tests → Wrap-up
- Size estimates: `[S]` < 30min, `[M]` 30min–2h, `[L]` 2h+
- Checkboxes that Claude marks as it completes each task
- Blocker tracking table

### What the Hooks Enforce

| Hook | What it blocks | Why |
|------|---------------|-----|
| `check-spec-exists.sh` | Any source file write without a complete spec | Forces planning before coding |
| `protect-files.sh` | Warns on high-risk file edits (main.dart, app.module.ts, .env, etc.) | Prevents accidental breakage |
| `block-dangerous-commands.sh` | `git push --force`, `rm -rf src/`, package installs | Prevents destructive operations |
| `check-file-size.sh` | Files >300 lines (blocks), >200 lines (warns) — frontend stacks only | Keeps code decomposed |
| `session-continuity.sh` | Nothing — adds context about where you left off | Helps Claude resume mid-feature |
| `check-consistency.sh` | Nothing — warns when spec and code drift apart | Catches stale specs |

---

## Honest Assessment

### When this framework is worth it

- **Teams of 3+ devs** using Claude Code on a shared codebase. The spec-first enforcement prevents "Claude rewrote the auth module because someone said 'fix the login bug'" situations.
- **Production codebases** where architecture consistency matters. The hooks catch layer violations, missing tests, and undocumented files in real-time.
- **Onboarding new devs** who use Claude Code. The steering files teach Claude your project's patterns — it won't suggest Redux in a Zustand project or LiveData in a StateFlow project.
- **Regulated environments** where you need an audit trail. The spec files document what was planned vs what was built.

### When it's overkill

- **Solo dev prototyping.** The spec-first hook will block you every time you try to write a file without filling out three markdown templates first. That's friction you don't need when you're exploring.
- **Small scripts or utilities.** A 200-line Express API doesn't need 31 governance files.
- **Teams that don't use Claude Code.** This framework is specifically designed for Claude Code's hook system. It does nothing for Copilot, Cursor, or manual coding.

### What it won't do

- It won't write your code. It governs HOW Claude writes code — architecture, naming, testing, process.
- It won't catch runtime bugs. The hooks check structure and process, not logic.
- It won't replace code review. It reduces the surface area of what needs reviewing, but a human still needs to verify the output.

### The real benefit

The spec-first workflow forces a 5-minute planning step before every feature. In practice, this means:

1. Claude produces fewer "surprise" files that don't fit the architecture
2. Every feature has documentation (the spec IS the documentation)
3. Tasks are trackable — you can see exactly what's done and what's remaining
4. Architecture compliance is checked on every file write, not just at PR time

The 5-minute planning cost saves 30+ minutes of "why did Claude create a Redux store when we use Zustand" debugging.

---

## Project Structure

```
ai-governance/
├── bin/
│   └── ai-gov.ts                    # CLI entry point
├── src/
│   ├── types.ts                     # All interfaces and types
│   ├── cli.ts                       # Commander setup + commands
│   ├── detect-stack.ts              # Auto-detection from manifest files
│   ├── profiles.ts                  # Default values per stack (7 profiles)
│   ├── content-blocks.ts            # Compute template variables from scan
│   ├── scanners/
│   │   ├── index.ts                 # Scanner dispatcher
│   │   ├── shared-js.ts             # Shared JS/TS scanners (pkg manager, tooling, tests)
│   │   ├── flutter.ts               # 15+ detection points
│   │   ├── kotlin.ts                # 12+ detection points
│   │   ├── nodejs.ts                # 40+ detection points (17 categories)
│   │   ├── react.ts                 # 15+ detection points
│   │   ├── angular.ts               # 10+ detection points
│   │   ├── python.ts                # 15+ detection points
│   │   └── swiftui.ts               # 12+ detection points
│   ├── generators/
│   │   ├── index.ts                 # Orchestrator
│   │   ├── claude-md.ts             # CLAUDE.md (root + master)
│   │   ├── settings-json.ts         # settings.json + custom-hooks merge
│   │   ├── constitution.ts          # Hard rules, architecture invariants
│   │   ├── architecture.ts          # Layer flow, project structure, state pattern
│   │   ├── coding-standards.ts      # Naming, type naming, file size rules
│   │   ├── ai-usage-policy.ts       # Prerequisites, forbidden actions, PR checklist
│   │   ├── workflow.ts              # Flow diagrams, layer build order
│   │   ├── spec-first-workflow.ts   # STOP gates, completeness checklist
│   │   ├── feature-readme.ts        # README policy per feature
│   │   ├── prompt-templates.ts      # New Feature / Bug Fix / Hotfix templates
│   │   ├── spec-templates.ts        # requirements.md, design.md, tasks.md
│   │   ├── extensions.ts            # jira-sync, retrospective, verify
│   │   ├── monorepo.ts              # Per-package governance
│   │   └── hooks/
│   │       ├── index.ts             # Hook dispatcher
│   │       ├── protect-files.ts
│   │       ├── block-dangerous.ts
│   │       ├── check-spec-exists.ts
│   │       ├── session-continuity.ts
│   │       ├── format-code.ts
│   │       ├── analyze-code.ts
│   │       ├── check-feature-readme.ts
│   │       ├── check-consistency.ts
│   │       ├── check-file-size.ts
│   │       ├── post-task-checklist.ts
│   │       └── hooks-readme.ts
│   └── utils/
│       ├── safe-write.ts            # Write with diff/dry-run/version-check
│       ├── file-helpers.ts          # pkgHas, pubspecHas, gradleHas, etc.
│       └── logger.ts                # Colored console output
├── tests/
│   ├── scanners.test.ts             # 40 tests across 6 stacks
│   └── fixtures/                    # Minimal manifest files per stack
│       ├── flutter-bloc/pubspec.yaml
│       ├── flutter-riverpod/pubspec.yaml
│       ├── react-nextjs/package.json
│       ├── nodejs-nestjs/package.json
│       ├── kotlin-compose/app/build.gradle.kts
│       ├── angular-17/package.json
│       └── python-fastapi/pyproject.toml
├── package.json
├── tsconfig.json
└── jest.config.cjs
```

**44 source files · ~4,100 lines of TypeScript · 40 tests**

---

## v14.1 Fixes (from bash script)

All incorporated into this CLI:

- `bash` prefix on all settings.json hook commands (Windows compatibility)
- `$1` argument for extension event passing (replaces `VAR=value command` syntax)
- Merged duplicate check-spec-exists registration
- Python FEATURES_DIR deep path scanning (`app/api/v1/endpoints/` not just `app/api/`)
- Dual-path feature extraction in hooks (FEATURES_DIR + SOURCE_DIR fallback)
- Template label fixes (Phase 5 → "API Layer" for backend stacks)
- Design layer table blank row fix
- Spec-first workflow step numbering fix

---

## License

MIT
