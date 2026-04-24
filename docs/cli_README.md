# Governed AI Development — Architectural Guardrails for Claude Code

> **The first framework that makes AI stop, plan, and ask before writing code.**

AI coding tools generate code at machine speed. This framework ensures that speed doesn't come at the cost of architecture, consistency, or maintainability.

**Version:** 14.3.0 · **Agent:** Claude Code · **Stacks:** Flutter · Kotlin · Node.js · React · Angular · Python

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
├── hooks/                       ← 11 enforcement scripts
└── extensions/                  ← jira-sync, verify, retrospective

specs/
└── _template/                   ← requirements.md, design.md, tasks.md
```

---

## 5 Task Types

| Type | Trigger | What Claude Does |
|------|---------|-----------------|
| **New Feature** | "create", "build X" | Spec first → plan → STOP for approval → implement by phase |
| **Edit Feature** | "update feature", "add X to Y" | Read existing spec → update → STOP → implement new tasks only |
| **Bug Fix** | "fix", "broken" | Read file → root cause → minimal fix → no refactoring |
| **Refactor** | "refactor", "clean up" | Impact analysis → STOP for approval → tests must pass |
| **Hotfix** | "urgent", "prod issue" | Fix immediately → document after → flag for review |

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
| **Flutter** | BLoC/Riverpod/Provider/GetX, get_it, go_router, Dio, Hive/Drift/Isar, freezed, FVM |
| **Kotlin** | Compose/XML, Hilt/Koin/Dagger, StateFlow/LiveData, Room/Realm, Firebase |
| **Node.js** | NestJS/Express/Fastify, Prisma/TypeORM/Mongoose, 17 detection categories, monorepo |
| **React** | Next.js App/Pages Router, Zustand/Redux/React Query, Tailwind |
| **Angular** | Angular 14-18+, Signals, NgRx/NGXS, Angular Material, standalone |
| **Python** | FastAPI, SQLAlchemy, JWT, Redis/Celery, poetry/uv/pipenv, ruff/black |

---

## Documentation

| Document | What It Covers |
|----------|---------------|
| **[Setup Guide](docs/setup-guide.md)** | Step-by-step for macOS, Linux, Windows |
| **[Prompt Guide](docs/prompt-guide.md)** | How to prompt Claude Code — all 5 task types |
| **[Deep Dive](docs/deep-dive.md)** | Complete technical reference — scanners, hooks, templates |
| **[Developer Commands](docs/developer-commands.md)** | Claude Code commands + daily workflow |
| **[Team Feedback Guide](docs/team-feedback-guide.md)** | 30 questions to collect developer feedback |
| **[CHANGELOG](CHANGELOG.md)** | Version history v10 → v14.3 |
| **[CONTRIBUTING](CONTRIBUTING.md)** | How to add scanners, hooks, generators |

---

## Honest Assessment

**What this does well:** Architectural consistency (~85%), prevents catastrophic mistakes, forces planning before coding, session continuity.

**What this doesn't do:** Doesn't make AI write better algorithms, doesn't replace code review, ~15-20% bypass rate, adds overhead to trivial tasks.

**When to use:** Teams of 2+, projects 6+ months, enterprise work.

**Not a fit:** Throwaway scripts, hackathons, solo prototypes under 10 files.

---

## License

MIT
