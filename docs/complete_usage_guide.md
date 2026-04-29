# ai-gov Complete Usage Guide — v16.0.0

> Step-by-step guide for developers, team leads, and CI/CD engineers.
> Covers all three governance layers: AI Steering · Git Hooks · CI + PR Check.

**Version:** 16.0.0
**Audience:** New adopters and teams upgrading from v15.1.0

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Installation](#2-installation)
3. [Layer 1 — AI Steering (ai-gov init)](#3-layer-1--ai-steering)
4. [Layer 2 — Git Hooks (ai-gov init --git-hooks)](#4-layer-2--git-hooks)
5. [Layer 3 — CI + PR Check (ai-gov init --ci + ai-gov pr-check)](#5-layer-3--ci--pr-check)
6. [Daily Developer Workflow](#6-daily-developer-workflow)
7. [Team Lead Configuration](#7-team-lead-configuration)
8. [Slash Commands Reference](#8-slash-commands-reference)
9. [All CLI Commands Reference](#9-all-cli-commands-reference)
10. [Upgrading from v15.1.0](#10-upgrading-from-v1510)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

Before starting, verify these are installed:

```bash
node --version     # must be >= 18.0.0
npm --version      # any recent version
git --version      # any recent version
jq --version       # must be >= 1.6  ← most common missing tool
claude --version   # Claude Code CLI
```

### Install jq (required by ALL hooks)

```bash
# macOS
brew install jq

# Ubuntu / Debian / WSL2
sudo apt-get update && sudo apt-get install -y jq

# Windows (PowerShell as admin)
winget install jqlang.jq
# Also install Git Bash: https://git-scm.com/download/win
```

> **jq is the #1 setup issue.** If jq is missing, every governance hook silently skips. You get zero enforcement with no error message.

### Windows note

The CLI (`ai-gov init`) runs on bare Windows. The bash hook scripts (`.claude/git-hooks/*.sh`, `.git/hooks/*`) require **Git Bash or WSL2** in PATH. Without it, git hooks fire but bash isn't found — they silently skip.

---

## 2. Installation

### Option A — npm (recommended for teams)

```bash
npm install -g ai-gov
ai-gov --version    # → 16.0.0
```

### Option B — npx (no install)

```bash
npx ai-gov init
npx ai-gov doctor
```

### Option C — From source

```bash
git clone https://github.com/jvvsrinukumar/ai-gov-cli.git
cd ai-gov-cli
npm install
npm run build
npm link            # makes 'ai-gov' available globally
ai-gov --version    # → 16.0.0
```

---

## 3. Layer 1 — AI Steering

Layer 1 generates governance files that **Claude Code reads before every task**. This is the foundation — Layers 2 and 3 build on it.

### Step 1: Navigate to your project

```bash
cd /path/to/your/project
```

Your project must have a manifest file (`pubspec.yaml`, `package.json`, `build.gradle.kts`, `pyproject.toml`, or `Package.swift`) for auto-detection. If it doesn't, use `--stack` explicitly.

### Step 2: Preview first (optional but recommended)

```bash
ai-gov init --dry-run
```

Shows every file that would be created with line counts — nothing is written. Example output:

```
============================================
 AI Governance v16.0.0 (Scan-Adaptive · Claude Code)
============================================

  ~ Detecting stack...
  + State: flutter_bloc
  + DI: injectable / get_it
  + Router: go_router
  + Network: Dio
  + DB: Hive
  + Code gen: freezed, json_serializable

  [dry-run] CLAUDE.md (new file, 4 lines)
  [dry-run] .claude/CLAUDE.md (new file, 120 lines)
  [dry-run] .claude/settings.json (new file, 108 lines)
  [dry-run] .claude/steering/constitution.md (new file, 36 lines)
  [dry-run] .claude/steering/architecture.md (new file, 50 lines)
  [dry-run] .claude/steering/coding-standards.md (new file, 54 lines)
  [dry-run] .claude/steering/ai-usage-policy.md (new file, 42 lines)
  [dry-run] .claude/steering/workflow.md (new file, 49 lines)
  [dry-run] .claude/steering/spec-first-workflow.md (new file, 48 lines)
  [dry-run] .claude/steering/feature-readme.md (new file, 28 lines)
  [dry-run] .claude/steering/prompt-templates.md (new file, 63 lines)
  [dry-run] .claude/hooks/protect-files.sh (new file, 17 lines)
  [dry-run] .claude/hooks/check-spec-exists.sh (new file, 111 lines)
  ... (31 files total)
```

### Step 3: Generate governance files

```bash
ai-gov init
```

If auto-detection picks the wrong stack, specify it:

```bash
ai-gov init --stack flutter
ai-gov init --stack react
ai-gov init --stack kotlin
ai-gov init --stack nodejs
ai-gov init --stack angular
ai-gov init --stack python
ai-gov init --stack swiftui
```

### Step 4: Verify the setup

```bash
ai-gov doctor
```

Expected output:

```
============================================
 AI Governance Doctor
============================================

  ✓ CLAUDE.md exists
  ✓ .claude/CLAUDE.md exists
  ✓ .claude/settings.json exists
  ✓ specs/_template/ exists
  ✓ .claude/hooks/ exists
  ✓   protect-files.sh
  ✓   check-secrets.sh
  ✓   block-dangerous-commands.sh
  ✓   check-spec-exists.sh
  ✓   session-continuity.sh
  ✓   format-code.sh
  ✓   analyze-code.sh
  ✓   check-feature-readme.sh
  ✓   check-consistency.sh
  ✓   check-file-size.sh
  ✓   post-task-checklist.sh
  ✓ jq installed (required by hooks)

All checks passed!
```

If any hook shows `✗`, run `ai-gov init` again. If jq shows `✗`, install it first.

### Step 5: Commit the governance files

```bash
git add .claude/ specs/ CLAUDE.md
git commit -m "chore: add AI governance framework v16.0.0"
git push
```

Every developer who pulls gets the same Claude Code governance automatically. The `.claude/settings.json` registers all hooks — Claude Code reads it on startup.

### Step 6: Open Claude Code and verify

```bash
cd /path/to/your/project
claude
```

Claude Code reads `.claude/CLAUDE.md` and all steering files on startup. Test it:

```
> build a hello world screen
```

Claude should:
1. Check if `specs/hello-world/` exists
2. If not — create spec files from `specs/_template/`, fill them out, **stop and wait for your "go ahead"**
3. After you approve — implement phase by phase

If Claude skips straight to coding without spec, check: `ls .claude/CLAUDE.md` and `jq --version`.

---

## 4. Layer 2 — Git Hooks

Layer 2 installs governance checks that run on **every `git commit`** — before code ever reaches a PR.

### Step 1: Generate and install git hooks

```bash
ai-gov init --git-hooks
```

What this does:

```
Git Hooks:
  Created: .claude/git-hooks/config.json
  Created: .claude/git-hooks/pre-commit.sh
  Created: .claude/git-hooks/commit-msg.sh
  Created: .claude/git-hooks/checks/file-size.sh
  Created: .claude/git-hooks/checks/secrets.sh
  Created: .claude/git-hooks/checks/no-todos.sh
  Created: .claude/git-hooks/checks/no-debug.sh
  Created: .claude/git-hooks/checks/format-check.sh
  Created: .claude/git-hooks/checks/lint-check.sh
  + Git hook scripts made executable
  Created: .git/hooks/pre-commit
  Created: .git/hooks/commit-msg
```

### Step 2: Commit the git-hooks directory

```bash
git add .claude/git-hooks/
git commit -m "chore: add git governance hooks v16.0.0"
git push
```

> **Important:** `.claude/git-hooks/` is committed to the repo so every teammate gets the same checks when they pull. The `.git/hooks/` wrappers are local-only and each developer installs them once (see Step 3).

### Step 3: Each developer installs their local wrappers

When a teammate pulls the repo for the first time, they run:

```bash
ai-gov init --git-hooks
```

The CLI detects that `.claude/git-hooks/` already exists and installs only the `.git/hooks/` thin wrappers locally. No files are overwritten.

### Step 4: Test the hooks

```bash
# Test pre-commit: stage something and commit
echo "AKIA_EXAMPLE_KEY_FOR_DOCS" > test-secret.txt
git add test-secret.txt
git commit -m "test"
```

Expected:

```
  🔒 Pre-commit governance check
  ───────────────────────────────
  ❌ SECRETS: test-secret.txt — AWS Access Key ID detected (AKIA pattern)
     → Use environment variables or AWS Secrets Manager

  ❌ 1 blocking issue(s) found. Fix and try again.
  (bypass with: git commit --no-verify)
```

```bash
# Clean up
git restore --staged test-secret.txt
rm test-secret.txt
```

```bash
# Test commit-msg validator
git commit --allow-empty -m "stuff"
```

Expected:

```
  ❌ COMMIT MESSAGE: doesn't follow conventional format

  Expected: <type>(<scope>): <description>
  Types:    feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
  Minimum:  10 characters in description

  Your message: "stuff"
```

### Existing hook system (husky / lefthook / pre-commit)

If your project already uses a hook system, the CLI detects it and prints integration guidance instead of overwriting:

```
  Existing hook system detected: husky

  ai-gov scripts are generated in .claude/git-hooks/ (committed to repo).
  To integrate with husky, add to .husky/pre-commit:

    bash .claude/git-hooks/pre-commit.sh

  And add to .husky/commit-msg:

    bash .claude/git-hooks/commit-msg.sh "$1"

  Or to replace husky entirely:
    ai-gov init --git-hooks --force
```

To force-overwrite `.git/hooks/` regardless:

```bash
ai-gov init --git-hooks --force
```

---

## 5. Layer 3 — CI + PR Check

Layer 3 runs governance checks on **every PR/MR** and posts results as a comment.

### Part A: Generate CI pipeline config

#### GitHub Actions

```bash
ai-gov init --ci github
```

Creates `.github/workflows/governance-check.yml`. Commit and push:

```bash
git add .github/workflows/governance-check.yml
git commit -m "chore: add GitHub Actions governance check"
git push
```

Every PR now gets a governance comment automatically. Example:

```
🏛️ Governance Review

Changed files: 12 | Blockers: 0 | Warnings: 2

⚠️ This PR has warnings. Merge is allowed but consider addressing them.

✅ Architecture: No layer boundary violations detected
✅ File Size: All files within size limits
✅ Credentials: No credentials detected in diff
✅ Spec Coverage: All feature files have matching specs
⚠️ Test Coverage: 2 source file(s) without tests
   → src/features/payment/PaymentService.ts: No corresponding test file found
✅ TODOs: No TODO/FIXME/HACK/XXX in added lines
⚠️ Commit Messages: 1 commit(s) don't follow conventional format
   → commit: Non-conventional commit: "WIP"
✅ PR Description: PR template exists

---
Generated by ai-gov
```

#### GitLab

```bash
ai-gov init --ci gitlab
```

Appends a `governance-check` job to `.gitlab-ci.yml` (or creates the file if it doesn't exist). Commit and push.

#### Bitbucket

```bash
ai-gov init --ci bitbucket
```

Creates `bitbucket-pipelines.yml`. Commit and push.

---

### Part B: Run pr-check locally

You can run the same checks locally before pushing:

```bash
# Check against main (default)
ai-gov pr-check

# Check against a different base branch
ai-gov pr-check --base develop

# Simulate GitHub PR comment format
ai-gov pr-check --format github

# Machine-readable JSON for scripting
ai-gov pr-check --format json

# Run from a different directory
ai-gov pr-check --base main -d /path/to/your/project
```

Example terminal output:

```
  ════════════════════════════════════
    Governance PR Check
  ════════════════════════════════════
  Changed files: 8

  ✅ Architecture: No layer boundary violations detected
  ✅ File Size: All files within size limits
  ✅ Credentials: No credentials detected in diff
  ✅ Spec Coverage: All feature files have matching specs
  ⚠️  Test Coverage: 1 source file(s) without tests
    → src/auth/TokenService.ts: No corresponding test file found
  ✅ TODOs: No TODO/FIXME/HACK/XXX in added lines
  ✅ Commit Messages: All 3 commit(s) follow conventional format
  ⏭  PR Description: No PR template found — not applicable in CLI context

  ⚠️  1 warning(s), 7 passed — no blockers
```

Exit codes: `0` = no blockers, `1` = at least one `fail` check.

---

## 6. Daily Developer Workflow

### Starting a feature

```bash
# 1. Create a feature branch
git checkout -b feature/payment-flow

# 2. Open Claude Code
claude

# 3. Ask Claude to build the feature
/new-feature

# Claude creates spec, waits for your approval, then implements
```

### During development — what you see at each commit

#### Normal commit (all checks pass)

```bash
git add src/features/payment/
git commit -m "feat(payment): add payment service layer"

  🔒 Pre-commit governance check
  ───────────────────────────────

  ✅ All checks passed.

[feature/payment-flow abc1234] feat(payment): add payment service layer
 4 files changed, 89 insertions(+)
```

#### Commit blocked — file too large

```bash
git add src/features/payment/PaymentScreen.tsx   # 380 lines
git commit -m "feat(payment): add payment UI"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ❌ FILE SIZE: src/features/payment/PaymentScreen.tsx has 380 lines (max 300)
     → Split into smaller components before committing

  ❌ 1 blocking issue(s) found. Fix and try again.
  (bypass with: git commit --no-verify)
```

**Fix:** Split into `PaymentScreen.tsx` (< 300 lines) + `PaymentForm.tsx`, then commit again.

#### Commit blocked — secret detected

```bash
git add src/config/api.ts
git commit -m "feat: configure payment API"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ❌ SECRETS: src/config/api.ts — AWS Access Key ID detected (AKIA pattern)
     → Use environment variables or AWS Secrets Manager

  ❌ 1 blocking issue(s) found. Fix and try again.
```

**Fix:** Move the key to `.env`, read via `process.env.API_KEY`, commit again.

#### Commit blocked — bad commit message

```bash
git commit -m "fix stuff"

  ❌ COMMIT MESSAGE: doesn't follow conventional format

  Expected: <type>(<scope>): <description>
  Types:    feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
  Minimum:  10 characters in description

  Examples:
    feat: add user profile edit screen
    fix(auth): resolve null pointer in login flow

  Your message: "fix stuff"
```

**Fix:** Use a proper message:

```bash
git commit -m "fix(payment): resolve null check in payment service"
```

#### Commit with TODO — warning only, not blocked

```bash
git add src/features/payment/PaymentService.ts
git commit -m "feat(payment): add payment service"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ⚠️  TODO: src/features/payment/PaymentService.ts — // TODO: handle retry logic

  ⚠️  1 warning(s). Commit allowed — consider fixing.

[feature/payment-flow def5678] feat(payment): add payment service
```

The commit goes through. Warnings don't block.

To suppress a TODO with a ticket reference (allowed by default):

```
// TODO: handle retry logic — PROJ-456
```

This passes without a warning.

### Before raising a PR — local pr-check

Run this before pushing to catch what the CI would flag:

```bash
ai-gov pr-check --base main
```

If there are blockers, fix them before pushing. If there are only warnings, you can push but the CI comment will show them.

### Raising the PR

```bash
git push -u origin feature/payment-flow
# Open PR on GitHub / GitLab / Bitbucket
```

Within ~2 minutes, the CI posts a governance comment on the PR. The comment updates on every new push to the branch.

### If the CI governance check blocks the PR

Only the **Credentials** check is a hard blocker by default (exits 1, fails the required check). All other checks are warnings.

```
❌ Governance Review

Blockers: 1

❌ Credentials: 1 potential credential(s) found
  → diff: AWS Access Key ID detected (AKIA pattern) — use environment variables
```

Fix the credential, push again — the CI re-runs and the comment updates.

---

## 7. Team Lead Configuration

### Configuring git hook thresholds

Edit `.claude/git-hooks/config.json` and commit it. All teammates pick up the new config on next pull.

```json
{
  "pre-commit": {
    "file-size": {
      "enabled": true,
      "max-lines": 250,
      "frontend-only": true,
      "frontend-extensions": [".dart", ".tsx", ".jsx", ".ts", ".kt"],
      "exclude-patterns": ["generated", "schema", "proto", "graphql"]
    },
    "secrets": {
      "enabled": true,
      "skip-dirs": ["test", "tests", "__tests__", "fixtures", "mocks", "seeds"],
      "skip-extensions": [".md", ".txt", ".env.example", ".env.template"]
    },
    "no-todos": {
      "enabled": true,
      "allow-with-ticket": true,
      "ticket-pattern": "PROJ-[0-9]+"
    },
    "no-debug": {
      "enabled": true
    },
    "format-check": {
      "enabled": false
    },
    "lint-check": {
      "enabled": false
    }
  },
  "commit-msg": {
    "conventional-commits": true,
    "allowed-types": ["feat", "fix", "refactor", "hotfix", "docs", "test", "chore", "style", "perf", "ci", "build"],
    "min-description-length": 10,
    "require-ticket-ref": false,
    "ticket-pattern": "PROJ-[0-9]+"
  }
}
```

### Common configuration scenarios

#### Lower file size threshold for a strict frontend team

```json
"file-size": {
  "enabled": true,
  "max-lines": 200,
  "frontend-only": true
}
```

#### Enable format and lint checks for the whole team

Only do this once the team has agreed and all developers have the formatter installed:

```json
"format-check": { "enabled": true },
"lint-check": { "enabled": true }
```

#### Require a ticket reference in every commit

```json
"commit-msg": {
  "conventional-commits": true,
  "require-ticket-ref": true,
  "ticket-pattern": "JIRA-[0-9]+"
}
```

After this change, `feat: add payment screen` fails. `feat: add payment screen [JIRA-456]` passes.

#### Allow custom commit types (e.g., `release`, `wip`)

```json
"commit-msg": {
  "allowed-types": ["feat", "fix", "refactor", "hotfix", "docs", "test", "chore", "style", "perf", "ci", "build", "release", "wip"]
}
```

#### Exclude generated files from file-size checks

```json
"file-size": {
  "exclude-patterns": ["generated", "g.dart", "freezed", "pb.dart", "schema"]
}
```

#### Turn off a check entirely

```json
"no-debug": { "enabled": false }
```

#### Stack-aware debug patterns (set automatically by ai-gov init)

The `no-debug.sh` script is generated per stack:

| Stack | Blocked patterns |
|-------|-----------------|
| Flutter | `print(`, `debugPrint(`, `debugger;` |
| React | `console.log(`, `console.debug(`, `debugger` |
| Angular | `console.log(`, `console.debug(`, `debugger` |
| Kotlin | `println(`, `Log.d(`, `Log.v(` |
| Node.js | `console.log(` |
| Python | `print(`, `breakpoint(`, `pdb.set_trace(` |
| Java | `System.out.print`, `System.err.print`, `.printStackTrace(` |

### Bypass rules (for emergencies)

A developer can bypass all pre-commit checks for a single commit:

```bash
git commit --no-verify -m "chore: emergency hotfix"
```

> The `--no-verify` bypass is local only. The CI `pr-check` still runs on the PR and catches everything the pre-commit missed.

### Integrating with Husky

If your team uses Husky, don't use `--force`. Instead, add to `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run ai-gov governance checks
bash .claude/git-hooks/pre-commit.sh
```

And add to `.husky/commit-msg`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Validate conventional commit format
bash .claude/git-hooks/commit-msg.sh "$1"
```

### Running pr-check in CI scripts

```bash
# Exit 1 if blockers found (use for required CI checks)
ai-gov pr-check --base main --format github > /tmp/report.md
# exit code: 0 = clean, 1 = blockers

# Parse JSON results in a script
BLOCKERS=$(ai-gov pr-check --format json | jq '.summary.blockers')
if [ "$BLOCKERS" -gt 0 ]; then
  echo "Governance blockers found: $BLOCKERS"
  exit 1
fi
```

---

## 8. Slash Commands Reference

After `ai-gov init`, these `/commands` are available in Claude Code sessions.

### Governance commands (generated by ai-gov)

| Command | What it does | When to use |
|---------|-------------|-------------|
| `/new-feature` | Enters plan mode. Creates spec files (requirements → design → tasks), waits for approval at each gate, then implements phase by phase | Starting any non-trivial feature |
| `/edit-feature` | Reads existing spec + current code, proposes targeted edits, implements after approval | Modifying an existing feature |
| `/fix` | Bug fix workflow — reads spec, reproduces issue, diagnoses root cause, fixes, verifies | Any bug fix |
| `/refactor` | Reads spec + code, proposes refactoring plan, implements after approval. Never adds new behaviour | Code quality improvements |
| `/hotfix` | Emergency fix — minimal change, no new files, adds a regression test, done | Production incidents |
| `/explore` | Read-only exploration — answers questions, maps architecture, suggests approach. Writes no files | Understanding unfamiliar code |
| `/audit` | Full governance audit — reads actual code, scores 6 categories (governance, architecture, code patterns, feature structure, test coverage, dead code), writes `docs/governance-audit-YYYY-MM-DD.md`, self-heals stale steering files | Start of sprint, after major refactor, onboarding |

### Example: using /new-feature

```
> /new-feature

Claude: I'll build this as a new feature. Let me start with the spec.

== GATE 1: REQUIREMENTS ==

I'll fill specs/payment-flow/requirements.md now.

[fills requirements.md with user stories, API endpoints, data models]

Here is the requirements spec. Please review and approve before I continue.

> approved, proceed

== GATE 2: DESIGN ==

[fills design.md with layer mapping, file list, hard rules compliance table]

Here is the design. Please review and approve before I continue.

> approved, proceed

== GATE 3: TASKS ==

[fills tasks.md with phased breakdown and size estimates]

Here is the task breakdown. I'll implement in this order:
Phase 1 (Data): PaymentRepository, PaymentApiService
Phase 2 (Logic): PaymentUseCase
Phase 3 (State): PaymentCubit, PaymentState
Phase 4 (UI): PaymentScreen, PaymentForm
Phase 5 (Tests): unit + widget tests

Shall I begin Phase 1?

> yes

[implements Phase 1, hooks fire after each file written, Claude reports]
```

### Example: using /audit

```
> /audit

[Claude reads all .claude/steering/ files, scans actual source code]

/audit — Project Truth Check
════════════════════════════════════════
Stack: React (Zustand · React Query · Next.js App Router)
Audit date: 2026-04-26

HEALTH SCORECARD
────────────────
Governance       A  97/100  All 8 steering files present, hooks v16.0.0
Architecture     B  85/100  1 component fetches API directly without custom hook
Code Patterns    A  90/100  92% Zustand usage, 3 components still use local state
Feature Structure B  78/100  5/6 features have spec + README
Test Coverage    C  62/100  2 features untested
Dead Code        A  95/100  1 unused export found

OVERALL: B  84/100  PASS WITH UPDATES

Step 11: Updating .claude/steering/architecture.md ... done
Step 11: Updating .claude/steering/coding-standards.md ... done

ACTION ITEMS
1. Move direct fetch in src/features/orders/OrderList.tsx into useOrders hook
2. Create spec for: notifications feature
3. Add tests for: cart feature, checkout feature
4. Remove unused export: formatCurrency in src/utils/format.ts
════════════════════════════════════════
```

---

## 9. All CLI Commands Reference

### `ai-gov init`

```
ai-gov init [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --stack <stack>` | flutter \| kotlin \| nodejs \| react \| angular \| swiftui \| python \| java | auto-detect |
| `--overwrite` | Replace all existing governance files | false |
| `--dry-run` | Preview all changes — nothing is written | false |
| `--update-hooks` | Update only hooks that are at a lower version than the CLI | false |
| `-d, --dir <path>` | Target project directory | current directory |
| `--git-hooks` | Generate git hook scripts + install `.git/hooks/` wrappers | false |
| `--ci <platform>` | Generate CI config: github \| gitlab \| bitbucket | — |
| `--force` | Overwrite existing `.git/hooks/` even if another hook system exists | false |

**Usage examples:**

```bash
# First-time setup on a Flutter project
ai-gov init --stack flutter

# Preview without writing
ai-gov init --dry-run

# Full setup: governance + git hooks + GitHub CI
ai-gov init --git-hooks --ci github

# Re-run on existing project (prompts per changed file)
ai-gov init

# Overwrite everything silently
ai-gov init --overwrite

# Update only stale hooks after CLI upgrade
ai-gov init --update-hooks

# Install git hooks, force-overwrite husky
ai-gov init --git-hooks --force

# Point at a different directory
ai-gov init -d /path/to/project --stack react
```

---

### `ai-gov pr-check`

```
ai-gov pr-check [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--base <branch>` | Base branch to diff against | `main` |
| `--format <format>` | terminal \| github \| gitlab \| json | `terminal` |
| `-d, --dir <path>` | Target project directory | current directory |

**Usage examples:**

```bash
# Run against main (default)
ai-gov pr-check

# Run against develop branch
ai-gov pr-check --base develop

# Output for GitHub PR comment
ai-gov pr-check --format github

# Output for GitLab MR note
ai-gov pr-check --format gitlab

# Machine-readable JSON
ai-gov pr-check --format json

# Save GitHub-format report to file
ai-gov pr-check --format github > /tmp/governance-report.md

# Extract summary from JSON
ai-gov pr-check --format json | jq '.summary'
# → { "changedFiles": 12, "blockers": 0, "warnings": 2, "passed": 6, "hasBlockers": false }

# Run from a different project directory
ai-gov pr-check --base main -d /path/to/project
```

**Checks run:**

| Check | What it finds | Default |
|-------|---------------|---------|
| Architecture | Files crossing UI↔data layer in same PR | warn |
| File Size | Source files > 300 lines | warn |
| Credentials | AWS AKIA keys + credential variables with long values | **fail** |
| Spec Coverage | Feature files without matching spec in `specs/` | warn |
| Test Coverage | New source files without a test file | warn |
| TODOs | `TODO` / `FIXME` / `HACK` / `XXX` in added lines | warn |
| Commit Messages | Non-conventional commit format | warn |
| PR Description | Presence of a PR template | skip |

Only **Credentials** exits with code 1. All other checks exit 0 (warnings only).

---

### `ai-gov doctor`

```
ai-gov doctor [-d <path>]
```

Checks: CLAUDE.md exists, settings.json valid, all 11 hooks present, jq installed.

```bash
ai-gov doctor
ai-gov doctor -d /path/to/project
```

---

## 10. Upgrading from v15.1.0

v16.0.0 adds git hooks and CI/PR check on top of the existing governance files. No existing files are changed by the upgrade.

```bash
# 1. Install the new version
npm install -g ai-gov@16.0.0
ai-gov --version   # → 16.0.0

# 2. Update hooks in your project
cd /path/to/your/project
ai-gov init --update-hooks

# 3. Add git hooks (new in 16.0.0)
ai-gov init --git-hooks

# 4. Add CI config (new in 16.0.0)
ai-gov init --ci github    # or gitlab or bitbucket

# 5. Commit everything
git add .claude/git-hooks/ .github/workflows/
git commit -m "chore: upgrade governance to v16.0.0 — git hooks + CI"
git push
```

Each teammate runs `ai-gov init --git-hooks` once after pulling to install their local `.git/hooks/` wrappers.

---

## 11. Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `ai-gov: command not found` | Not installed or npm link not done | `npm install -g ai-gov` |
| Hooks don't fire at all | `jq` not installed | `brew install jq` (macOS) or `sudo apt install jq` |
| Claude skips spec and codes directly | `.claude/CLAUDE.md` missing or jq missing | Run `ai-gov doctor` — it will identify the missing piece |
| `permission denied` on hook scripts | chmod not applied | `chmod +x .claude/git-hooks/*.sh .claude/git-hooks/checks/*.sh` |
| Existing husky hooks stopped firing | ai-gov `--force` overwrote them | Add `bash .claude/git-hooks/pre-commit.sh` back to `.husky/pre-commit` |
| `pr-check` shows 0 changed files | Running on main branch with no diverged commits | Switch to a feature branch first |
| Wrong stack detected | Ambiguous manifest or mixed project | `ai-gov init --stack <correct>` |
| Hooks are outdated after upgrade | CLI upgraded but project hooks weren't updated | `ai-gov init --update-hooks` |
| `[dry-run]` showed changes but nothing written | That's correct behaviour — dry-run never writes | Remove `--dry-run` to write for real |
| CI reports `npm: command not found` in pipeline | Node not available in CI image | Ensure `actions/setup-node@v4` runs before governance step |
| Secrets check flags a test fixture | False positive on a test credential | Add `# nosecret` or `# ai-gov:ignore` on the line, or add `test/` to `skip-dirs` in config.json |
| `--no-verify` used to bypass hooks | Developer bypassed locally | The CI `pr-check` still runs on the PR — it will catch what pre-commit missed |

### Getting detailed output

```bash
# See full stack trace on CLI errors
DEBUG=1 ai-gov init

# Run a hook manually to test it
echo "test-file.ts" | bash .claude/git-hooks/checks/file-size.sh .claude/git-hooks

# Check hook config values
jq '.' .claude/git-hooks/config.json

# Manually run pr-check and see JSON
ai-gov pr-check --format json | jq '.'
```

---

*Document covers ai-gov v16.0.0. For changes since v15.1.0 see CHANGELOG.md.*
