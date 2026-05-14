# ai-gov Complete Usage Guide

> Step-by-step guide for developers, team leads, and CI/CD engineers.
> Covers all three governance layers: AI Steering · Git Hooks · CI + PR Check.

**Version:** 18.0.0
**Audience:** New adopters and teams upgrading from any previous version

---

## Table of Contents

1. [What Is ai-gov](#1-what-is-ai-gov)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Layer 1 — AI Steering (ai-gov init)](#4-layer-1--ai-steering)
5. [Layer 2 — Git Hooks (ai-gov init --git-hooks)](#5-layer-2--git-hooks)
6. [Layer 3 — CI + PR Check (ai-gov init --ci)](#6-layer-3--ci--pr-check)
7. [New Developer Onboarding (ai-gov onboard)](#7-new-developer-onboarding)
8. [MCP Tool Governance (ai-gov mcp)](#8-mcp-tool-governance)
9. [Upgrading (ai-gov upgrade)](#9-upgrading)
10. [Workspace (multiple projects)](#10-workspace-multiple-projects)
11. [Daily Developer Workflow](#11-daily-developer-workflow)
12. [Slash Commands Reference](#12-slash-commands-reference)
13. [All CLI Commands Reference](#13-all-cli-commands-reference)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What Is ai-gov

`ai-gov` is a governance framework for AI-assisted development. It installs guardrails at three levels:

| Layer | What | When It Runs |
|-------|------|-------------|
| **1 — AI Steering** | Markdown files read by Claude/Kiro at every session start | Every AI session |
| **2 — Git Hooks** | Bash scripts that run `git commit` checks | Every commit |
| **3 — CI + PR Check** | Workflow file that runs governance checks on every PR | Every pull request |

### Supported stacks

`flutter` · `kotlin` · `nodejs` · `react` · `next` · `angular` · `swiftui` · `python` · `java`

### Supported agents

`claude-code` (default) · `kiro`

---

## 2. Prerequisites

```bash
node --version     # must be >= 18.0.0
npm --version      # any recent version
git --version      # any recent version
```

### Runtime for hooks (python3 preferred, jq fallback)

Hooks need **python3** or **jq** to read `config.json`. python3 is preferred — pre-installed on macOS and Ubuntu.

| Platform | Install python3 | Install jq (fallback) |
|----------|----------------|----------------------|
| macOS | `brew install python3` (or already built-in) | `brew install jq` |
| Ubuntu / Debian / WSL2 | Already installed on 20.04+ | `sudo apt-get install -y jq` |
| Windows | `winget install Python.Python.3` | `winget install jqlang.jq` |

> If **neither** is installed, hooks emit a warning and skip — no silent failures. Run `ai-gov doctor` to check.

---

## 3. Installation

### Option A — npm (recommended for teams)

```bash
npm install -g ai-gov
ai-gov --version    # → 18.0.0
```

### Option B — npx (no global install required)

```bash
npx ai-gov init
npx ai-gov doctor
```

---

## 4. Layer 1 — AI Steering

Layer 1 generates governance files that **Claude Code or Kiro reads before every task**. This is the foundation — Layers 2 and 3 build on it.

### Step 1: Navigate to your project

```bash
cd /path/to/your/project
```

Your project must have a manifest file (`pubspec.yaml`, `package.json`, `build.gradle.kts`, `pyproject.toml`, or `Package.swift`) for auto-detection. If it doesn't, use `--stack` explicitly.

### Step 2: Preview first (optional but recommended)

```bash
npx ai-gov init --dry-run
```

This shows every file that would be created — nothing is written.

### Step 3: Run init

```bash
# Auto-detect stack, default to claude-code agent
npx ai-gov init

# Explicit stack
npx ai-gov init --stack next

# Kiro agent
npx ai-gov init --agent kiro

# All layers at once
npx ai-gov init --git-hooks --ci github
```

### What gets generated (Claude Code)

```
your-project/
├── CLAUDE.md                          ← Root pointer to .claude/CLAUDE.md
├── .claude/
│   ├── CLAUDE.md                      ← Master rules file
│   ├── settings.json                  ← Registers all 11 Claude Code hooks
│   ├── steering/
│   │   ├── constitution.md            ← Hard rules (never bypass specs)
│   │   ├── architecture.md            ← Layer flow, high-risk files
│   │   ├── coding-standards.md        ← Naming, file size limits
│   │   ├── ai-usage-policy.md         ← What Claude can/cannot do
│   │   ├── workflow.md                ← Feature, bug, hotfix workflows
│   │   ├── spec-first-workflow.md     ← Spec-before-code enforcement
│   │   ├── feature-readme.md          ← README policy per feature
│   │   ├── task-estimates.md          ← Time-boxing conventions [S/M/L]
│   │   └── prompt-templates.md        ← Reusable templates
│   ├── hooks/                         ← 11 bash hooks (run inside IDE)
│   └── commands/                      ← Slash commands
│       ├── new-feature.md             ← /new-feature — 3-gate spec workflow
│       ├── edit-feature.md            ← /edit-feature
│       ├── fix.md                     ← /fix
│       ├── refactor.md                ← /refactor
│       ├── hotfix.md                  ← /hotfix
│       ├── explore.md                 ← /explore (read-only)
│       ├── audit.md                   ← /audit — full governance audit
│       ├── assess.md                  ← /assess — refactor vs rewrite
│       ├── backlog.md                 ← /backlog — from assessment to sprint
│       └── jira.md                    ← /jira — sync tasks.md to Jira
└── specs/
    └── _template/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

### Steering files — what gets customised vs what is regenerated

| Path | Behaviour |
|------|-----------|
| `.claude/steering/architecture.md` | **Preserved on upgrade** — your team's decisions |
| `.claude/steering/coding-standards.md` | **Preserved on upgrade** |
| `.claude/steering/workflow.md` | **Preserved on upgrade** |
| `.claude/steering/constitution.md` | **Preserved on upgrade** |
| `.claude/hooks/` | **Always regenerated** on upgrade |
| `.claude/commands/` | **Always regenerated** on upgrade |
| `.claude/CLAUDE.md` | **Always regenerated** (app name extracted and preserved) |

---

## 5. Layer 2 — Git Hooks

```bash
npx ai-gov init --git-hooks
```

Generates bash scripts in `.claude/git-hooks/` that run on `git commit`. These are committed to git — every developer gets them automatically.

### What gets blocked vs warned

| Check | Blocks (exit 2) | Warns (exit 0) |
|-------|-----------------|----------------|
| File size (frontend stacks) | > 300 lines | > 200 lines |
| File size (backend stacks: nodejs/python/java) | — (no-op) | — |
| Secrets | AWS AKIA keys, credential-named variables | — |
| TODOs | — | TODO/FIXME without ticket reference |
| Debug | — | console.log, print, debugger |
| Commit message format | Non-conventional commits | — |

> **Backend stacks are exempt from the 300-line file size rule.** The check generates a 5-line no-op stub for nodejs, python, and java projects.

### Developer install (once per clone)

```bash
npx ai-gov onboard   # installs .git/hooks/ wrappers
```

---

## 6. Layer 3 — CI + PR Check

```bash
npx ai-gov init --ci github    # GitHub Actions
npx ai-gov init --ci gitlab    # GitLab CI
npx ai-gov init --ci bitbucket # Bitbucket Pipelines
```

Generates a CI pipeline file that runs `npx ai-gov pr-check` on every PR. Validates governance files exist, checks commit message format, verifies no secrets in diff.

### Hub Telemetry (opt-in)

If a hub is configured (`npx ai-gov init --hub-url https://...`), the CLI posts anonymised governance health metrics to your team's dashboard. Email addresses are SHA-256 hashed before transmission. The pipeline never blocks on hub unavailability.

---

## 7. New Developer Onboarding

After cloning a repo that already has governance set up:

```bash
# Step 1 — Install git hook wrappers on your machine
npx ai-gov onboard

# Step 2 — Set up MCP tokens (if project uses MCP tools)
npx ai-gov mcp onboard

# Step 3 — Verify everything is correct
npx ai-gov doctor
```

### What `ai-gov onboard` does

- Installs `.git/hooks/pre-commit` and `.git/hooks/commit-msg` wrappers
- Wrappers delegate to the scripts in `.claude/git-hooks/` (committed to git)
- Verifies python3/jq runtime is available
- Confirms governance files are present

### Preview before running

```bash
npx ai-gov onboard --dry-run
```

---

## 8. MCP Tool Governance

MCP (Model Context Protocol) servers let Claude connect to external tools: Jira, Figma, PostgreSQL, GitHub, etc. The `ai-gov mcp` commands govern how tokens are managed across a team so no credentials are ever committed to git.

### Team lead (once per project)

```bash
npx ai-gov mcp init
```

Generates `.mcp.json` (committed — uses `${VAR}` placeholders), `.env.mcp.example` (committed — instructions for devs), `.envrc` (committed — loads tokens via direnv).

Preview first:
```bash
npx ai-gov mcp init --dry-run
```

### Developer (once per clone)

```bash
npx ai-gov mcp onboard
```

Guided prompts per tool. Global tokens (Jira email/API key, Figma token) stored in `~/.config/ai-gov/.env.mcp.global` — set once, reused across all your projects automatically.

Preview first:
```bash
npx ai-gov mcp onboard --dry-run
```

### Validate your setup

```bash
npx ai-gov mcp validate
```

### Rotate a token

```bash
npx ai-gov mcp update-token --tool jira
```

### Catalog of supported tools

| Tool | Category | OAuth | Token URL |
|------|----------|-------|-----------|
| Jira (Atlassian) | pm | No | `id.atlassian.com/manage-profile/security/api-tokens` |
| Figma | design | No | `figma.com/settings` |
| Zeplin | design | No | `app.zeplin.io/profile/developer-tools` |
| PostgreSQL | database | No | — (connection URL) |
| GitHub | devops | No | `github.com/settings/personal-access-tokens` |
| Linear | pm | No | `linear.app/settings/api` |
| Notion | communication | Yes | `/mcp` in Claude Code |
| Slack | communication | Yes | `/mcp` in Claude Code |
| Sentry | devops | Yes | `/mcp` in Claude Code |

See [`mcp-governance-guide.md`](./mcp-governance-guide.md) for full walkthrough and multi-workspace setup.

---

## 9. Upgrading

```bash
# Preview what would change
npx ai-gov upgrade --dry-run

# Upgrade hooks + commands (preserves steering files)
npx ai-gov upgrade

# Upgrade everything including steering files
npx ai-gov upgrade --force
```

**Always upgraded:** hooks, git-hooks, commands, CLAUDE.md
**Preserved by default:** steering files, specs, custom-hooks.json

See [`upgrade_guide.md`](./upgrade_guide.md) for full details including `--force` strategy and per-directory upgrades.

---

## 10. Workspace (multiple projects)

For a workspace containing multiple projects (backend APIs, frontend apps, mobile apps):

```bash
# First-time setup
npx ai-gov workspace --dir /path/to/workspace

# Upgrade all projects in workspace
npx ai-gov workspace --upgrade

# Upgrade workspace + steering files
npx ai-gov workspace --upgrade --force
```

`workspace` auto-discovers sub-projects, detects each stack, generates per-project governance, and adds shared workspace-level steering files.

### Workspace layouts

**Layout A — Grouped** (backend/frontend folders):
```
workspace/
  backend/
    api-server/      ← ai-gov init target
  frontend/
    web-app/         ← ai-gov init target
```

**Layout B — Flat** (all projects at root level):
```
workspace/
  api-server/        ← ai-gov init target
  web-app/           ← ai-gov init target
  mobile-app/        ← ai-gov init target
```

See [`workspace_setup_guide.md`](./workspace_setup_guide.md) for the full setup walkthrough.

---

## 11. Daily Developer Workflow

```
START OF SPRINT
───────────────
/audit                     ← 6-category health check, self-heals steering files
/assess                    ← before proposing a large refactor or rewrite

START OF DAY
────────────
/resume                    ← pick up where you left off
/graphify query "..."      ← check what exists before writing (if using Graphify)

DURING DEVELOPMENT
──────────────────
/plan [description]        ← always plan before coding
/new-feature               ← spec-first: requirements → design → tasks → implement
/fix [description]         ← reproduce → diagnose → minimal fix → test
/refactor                  ← impact analysis gate before changes

END OF FEATURE
──────────────
/simplify                  ← quality + efficiency review
/security-review           ← catch issues before commit
git commit                 ← git hooks run automatically
/review [PR]               ← review before merging

AFTER SPRINT
────────────
/backlog                   ← generate sprint backlog from assess report
/jira                      ← sync spec tasks.md to Jira stories
```

---

## 12. Slash Commands Reference

Slash commands are markdown files in `.claude/commands/`. Type `/command-name` in Claude Code chat.

| Command | Gates | What It Does |
|---------|:-----:|--------------|
| `/new-feature` | 3 | Spec-first: requirements → design → tasks → implement |
| `/edit-feature` | 1 | Read existing spec + code → propose changes → implement |
| `/fix` | 1 | Reproduce → root cause → minimal fix → regression test |
| `/refactor` | 1 | Impact analysis → tests before → apply → tests after |
| `/hotfix` | 1 | Emergency: smallest change, must have test |
| `/explore` | 0 | Read-only: trace data flows, answer questions |
| `/audit` | 0 | 11-step governance audit → writes dated report |
| `/assess` | 0 | Refactor vs rewrite evidence-based assessment |
| `/backlog` | 0 | Generate sprint backlog from latest assess report |
| `/jira` | 0 | Sync spec tasks.md time estimates to Jira via MCP |

**Gates:** Commands with gates start with `EnterPlanMode`. Claude can read files and show plans but cannot write anything until you approve each gate.

---

## 13. All CLI Commands Reference

```bash
# ── Init (team lead) ──────────────────────────────────────────────
npx ai-gov init                         # init with auto-detection
npx ai-gov init --stack next            # force stack (flutter|kotlin|nodejs|react|next|angular|swiftui|python|java)
npx ai-gov init --agent kiro            # generate Kiro governance
npx ai-gov init --git-hooks             # add Layer 2 — git hooks
npx ai-gov init --ci github             # add Layer 3 — GitHub Actions
npx ai-gov init --ci gitlab             # add Layer 3 — GitLab CI
npx ai-gov init --ci bitbucket          # add Layer 3 — Bitbucket Pipelines
npx ai-gov init --dry-run               # preview only, writes nothing

# ── Onboard (each developer) ──────────────────────────────────────
npx ai-gov onboard                      # install git hooks, verify runtime
npx ai-gov onboard --dry-run            # preview what would be installed

# ── Doctor (verify setup) ─────────────────────────────────────────
npx ai-gov doctor                       # health check for current project
npx ai-gov doctor --agent kiro          # health check for Kiro agent

# ── Upgrade (team lead) ───────────────────────────────────────────
npx ai-gov upgrade                      # upgrade hooks + commands
npx ai-gov upgrade --force              # upgrade including steering files
npx ai-gov upgrade --dry-run            # preview changes
npx ai-gov upgrade --dir ./backend      # upgrade specific directory

# ── Workspace ─────────────────────────────────────────────────────
npx ai-gov workspace                    # init all sub-projects
npx ai-gov workspace --upgrade          # upgrade all sub-projects
npx ai-gov workspace --upgrade --force  # upgrade + steering files
npx ai-gov workspace --dir /path/to/ws  # specify workspace root

# ── MCP governance ────────────────────────────────────────────────
npx ai-gov mcp init                     # team lead: generate .mcp.json
npx ai-gov mcp init --overwrite         # overwrite existing .mcp.json
npx ai-gov mcp init --dry-run           # preview MCP config
npx ai-gov mcp onboard                  # developer: set personal tokens
npx ai-gov mcp onboard --dry-run        # preview token setup
npx ai-gov mcp validate                 # check all tokens present
npx ai-gov mcp update-token --tool jira # rotate one tool's tokens

# ── PR check (CI) ─────────────────────────────────────────────────
npx ai-gov pr-check                     # run governance check (CI use)
```

---

## 14. Troubleshooting

### "`.claude/` not found — run `ai-gov init` first"

The project has never been initialised. Run:
```bash
npx ai-gov init
```

### Hooks not firing after `git commit`

Run `npx ai-gov onboard` to install the local `.git/hooks/` wrappers. Every developer must run this once per clone — the wrappers are not committed to git.

### `ai-gov: command not found` after global install

Your npm global bin directory is not in `PATH`. Find it and add it:
```bash
npm bin -g       # e.g. /usr/local/bin ← add this to PATH
```

Add to `~/.zshrc` or `~/.bashrc`:
```bash
export PATH="$(npm bin -g):$PATH"
```

### Hook skips with "install jq or python3" warning

Neither runtime is installed. Install one:
```bash
brew install python3   # macOS
apt install python3    # Ubuntu/Debian
```

See [`runtime_requirements.md`](./runtime_requirements.md) for platform-specific instructions.

### App name is wrong after upgrade

Upgrade extracts the app name from the existing `.claude/CLAUDE.md` line `**App:** <name>`. If that line was removed, it falls back to `package.json`. Edit `.claude/CLAUDE.md` after upgrade and correct the `**App:**` line.

### Steering files changed without `--force`

Standard upgrade never touches steering files. If they changed, check for a concurrent git merge — the changes are from git, not the upgrade command.

### MCP: "environment variable not set"

Your shell hasn't loaded `.env.mcp`. Run:
```bash
direnv allow          # if using direnv
# or
source .env.mcp       # one-off manual load
```

### MCP: token prompt says "already set" but I want to change it

```bash
npx ai-gov mcp update-token --tool jira
```

### CI failure: `ai-gov pr-check` exits non-zero

Run the check locally to see the error:
```bash
npx ai-gov pr-check
```

Common causes: missing steering files, hooks not present, python3/jq not in CI runner. Add `python3` to your CI image if using Alpine-based containers.
