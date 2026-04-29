# ai-gov Workspace Setup Guide — Git Hooks, CI & PR Check

> **Who this is for:** Team leads and developers setting up governance across a workspace
> that contains multiple projects (backend APIs, frontend apps, mobile apps, etc.).
>
> **This guide covers both workspace layouts end-to-end:**
> - Layout A — Grouped (backend/ + frontend/ folders)
> - Layout B — Flat (all projects at root level)

**Version:** 16.0.0

---

## Table of Contents

1. [Understand the two workspace layouts](#1-understand-the-two-workspace-layouts)
2. [Understand the three governance layers](#2-understand-the-three-governance-layers)
3. [Prerequisites](#3-prerequisites)
4. [Step 1 — Workspace Init (Layer 1 for all projects at once)](#4-step-1--workspace-init)
5. [Step 2 — Git Hooks per project (Layer 2)](#5-step-2--git-hooks-per-project)
6. [Step 3 — CI per project (Layer 3)](#6-step-3--ci-per-project)
7. [Step 4 — PR Check per project](#7-step-4--pr-check-per-project)
8. [Step 5 — Commit everything](#8-step-5--commit-everything)
9. [What each developer does after cloning](#9-what-each-developer-does-after-cloning)
10. [Verification checklist](#10-verification-checklist)
11. [Layout A — full command list](#11-layout-a--full-command-list)
12. [Layout B — full command list](#12-layout-b--full-command-list)
13. [Common mistakes](#13-common-mistakes)

---

## 1. Understand the two workspace layouts

Before running any command, identify which layout your workspace uses.

### Layout A — Grouped (backend + frontend folders)

Projects are organised into type-based folders.

```
my-workspace/                   ← workspace root
  backend/
    accushield-kiosk-apis/      ← Node.js project
    corporate_node/             ← Node.js project
    monitor_nodejs/             ← Node.js project
  frontend/
    corporate_angular/          ← Angular project
```

Each project lives at a **2-level path**: `backend/accushield-kiosk-apis`, `frontend/corporate_angular`

---

### Layout B — Flat (all projects at root level)

Projects sit directly inside the workspace root.

```
my-workspace/                   ← workspace root
  accushield-kiosk-apis/        ← Node.js project
  amazonq/                      ← Node.js project
  corporate_node/               ← Node.js project
  monitor_nodejs/               ← Node.js project
  staff-server/                 ← Node.js project
  volunteer-server/             ← Node.js project
```

Each project lives at a **1-level path**: `accushield-kiosk-apis`, `corporate_node`

---

> **Which one is mine?**
> - If your projects are inside `backend/` or `frontend/` folders → **Layout A**
> - If your projects sit directly in the workspace root → **Layout B**

---

## 2. Understand the three governance layers

Each project in your workspace gets three independent governance layers.
They are run separately — you are in full control of which layers to apply.

```
Layer 1 — AI Steering       ai-gov workspace (or ai-gov init --dir <project>)
                            → generates .claude/ governance files
                            → Claude reads these automatically in every session
                            → done ONCE by the team lead, committed to git

Layer 2 — Git Hooks         ai-gov init --git-hooks --dir <project>
                            → generates pre-commit + commit-msg hook scripts
                            → fires every time ANY developer runs `git commit`
                            → scripts committed to git, local wrappers installed per-developer

Layer 3 — CI + PR Check     ai-gov init --ci github --dir <project>
                            → generates a CI pipeline file
                            → runs governance check on every pull request automatically
                            → done ONCE by team lead, committed to git
```

**Rule of thumb:**
- Team lead does Steps 1–5 once, then commits and pushes.
- Every developer runs Step 9 once after cloning.

---

## 3. Prerequisites

Run these checks before starting:

```bash
node --version     # must be >= 18.0.0
jq --version       # must be >= 1.6 (most common missing tool)
git --version
claude --version   # Claude Code CLI
```

### Install jq if missing

```bash
# macOS
brew install jq

# Ubuntu / Debian / WSL2
sudo apt-get install -y jq

# Windows (PowerShell as admin, then install Git Bash too)
winget install jqlang.jq
```

> **jq is critical.** If jq is not installed, every governance hook silently skips with no error.
> Run `jq --version` to confirm before proceeding.

### Install ai-gov

```bash
npm install -g ai-gov
ai-gov --version    # → 16.0.0
```

---

## 4. Step 1 — Workspace Init

**Who runs this:** Team lead, once.
**What it does:** Generates governance (Layer 1) for every project automatically.

### Layout A

```bash
ai-gov workspace --dir /path/to/my-workspace
```

What the CLI does:
1. Finds `backend/` and `frontend/` group folders
2. Scans each sub-directory, detects stack (Node.js, Angular, etc.)
3. Runs full `ai-gov init` for each project in their own directory
4. Generates workspace-level steering files at the root

Output you will see:

```
============================================
 AI Governance — Workspace Init (my-workspace)
============================================

Discovered 4 project(s):
  + backend/accushield-kiosk-apis  [nodejs]
  + backend/corporate_node         [nodejs]
  + backend/monitor_nodejs         [nodejs]
  + frontend/corporate_angular     [angular]

============================================
 Project: backend/accushield-kiosk-apis
============================================
  Created: .claude/CLAUDE.md
  Created: .claude/steering/architecture.md
  ...

============================================
 Workspace: my-workspace
============================================
  Created: .claude/CLAUDE.md
  Created: .claude/steering/workspace-policy.md
  Created: .claude/steering/cross-project-rules.md
  Created: .claude/steering/project-registry.md
```

---

### Layout B

```bash
ai-gov workspace --dir /path/to/my-workspace
```

Identical command. The CLI auto-detects the flat layout.

What the CLI does:
1. Scans each directory directly under workspace root
2. Detects stack per project
3. Runs full `ai-gov init` for each project
4. Generates workspace-level steering files at root

---

### What gets generated after Step 1

**Layout A result:**
```
my-workspace/
  .claude/                            ← workspace governance
    CLAUDE.md
    steering/
      workspace-policy.md
      cross-project-rules.md
      project-registry.md

  backend/
    accushield-kiosk-apis/
      .claude/                        ← Node.js governance
        CLAUDE.md                         (has workspace reference at bottom)
        steering/
          architecture.md
          coding-standards.md
          ai-usage-policy.md
          constitution.md
          workflow.md
          spec-first-workflow.md
          feature-readme.md
          prompt-templates.md
        hooks/                        ← 11 Claude Code hook scripts
        commands/                     ← 7 slash commands
        settings.json
      specs/_template/
    corporate_node/
      .claude/  specs/
    monitor_nodejs/
      .claude/  specs/

  frontend/
    corporate_angular/
      .claude/                        ← Angular governance
        CLAUDE.md
        steering/  hooks/  commands/
      specs/_template/
```

**Layout B result:** Same structure but projects are directly under `my-workspace/` (no `backend/` or `frontend/` wrapper).

---

### Preview before writing (optional)

```bash
ai-gov workspace --dir /path/to/my-workspace --dry-run
```

Nothing gets written. Shows every file that would be created.

---

### Init only specific projects (optional)

```bash
# Layout A — only two projects
ai-gov workspace --dir /path/to/my-workspace --only backend/corporate_node,frontend/corporate_angular

# Layout B — only two projects
ai-gov workspace --dir /path/to/my-workspace --only corporate_node,staff-server
```

---

## 5. Step 2 — Git Hooks per project

**Who runs this:** Team lead, once per project.
**What it does:** Generates pre-commit and commit-msg bash scripts per project.

Git hooks are per-project. You run `ai-gov init --git-hooks` separately for each project.

### Layout A — run for each backend and frontend project

```bash
# Backend projects
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/monitor_nodejs

# Frontend projects
ai-gov init --git-hooks --dir /path/to/my-workspace/frontend/corporate_angular
```

### Layout B — run for each project

```bash
ai-gov init --git-hooks --dir /path/to/my-workspace/accushield-kiosk-apis
ai-gov init --git-hooks --dir /path/to/my-workspace/amazonq
ai-gov init --git-hooks --dir /path/to/my-workspace/corporate_node
ai-gov init --git-hooks --dir /path/to/my-workspace/monitor_nodejs
ai-gov init --git-hooks --dir /path/to/my-workspace/staff-server
ai-gov init --git-hooks --dir /path/to/my-workspace/volunteer-server
```

---

### What gets added per project

```
project/
  .claude/
    git-hooks/                   ← committed to git (team gets these)
      pre-commit.sh              ← runs all enabled checks on staged files
      commit-msg.sh              ← validates commit message format
      config.json                ← enable/disable checks, set thresholds
      checks/
        file-size.sh             ← BLOCKS files > 300 lines
        secrets.sh               ← BLOCKS AWS keys, tokens, passwords
        no-todos.sh              ← warns on TODO/FIXME/HACK
        no-debug.sh              ← warns on console.log / debugger
        format-check.sh          ← (off by default)
        lint-check.sh            ← (off by default)

  .git/
    hooks/
      pre-commit                 ← local wrapper → .claude/git-hooks/pre-commit.sh
      commit-msg                 ← local wrapper → .claude/git-hooks/commit-msg.sh
```

> **Important distinction:**
> - `.claude/git-hooks/` is **committed to git** — the whole team gets the check logic
> - `.git/hooks/` is **NOT committed** — each developer installs the local wrapper once
> - See [Step 9](#9-what-each-developer-does-after-cloning) for developer instructions

---

### What happens when a developer commits in any project

```
$ cd backend/corporate_node
$ git add src/services/auth.service.ts
$ git commit -m "feat(auth): add JWT refresh token"

  Governance pre-commit check
  ───────────────────────────────
  All checks passed.

[feature/auth abc1234] feat(auth): add JWT refresh token
```

**If a secret is found:**
```
  BLOCKED  secrets: src/config/api.ts — AWS Access Key ID (AKIA pattern)
           Move to environment variables or AWS Secrets Manager.
  1 blocking issue(s). Fix and try again.
```

**If commit message is wrong:**
```
  BLOCKED  commit message does not follow conventional format
  Expected: <type>(<scope>): <description>
  Types:    feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
  Your message: "fixed stuff"
```

---

### Configuring checks per project

Each project has its own `config.json` — you can have different thresholds per project.

```bash
# Example: tighten file size limit for the Angular frontend
nano /path/to/my-workspace/frontend/corporate_angular/.claude/git-hooks/config.json
```

```json
{
  "pre-commit": {
    "file-size": { "enabled": true, "max-lines": 200 },
    "secrets": { "enabled": true },
    "no-todos": { "enabled": true, "allow-with-ticket": true }
  },
  "commit-msg": {
    "conventional-commits": true,
    "min-description-length": 10
  }
}
```

---

### If the project already uses Husky

Do **not** use `--force`. Instead add to `.husky/pre-commit`:
```bash
bash .claude/git-hooks/pre-commit.sh
```
Add to `.husky/commit-msg`:
```bash
bash .claude/git-hooks/commit-msg.sh "$1"
```

---

## 6. Step 3 — CI per project

**Who runs this:** Team lead, once per project.
**What it does:** Generates a CI pipeline that runs `ai-gov pr-check` on every pull request.

CI is per-project (each project has its own CI config). Choose your platform.

---

### GitHub Actions

#### Layout A
```bash
ai-gov init --ci github --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --ci github --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --ci github --dir /path/to/my-workspace/backend/monitor_nodejs
ai-gov init --ci github --dir /path/to/my-workspace/frontend/corporate_angular
```

#### Layout B
```bash
ai-gov init --ci github --dir /path/to/my-workspace/accushield-kiosk-apis
ai-gov init --ci github --dir /path/to/my-workspace/corporate_node
ai-gov init --ci github --dir /path/to/my-workspace/monitor_nodejs
ai-gov init --ci github --dir /path/to/my-workspace/staff-server
ai-gov init --ci github --dir /path/to/my-workspace/volunteer-server
```

Each project gets:
```
project/
  .github/
    workflows/
      governance-check.yml     ← runs on every PR to main/develop
```

No tokens or secrets needed — GitHub provides `GITHUB_TOKEN` automatically.

---

### GitLab CI

#### Layout A
```bash
ai-gov init --ci gitlab --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --ci gitlab --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --ci gitlab --dir /path/to/my-workspace/backend/monitor_nodejs
ai-gov init --ci gitlab --dir /path/to/my-workspace/frontend/corporate_angular
```

#### Layout B
```bash
ai-gov init --ci gitlab --dir /path/to/my-workspace/accushield-kiosk-apis
ai-gov init --ci gitlab --dir /path/to/my-workspace/corporate_node
# ... repeat for each project
```

Each project gets `.gitlab-ci.yml` with a `governance-check` job. If `.gitlab-ci.yml` already exists, the job is appended — your existing pipeline is not overwritten.

---

### Bitbucket Pipelines

#### Layout A
```bash
ai-gov init --ci bitbucket --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --ci bitbucket --dir /path/to/my-workspace/backend/corporate_node
# ... repeat for each project
```

#### Layout B
```bash
ai-gov init --ci bitbucket --dir /path/to/my-workspace/accushield-kiosk-apis
ai-gov init --ci bitbucket --dir /path/to/my-workspace/corporate_node
# ... repeat for each project
```

Each project gets `bitbucket-pipelines.yml`.

---

### What a developer sees on their PR (all platforms)

When a PR is opened in any project, the CI pipeline posts a comment automatically:

```
Governance Review
─────────────────────────────────────────
Changed files: 6 | Blockers: 0 | Warnings: 1

  Architecture      PASS
  File Size         WARN   1 file exceeds 300 lines
  Credentials       PASS
  Spec Coverage     PASS
  Test Coverage     PASS
  TODOs             PASS
  Commit Messages   PASS
  PR Description    PASS

  1 warning — merge allowed
```

If a blocker is found (e.g. a hardcoded credential), the pipeline exits with code 1 and blocks the merge button until it is fixed.

---

## 7. Step 4 — PR Check per project

**Who runs this:** Team lead or any developer.
**What it does:** Runs governance checks locally against the current branch.

You can run `pr-check` at any time in any project — you do not need CI to use it.

### Layout A

```bash
# Check a branch in a backend project
cd /path/to/my-workspace/backend/corporate_node
ai-gov pr-check --base main

# Check a branch in the frontend project
cd /path/to/my-workspace/frontend/corporate_angular
ai-gov pr-check --base main
```

Or without cd:
```bash
ai-gov pr-check --base main --dir /path/to/my-workspace/backend/corporate_node
ai-gov pr-check --base main --dir /path/to/my-workspace/frontend/corporate_angular
```

### Layout B

```bash
ai-gov pr-check --base main --dir /path/to/my-workspace/corporate_node
ai-gov pr-check --base main --dir /path/to/my-workspace/staff-server
ai-gov pr-check --base main --dir /path/to/my-workspace/volunteer-server
```

### Output formats

```bash
# Human-readable (default)
ai-gov pr-check --base main --dir /path/to/project

# GitHub markdown (paste into PR comment manually)
ai-gov pr-check --format github --dir /path/to/project

# GitLab markdown
ai-gov pr-check --format gitlab --dir /path/to/project

# JSON (for scripts)
ai-gov pr-check --format json --dir /path/to/project | jq '.summary'
```

### 8 checks run on every PR

| Check | What it looks for | Blocks merge |
|-------|-------------------|:------------:|
| Architecture | Files crossing layer boundaries | — |
| File Size | Source files > 300 lines | — |
| Credentials | AWS keys, credential-named variables | Yes |
| Spec Coverage | Feature changed but no spec found | — |
| Test Coverage | New source file without a test file | — |
| TODOs | `TODO` / `FIXME` / `HACK` in added lines | — |
| Commit Messages | Non-conventional format | — |
| PR Description | PR template presence | — |

Only Credentials blocks by default. All others are warnings.

---

## 8. Step 5 — Commit everything

After completing Steps 1–4, commit the generated files for every project.

### Layout A — commit per project

```bash
# Backend projects
cd /path/to/my-workspace/backend/accushield-kiosk-apis
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

cd /path/to/my-workspace/backend/corporate_node
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

cd /path/to/my-workspace/backend/monitor_nodejs
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

# Frontend project
cd /path/to/my-workspace/frontend/corporate_angular
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

# Workspace root (shared steering files)
cd /path/to/my-workspace
git add .claude/ CLAUDE.md
git commit -m "chore: add workspace-level governance"
git push
```

### Layout B — commit per project

```bash
cd /path/to/my-workspace/accushield-kiosk-apis
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

cd /path/to/my-workspace/corporate_node
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push

# Repeat for each project...

# Workspace root
cd /path/to/my-workspace
git add .claude/ CLAUDE.md
git commit -m "chore: add workspace-level governance"
git push
```

> **What to commit:**
> - `.claude/` — all governance files (steering, hooks, commands, settings)
> - `specs/` — spec templates
> - `CLAUDE.md` — root redirect file
> - `.github/` or `.gitlab-ci.yml` or `bitbucket-pipelines.yml` — CI config
>
> **Do NOT commit:**
> - `.git/hooks/` — local wrappers (these are machine-specific, each dev installs their own)
> - `.env` files

---

## 9. What each developer does after cloning

**One-time setup per project.** Each developer runs this after cloning any project in the workspace.

### Layout A — developer setup

```bash
# After cloning accushield-kiosk-apis:
cd /path/to/my-workspace/backend/accushield-kiosk-apis
npm install
ai-gov init --git-hooks --dir .    # installs local .git/hooks/ wrappers

# After cloning corporate_node:
cd /path/to/my-workspace/backend/corporate_node
npm install
ai-gov init --git-hooks --dir .

# After cloning corporate_angular:
cd /path/to/my-workspace/frontend/corporate_angular
npm install
ai-gov init --git-hooks --dir .
```

### Layout B — developer setup

```bash
# After cloning any project:
cd /path/to/my-workspace/corporate_node
npm install
ai-gov init --git-hooks --dir .

cd /path/to/my-workspace/staff-server
npm install
ai-gov init --git-hooks --dir .
```

### Verify it worked

```bash
ai-gov doctor --dir .
```

Expected output:
```
  ✓ CLAUDE.md exists
  ✓ .claude/CLAUDE.md exists
  ✓ .claude/settings.json exists
  ✓ specs/_template/ exists
  ✓ .claude/hooks/ exists
  ✓   protect-files.sh
  ✓   check-secrets.sh
  ✓   block-dangerous-commands.sh
  ...
  ✓ jq installed
```

---

## 10. Verification checklist

Run this after full setup to confirm every project is correctly governed.

### Team lead checklist (per project)

```bash
# Repeat for every project in the workspace
ai-gov doctor --dir /path/to/project
```

| What to check | Command |
|--------------|---------|
| All governance files present | `ai-gov doctor --dir <project>` |
| Git hooks wired | Try `git commit` with bad message — should be blocked |
| CI pipeline file exists | Check `.github/workflows/governance-check.yml` |
| Workspace steering files exist | `ls /path/to/workspace/.claude/steering/` |
| Workspace reference in project | `grep "Workspace Rules" <project>/.claude/CLAUDE.md` |

### Quick test — does git hook enforcement work?

```bash
# Test inside any project
cd /path/to/project

# Try a bad commit message — should be BLOCKED
echo "test" > /tmp/test-governance.txt
git add /tmp/test-governance.txt 2>/dev/null || true
git commit -m "bad message"
# Expected: BLOCKED — commit message does not follow conventional format

# Clean up
git restore --staged . 2>/dev/null || true
```

### Quick test — does Claude read the rules?

Open Claude Code in any project directory:
```bash
cd /path/to/project
claude
```

Ask Claude: `"What stack is this project and what are the layer rules?"`

Claude should answer by reading `.claude/CLAUDE.md` and describing your architecture correctly. If it doesn't know, run `ai-gov doctor` to check that `.claude/CLAUDE.md` exists.

---

## 11. Layout A — full command list

Copy-paste the full setup for a grouped workspace.

```bash
# ─── STEP 1: Workspace init (all projects, Layer 1) ──────────────────────────
ai-gov workspace --dir /path/to/my-workspace

# ─── STEP 2: Git hooks (Layer 2) ─────────────────────────────────────────────
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/monitor_nodejs
ai-gov init --git-hooks --dir /path/to/my-workspace/frontend/corporate_angular

# ─── STEP 3: CI — GitHub Actions (Layer 3) ───────────────────────────────────
ai-gov init --ci github --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov init --ci github --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --ci github --dir /path/to/my-workspace/backend/monitor_nodejs
ai-gov init --ci github --dir /path/to/my-workspace/frontend/corporate_angular

# ─── STEP 4: Verify ──────────────────────────────────────────────────────────
ai-gov doctor --dir /path/to/my-workspace/backend/accushield-kiosk-apis
ai-gov doctor --dir /path/to/my-workspace/backend/corporate_node
ai-gov doctor --dir /path/to/my-workspace/backend/monitor_nodejs
ai-gov doctor --dir /path/to/my-workspace/frontend/corporate_angular

# ─── STEP 5: Commit (per project) ────────────────────────────────────────────
for project in \
  backend/accushield-kiosk-apis \
  backend/corporate_node \
  backend/monitor_nodejs \
  frontend/corporate_angular; do
  cd /path/to/my-workspace/$project
  git add .claude/ specs/ CLAUDE.md .github/
  git commit -m "chore: add ai-gov governance framework v16.0.0"
  git push
  cd /path/to/my-workspace
done

# Workspace root
cd /path/to/my-workspace
git add .claude/ CLAUDE.md
git commit -m "chore: add workspace-level governance"
git push
```

---

## 12. Layout B — full command list

Copy-paste the full setup for a flat workspace.

```bash
# Set your workspace path once
WORKSPACE=/path/to/my-workspace

# ─── STEP 1: Workspace init (all projects, Layer 1) ──────────────────────────
ai-gov workspace --dir $WORKSPACE

# ─── STEP 2: Git hooks (Layer 2) ─────────────────────────────────────────────
ai-gov init --git-hooks --dir $WORKSPACE/accushield-kiosk-apis
ai-gov init --git-hooks --dir $WORKSPACE/amazonq
ai-gov init --git-hooks --dir $WORKSPACE/corporate_node
ai-gov init --git-hooks --dir $WORKSPACE/monitor_nodejs
ai-gov init --git-hooks --dir $WORKSPACE/staff-server
ai-gov init --git-hooks --dir $WORKSPACE/volunteer-server

# ─── STEP 3: CI — GitHub Actions (Layer 3) ───────────────────────────────────
ai-gov init --ci github --dir $WORKSPACE/accushield-kiosk-apis
ai-gov init --ci github --dir $WORKSPACE/amazonq
ai-gov init --ci github --dir $WORKSPACE/corporate_node
ai-gov init --ci github --dir $WORKSPACE/monitor_nodejs
ai-gov init --ci github --dir $WORKSPACE/staff-server
ai-gov init --ci github --dir $WORKSPACE/volunteer-server

# ─── STEP 4: Verify ──────────────────────────────────────────────────────────
for project in accushield-kiosk-apis amazonq corporate_node monitor_nodejs staff-server volunteer-server; do
  ai-gov doctor --dir $WORKSPACE/$project
done

# ─── STEP 5: Commit (per project) ────────────────────────────────────────────
for project in accushield-kiosk-apis amazonq corporate_node monitor_nodejs staff-server volunteer-server; do
  cd $WORKSPACE/$project
  git add .claude/ specs/ CLAUDE.md .github/
  git commit -m "chore: add ai-gov governance framework v16.0.0"
  git push
done

# Workspace root
cd $WORKSPACE
git add .claude/ CLAUDE.md
git commit -m "chore: add workspace-level governance"
git push
```

---

## 13. Common mistakes

### Mistake 1 — Running workspace init inside a project folder

```bash
# WRONG — this runs single-project init, not workspace init
cd my-workspace/backend/corporate_node
ai-gov workspace

# CORRECT — always run from workspace root
ai-gov workspace --dir /path/to/my-workspace
```

---

### Mistake 2 — Running git-hooks init at workspace root instead of per project

```bash
# WRONG — workspace root has no git hooks target
ai-gov init --git-hooks --dir /path/to/my-workspace

# CORRECT — run per project
ai-gov init --git-hooks --dir /path/to/my-workspace/backend/corporate_node
ai-gov init --git-hooks --dir /path/to/my-workspace/frontend/corporate_angular
```

---

### Mistake 3 — Forgetting to run init --git-hooks after cloning (as a developer)

Symptom: you push bad commit messages and nothing blocks them.

Fix:
```bash
cd /path/to/project
ai-gov init --git-hooks --dir .
```

Each developer must do this once. The `.git/hooks/` wrappers are not committed to git.

---

### Mistake 4 — CI check not running

Symptom: PRs open but no governance comment appears.

Check:
```bash
ls /path/to/project/.github/workflows/
# Should show: governance-check.yml
```

If missing:
```bash
ai-gov init --ci github --dir /path/to/project
cd /path/to/project
git add .github/
git commit -m "ci: add governance PR check"
git push
```

---

### Mistake 5 — Workspace reference not in project CLAUDE.md

Symptom: Claude doesn't know about workspace-level rules when working in a project.

Check:
```bash
grep "Workspace Rules" /path/to/project/.claude/CLAUDE.md
```

If missing, re-run workspace init:
```bash
ai-gov workspace --dir /path/to/workspace --only backend/corporate_node
```

---

### Mistake 6 — jq not installed

Symptom: git commits go through with no checks at all — no blocked messages, no output from hooks.

Fix:
```bash
jq --version    # if this fails, jq is missing
brew install jq # macOS
sudo apt install jq # Linux
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Init all projects in workspace | `ai-gov workspace --dir <workspace>` |
| Add git hooks to one project | `ai-gov init --git-hooks --dir <project>` |
| Add GitHub CI to one project | `ai-gov init --ci github --dir <project>` |
| Add GitLab CI to one project | `ai-gov init --ci gitlab --dir <project>` |
| Add Bitbucket CI to one project | `ai-gov init --ci bitbucket --dir <project>` |
| Run PR check locally | `ai-gov pr-check --base main --dir <project>` |
| Verify setup | `ai-gov doctor --dir <project>` |
| Developer one-time setup | `ai-gov init --git-hooks --dir <project>` |
| Preview without writing | `ai-gov workspace --dir <workspace> --dry-run` |
| Init specific projects only | `ai-gov workspace --dir <workspace> --only path/a,path/b` |
