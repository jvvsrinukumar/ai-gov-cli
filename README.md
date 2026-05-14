# AI Governance CLI

[![CI](https://github.com/jvvsrinukumar/ai-gov-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jvvsrinukumar/ai-gov-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ai-gov.svg)](https://www.npmjs.com/package/ai-gov)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> The scaffolding layer for AI agent team adoption. When multiple developers use Claude Code or Kiro on the same codebase without shared rules, you get inconsistency at machine speed. This CLI fixes that.

**Version:** 17.6.0 · **Stacks:** Flutter · Kotlin · Node.js · React · Next.js · Angular · SwiftUI · Python · Java · **Agents:** Claude Code · Kiro

---

## The problem it solves

When one developer uses Claude Code, the output is fast and often good. When five developers use it on the same codebase with no shared rules, you get five different interpretations of the architecture, five different commit styles, and no one noticing when Claude drifts from the spec.

`ai-gov init` scans your project, detects your stack, and generates ~40 governance files that give Claude the same architectural context every session — for every developer. It optionally installs git hooks that enforce commit standards, and a CI check that runs on every pull request.

---

## Framework Overview — Three Layers

| Layer | Command | What it does |
|-------|---------|--------------|
| **Layer 1 — AI Steering** | `npx ai-gov init` | Generates agent steering files, hooks, and spec templates. Claude reads these automatically every session. |
| **Layer 2 — Git Hooks** | `npx ai-gov init --git-hooks` | Generates pre-commit and commit-msg scripts. Checks file size, secrets, TODOs, debug statements, and commit message format on every `git commit`. |
| **Layer 3 — CI + PR Check** | `npx ai-gov init --ci github` | Generates a CI pipeline that runs governance on every PR. |

You can use Layer 1 only, or Layer 1 + 2, or all three. They are independent.

---

## Prerequisites

- **Node.js** >= 18
- **python3 or jq** — used by generated bash hook scripts to read config.json

| Runtime | macOS | Linux/Ubuntu | Windows |
|---------|-------|--------------|---------|
| **python3** | Built-in | Default on Ubuntu 20+ | `winget install Python.Python.3` or WSL2 |
| **jq** | `brew install jq` | `sudo apt install jq` | `winget install jqlang.jq` |

python3 is preferred — it is available on every macOS and standard Linux environment. When neither is present, hooks print a visible warning and exit 0 (governance is skipped, not crashed).

> **Windows note:** The CLI runs on bare Windows. Generated bash hook scripts require Git Bash or WSL2.

---

## Step 1 — Initialise governance on your project

```bash
# Auto-detects stack and agent
npx ai-gov init

# Force a specific stack
npx ai-gov init --stack react       # or: next|flutter|kotlin|nodejs|angular|swiftui|python|java

# Force a specific agent
npx ai-gov init --agent kiro        # or: claude-code

# Preview everything — nothing written
npx ai-gov init --dry-run

# All three layers at once
npx ai-gov init --git-hooks --ci github
```

### What gets generated (Claude Code)

```
your-project/
├── CLAUDE.md                              ← root pointer for Claude
├── .claude/
│   ├── CLAUDE.md                          ← master rules (stack-tailored, read every session)
│   ├── settings.json                      ← registers all hooks
│   ├── steering/
│   │   ├── constitution.md                ← hard rules Claude must follow
│   │   ├── architecture.md                ← layer flow, file structure, high-risk files
│   │   ├── coding-standards.md            ← naming, file size limits, patterns
│   │   ├── ai-usage-policy.md             ← what Claude can/cannot do autonomously
│   │   ├── workflow.md                    ← feature/bug/hotfix workflow
│   │   ├── spec-first-workflow.md         ← spec-before-code enforcement
│   │   ├── feature-readme.md              ← README policy per feature
│   │   └── prompt-templates.md            ← reusable task templates
│   ├── hooks/                             ← 11 Claude Code hooks (run inside the IDE)
│   │   ├── check-spec-exists.sh           ← blocks file writes until spec is approved
│   │   ├── protect-files.sh               ← warns on high-risk file edits
│   │   ├── check-secrets.sh               ← blocks hardcoded credentials
│   │   ├── block-dangerous-commands.sh    ← blocks git push --force, rm -rf src/
│   │   ├── check-file-size.sh             ← warns >200 lines, blocks >300 (frontend only)
│   │   ├── format-code.sh                 ← auto-formats after every file write
│   │   ├── analyze-code.sh                ← runs linter after every file write
│   │   ├── check-feature-readme.sh        ← ensures README updated per feature
│   │   ├── check-consistency.sh           ← warns when spec and code have drifted
│   │   ├── session-continuity.sh          ← context summary at session start
│   │   └── post-task-checklist.sh         ← reminds Claude to confirm arch, flag risks
│   ├── commands/                          ← slash commands available in Claude Code
│   │   ├── new-feature.md                 ← /new-feature — 3 gates, spec-first
│   │   ├── edit-feature.md                ← /edit-feature — targeted changes
│   │   ├── fix.md                         ← /fix — reproduce, diagnose, fix, verify
│   │   ├── refactor.md                    ← /refactor — impact analysis + tests first
│   │   ├── hotfix.md                      ← /hotfix — minimal urgent fix
│   │   ├── explore.md                     ← /explore — read-only questions
│   │   ├── audit.md                       ← /audit — full governance audit to docs/
│   │   ├── assess.md                      ← /assess — rewrite assessment (11 docs)
│   │   └── backlog.md                     ← /backlog — rebuild stories from assessment
│   └── git-hooks/                         ← (created with --git-hooks, committed to repo)
│       ├── pre-commit.sh
│       ├── commit-msg.sh
│       ├── config.json
│       └── checks/
│           ├── file-size.sh
│           ├── secrets.sh
│           ├── no-todos.sh
│           ├── no-debug.sh
│           ├── format-check.sh
│           └── lint-check.sh
└── specs/
    └── _template/                         ← copy per feature before implementing
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

### What gets generated (Kiro — `--agent kiro`)

```
your-project/
├── .kiro/
│   ├── .gitattributes
│   ├── steering/                          ← Kiro reads these automatically (YAML front-matter)
│   │   ├── constitution.md
│   │   ├── architecture.md
│   │   ├── coding-standards.md
│   │   ├── ai-usage-policy.md
│   │   ├── workflow.md
│   │   ├── spec-first-workflow.md
│   │   ├── feature-readme.md
│   │   └── prompt-templates.md
│   ├── hooks/                             ← Kiro JSON hooks (auto-discovered)
│   │   ├── block-dangerous-commands.json
│   │   ├── protect-files.json
│   │   ├── check-secrets.json
│   │   ├── check-file-size.json
│   │   ├── session-continuity.json
│   │   ├── require-task-type.json
│   │   ├── post-task-checklist.json
│   │   └── workflow-*.json (×6)           ← audit, new-feature, fix, refactor, hotfix, explore
│   └── specs/
│       └── _template/
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
```

### Agent auto-detection

The CLI detects which agent to target from existing directories:

| State | Result |
|-------|--------|
| Only `.claude/` exists | Claude Code |
| Only `.kiro/` exists | Kiro |
| Neither exists | Claude Code (default) |
| Both exist, interactive TTY | Prompts you to choose |
| Both exist, non-interactive (CI) | Claude Code |

### Conflict handling on re-run

When an agent directory already exists, you are prompted:

```
  .claude/ already exists. How should ai-gov handle existing files?

  g  Generate — create new files, ask permission for each changed file  [default]
  k  Keep    — create new files only, leave all existing untouched
  o  Overwrite — replace all files with the latest generated version
```

Use `--update-hooks` to only update hooks on an older version, leaving steering files untouched.

### Commit governance files to git

```bash
git add .claude/ CLAUDE.md         # Claude Code
# or
git add .kiro/                     # Kiro

git commit -m "chore: add ai-gov governance framework v17.6.0"
git push
```

After this, every developer who clones the repo gets the steering rules and hook logic automatically. They still need to run `npx ai-gov onboard` once (Step 4) to wire the local `.git/hooks/` wrappers.

---

## Step 2 — Add git hooks (optional)

```bash
npx ai-gov init --git-hooks
```

This generates pre-commit and commit-msg check scripts in `.claude/git-hooks/` (committed to your repo) and installs thin wrapper scripts in `.git/hooks/` (local to your machine, not committed).

### What developers see at commit time

**All checks pass:**
```
  🔒 Pre-commit governance check
  ───────────────────────────────
  ✅ All checks passed.
```

**File too large (frontend stacks only — react, next, angular, flutter, kotlin):**
```
  🔒 Pre-commit governance check
  ───────────────────────────────
  BLOCKED  file-size: LoginScreen.tsx has 340 lines (max 300)

  ❌ 1 blocking issue(s). Fix and try again.
  (bypass with: git commit --no-verify)
```

> **Note:** File size checks only apply to frontend stacks. Backend stacks (nodejs, python, java) generate a no-op stub — large service or repository files are expected.

**Hardcoded secret:**
```
  BLOCKED  secrets: src/config/api.ts — AWS Access Key ID (AKIA pattern)
```

**Non-conventional commit message:**
```
  Governance commit-msg check
  ───────────────────────────────
  BLOCKED  Expected: <type>(<scope>): <description>
  Types: feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
```

**Warning only (commit goes through):**
```
  ⚠️  1 warning(s). Commit allowed — consider fixing.
```

### Configure thresholds

Edit `.claude/git-hooks/config.json` and commit. Every developer gets the update on next pull.

```json
{
  "pre-commit": {
    "file-size":    { "enabled": true },
    "secrets":      { "enabled": true },
    "no-todos":     { "enabled": true },
    "no-debug":     { "enabled": true },
    "format-check": { "enabled": false },
    "lint-check":   { "enabled": false }
  },
  "commit-msg": {
    "conventional-commits": true,
    "min-description-length": 10,
    "require-ticket-ref": false
  }
}
```

Enable format and lint checks once your team has formatters configured. Require a Jira ticket ref:

```json
"commit-msg": { "require-ticket-ref": true, "ticket-pattern": "JIRA-[0-9]+" }
```

### Bypass for a single commit (use sparingly)

```bash
git commit --no-verify -m "chore: WIP checkpoint"
```

The CI `pr-check` still catches what `--no-verify` skips.

### Integrating with Husky

If your team already uses Husky, add to `.husky/pre-commit`:

```bash
bash .claude/git-hooks/pre-commit.sh
```

And to `.husky/commit-msg`:

```bash
bash .claude/git-hooks/commit-msg.sh "$1"
```

---

## Step 3 — Add CI check (optional)

```bash
npx ai-gov init --ci github      # GitHub Actions
npx ai-gov init --ci gitlab      # GitLab CI
npx ai-gov init --ci bitbucket   # Bitbucket Pipelines
```

Commit the generated file and every PR gets checked automatically. No manual token setup needed — CI platforms provide authentication automatically.

### What shows on a PR

```
Governance Review

Changed files: 12 | Blockers: 0 | Warnings: 2

✅ Architecture      No layer boundary violations
✅ File Size         All files within size limits
✅ Credentials       No credentials detected
✅ Spec Coverage     All feature files have matching specs
⚠️  Test Coverage    2 source file(s) without tests
✅ TODOs             No TODO/FIXME in added lines
✅ Commit Messages   All commits follow conventional format
```

Only credentials block the merge by default. Edit `.claude/governance.json` to promote any check to blocking.

### GitLab — appends to existing pipeline

```bash
npx ai-gov init --ci gitlab
```

If `.gitlab-ci.yml` already exists, the command appends a `governance-check` job to your existing stages without overwriting your pipeline.

---

## Step 4 — Developer onboard (each new developer runs this once)

After cloning a repo that already has governance set up:

```bash
npx ai-gov onboard

# Preview what would be installed (no writes)
npx ai-gov onboard --dry-run

# Specific directory
npx ai-gov onboard --dir ./my-project
```

This command:
1. Detects the agent (Claude Code or Kiro) from existing directories
2. Verifies python3 or jq is available
3. Installs `.git/hooks/pre-commit` and `.git/hooks/commit-msg` wrappers
4. Prints a summary of what every commit will be checked for

Share with your team in Slack after the team lead completes Steps 1–3:

> **Team:** clone the repo, then run `npx ai-gov onboard` once.

---

## Step 5 — Upgrade (after ai-gov version updates)

```bash
# Re-generate hooks, commands, and CLAUDE.md — keep steering files
npx ai-gov upgrade

# Preview what would change
npx ai-gov upgrade --dry-run

# Also overwrite steering files (when architectural guidance has changed)
npx ai-gov upgrade --force

# Upgrade a specific project
npx ai-gov upgrade --dir ./backend/api
```

**What always gets upgraded:**
- All Claude Code hook scripts (`.claude/hooks/`)
- Git hook scripts (`.claude/git-hooks/`)
- All slash commands (`.claude/commands/`)
- `.claude/CLAUDE.md` (embedded rules must stay current)

**What is kept by default** (use `--force` to overwrite):
- `.claude/steering/` — team-specific architecture, coding standards, workflow
- `specs/` — your feature specs, never touched

After upgrading, commit so all teammates get the updated hooks:

```bash
git add .claude/
git commit -m "chore: upgrade ai-gov hooks to v17.6.0"
git push
```

### Workspace upgrade — upgrade all projects at once

```bash
ai-gov workspace --upgrade

# Also overwrite steering files
ai-gov workspace --upgrade --force

# Preview
ai-gov workspace --upgrade --dry-run
```

---

## Workspace — multi-project setup

```bash
# Auto-discover all projects and generate per-project governance
npx ai-gov workspace --dir /path/to/workspace

# Preview
npx ai-gov workspace --dir /path/to/workspace --dry-run

# Only specific projects
npx ai-gov workspace --dir /path/to/workspace --only backend/api,frontend/web

# Upgrade all projects to the latest hooks
npx ai-gov workspace --upgrade
```

### Supported layouts

**Grouped:**
```
workspace/
  backend/
    api/            ← Node.js — auto-detected
    notifications/  ← Node.js — auto-detected
  frontend/
    web/            ← React — auto-detected
    mobile/         ← Flutter — auto-detected
```

**Flat:**
```
workspace/
  corporate_node/   ← Node.js — auto-detected
  corporate_react/  ← React — auto-detected
  corporate_flutter/ ← Flutter — auto-detected
```

Group directories scanned automatically: `backend/`, `frontend/`, `mobile/`, `services/`, `apps/`, `packages/`, `libs/`

### Monorepo vs multi-repo — auto-detected

| Layout | Detection | Git hook install |
|--------|-----------|-----------------|
| **Monorepo** (single `.git/` at root) | No per-project `.git/` | One workspace hook at root `.git/hooks/pre-commit` delegates to all projects |
| **Multi-repo** (each project has `.git/`) | Per-project `.git/` found | Per-project wrappers pointing to each project's git-hooks scripts |

### What gets generated at workspace level

```
workspace/
  .claude/
    CLAUDE.md                     ← workspace master rules
    steering/
      workspace-policy.md         ← shared AI usage policy
      cross-project-rules.md      ← API contracts, no cross-src imports
      project-registry.md         ← table of all projects, stacks, status
    git-hooks/
      workspace-pre-commit.sh     ← monorepo orchestrator
  backend/api/
    .claude/                      ← per-project governance (Node.js rules)
  frontend/web/
    .claude/                      ← per-project governance (React rules)
```

---

## Project Init — scaffold from scratch

```bash
# Interactive wizard
npx ai-gov project init

# Non-interactive
npx ai-gov project init --type flutter --name my_app --yes
npx ai-gov project init --type next --name my-dashboard --yes

# Preview scaffold (no governance applied)
npx ai-gov project init --type next --name my-app --dry-run --yes
```

Unlike `ai-gov init` (which adds governance to an existing project), `project init` creates the entire project — directory structure, config files, dependencies, and governance — in one command.

| Stack | Naming | What gets scaffolded |
|-------|--------|---------------------|
| `flutter` | snake_case (`my_app`) | Clean architecture with BLoC/Cubit, Dio, GetIt, GoRouter, FVM |
| `next` | kebab-case (`my-app`) | Next.js with configurable router, styling, state, auth, database |

**Adding a new project to an existing workspace:**

```bash
# 1. Create the project inside your workspace
npx ai-gov project init --type next --name my-dashboard --dir ./frontend

# 2. Re-run workspace to register the new project
npx ai-gov workspace
```

---

## Full team setup — done once by the team lead

```bash
cd your-project

# Layer 1 — AI steering
npx ai-gov init

# Layer 2 — Git hooks
npx ai-gov init --git-hooks

# Layer 3 — CI check
npx ai-gov init --ci github

# Verify setup
npx ai-gov doctor

# Commit everything
git add .claude/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v17.6.0"
git push
```

After the team lead pushes, every developer runs once:

```bash
npx ai-gov onboard
```

---

## MCP Governance

Configure team tools (Jira, Figma, PostgreSQL, GitHub, Linear, Notion, Slack, Sentry) without committing tokens to git.

```bash
# Team lead (once): select tools, set org vars, write .mcp.json
npx ai-gov mcp init

# Preview without writing
npx ai-gov mcp init --dry-run

# Each developer: set personal tokens
npx ai-gov mcp onboard

# Preview what would be written
npx ai-gov mcp onboard --dry-run

# CI: verify all tokens are present
npx ai-gov mcp validate

# Rotate a single tool's token
npx ai-gov mcp update-token --tool jira
```

Two-level token storage:
- **Global** (`~/.config/ai-gov/.env.mcp.global`) — set once, shared across all projects (Jira, Figma, GitHub, etc.)
- **Project** (`.env.mcp`) — per-repo tokens (DATABASE_URL, etc.)

OAuth tools (Notion, Slack, Sentry) require no tokens — authenticate via browser.

See [docs/mcp-governance-guide.md](docs/mcp-governance-guide.md) for the full walkthrough.

---

## All commands reference

### `ai-gov init`

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --stack <stack>` | `flutter\|kotlin\|nodejs\|react\|next\|angular\|swiftui\|python\|java` | auto-detect |
| `-a, --agent <agent>` | `claude-code\|kiro` | auto-detect |
| `--overwrite` | Replace all existing files silently | false |
| `--dry-run` | Preview — nothing written | false |
| `--update-hooks` | Update only stale hooks | false |
| `-d, --dir <path>` | Target directory | cwd |
| `--git-hooks` | Generate git pre-commit + commit-msg hooks | false |
| `--ci <platform>` | `github\|gitlab\|bitbucket` | — |
| `--force` | Overwrite existing `.git/hooks/` | false |

### `ai-gov doctor`

```bash
npx ai-gov doctor
npx ai-gov doctor --dir ./my-project
```

Checks: CLAUDE.md exists, settings.json valid, all hooks present, python3 or jq installed, git hooks wired, config.json schema valid. Exits with code 1 if neither python3 nor jq is available.

### `ai-gov onboard`

```bash
npx ai-gov onboard
npx ai-gov onboard --dry-run
npx ai-gov onboard --dir ./my-project
```

### `ai-gov upgrade`

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dir <path>` | Project directory | cwd |
| `-s, --stack <stack>` | Override stack detection | auto-detect |
| `-a, --agent <agent>` | Target agent | auto-detect |
| `--force` | Also overwrite steering files | false |
| `--dry-run` | Preview — nothing written | false |

### `ai-gov workspace`

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dir <path>` | Workspace root | cwd |
| `--dry-run` | Preview — nothing written | false |
| `--overwrite` | Replace all existing governance files | false |
| `--only <projects>` | Comma-separated relative paths | all discovered |
| `--upgrade` | Upgrade hooks in all existing projects | false |
| `--force` | With `--upgrade`: also overwrite steering files | false |

### `ai-gov pr-check`

| Flag | Description | Default |
|------|-------------|---------|
| `--base <branch>` | Base branch for diff | `main` |
| `--format <format>` | `terminal\|github\|gitlab\|json` | `terminal` |
| `-d, --dir <path>` | Project directory | cwd |

```bash
npx ai-gov pr-check
npx ai-gov pr-check --base develop
npx ai-gov pr-check --format json | jq '.summary'
```

**8 checks on every PR:**

| Check | Blocks by default |
|-------|:-----------------:|
| Architecture violations | — |
| File size > 300 lines | — |
| Credentials (AWS AKIA, tokens) | Yes |
| Spec coverage | — |
| Test coverage | — |
| TODOs / FIXME / HACK | — |
| Commit message format | — |
| PR description presence | — |

### `ai-gov mcp`

| Subcommand | Who runs it | Flags |
|------------|-------------|-------|
| `mcp init` | Team lead (once) | `--dry-run`, `--overwrite` |
| `mcp onboard` | Each developer | `--dry-run` |
| `mcp validate` | Developer or CI | — |
| `mcp update-token --tool <id>` | Developer | — |

### `ai-gov project init`

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type <stack>` | `flutter\|next` | interactive |
| `-n, --name <name>` | App name (max 214 chars) | interactive |
| `-y, --yes` | Skip confirmation summary | false |
| `--dry-run` | Scaffold without governance | false |
| `-d, --dir <path>` | Parent directory | cwd |

### `ai-gov uninstall`

```bash
npx ai-gov uninstall --git-hooks          # Remove .git/hooks/ wrappers
npx ai-gov uninstall --ci github          # Remove CI workflow
npx ai-gov uninstall --all                # Remove everything
npx ai-gov uninstall --all --dry-run      # Preview
```

---

## Slash commands (Claude Code)

| Command | Use when | Gates |
|---------|----------|-------|
| `/new-feature <name>` | Building something new | 3 (Requirements → Design → Tasks) |
| `/edit-feature <name>` | Changing an existing feature | 1 |
| `/fix <description>` | Something is broken | 1 (Root cause) |
| `/hotfix <description>` | Production is broken right now | 1 (Emergency diagnosis) |
| `/refactor <description>` | Code works but structure is bad | 1 (Impact analysis) |
| `/explore <question>` | Understanding the codebase | 0 (read-only) |
| `/audit` | Periodic governance health check | 0 |
| `/assess` | Evaluating a legacy app for rewrite | 0 |
| `/backlog` | Generate rebuild stories from `/assess` | 0 |

**Command routing:**

```
Production down right now              →  /hotfix
Something broken (not urgent)          →  /fix
Building something new                 →  /new-feature
Changing or extending something        →  /edit-feature
Code works, structure is bad           →  /refactor
Understanding the codebase             →  /explore
Governance health check                →  /audit
Evaluating legacy app for rewrite      →  /assess
Generate rebuild stories               →  /backlog
```

---

## Stack detection

The scanner reads manifest files and produces tailored governance for each stack:

| Stack | Detected from | Key detections |
|-------|--------------|----------------|
| **Flutter** | `pubspec.yaml` | State (Riverpod/BLoC/Provider/GetX), DI, router, network, local DB, Mason, FVM |
| **Kotlin** | `build.gradle.kts` | UI (Compose/XML), DI (Hilt/Koin), state (StateFlow/LiveData), ORM, multi-module |
| **Node.js** | `package.json` | Framework (NestJS/Express/Fastify), ORM, DI, API type, auth, queues, monorepo |
| **React** | `package.json` | State (Zustand/Redux/Jotai), router (TanStack/React Router), forms, CSS, UI libs |
| **Next.js** | `package.json` | App vs Pages Router, RSC, state, styling — uses React scanner |
| **Angular** | `package.json` | Version, Signals (v17+), state (NgRx/NGXS/Akita), SSR, UI libs, Nx |
| **SwiftUI** | `Package.swift` | TCA, DI, state (@Observable), async/await, local DB |
| **Python** | `pyproject.toml` | Framework (FastAPI/Django/Flask), ORM, auth, cache, queue, package manager |
| **Java** | `pom.xml` / `build.gradle` | Framework (Spring Boot/Quarkus/Micronaut), DI, ORM, Java version, Lombok |

**File size enforcement by stack:**

| Stack type | File size hook |
|-----------|----------------|
| Frontend: react, next, angular, flutter, kotlin | Active — warns >200 lines, blocks >300 |
| Backend: nodejs, python, java | No-op — large files are expected |
| swiftui | No-op |

---

## Kiro vs Claude Code — key differences

| Aspect | Claude Code | Kiro |
|--------|-------------|------|
| Output directory | `.claude/` | `.kiro/` |
| Steering files | Plain markdown | Markdown with YAML front-matter |
| Hooks | Bash scripts in `settings.json` | JSON files auto-discovered by Kiro |
| Commands | `.claude/commands/*.md` (slash commands) | `userTriggered` JSON workflow hooks |
| Spec templates | `specs/_template/` | `.kiro/specs/_template/` |
| Enforcement | Hard block via `exit 2` | Agent-enforced via `askAgent` DENY |

> **Enforcement caveat:** Claude Code hooks use `exit 2` — a process-level hard block. Kiro hooks use `askAgent` with DENY instructions — cooperative enforcement. Both are effective in practice.

---

## Telemetry (optional)

If your team runs an [AI Governance Hub](https://github.com/jvvsrinukumar/ai-governance-hub), governance metrics are reported automatically on each `git push` — commit count, compliance percentage, violation counts.

Configure in `.ai-gov/config.json`:

```json
{
  "hub": "https://your-hub.example.com",
  "project": "my-app",
  "team": "platform",
  "platform": "github"
}
```

**Privacy:** No source code or commit messages are sent. Developer emails are SHA-256 hashed before transmission.

**Opt out:**

```bash
export AI_GOV_TELEMETRY=off
```

---

## Project structure (CLI source)

```
ai-governance/
├── src/
│   ├── cli.ts                             ← Commander registration (~286 lines)
│   ├── types.ts                           ← all interfaces and types
│   ├── detect-stack.ts                    ← auto-detection from manifest files
│   ├── profiles.ts                        ← defaults per stack (9 profiles)
│   ├── content-blocks.ts                  ← template variable computation
│   ├── scanners/                          ← 9 stack scanners
│   ├── agents/
│   │   ├── detect-agent.ts                ← shared auto-detect utility
│   │   ├── types.ts                       ← AgentAdapter interface + registry
│   │   ├── claude-code/                   ← Claude Code hooks + commands generators
│   │   └── kiro/                          ← Kiro steering + hooks generators
│   ├── generators/
│   │   ├── index.ts                       ← dispatcher → agent registry
│   │   ├── architecture.ts, constitution.ts, ...
│   │   ├── git-hooks/                     ← pre-commit, commit-msg, pre-push generators
│   │   └── ci/                            ← github, gitlab, bitbucket generators
│   ├── commands/
│   │   ├── init-cmd.ts                    ← init command handler
│   │   ├── doctor.ts                      ← doctor command handler
│   │   ├── workspace-cmd.ts               ← workspace routing
│   │   ├── init-ci.ts                     ← CI file writing (HTTPS-validated hub URL)
│   │   ├── workspace-init.ts              ← workspace discovery + mono/multi-repo detection
│   │   ├── upgrade.ts                     ← re-generate hooks, preserve steering
│   │   ├── onboard.ts                     ← new developer setup
│   │   ├── mcp.ts                         ← MCP governance subcommands
│   │   ├── project-init.ts               ← project scaffold orchestrator
│   │   └── uninstall.ts
│   ├── utils/
│   │   ├── collect-project-info.ts        ← reads project name from manifests
│   │   ├── validate-git-hooks-config.ts   ← config.json schema validation
│   │   ├── gitignore-manager.ts           ← .gitignore entry management
│   │   ├── display-hub-disclosure.ts      ← telemetry transparency notice
│   │   ├── hub-config.ts                  ← reads .ai-gov/config.json
│   │   ├── safe-write.ts                  ← write with dry-run/diff/version-check
│   │   ├── logger.ts                      ← colored console output
│   │   └── tty.ts                         ← TTY detection + line reading
│   ├── stacks/
│   │   ├── registry.ts                    ← adapter registry (self-registration)
│   │   ├── flutter/                       ← Flutter adapter + templates
│   │   └── next/                          ← Next.js adapter + templates
│   ├── pr-check/                          ← 8 checks + 4 output formatters
│   └── mcp/                               ← MCP catalog, env files, global env
├── tests/                                 ← 1178 tests across 40 suites
├── docs/                                  ← supplementary guides
├── package.json
└── jest.config.cjs
```

---

## When to use this (and when not to)

### Worth it when

- **Teams of 3+ using Claude Code or Kiro** — prevents "Claude rewrote the auth module because someone said fix the login bug"
- **Production codebases** where architecture consistency matters
- **Regulated environments** needing an audit trail — spec files document what was planned vs. built
- **Onboarding new devs** — steering files give Claude your project's patterns from their first session
- **Mixed-stack workspaces** — Node.js + React + Flutter each get stack-specific governance, with shared cross-project rules

### Not worth it when

- **Solo dev prototyping** — spec-first requires three markdown files before writing any code
- **Small utilities** — a 200-line script does not need 40 governance files
- **Teams not using Claude Code or Kiro** — every feature is built on the agent hook system

### What it will not do

- **Make Claude deterministic** — steering files give Claude a better starting point. Claude still makes its own decisions.
- **Govern code quality** — hooks check file size, secrets, commit format, TODOs. Not whether the code is correct.
- **Maintain itself** — the generated `architecture.md` is a starting point. It needs human editing as the project evolves.
- **Replace engineering discipline** — `--no-verify` exists. A team that doesn't take governance seriously will route around every control.

---

## License

MIT
