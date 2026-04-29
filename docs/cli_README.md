# Governed AI Development — Architectural Guardrails for Claude Code

> **A structured context injection system with shell-based hard stops and plan mode enforcement for AI-assisted development.**

AI coding tools generate code at machine speed. This framework makes that speed more consistent — same architecture, same patterns, same file structure across sessions. It does not make Claude deterministic or correct. It gives Claude a better starting point each session and enforces hard stops on the most dangerous operations.

**Version:** 16.0.0 · **Agent:** Claude Code · **Stacks:** Flutter · Kotlin · Node.js · React · Angular · SwiftUI · Python · Java

---

## Quick Start

```bash
# 1. Clone the CLI (one-time per developer)
git clone https://github.com/jvvsrinukumar/ai-gov-cli.git
cd ai-gov-cli
npm install
npm run build
npm link              # makes 'ai-gov' available globally

# 2. Go to your project and run governance
cd /path/to/your/project
ai-gov init           # auto-detects stack, generates governance

# 3. Start Claude Code — it reads the rules automatically
claude
```

### Other Commands

```bash
ai-gov init --stack flutter    # specify stack explicitly
ai-gov init --dry-run          # preview what would be generated (shows diffs)
ai-gov init --update-hooks     # update only stale hooks after version upgrade
ai-gov init --overwrite        # regenerate everything

# Workspace: init governance for all projects at once
ai-gov workspace --dir /path/to/workspace          # auto-discovers all projects
ai-gov workspace --dir /path/to/workspace --dry-run
ai-gov workspace --dir /path/to/workspace --only backend/api,frontend/app
```

### Governance Commands (inside Claude Code)

After init, run these inside a `claude` session:

```
/audit          ← 12-step project truth check — scores governance, architecture,
                  code patterns, feature structure, test coverage, dead code.
                  Self-healing: directly updates .claude/steering/ where stale.
                  Safe to rerun every sprint — scorecard improves as issues fixed.
```

---

## What Problem This Solves

Claude Code without governance is a skilled developer with amnesia. Each session makes different architectural decisions, writes code wherever it wants, skips tests, creates 500-line god files, and starts fresh with zero memory of yesterday.

This framework makes Claude Code **predictable** — same architecture, same patterns, same file structure, every session.

---

## What Gets Generated

```
.claude/
├── CLAUDE.md                    ← "You MUST follow these rules" (Claude reads this first)
├── settings.json                ← 11 hook registrations
├── custom-hooks.json            ← Your custom hooks (never overwritten)
├── steering/                    ← Architecture, naming, hard rules, workflow (8 files)
│   └── architecture.md          ← includes Zone Rules if legacy zones detected (v14.3+)
├── hooks/                       ← 11 enforcement scripts
└── extensions/                  ← jira-sync, verify, retrospective

specs/
└── _template/                   ← requirements.md, design.md, tasks.md
```

> **Legacy Zone Detection (v14.3+):** If your project has mixed architecture (e.g. `lib/screens/` alongside `lib/features/` in Flutter, or NgModule alongside standalone in Angular), the CLI detects this at `init` time and bakes "Zone Rules" into `architecture.md` and `coding-standards.md` — specifying which patterns to follow in each zone.

---

## 6 Governance Commands (all use plan mode)

| Command | Gates | What Claude Does |
|---------|-------|-----------------|
| **`/new-feature [name]`** | 3 | Spec first → 3-gate approval → implement by phase |
| **`/edit-feature [name]`** | 3 | Read existing spec → update → STOP → implement new tasks only |
| **`/explore [scope]`** | 1 | Read code → code map + findings → choose: create spec / update spec / fix / refactor |
| **`/fix [description]`** | 1 | Read → root cause + proposed fix → STOP for approval → apply |
| **`/refactor [scope]`** | 1 | Read → impact analysis → STOP for approval → tests before → refactor → tests after |
| **`/hotfix [issue]`** | 1 | Fast diagnosis → STOP for confirmation → apply → post-fix summary |

---

## 11 Hooks

| Hook | What It Does | Level |
|------|-------------|:-----:|
| **check-spec-exists** | Blocks code without specs + validates completeness | Block |
| **check-secrets** | Blocks AWS keys, API tokens, passwords in source | Block |
| **block-dangerous** | Blocks force push, rm -rf, unauthorized pkg install | Block |
| **check-file-size** | 200-300: warn. 300+: block. Backend exempt. | Block/Warn |
| **protect-files** | Warns on high-risk file edits | Warn |
| **session-continuity** | Shows progress from last session | Context |
| **format-code** | Auto-formats after every edit | Auto |
| **analyze-code** | Runs linter after every edit | Auto |
| **check-feature-readme** | Ensures feature README exists | Warn |
| **check-consistency** | Detects spec/code/README drift | Warn |
| **post-task-checklist** | End-of-task reminder | Context |

---

## Supported Stacks

| Stack | What Gets Detected |
|-------|-------------------|
| **Flutter** | BLoC/Riverpod/Provider/GetX, get_it+injectable, go_router/auto_route, Dio, Hive/Drift/Isar, freezed, FVM, easy_localization, legacy zones (lib/screens, lib/pages) |
| **Kotlin** | Compose/XML, Hilt/Koin/Dagger, StateFlow/LiveData, Room/Realm, Firebase, Kotlin Multiplatform |
| **Node.js** | NestJS/Express/Fastify, Prisma/TypeORM/Drizzle/Mongoose, tsyringe/inversify/typedi, BullMQ/Bull, winston/pino, class-validator, monorepo, 17 detection categories |
| **React** | Next.js App/Pages Router, Zustand/Redux/Jotai/React Query, Tailwind/MUI/Mantine/Chakra/Ant Design, React Hook Form+Zod, vitest/Jest, legacy class components |
| **Angular** | Angular 14-18+, Signals, NgRx/NGXS/Akita, Angular Material, standalone/NgModule, Nx workspace, SSR, ngx-translate, legacy module detection |
| **Python** | FastAPI/Django/Flask, SQLAlchemy/SQLModel, JWT/passlib/OAuth2, Redis/Celery/RQ, poetry/uv/pipenv, ruff/black, pytest, httpx, structlog/loguru |
| **Java** | Maven/Gradle, Java 8–21+ (preview features), Spring Boot/WebFlux/Quarkus/Micronaut/JAX-RS, Spring DI/Guice/OSGi SCR/CDI, Swing/JavaFX, JPA/Hibernate/MyBatis/jOOQ, JUnit 5/Mockito/AssertJ/Testcontainers, Checkstyle/SpotBugs/Spotless, OSGi bundles, multi-module, SLF4J/Logback, springdoc-openapi, Lombok/MapStruct |

---

## Documentation

| Document | What It Covers |
|----------|---------------|
| **[Setup Guide](docs/cli_setup_guide.md)** | Step-by-step for macOS, Linux, Windows — what Claude shows on first launch |
| **[Governance Commands](docs/cli_governance_commands.md)** | Full reference — 5 slash commands, plan mode, 3-gate spec approval, phase-selective implementation, require-task-type hook, enforcement chain, stack-specific phases |
| **[Prompt Guide](docs/cli_prompt_guide.md)** | Quick reference — commands, fallback syntax, anti-patterns |
| **[Deep Dive](docs/cli_deep_dive.md)** | Complete technical reference — scanners, hooks, templates, /audit 12-step |
| **[Developer Commands](docs/cli_developer_commands.md)** | Claude Code built-in commands + graphify + daily workflow cheatsheet |
| **[Complete Usage Guide](docs/complete_usage_guide.md)** | All commands, CI setup, git hooks, pr-check |
| **[Workspace Setup Guide](docs/workspace_setup_guide.md)** | Step-by-step git hooks + CI + PR check for grouped and flat workspace layouts |
| **[CHANGELOG](docs/cli_CHANGELOG.md)** | Version history v10 → v16.0.0 |

---

## Workspace Setup (multiple projects)

Use `ai-gov workspace` when your workspace contains multiple projects — whether grouped into `backend/` / `frontend/` folders or laid out flat at the root.

### Two layouts supported

**Grouped (Image 1 — backend + frontend folders):**
```
workspace/
  backend/
    accushield-kiosk-apis/    ← Node.js
    corporate_node/           ← Node.js
    monitor_nodejs/           ← Node.js
  frontend/
    corporate_angular/        ← Angular
```

**Flat (Image 2 — all projects at root):**
```
workspace/
  accushield-kiosk-apis/      ← Node.js
  corporate_node/             ← Node.js
  monitor_nodejs/             ← Node.js
  staff-server/               ← Node.js
  volunteer-server/           ← Node.js
```

### Run once at workspace root

```bash
ai-gov workspace --dir /path/to/workspace
```

### What gets generated

```
workspace/
  .claude/                              ← workspace-level governance
    CLAUDE.md                           ← master rules (lists all projects)
    steering/
      workspace-policy.md              ← shared AI usage rules for all projects
      cross-project-rules.md           ← API contracts, no cross-src imports
      project-registry.md              ← all projects, stacks, governance status

  backend/
    accushield-kiosk-apis/
      .claude/                          ← full Node.js governance
        CLAUDE.md                           (+ workspace reference injected)
        steering/ hooks/ commands/
      specs/
    corporate_node/
      .claude/                          ← full Node.js governance
      specs/

  frontend/
    corporate_angular/
      .claude/                          ← full Angular governance
        CLAUDE.md                           (+ workspace reference injected)
        steering/ hooks/ commands/
      specs/
```

Each project's `.claude/CLAUDE.md` gets a `## Workspace Rules` section appended automatically, pointing to the shared workspace steering files.

### Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview everything — nothing written |
| `--overwrite` | Replace all existing governance files |
| `--only <paths>` | Comma-separated list of relative paths to init only |

### Next steps after workspace init

1. Review `workspace/.claude/CLAUDE.md`
2. Fill in project descriptions in `.claude/steering/project-registry.md`
3. Document API contracts in `.claude/steering/cross-project-rules.md`
4. Commit `.claude/` and `specs/` in each project
5. Run `ai-gov doctor --dir <project>` per project to verify

---

## Honest Assessment

### What is actually enforced (deterministic — cannot be bypassed by prompting)

- **Shell hooks** — block secrets, force-push, rm -rf, dangerous package installs. Fire at the OS level regardless of what the user says.
- **Plan mode gates** — `EnterPlanMode` physically blocks `Write`, `Edit`, `Bash`. All 6 commands use it. The gate is real, not a polite instruction.

### What is best-effort (Claude reads and tries to follow — may drift)

- **Steering files** — markdown injected into Claude's context each session. Claude follows them until context pressure, long sessions, or assertive prompting overrides them. There is no enforcement mechanism in the files themselves.
- **`/audit` health scores** — Claude reads source files and estimates patterns. For large codebases (50+ files, 3000+ line models), Claude samples and approximates. The scores are Claude's best judgment, not static analysis output.
- **Step 11 self-healing** — Claude writes directly to `.claude/steering/` based on its own gap analysis. If the analysis is wrong, the steering files confidently describe a project that doesn't exist. No human review gate before the write.

### Known limitations

- **jq dependency** — all 11 hooks silently fail if jq is not installed. Check with `jq --version` after setup.
- **CLI only** — hooks, session-continuity, and slash commands require Claude Code terminal mode. They do not work in the VS Code or Cursor IDE extension.
- **Installation friction** — requires Node.js 18+, npm, jq, Claude Code CLI, and this repo built and linked. Windows requires WSL2 first.

### When to use

| Situation | Fit |
|-----------|-----|
| 2-5 devs, 6+ month project, all on Claude Code CLI | Good fit |
| Solo developer wanting session continuity + secrets blocking | Good fit (worth the setup) |
| Enterprise / managed machines / IDE extension users | Poor fit — hooks won't fire |
| Hackathon / prototype / under 10 files | No value — overhead dominates |
| Expecting CI-grade enforcement | Wrong tool — use real linters and CI checks instead |

---

## License

MIT
