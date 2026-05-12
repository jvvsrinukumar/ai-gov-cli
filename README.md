# AI Governance CLI

[![CI](https://github.com/jvvsrinukumar/ai-gov-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/jvvsrinukumar/ai-gov-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/ai-gov.svg)](https://www.npmjs.com/package/ai-gov)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> The scaffolding layer for AI agent team adoption. When multiple developers use Claude Code or Kiro on the same codebase without shared rules, you get inconsistency at machine speed. This CLI fixes that.

**Version:** 17.3.0 · **Stacks:** Flutter · Kotlin · Node.js · React · Angular · SwiftUI · Python · Java · **Agents:** Claude Code · Kiro

---

## Quick Start

```bash
# Claude Code (default)
npx ai-gov init

# Kiro
npx ai-gov init --agent kiro

# Preview without writing
npx ai-gov init --dry-run

# Check your setup
npx ai-gov doctor
```

**Choose your path:**

| I use... | Start here |
|----------|-----------|
| **Claude Code** | [Step 1 — Claude Code setup](#step-1--set-up-the-governance-framework) · [Full Claude Code guide](docs/claude_code_setup_guide.md) |
| **Kiro** | [Kiro Setup](#kiro-setup-alternative-to-step-1) · [Full Kiro guide](docs/kiro_setup_guide.md) |
| **Both** | Run `init` once per agent — they don't conflict |
| **Starting a new project** | [`ai-gov project init`](#ai-gov-project-init) — scaffolds from scratch with governance built-in |
| **Multi-project workspace** | [Workspace setup](#ai-gov-workspace) · [Full workspace guide](docs/workspace_setup_guide.md) |

---

## The problem it solves

When one developer uses Claude Code, the output is fast and often good. When five developers use it on the same codebase with no shared rules, you get five different interpretations of the architecture, five different commit styles, and no one noticing when Claude drifts from the spec.

`ai-gov init` scans your project, detects your stack, and generates ~40 governance files that give Claude the same architectural context every session — for every developer. It optionally installs git hooks that enforce commit standards, and a CI check that runs on every pull request.

`ai-gov workspace` does the same across an entire workspace — scanning every sub-project at once, generating per-project governance tailored to each detected stack, and adding shared workspace-level steering files that all projects inherit.

**The closest analogy:** ESLint did not make JavaScript developers write better code. It made inconsistency visible and preventable. This does the same for Claude Code team usage — not perfect outputs, but significantly fewer divergent decisions across the team.

---

## Three layers — each optional, each builds on the previous

| Layer | Command | What it does |
|-------|---------|--------------|
| **Layer 1 — AI Steering** | `npx ai-gov init` | Generates Claude Code steering files, hooks, and spec templates in `.claude/`. Claude reads these automatically and follows your architecture rules. |
| **Layer 2 — Git Hooks** | `npx ai-gov init --git-hooks` | Generates pre-commit and commit-msg bash scripts. Runs when any developer does `git commit`. Checks file size, secrets, TODOs, debug statements, and commit message format. |
| **Layer 3 — CI + PR Check** | `npx ai-gov init --ci github` | Generates a CI pipeline that runs governance on every PR and posts results as a comment. Also available standalone: `npx ai-gov pr-check`. |
| **New Project** | `npx ai-gov project init` | Scaffolds a brand-new project from scratch with governance applied from day one. Currently supports Flutter and Next.js — more stacks coming. |
| **Workspace** | `npx ai-gov workspace` | Scans a workspace root, auto-discovers all sub-projects, runs per-project governance for each detected stack, and generates shared workspace-level steering files. Auto-detects monorepo vs multi-repo and installs git hooks accordingly. |
| **Upgrade** | `npx ai-gov upgrade` | Re-generates hooks, commands, and CLAUDE.md for an existing project. Preserves team-specific steering files by default. Use `--force` to also upgrade steering files. |

You can do Layer 1 only. Or Layer 1 + 2. Or all three. They're independent. Use `workspace` when multiple projects live under one root.

---

## Installation

### Prerequisites

- **Node.js** >= 18
- **python3 or jq** — used by all generated bash hook scripts to read config.json

| Runtime | macOS | Linux/Ubuntu | Windows |
|---------|-------|--------------|---------|
| **python3** | Built-in (no install) | Default on Ubuntu 20+ | Available via `winget install Python.Python.3` or WSL2 |
| **jq** | `brew install jq` | `sudo apt install jq` | `winget install jqlang.jq` |

**python3 is preferred** — it is available on every macOS and standard Linux environment with zero setup. jq is accepted as an alternative. When neither is present, hooks print a visible warning and exit 0 (governance is skipped, not crashed).

Run `npx ai-gov doctor` after setup — it checks which runtime is available and tells you exactly what to install if something is missing.

> **Windows note:** The CLI (`ai-gov init`) runs on bare Windows. The generated bash hook scripts require Git Bash or WSL2. Without one of those, hooks are skipped with a warning.

### Run without installing (recommended for first try)

```bash
npx ai-gov init
npx ai-gov init --stack flutter --dry-run
npx ai-gov doctor
```

### Global install

```bash
npm install -g ai-gov
ai-gov init
```

### From source

```bash
git clone https://github.com/jvvsrinukumar/ai-gov-cli.git
cd ai-gov-cli
npm install && npm run build && npm link
```

---

## Step 1 — Set up the governance framework

```bash
npx ai-gov init
```

### What happens when you run this

The CLI looks at your project files (`package.json`, `pubspec.yaml`, `build.gradle.kts`, etc.) and figures out your stack automatically — for example: "this is a React project with Zustand, Tailwind, and Jest". It then generates ~40 governance files tailored to that stack:

```
your-project/
├── CLAUDE.md                              <- root pointer: tells Claude "go read .claude/CLAUDE.md"
├── .claude/
│   ├── CLAUDE.md                          <- master rules file (Claude reads this at the start of every session)
│   ├── settings.json                      <- registers all 10+ Claude Code hooks
│   ├── custom-hooks.json                  <- your team's custom hooks (never overwritten on re-run)
│   ├── steering/
│   │   ├── constitution.md                <- hard rules (never skip layers, never bypass specs, etc.)
│   │   ├── architecture.md                <- layer flow, project structure diagram, high-risk files
│   │   ├── coding-standards.md            <- naming, file size limits, error handling patterns
│   │   ├── ai-usage-policy.md             <- what Claude can and cannot do autonomously
│   │   ├── workflow.md                    <- how to handle features, bugs, and hotfixes
│   │   ├── spec-first-workflow.md         <- spec-before-code enforcement with STOP gates
│   │   ├── feature-readme.md              <- README policy per feature
│   │   └── prompt-templates.md            <- reusable templates for common tasks
│   ├── hooks/                             <- 11 Claude Code hook scripts (run inside the IDE)
│   │   ├── check-spec-exists.sh           <- blocks file writes until spec is complete
│   │   ├── protect-files.sh               <- warns on high-risk file edits
│   │   ├── check-secrets.sh               <- blocks hardcoded credentials
│   │   ├── block-dangerous-commands.sh    <- blocks git push --force, rm -rf src/, etc.
│   │   ├── check-file-size.sh             <- warns >200 lines, blocks >300 lines
│   │   ├── format-code.sh                 <- auto-formats after every file write
│   │   ├── analyze-code.sh                <- runs linter after every file write
│   │   ├── check-feature-readme.sh        <- ensures README is updated per feature
│   │   ├── check-consistency.sh           <- warns when spec and code have drifted
│   │   ├── session-continuity.sh          <- context summary at session start
│   │   └── post-task-checklist.sh         <- reminds Claude to confirm arch, flag risks
│   ├── commands/                          <- slash commands available in Claude Code
│   │   ├── new-feature.md                 <- /new-feature — spec gates + implementation
│   │   ├── edit-feature.md                <- /edit-feature — targeted changes workflow
│   │   ├── fix.md                         <- /fix — reproduce, diagnose, fix, verify
│   │   ├── refactor.md                    <- /refactor — read spec, propose, then change
│   │   ├── hotfix.md                      <- /hotfix — minimal urgent fix
│   │   ├── explore.md                     <- /explore — read-only codebase questions
│   │   └── audit.md                       <- /audit — full governance audit to docs/
│   └── extensions/
│       ├── manifest.json
│       ├── jira-sync/run.sh
│       ├── retrospective/run.sh
│       └── verify/run.sh
└── specs/
    └── _template/                         <- blank spec template to copy per feature
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

### After this step

Open Claude Code in your project. Claude automatically reads `CLAUDE.md` and follows all the rules. Every time Claude writes a file, hooks fire (format, lint, size check, spec check, etc.).

When you say "build user profile feature", Claude creates a spec first before writing any code.

Commit these files to git so the whole team gets the same rules:

```bash
git add .claude/ CLAUDE.md
git commit -m "chore: add ai-gov governance framework"
git push
```

### What if you re-run init on an existing project?

The CLI detects existing files and prompts you for each conflict:

```
  .claude/steering/architecture.md already exists.
  [G]enerate (show diff + ask) / [K]eep existing / [O]verwrite:
```

- **G** — shows a unified diff, then asks yes/no per file
- **K** — skips all existing files (safe for updates)
- **O** — replaces all files with freshly generated content

Use `--update-hooks` to only update hooks that are on an older version, without touching steering files.

---

## Kiro Setup (alternative to Step 1)

If your team uses Kiro instead of Claude Code:

```bash
npx ai-gov init --agent kiro
```

This generates governance files in `.kiro/` instead of `.claude/`:

```
your-project/
├── .kiro/
│   ├── .gitattributes
│   ├── steering/                          ← Kiro reads these automatically (YAML front-matter)
│   │   ├── constitution.md                ← inclusion: always
│   │   ├── architecture.md                ← inclusion: always
│   │   ├── coding-standards.md            ← inclusion: always
│   │   ├── ai-usage-policy.md             ← inclusion: always
│   │   ├── workflow.md                    ← inclusion: always
│   │   ├── spec-first-workflow.md         ← inclusion: always
│   │   ├── feature-readme.md              ← inclusion: always
│   │   └── prompt-templates.md            ← inclusion: always
│   ├── hooks/                             ← Kiro JSON hooks (auto-discovered)
│   │   ├── block-dangerous-commands.json  ← preToolUse: blocks force push, rm -rf
│   │   ├── protect-files.json             ← preToolUse: warns on high-risk files
│   │   ├── pre-write-secrets-gate.json    ← preToolUse: blocks writes with credentials
│   │   ├── check-secrets.json             ← fileEdited: scans for credentials (post-hoc)
│   │   ├── check-file-size.json           ← postToolUse: warns >200 lines
│   │   ├── format-code.json               ← postToolUse: auto-formats
│   │   ├── analyze-code.json              ← postToolUse: runs linter
│   │   ├── session-continuity.json        ← promptSubmit: context preservation
│   │   ├── require-task-type.json         ← promptSubmit: task classification
│   │   ├── post-task-checklist.json       ← postTaskExecution: verification
│   │   ├── workflow-*.json (×6)           ← userTriggered: audit, new-feature, fix, refactor, hotfix, explore
│   │   └── README.md
│   └── specs/
│       └── _template/                     ← Kiro-native spec location
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
```

### Key differences from Claude Code

| Aspect | Claude Code | Kiro |
|--------|-------------|------|
| Output directory | `.claude/` | `.kiro/` |
| Steering files | Plain markdown | Markdown with YAML front-matter (`inclusion: always`) |
| Hooks | Bash scripts registered in `settings.json` | JSON files auto-discovered by Kiro |
| Commands | `.claude/commands/*.md` (slash commands) | `userTriggered` workflow hooks (same workflows, button-triggered) |
| Spec templates | `specs/_template/` (project root) | `.kiro/specs/_template/` (Kiro-native location) |
| Enforcement | Hard block via `exit 2` | Agent-enforced via `askAgent` DENY responses |

### Enforcement model

| Capability | Claude Code | Kiro |
|---|---|---|
| Block writes without spec | Hard block (`exit 2`) | `preToolUse` + `askAgent` DENIED |
| Block dangerous commands | Hard block (`exit 2`) | `preToolUse` on shell + `askAgent` DENIED |
| Block hardcoded secrets | Hard block (bash regex) | `preToolUse` + `askAgent` DENIED (pre-write gate) |
| Enforce file size | Hard block (`wc -l`) | `postToolUse` + `askAgent` |
| Format after write | `postToolUse` bash | `postToolUse` + `runCommand` |
| Lint after write | `postToolUse` bash | `postToolUse` + `runCommand` |

> **Enforcement strength caveat:** Claude Code hooks use `exit 2` — a process-level hard block that Claude cannot bypass. Kiro hooks use `askAgent` with DENY instructions — the agent is expected to honor the denial per Kiro's hook contract, but enforcement is cooperative (agent-enforced), not process-level. In practice, Kiro reliably honors `preToolUse` DENY responses, but it is not architecturally equivalent to a hard block.

### Workflow shortcuts

Kiro has no slash command system, but `userTriggered` hooks provide the same guided workflows:

| Kiro Hook | Claude Code Equivalent | Trigger |
|-----------|----------------------|---------|
| `workflow-audit.json` | `/audit` | Button in Agent Hooks panel |
| `workflow-new-feature.json` | `/new-feature` | Button in Agent Hooks panel |
| `workflow-fix.json` | `/fix` | Button in Agent Hooks panel |
| `workflow-refactor.json` | `/refactor` | Button in Agent Hooks panel |
| `workflow-hotfix.json` | `/hotfix` | Button in Agent Hooks panel |
| `workflow-explore.json` | `/explore` | Button in Agent Hooks panel |

### Auto-detection

If you don't specify `--agent`, the CLI auto-detects:
- Existing `.kiro/` directory → uses Kiro
- Existing `.claude/` directory → uses Claude Code
- Neither exists → defaults to Claude Code (backward compatible)
- Both exist → prompts you to choose (or defaults to Claude Code in CI)

---

## Step 2 — Add git hooks (optional)

```bash
npx ai-gov init --git-hooks
```

### Claude Code hooks vs. git hooks — they are different things

People often confuse these. Here is the difference:

| | Claude Code hooks (Step 1) | Git hooks (Step 2) |
|--|---------------------------|-------------------|
| **When they run** | When Claude writes or edits a file | When a developer runs `git commit` |
| **Who they check** | Claude's output | Developer's staged changes |
| **Where they live** | `.claude/hooks/` | `.claude/git-hooks/` + `.git/hooks/` |
| **Can be bypassed** | No — Claude always follows them | Yes — `git commit --no-verify` |
| **Committed to repo** | Yes | Scripts yes, wrappers no |

Step 1 governs what Claude produces. Step 2 governs what developers commit.

### What gets created

```
your-project/
├── .claude/
│   └── git-hooks/                         <- NEW (committed to repo — all teammates get these)
│       ├── config.json                    <- enable/disable checks, set thresholds
│       ├── pre-commit.sh                  <- orchestrator: runs all enabled checks
│       ├── commit-msg.sh                  <- validates conventional commit format
│       └── checks/
│           ├── file-size.sh               <- BLOCKS files > 300 lines (configurable)
│           ├── secrets.sh                 <- BLOCKS hardcoded credentials (AKIA, tokens, etc.)
│           ├── no-todos.sh                <- warns on TODO/FIXME/HACK/XXX (allows ticket refs)
│           ├── no-debug.sh                <- warns on console.log / print / debugger
│           ├── format-check.sh            <- checks formatting (off by default)
│           └── lint-check.sh              <- checks linting (off by default)
└── .git/
    └── hooks/                             <- NOT committed (local to each developer's machine)
        ├── pre-commit                     <- thin wrapper -> .claude/git-hooks/pre-commit.sh
        └── commit-msg                     <- thin wrapper -> .claude/git-hooks/commit-msg.sh
```

> **Important for new team members:** The `.git/hooks/` wrappers are local — git does not commit them. Each developer must run `npx ai-gov onboard` once after cloning the repo (or use the curl script below). The actual check scripts in `.claude/git-hooks/` ARE committed, so the logic is shared. The wrapper is just a pointer.

### What happens when a developer commits

**Clean commit:**

```
$ git add src/features/auth/login.tsx
$ git commit -m "feat(auth): add login screen"

  Governance pre-commit check
  ───────────────────────────────
  All checks passed.

[feature/auth abc1234] feat(auth): add login screen
```

**File too large:**

```
$ git add src/features/auth/LoginScreen.tsx   # 340 lines
$ git commit -m "feat: add login screen"

  Governance pre-commit check
  ───────────────────────────────
  BLOCKED  file-size: src/features/auth/LoginScreen.tsx has 340 lines (max 300)
           Split into smaller components before committing.

  1 blocking issue(s). Fix and try again.
  (bypass: git commit --no-verify)
```

**Hardcoded secret:**

```
$ git add src/config/api.ts
$ git commit -m "feat: add API config"

  Governance pre-commit check
  ───────────────────────────────
  BLOCKED  secrets: src/config/api.ts — AWS Access Key ID (AKIA pattern)
           Move to environment variables or AWS Secrets Manager.

  1 blocking issue(s). Fix and try again.
  (bypass: git commit --no-verify)
```

**Bad commit message:**

```
$ git commit -m "stuff"

  Governance commit-msg check
  ───────────────────────────────
  BLOCKED  commit message does not follow conventional format

  Expected:   <type>(<scope>): <description>
  Types:      feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
  Minimum:    10 characters in description

  Examples:
    feat: add user profile edit screen
    fix(auth): resolve null pointer in login flow
    chore: update dependencies

  Your message: "stuff"
```

**Warning only (TODO) — commit still goes through:**

```
$ git commit -m "feat: add payment flow"

  Governance pre-commit check
  ───────────────────────────────
  WARNING  no-todos: src/features/payment/PaymentService.ts
           Line 47: // TODO: handle retry logic
           (suppress: add a ticket ref — TODO: ... PROJ-456)

  1 warning(s). Commit allowed — consider fixing.

[feature/payment def5678] feat: add payment flow
```

### Existing hook system detection

If the CLI detects husky, lefthook, or pre-commit already installed, it prints integration guidance instead of overwriting:

```
  Existing hook system detected: husky

  ai-gov scripts are in .claude/git-hooks/ (committed to repo).
  To integrate with husky, add to .husky/pre-commit:

    bash .claude/git-hooks/pre-commit.sh

  And to .husky/commit-msg:

    bash .claude/git-hooks/commit-msg.sh "$1"

  Or to replace husky entirely:
    npx ai-gov init --git-hooks --force
```

---

## Step 3 — Add CI check (optional)

```bash
npx ai-gov init --ci github      # GitHub Actions
npx ai-gov init --ci gitlab      # GitLab CI
npx ai-gov init --ci bitbucket   # Bitbucket Pipelines
```

This generates a CI pipeline that runs `ai-gov pr-check` on every pull request and posts the results as a comment. If a blocker is found (like a hardcoded credential), the pipeline exits with code 1 and blocks the merge.

### No login, no tokens — here is why

| Platform | Auth method | Setup needed |
|----------|-------------|--------------|
| GitHub Actions | `GITHUB_TOKEN` — provided automatically by GitHub to every workflow | None |
| GitLab CI | `CI_JOB_TOKEN` — built into every GitLab pipeline | None |
| Bitbucket Pipelines | Built-in pipeline credentials | None |

You just commit the workflow file. GitHub/GitLab/Bitbucket handle the authentication automatically.

> **Note:** "No tokens" means no manual secret creation. You still need to: (1) commit the generated workflow file, (2) push to a branch with PR protection enabled, and (3) ensure your repo's branch protection rules require the governance check to pass before merge. The CI platform provides the token — but you configure when and where it runs.

### GitHub Actions — step by step

**Step 1** — Generate the workflow file (team lead does this once):

```bash
npx ai-gov init --ci github
```

Creates: `.github/workflows/governance-check.yml`

**Step 2** — Commit and push:

```bash
git add .github/workflows/governance-check.yml
git commit -m "ci: add governance PR check"
git push
```

**Step 3** — Done. Every PR from now on gets checked automatically.

### What a developer sees on their PR

When a PR is opened, GitHub Actions runs and posts this comment (updates automatically on new pushes — no duplicates):

---

**Governance Review**

**Changed files:** 12 | **Blockers:** 0 | **Warnings:** 2

> This PR has warnings. Merge is allowed but consider addressing them.

✅ **Architecture**: No layer boundary violations detected

✅ **File Size**: All files within size limits

✅ **Credentials**: No credentials detected in diff

✅ **Spec Coverage**: All feature files have matching specs

<details>
<summary>**Test Coverage**: 2 source file(s) without tests</summary>

- `src/features/payment/PaymentService.ts` — no corresponding test file found
- `src/features/payment/PaymentMapper.ts` — no corresponding test file found

</details>

✅ **TODOs**: No TODO/FIXME/HACK in added lines

<details>
<summary>**Commit Messages**: 1 commit(s) don't follow conventional format</summary>

- `commit`: Non-conventional: "WIP" — expected `<type>(<scope>): <description>`

</details>

✅ **PR Description**: PR template found

---
*Generated by ai-gov*

---

### PR with a credential — pipeline blocks merge

```
Governance Review

Changed files: 4 | Blockers: 1 | Warnings: 0

This PR has blocking issues that must be resolved before merge.

BLOCKED  Credentials: 1 potential credential found
         AWS Access Key ID (AKIA pattern) in diff
         -> Use environment variables or AWS Secrets Manager
```

The CI step exits with code 1. GitHub marks the check as failed. The merge button is blocked until the credential is removed and the branch is force-pushed.

### GitLab — step by step

```bash
npx ai-gov init --ci gitlab
```

- If `.gitlab-ci.yml` already exists: appends a `governance-check` job to your existing stages (does not overwrite your pipeline).
- If it doesn't exist: creates a minimal file with the governance job.

```bash
git add .gitlab-ci.yml
git commit -m "ci: add governance MR check"
git push
```

Triggers automatically on every merge request. Uses GitLab's built-in `CI_JOB_TOKEN`.

### Bitbucket — step by step

```bash
npx ai-gov init --ci bitbucket
```

Creates `bitbucket-pipelines.yml`. Commit and push — runs automatically on every pull request.

---

## Full team setup (done once by the team lead)

```bash
# 1. Go to your project
cd your-project

# 2. Generate Layer 1: Claude Code governance
npx ai-gov init

# 3. Add Layer 2: git pre-commit + commit-msg hooks
npx ai-gov init --git-hooks

# 4. Add Layer 3: CI check (pick your platform)
npx ai-gov init --ci github

# 5. Verify everything is wired up correctly
npx ai-gov doctor

# 6. Commit and push everything
git add .claude/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v17.1.0"
git push
```

After this, every developer on the team:

- Gets the Claude Code steering rules automatically (they are in `.claude/`, which is committed)
- Gets the git hook logic automatically (`.claude/git-hooks/` is committed)
- Needs to run **`npx ai-gov onboard`** once after cloning — installs the local `.git/hooks/` wrappers, verifies runtime (python3/jq), and confirms the setup is complete
- Gets CI checks automatically on every PR (the workflow file is committed)

### New developer onboarding (50+ teams)

Share this with your team in Slack/email — they run one command:

```bash
# Option A — no Node.js required (pure bash)
curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash

# Option B — via npx (requires Node.js 18+)
npx ai-gov onboard
```

Both commands: verify `.claude/` governance files are present, check python3/jq runtime, install `.git/hooks/` wrappers, and print a summary of what every commit will be checked for. Takes under 10 seconds.

---

## Checking a PR as a team lead

Two ways to check a PR. You can use either or both.

### Option A — Check locally from your terminal (no CI needed)

```bash
# 1. Pull the developer's branch
git fetch origin
git checkout feature/user-profile

# 2. Run governance check against main
npx ai-gov pr-check --base main
```

Output:

```
════════════════════════════════════
  Governance PR Check
════════════════════════════════════
Changed files: 8

  Architecture      PASS   No layer boundary violations detected
  File Size         WARN   1 file(s) exceed 300 lines
  Credentials       PASS   No credentials detected
  Spec Coverage     PASS   All feature files have matching specs
  Test Coverage     PASS   All source files have test files
  TODOs             PASS   No TODO/FIXME in added lines
  Commit Messages   PASS   All 3 commit(s) follow conventional format
  PR Description    SKIP   No PR template found (not required)

  1 warning(s), 6 passed — no blockers

  File Size details:
    src/features/auth/login-screen.tsx: 342 lines (max 300)
```

Get machine-readable output for scripts:

```bash
npx ai-gov pr-check --base main --format json | jq '.summary'
```

```json
{
  "changedFiles": 8,
  "blockers": 0,
  "warnings": 1,
  "passed": 6,
  "hasBlockers": false
}
```

### Option B — Automatic CI comment on every PR (set up once, runs forever)

See Step 3 above. After the workflow file is committed, every PR gets the governance comment automatically. The team lead just reads the comment — no manual `pr-check` needed.

---

## Configuring thresholds (team lead)

After running `ai-gov init --git-hooks`, edit `.claude/git-hooks/config.json` and commit it. Every developer gets the updated thresholds when they pull.

```json
{
  "pre-commit": {
    "file-size": {
      "enabled": true,
      "max-lines": 250,
      "frontend-only": true,
      "frontend-extensions": [".dart", ".tsx", ".jsx", ".ts", ".kt"],
      "exclude-patterns": ["generated", "schema", "proto"]
    },
    "secrets": {
      "enabled": true,
      "skip-dirs": ["test", "tests", "__tests__", "fixtures", "mocks"],
      "skip-extensions": [".md", ".txt", ".env.example"]
    },
    "no-todos": {
      "enabled": true,
      "allow-with-ticket": true,
      "ticket-pattern": "PROJ-[0-9]+"
    },
    "no-debug": { "enabled": true },
    "format-check": { "enabled": false },
    "lint-check": { "enabled": false }
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

**Tighten the file size limit:**

```json
"file-size": { "enabled": true, "max-lines": 200 }
```

**Enable format and lint checks** (off by default — enable only once the team has formatters configured):

```json
"format-check": { "enabled": true },
"lint-check": { "enabled": true }
```

**Require a Jira ticket in every commit message:**

```json
"commit-msg": {
  "require-ticket-ref": true,
  "ticket-pattern": "JIRA-[0-9]+"
}
```

Commits like `feat: add login screen` will fail unless the body contains `JIRA-123`. Commits like `feat: add login screen JIRA-456` pass.

**Allow TODOs that reference a ticket** (on by default):

```
// TODO: handle retry logic — tracked in PROJ-456
```

This passes even with `no-todos` enabled.

**Bypass hooks for a single commit** (use sparingly):

```bash
git commit --no-verify -m "chore: WIP checkpoint"
```

The CI `pr-check` still catches what `--no-verify` skips.

### Integrating with Husky

If your team already uses Husky, do not use `--force`. Add to `.husky/pre-commit`:

```bash
bash .claude/git-hooks/pre-commit.sh
```

Add to `.husky/commit-msg`:

```bash
bash .claude/git-hooks/commit-msg.sh "$1"
```

---

## All commands reference

### `ai-gov init`

```bash
ai-gov init [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-s, --stack <stack>` | Force a specific stack: `flutter\|kotlin\|nodejs\|react\|angular\|swiftui\|python\|java` | auto-detect |
| `-a, --agent <agent>` | Target agent: `claude-code\|kiro` | auto-detect |
| `--overwrite` | Replace all existing files silently | false |
| `--dry-run` | Preview what would be generated — nothing written | false |
| `--update-hooks` | Update only hooks on an older version (safe re-run) | false |
| `-d, --dir <path>` | Target project directory | `process.cwd()` |
| `--git-hooks` | Generate git pre-commit + commit-msg hooks | false |
| `--ci <platform>` | Generate CI config: `github\|gitlab\|bitbucket` | — |
| `--force` | Overwrite existing `.git/hooks/` even if another hook system exists | false |

```bash
# Preview everything — nothing written
ai-gov init --dry-run

# Force a specific stack
ai-gov init --stack flutter

# All three layers at once
ai-gov init --git-hooks --ci github

# Re-run on existing project (prompts per-file)
ai-gov init

# Update only stale hooks
ai-gov init --update-hooks

# Overwrite everything silently
ai-gov init --overwrite
```

### `ai-gov project init`

```bash
ai-gov project init [options]
```

Scaffold a brand-new project with governance applied from day one. Unlike `ai-gov init` (which adds governance to an existing project), `project init` creates the entire project from scratch — directory structure, config files, dependencies, and governance — in one command.

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type <stack>` | Stack identifier (skip interactive selection) | interactive |
| `-n, --name <name>` | App name (max 214 chars, must match stack naming convention) | interactive |
| `-y, --yes` | Skip confirmation summary | false |
| `--dry-run` | Scaffold without applying governance | false |
| `-d, --dir <path>` | Parent directory for the new project | `process.cwd()` |

**Currently supported stacks:**

| Stack | Naming | What gets scaffolded |
|-------|--------|---------------------|
| `flutter` | snake_case (`my_app`) | Clean architecture with BLoC/Cubit, Dio, GetIt, GoRouter, FVM, Mason bricks, multi-service API config, architecture tests |
| `next` | kebab-case (`my-app`) | Next.js with configurable router, styling, state management, auth, database, API style (frontend-only or full-stack) |

More stacks coming soon — the adapter pattern means adding a new stack requires only creating an adapter file. No orchestrator changes needed.

```bash
# Interactive — guided wizard
ai-gov project init

# Non-interactive — specify everything
ai-gov project init --type flutter --name my_app --yes

# Next.js project in a specific directory
ai-gov project init --type next --name my-dashboard --dir ~/projects --yes

# Preview scaffold without governance
ai-gov project init --type next --name my-app --dry-run --yes
```

**What happens:**

1. Select stack (or provide `--type`)
2. Collect common inputs: app name, display name, output directory, AI agent, git hooks, CI platform
3. Collect stack-specific inputs (Flutter: services, endpoints, FVM version; Next.js: project type, package manager, styling, state, auth, database)
4. Confirmation summary (skip with `--yes`)
5. Scaffold project files (no shell commands)
6. Post-setup: `git init`, dependency install, initial commit
7. Apply governance (`runGovernance` with `conflictMode: 'keep'`)
8. Install git hooks + CI config (if selected)

**Workspace safety:** All projects created via `project init` use `conflictMode: 'keep'` — workspace-level commands (`ai-gov workspace`) will never overwrite governance files in these projects.

**Adding to an existing workspace:**

If you run `project init` inside a workspace that already has workspace-level governance (`.claude/steering/project-registry.md`), the new project gets its own per-project governance but the workspace layer doesn't know about it yet. After creating the project, re-run workspace to register it:

```bash
# 1. Create the new project inside your workspace
ai-gov project init --type next --name my-dashboard --dir ./frontend

# 2. Re-run workspace to pick up the new project
ai-gov workspace --dir .

# 3. (Optional) Update cross-project-rules.md if the new project
#    has API contracts with existing projects
```

`ai-gov workspace` re-discovers all projects, updates `project-registry.md`, regenerates the workspace pre-commit hook, and appends workspace references to the new project's governance files.

### `ai-gov pr-check`

```bash
ai-gov pr-check [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--base <branch>` | Base branch to diff against | `main` |
| `--format <format>` | Output: `terminal\|github\|gitlab\|json` | `terminal` |
| `-d, --dir <path>` | Project directory | `process.cwd()` |

```bash
# Check against main
ai-gov pr-check

# Check against a different base
ai-gov pr-check --base develop

# GitHub markdown output (for posting to a PR comment)
ai-gov pr-check --format github > /tmp/report.md

# Machine-readable JSON
ai-gov pr-check --format json | jq '.summary'
```

**8 checks run on every PR:**

| Check | What it looks for | Blocks by default |
|-------|-------------------|:-----------------:|
| Architecture | Files crossing UI/data layer boundaries | — |
| File Size | Source files > 300 lines | — |
| Credentials | AWS AKIA keys + credential-named variables | Yes |
| Spec Coverage | Feature files changed without a matching spec | — |
| Test Coverage | New source files without a test file | — |
| TODOs | `TODO` / `FIXME` / `HACK` / `XXX` in added lines | — |
| Commit Messages | Non-conventional commit format | — |
| PR Description | PR template presence in the repo | — |

Only Credentials blocks by default. Promote any check to blocking by editing `.claude/governance.json`.

### `ai-gov workspace`

```bash
ai-gov workspace [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dir <path>` | Workspace root directory | `process.cwd()` |
| `--dry-run` | Preview what would be generated — nothing written | false |
| `--overwrite` | Replace all existing governance files silently | false |
| `--only <projects>` | Comma-separated list of relative project paths to init | all discovered |

**Workspace layouts supported:**

*Grouped (backend/frontend folders):*
```
workspace/
  backend/
    accushield-kiosk-apis/    ← Node.js — auto-detected
    corporate_node/           ← Node.js — auto-detected
  frontend/
    corporate_angular/        ← Angular — auto-detected
```

*Flat (all projects at root level):*
```
workspace/
  corporate_node/             ← Node.js — auto-detected
  staff-server/               ← Node.js — auto-detected
  volunteer-server/           ← Node.js — auto-detected
```

**Group directories scanned automatically:** `backend/`, `frontend/`, `mobile/`, `services/`, `apps/`, `packages/`, `libs/`

**Stack detected per project from:** `package.json`, `pubspec.yaml`, `pom.xml`, `build.gradle`, `pyproject.toml`, `Package.swift`, `settings.gradle`

```bash
# Auto-discover and init all projects
ai-gov workspace --dir /path/to/workspace

# Preview without writing
ai-gov workspace --dir /path/to/workspace --dry-run

# Only specific projects
ai-gov workspace --dir /path/to/workspace --only backend/corporate_node,frontend/corporate_angular

# Overwrite existing governance
ai-gov workspace --dir /path/to/workspace --overwrite
```

**Monorepo vs multi-repo — auto-detected:**

`ai-gov workspace` checks each discovered project for its own `.git/` directory:

| Layout | Detection | Git hook install |
|--------|-----------|-----------------|
| **Monorepo** (single `.git/` at workspace root) | No per-project `.git/` found | One workspace hook at `.git/hooks/pre-commit` delegates to `workspace-pre-commit.sh` |
| **Multi-repo** (each project has own `.git/`) | Per-project `.git/` found | Per-project `.git/hooks/pre-commit` + `commit-msg` wrappers delegating to each project's `.claude/git-hooks/pre-commit.sh` |

If husky, lefthook, or pre-commit is already detected in a project, the CLI prints integration guidance instead of overwriting.

**What gets generated:**

```
workspace/
  .claude/
    CLAUDE.md                         ← workspace master rules (lists all projects)
    git-hooks/
      workspace-pre-commit.sh         ← monorepo orchestrator (runs all project checks)
    steering/
      workspace-policy.md             ← shared AI usage policy for all projects
      cross-project-rules.md          ← API contracts, no cross-src imports rule
      project-registry.md             ← table of all projects + stacks + status

  backend/
    corporate_node/
      .claude/                        ← full per-project governance (Node.js rules)
        CLAUDE.md                         references workspace rules
        git-hooks/                        per-project pre-commit + checks
        steering/ hooks/ commands/
      specs/

  frontend/
    corporate_angular/
      .claude/                        ← full per-project governance (Angular rules)
        CLAUDE.md                         references workspace rules
        git-hooks/                        per-project pre-commit + checks
        steering/ hooks/ commands/
      specs/
```

Each project's `.claude/CLAUDE.md` is automatically appended with a workspace reference section pointing to the shared steering files.

### `ai-gov upgrade`

```bash
ai-gov upgrade [options]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-d, --dir <path>` | Project directory to upgrade | `process.cwd()` |
| `-s, --stack <stack>` | Override stack detection | auto-detect |
| `--force` | Also overwrite steering files (architecture.md, coding-standards.md, etc.) | false |
| `--dry-run` | Preview what would be upgraded — nothing written | false |

Designed for teams upgrading from an older ai-gov version. Always regenerates hooks, git-hooks, commands, and `.claude/CLAUDE.md` (these change with every version). Keeps steering files by default — they contain team-specific content that must not be overwritten accidentally.

```bash
# Upgrade hooks + commands in current directory
ai-gov upgrade

# Preview what would change
ai-gov upgrade --dry-run

# Also upgrade steering files (use when major architectural guidance has changed)
ai-gov upgrade --force

# Upgrade a specific project
ai-gov upgrade --dir ./backend/api
```

After upgrading, commit `.claude/` so all teammates get the updated hooks:

```bash
git add .claude/
git commit -m "chore: upgrade ai-gov hooks to v16.0.0"
git push
```

**What always gets upgraded:**
- `.claude/hooks/` — all 11 Claude Code hook scripts
- `.claude/git-hooks/` — pre-commit.sh + 6 check scripts
- `.claude/commands/` — all 7 slash commands
- `.claude/CLAUDE.md` — embedded rules (always must be current)

**What is kept by default (use `--force` to overwrite):**
- `.claude/steering/` — architecture.md, coding-standards.md, workflow.md, constitution.md
- `specs/` — your feature specs are never touched

### `ai-gov onboard`

```bash
ai-gov onboard [--dir <path>]
```

For new developers after cloning a repo that already has governance set up. Installs local `.git/hooks/` wrappers, checks python3/jq runtime, verifies `.claude/` governance files are present.

```bash
# Set up current directory (after cloning)
npx ai-gov onboard

# Set up a specific directory
npx ai-gov onboard --dir ./my-project
```

Equivalent to the curl script: `curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash`

### `ai-gov doctor`

```bash
ai-gov doctor [-d <path>]
```

Checks: CLAUDE.md exists, settings.json valid, all 11 hooks present, python3 or jq installed, git hooks wired, config.json schema valid. Exits with code 1 if neither python3 nor jq is available (hooks are unenforced).

---

## How the spec-first workflow works

This is the core enforcement mechanism in Layer 1:

```
Developer asks Claude: "build user profile feature"
    |
    v
Claude checks: does specs/user-profile/ exist?
    |
    +-- NO --> Hook blocks the write. Claude must:
    |              1. cp -r specs/_template specs/user-profile
    |              2. Fill requirements.md (user stories, API endpoints)
    |              3. Fill design.md (layer mapping, file list)
    |              4. Fill tasks.md (phased breakdown with estimates)
    |              5. Show the plan and wait for "go ahead"
    |
    +-- YES (spec is complete)
    |
    v
Claude implements: Data -> Logic -> State -> UI -> Tests
    |
    v
After every file write, Claude Code hooks fire automatically:
    - format-code.sh         auto-formats the file
    - analyze-code.sh        runs the linter
    - check-file-size.sh     warns if > 300 lines
    - check-feature-readme.sh  ensures README is updated
    - check-consistency.sh   warns if spec and code have drifted
```

### Slash commands — what they are and why they matter

After `ai-gov init`, the `.claude/commands/` folder contains 7 markdown files. Claude Code reads these automatically when you type the matching `/command` in chat.

**Why commands exist — the problem they solve**

Without commands, Claude responds differently every time. Ask two developers on the same team to "build a login feature" and Claude produces two completely different structures, different file names, different layers, different test patterns. There is no forcing function.

Commands are structured workflows with enforced gates. When you type `/new-feature user-profile`, Claude does not start writing files. It enters plan mode first, walks through gates, and waits for your explicit approval before touching the filesystem. Every developer on the team gets the same process, enforced by the same markdown file.

**Commands vs. free-form prompting**

| | Free-form (`build a login feature`) | Command (`/new-feature user-profile`) |
|--|-------------------------------------|--------------------------------------|
| Plan mode | No — writes files immediately | Yes — required before any file write |
| Spec created first | Depends on Claude's mood | Always — gate 1 blocks until spec is approved |
| Phases followed | Inconsistent | Stack-specific phases in the right order |
| Architecture respected | Sometimes | Reads `architecture.md` before starting |
| Reviewer can see plan | No — code appears | Yes — plan shown in chat before code |

**Plan mode and gates — the core mechanic**

Every command starts with `EnterPlanMode`. In plan mode, Claude can read files and show you plans in chat — but cannot write or edit any file. A gate is a point where Claude stops and shows you what it is about to do. You say "go ahead" (or reject/modify). Only then does Claude call `ExitPlanMode` and start writing.

```
You type: /new-feature user-profile
    |
    v
Claude calls EnterPlanMode immediately
    |
    v
GATE 1 — Requirements (shows in chat):
    • User stories
    • Data inputs/outputs
    • API endpoints
    → You say "looks good" to pass gate 1
    |
    v
GATE 2 — Design (shows in chat):
    • Layer mapping (which file goes in which layer)
    • File list with sizes
    • Hard rules compliance check
    → You say "approved" to pass gate 2
    |
    v
GATE 3 — Tasks (shows in chat):
    • Phased breakdown (Phase 1 → Phase 5)
    • Estimated file count per phase
    → You say "go ahead" to pass gate 3
    |
    v
Claude calls ExitPlanMode
    |
    v
Implementation begins — one phase at a time
Claude Code hooks fire after each file write (format, lint, size check)
```

**Passing arguments to commands**

The argument after the command name becomes `$ARGUMENTS` inside the workflow:

```
/new-feature user-profile      → feature name is "user-profile"
/fix null pointer in login     → bug description is "null pointer in login"
/hotfix payment crash prod     → emergency description is "payment crash prod"
/explore how does auth work    → question is "how does auth work"
```

If you type a command with no argument, Claude asks for the missing information before proceeding.

---

### `/new-feature` — 3 gates, plan mode, spec-first

**Trigger:** building something new that does not exist yet

**Gates:** Requirements → Design → Tasks (3 gates — all must be approved before implementation)

**What happens:**

```
/new-feature user-profile
```

1. Claude reads `.claude/steering/architecture.md` and `coding-standards.md`
2. **Gate 1 — Requirements:** Claude shows user stories, data in/out, API contracts. You approve or edit.
3. **Gate 2 — Design:** Claude shows the exact file list with layer assignment. You approve or edit.
4. **Gate 3 — Tasks:** Claude shows phased breakdown. You approve or edit.
5. Claude exits plan mode and implements — phase by phase, matching your stack's layer order.

**Stack-specific phases** (generated per stack — not generic):

| Stack | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|-------|---------|---------|---------|---------|---------|
| Flutter | Domain (entities, use cases) | Data (repo impl, DTOs) | State (BLoC/Cubit/Riverpod) | UI (screens, widgets) | Tests |
| Kotlin | Domain (data classes, use cases) | Data (repo impl, data source) | ViewModel (StateFlow, Hilt) | UI (Composable, nav graph) | Tests |
| React | Types (interfaces, constants) | API/Service (hooks, fetch) | State (Zustand/Redux slice) | Components (page + children) | Tests |
| Angular | Models (interfaces, enums) | Service (HTTP, transforms) | State (NgRx actions/effects) | Component (smart + presentational) | Tests |
| Node.js | Domain (entity, DTOs, schemas) | Repository (ORM queries) | Service (business logic) | Controller/Routes (API, Swagger) | Tests |
| Python | Schemas (Pydantic models) | Repository (SQLAlchemy) | Service (business logic) | Router (FastAPI endpoints, DI) | Tests |
| Java | Domain (JPA entities, DTOs) | Repository (Spring Data) | Service (business logic) | Controller (REST endpoints) | Tests |

**When NOT to use `/new-feature`:**
- The feature already exists and you want to change it → use `/edit-feature`
- Something is broken → use `/fix`
- The change is under 5 files → free-form is fine

---

### `/fix` — 1 gate, plan mode, bug only

**Trigger:** something that used to work is broken

**Gate:** Root cause + proposed fix (1 gate)

**What happens:**

```
/fix login button not responding after keyboard dismissal
```

1. Claude enters plan mode and reads the minimum files needed (never more than required)
2. **Gate — Root cause display:**
   ```
   ━━━ ROOT CAUSE ━━━
     File:    src/features/auth/LoginScreen.tsx
     Line ~47: keyboard listener not cleaned up in useEffect
     Cause:   missing return in useEffect causes listener to stack on re-render
   ```
   If the fix touches more than 3 files, Claude flags it as a potential structural issue — not a simple bug.
3. You say "apply" — Claude exits plan mode and makes the minimal change.
4. Claude runs tests.

**When NOT to use `/fix`:**
- The feature is missing (not broken) → use `/new-feature`
- The code works but is messy → use `/refactor`
- Production is down right now → use `/hotfix`

---

### `/hotfix` — 1 lightweight gate, fast

**Trigger:** production is broken right now, needs the smallest possible fix

**Gate:** Emergency diagnosis display (1 gate — fast)

**What happens:**

```
/hotfix payment gateway returning 500 on all transactions
```

1. Claude enters plan mode, reads max 5 files — no exploration
2. **Gate — Emergency diagnosis:**
   ```
   ━━━ EMERGENCY DIAGNOSIS ━━━
     Issue:      Payment gateway 500 on all transactions
     Root cause: API key rotation — env var PAYMENT_API_KEY is empty in prod
     Fix:        Update env var — no code change needed
     Risk:       low — env-only change
   ```
3. You say "apply" — minimal fix, no new files, immediate test
4. Claude flags: follow up with `/fix` or `/refactor` after the fire is out

**When NOT to use `/hotfix`:**
- Not a production emergency → use `/fix`
- Fix requires changing more than 5 files → use `/fix` or `/refactor`

---

### `/refactor` — 1 gate, impact analysis first, tests before code changes

**Trigger:** code works but needs structural improvement

**Gate:** Impact analysis (1 gate) — tests run immediately after the gate, before any refactoring

**What happens:**

```
/refactor extract auth logic out of LoginScreen into a usecase layer
```

1. Claude enters plan mode, reads ALL affected files before saying anything
2. **Gate — Impact analysis table:**
   ```
   ━━━ IMPACT ANALYSIS ━━━
   Files that WILL change:
   | File                        | Current pattern      | After refactor          |
   |-----------------------------|----------------------|-------------------------|
   | src/features/auth/Login.tsx | business logic inline| calls useAuthUseCase()  |
   | src/usecases/auth/          | does not exist       | new usecase files       |

   Files that will NOT change (callers stay the same):
     • src/navigation/AppRouter.tsx — imports only the screen component
   ```
3. You approve — Claude runs tests first (must pass before refactoring begins)
4. Claude refactors, runs tests again after

**When NOT to use `/refactor`:**
- Something is broken → use `/fix` first, then `/refactor`
- Adding new behaviour → use `/edit-feature`

---

### `/edit-feature` — 1 gate, reads spec + code before proposing changes

**Trigger:** a feature exists and you need to change or extend it

**Gate:** Proposed changes (1 gate)

**What happens:**

```
/edit-feature add email verification to user-profile
```

1. Claude enters plan mode, reads the existing spec in `specs/user-profile/` and the feature files
2. **Gate — Proposed changes:**
   - What will be added/changed vs. what stays the same
   - Any spec updates needed
   - File count
3. You approve — Claude updates spec first, then implements

**Key difference from `/new-feature`:** starts from existing spec and code. Does not create new spec folders. Does not run through all 3 gates.

---

### `/explore` — read-only, no file writes ever

**Trigger:** you want to understand the codebase without changing anything

```
/explore how does the payment flow work end to end
/explore why does the auth state reset on app restart
/explore what files would I need to change to add a dark mode toggle
```

Claude reads files and answers your question. It cannot write, edit, or run commands. There is no gate — the answer is the output.

Useful before starting any `/new-feature` or `/fix` session when the area is unfamiliar.

---

### `/audit` — 11-step governance audit, writes a dated report

**Trigger:** periodic governance check, after a release, before a major refactor, or when onboarding new devs

```
/audit
```

Claude runs 11 checks in sequence:

1. Inventory all features in the features directory
2. Read actual code (not just file names)
3. Compare against steering files (architecture.md, constitution.md)
4. Check spec coverage — which features have specs, which don't
5. Check test coverage
6. Check for architecture violations
7. Check for dead files (never imported)
8. Check hook versions (are hooks outdated?)
9. Check consistency between spec and implementation
10. Check for TODO/FIXME accumulation
11. Summary with recommended next actions

Writes the full report to `docs/governance-audit-YYYY-MM-DD.md`. This file is committed to git — it becomes a dated record of the project's governance state.

```
/audit
→ docs/governance-audit-2026-04-26.md written (347 lines)
```

---

### Command routing — which command to use

```
Something is broken in production right now    →  /hotfix
Something is broken (not production urgent)    →  /fix
Building something new                         →  /new-feature
Changing or extending something existing       →  /edit-feature
Improving code structure (behaviour unchanged) →  /refactor
Understanding the codebase                     →  /explore
Periodic health check / governance review      →  /audit
```

**If in doubt between `/fix` and `/new-feature`:**
- "The app doesn't have X" → `/new-feature`
- "The app had X and it broke" → `/fix`

**If in doubt between `/fix` and `/refactor`:**
- Behaviour is wrong → `/fix`
- Behaviour is right but structure is bad → `/refactor`

### Claude Code hook enforcement

| Hook | When it runs | What it enforces |
|------|-------------|-----------------|
| `check-spec-exists.sh` | Before any source file write | Spec must exist and be complete |
| `protect-files.sh` | Any file write | Warns on high-risk files (main.dart, app.module.ts) |
| `block-dangerous-commands.sh` | Any bash command | Blocks `git push --force`, `rm -rf src/`, package installs |
| `check-file-size.sh` | After any file write | Warns >200 lines, blocks >300 lines (frontend) |
| `session-continuity.sh` | Session start | Adds context about where the last session left off |
| `check-consistency.sh` | Periodically | Warns when spec and code have drifted |
| `check-feature-readme.sh` | After feature file writes | Ensures feature README is updated |
| `format-code.sh` | After any source write | Auto-runs stack formatter |
| `analyze-code.sh` | After any source write | Runs linter |
| `post-task-checklist.sh` | When Claude stops | Reminds to list files, confirm arch, flag risks |

---

## What gets detected per stack

The scanner reads your manifest files and produces a tailored governance output for each stack.

### Flutter
State (Riverpod / BLoC / Provider / GetX), DI (get_it / injectable / Riverpod), router (go_router / auto_route / beamer), network (Dio / http / Chopper), local DB (Hive / Drift / Isar / sqflite), code gen (freezed / json_serializable), i18n, Mason, FVM, flavors, error pattern (Either / dartz / fpdart), legacy MVC vs clean arch dual-zone detection

### Kotlin / Android
UI system (Compose vs XML), DI (Hilt / Koin / Dagger), state (StateFlow vs LiveData), ORM (Room / Realm / SQLDelight), linter (detekt / ktlint / spotless), navigation, WorkManager, Firebase services, SDK versions, multi-module, flavors

### Node.js
Language (TS/JS), module system (ESM/CJS), framework (NestJS / Express / Fastify / Koa / Hapi / Hono / AdonisJS), DI (NestJS / tsyringe / Inversify / Awilix), ORM (Prisma / TypeORM / Drizzle / Mongoose), auth, API docs (Swagger decorators / JSDoc / TSOA / Fastify JSON Schema), API type (REST / GraphQL / gRPC), queues (BullMQ / RabbitMQ / Kafka), real-time (Socket.IO), cloud (AWS / Firebase / GCP), logging (winston / pino), validation (class-validator / Joi / Zod), architecture pattern, monorepo (Lerna / Nx / Turborepo)

### React
Next.js (App Router / Pages Router), RSC detection, state (Zustand / Redux Toolkit / Jotai / MobX + React Query), router (TanStack / React Router), forms (React Hook Form / Formik + Zod), CSS (Tailwind / styled-components / Emotion), UI libs (MUI / Mantine / Chakra / Ant Design), build tool (Vite / CRA / Next.js)

### Angular
Version, Signals (v17+), state (NgRx / NGXS / Akita / Signals / RxJS), SSR, UI libs (Angular Material / PrimeNG), i18n (ngx-translate), test framework (Jest / Karma+Jasmine / Playwright), monorepo (Nx)

### Python
Framework (FastAPI / Django / Flask), ORM (SQLModel / SQLAlchemy / Tortoise), migrations (Alembic), auth (JWT / passlib), cache (Redis), queue (Celery), linter (ruff / black), test (pytest), validation (Pydantic), package manager (poetry / uv / pipenv)

### SwiftUI
TCA, DI (Resolver / Swinject / Factory), state (@Observable / ObservableObject), async/await, network (Alamofire / Moya / URLSession), local DB (SwiftData / GRDB / Realm), @MainActor, min iOS version

### Java
Build system (Maven / Gradle), Java version (8–21+), preview features (--enable-preview), framework (Spring Boot / Spring WebFlux / Quarkus / Micronaut / JAX-RS / Javalin / Spark), DI (Spring DI / Guice / OSGi SCR / CDI / Dagger), UI (Swing / JavaFX — desktop layer flow override), ORM (JPA/Hibernate / MyBatis / jOOQ / Spring JDBC), DB (MongoDB / Redis via Spring Data), test (JUnit 5 / JUnit 4 / TestNG + Mockito / AssertJ / Testcontainers / WireMock / ArchUnit), linter (Checkstyle / SpotBugs / PMD / Error Prone), formatter (Spotless / Google Java Format), OSGi (Felix / Equinox / bnd — bundle layer flow override), multi-module (Maven modules / Gradle includes), logging (SLF4J / Logback / Log4j2), API docs (springdoc-openapi / springfox), Lombok, MapStruct

---

## When to use this (and when not to)

### Worth it when

- **Teams of 3+ using Claude Code** on a shared codebase — the spec-first enforcement prevents "Claude rewrote the auth module because someone said fix the login bug"
- **Production codebases** where architecture consistency matters — hooks catch layer violations before they reach the repo
- **Regulated environments** needing an audit trail — spec files document what was planned vs what was built, with dated governance audit reports
- **Onboarding new devs** who use Claude Code — steering files give Claude your project's patterns from their first session, not after a week of corrections
- **Workspaces with mixed stacks** — a team running Node.js + React + Flutter gets stack-specific governance per project, with shared cross-project rules

### Not worth it when

- **Solo dev prototyping** — the spec-first hook requires filling three markdown templates before writing any file. Right tool for teams, wrong tool for exploration
- **Small utilities** — a 200-line Express API does not need 40 governance files
- **Teams not using Claude Code** — every feature in this framework is built on Claude Code's hook system. It has no value without it

### What it will not do — be clear about this

- **Will not make Claude deterministic.** Steering files give Claude a better starting point each session. Claude still makes its own decisions. A developer who ignores the spec gate gets zero benefit from it.
- **Will not govern code quality.** The hooks check file size, secrets, commit format, and TODO accumulation. They do not check whether the code is correct or whether the architecture was actually followed inside the files.
- **Will not maintain itself.** The generated `architecture.md` is a starting point. If your real project has a `/domain/aggregates/` folder that isn't in the generated file tree, Claude will work around it. Someone on the team needs to read and edit the steering files after init — and keep them current as the project evolves.
- **Will not replace engineering discipline.** The spec-first hook is opt-in by default. The `--no-verify` bypass exists. A team that doesn't take governance seriously will route around every control this tool provides. It is a forcing function, not a guarantee.

---

## Role in the Claude Code ecosystem

Most teams that adopt Claude Code go through the same arc:

1. **One developer** uses it, gets fast results, loves it
2. **Two or three developers** start using it — outputs are fast but increasingly inconsistent
3. **Five or more developers** — Claude produces code that works in isolation but doesn't fit the project. Auth was rewritten twice. The payment service doesn't follow the same patterns as everything else. Nobody can tell which files Claude touched vs which a developer wrote

The gap between "Claude Code installed" and "Claude Code used consistently across a team" is where this CLI operates. It does not make Claude smarter. It gives every developer on the team the same architectural context every session — so Claude's starting point is your actual project, not a generic interpretation of whatever the developer typed.

**What ai-gov sets up vs what it cannot control:**

| ai-gov sets up | Still needs human action |
|----------------|--------------------------|
| Steering files — Claude reads your architecture rules every session | Someone reads and edits them to match reality |
| Spec-first enforcement — Claude cannot write code without an approved spec | Team lead must enable it and enforce the gate |
| Pre-commit hooks — secrets, file size, commit format blocked at commit time | Team norm: `--no-verify` is for emergencies only |
| CI check — every PR gets a governance report | Team lead must act on blockers, not merge around them |
| `/audit` command — 11-step governance health check | Someone runs it. Periodically. Not once. |

The tool provides the infrastructure. The team provides the discipline. Both are required.

---

## Complete file tree (all three layers)

```
PROJECT_ROOT/
├── CLAUDE.md                              <- root pointer
├── .claude/
│   ├── CLAUDE.md                          <- master rules (stack-tailored)
│   ├── settings.json                      <- 10+ hook registrations
│   ├── custom-hooks.json                  <- team custom hooks (never overwritten)
│   ├── steering/
│   │   ├── constitution.md
│   │   ├── architecture.md
│   │   ├── coding-standards.md
│   │   ├── ai-usage-policy.md
│   │   ├── workflow.md
│   │   ├── spec-first-workflow.md
│   │   ├── feature-readme.md
│   │   └── prompt-templates.md
│   ├── hooks/                             <- Claude Code hooks (Layer 1)
│   │   ├── protect-files.sh
│   │   ├── check-secrets.sh
│   │   ├── block-dangerous-commands.sh
│   │   ├── check-spec-exists.sh
│   │   ├── session-continuity.sh
│   │   ├── format-code.sh
│   │   ├── analyze-code.sh
│   │   ├── check-feature-readme.sh
│   │   ├── check-consistency.sh
│   │   ├── check-file-size.sh
│   │   └── post-task-checklist.sh
│   ├── git-hooks/                         <- git hooks (Layer 2, --git-hooks)
│   │   ├── pre-commit.sh
│   │   ├── commit-msg.sh
│   │   ├── config.json
│   │   └── checks/
│   │       ├── file-size.sh
│   │       ├── secrets.sh
│   │       ├── no-todos.sh
│   │       ├── no-debug.sh
│   │       ├── format-check.sh
│   │       └── lint-check.sh
│   ├── commands/
│   │   ├── audit.md
│   │   ├── new-feature.md
│   │   ├── edit-feature.md
│   │   ├── fix.md
│   │   ├── refactor.md
│   │   ├── hotfix.md
│   │   └── explore.md
│   └── extensions/
│       ├── manifest.json
│       ├── jira-sync/run.sh
│       ├── retrospective/run.sh
│       └── verify/run.sh
├── specs/
│   └── _template/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
├── .github/
│   └── workflows/
│       └── governance-check.yml           <- CI check (Layer 3, --ci github)
└── .git/
    └── hooks/
        ├── pre-commit                     <- local wrapper (Layer 2, not committed)
        └── commit-msg                     <- local wrapper (Layer 2, not committed)
```

---

## Project structure (CLI source)

```
ai-governance/
├── bin/ai-gov.ts                          <- CLI entry point
├── src/
│   ├── types.ts                           <- all interfaces and types
│   ├── cli.ts                             <- Commander setup + all commands
│   ├── detect-stack.ts                    <- auto-detection from manifest files
│   ├── profiles.ts                        <- defaults per stack (8 profiles)
│   ├── content-blocks.ts                  <- template variable computation
│   ├── scanners/                          <- 8 stack scanners (40+ detection points each)
│   ├── agents/
│   │   ├── detect-agent.ts                <- auto-detect from .kiro/ vs .claude/
│   │   ├── types.ts                       <- AgentAdapter interface + agent registry
│   │   ├── claude-code/                   <- Claude Code orchestrator
│   │   │   ├── index.ts                   <- generates .claude/ governance files
│   │   │   ├── hooks/                     <- 11 bash hook generators
│   │   │   └── commands/                  <- 8 slash command generators
│   │   └── kiro/                          <- Kiro orchestrator
│   │       ├── index.ts                   <- generates .kiro/ governance files
│   │       ├── steering.ts                <- YAML front-matter wrapper
│   │       └── hooks/                     <- 20 JSON hook generators (governance + workflow)
│   ├── generators/                        <- shared content generators (agent-agnostic)
│   │   ├── index.ts                       <- dispatcher → agent registry
│   │   ├── architecture.ts, constitution.ts, coding-standards.ts, ...
│   │   ├── workspace/                     <- workspace-level file generators
│   │   ├── git-hooks/                     <- git hook generators (agent-agnostic)
│   │   └── ci/                            <- CI config generators (github/gitlab/bitbucket)
│   ├── commands/
│   │   ├── project-init.ts               <- orchestrator for `project init` (adapter pattern)
│   │   ├── init-git-hooks.ts              <- hook detection + wrapper installation
│   │   ├── init-ci.ts                     <- CI file writing
│   │   ├── workspace-init.ts              <- workspace discovery + mono/multi-repo detection
│   │   ├── upgrade.ts                     <- re-generate hooks/commands, preserve steering
│   │   └── onboard.ts                     <- new developer setup (installs wrappers, verifies runtime)
│   ├── stacks/                            <- project-init adapter system
│   │   ├── adapter.ts                     <- StackAdapter interface + ScaffoldContext type
│   │   ├── registry.ts                    <- adapter registry (self-registration pattern)
│   │   ├── common-prompts.ts              <- shared wizard prompts (@inquirer/prompts)
│   │   ├── flutter/                       <- Flutter adapter (scaffold, prompts, templates)
│   │   └── next/                          <- Next.js adapter (scaffold, prompts, templates)
│   ├── pr-check/
│   │   ├── index.ts                       <- orchestrator
│   │   ├── types.ts                       <- CheckResult, CheckItem
│   │   ├── checks/                        <- 8 checks
│   │   └── formatters/                    <- 4 output formats (terminal/github/gitlab/json)
│   └── utils/
│       ├── safe-write.ts                  <- write with dry-run/diff/version-check
│       ├── git.ts                         <- getChangedFiles, getDiff, getCommitMessages
│       ├── file-helpers.ts                <- pkgHas, pubspecHas, gradleHas, pomHas
│       ├── logger.ts                      <- colored console output
│       └── tty.ts                         <- TTY detection + line reading
├── tests/                                 <- 24 test suites, 837 tests
│   ├── agent-detection.test.ts
│   ├── backward-compat.test.ts
│   ├── cli-integration.test.ts
│   ├── generators.test.ts
│   ├── git-hooks.test.ts
│   ├── integration.test.ts
│   ├── java.test.ts
│   ├── kiro-hooks.test.ts
│   ├── kiro-integration.test.ts
│   ├── kiro-steering.test.ts
│   ├── pr-check.test.ts
│   ├── project-init.test.ts              <- orchestrator + buildGovernanceConfig + CLI flags
│   ├── project-init.property.test.ts     <- Property 18 (pure function correctness)
│   ├── scanners.test.ts
│   ├── uninstall.test.ts
│   ├── upgrade.test.ts
│   ├── workspace.test.ts
│   ├── stacks/                            <- adapter property + unit tests
│   │   ├── registry.test.ts
│   │   ├── registry.property.test.ts
│   │   ├── common-prompts.property.test.ts
│   │   ├── flutter-adapter.test.ts
│   │   ├── flutter-adapter.property.test.ts
│   │   ├── next-adapter.test.ts
│   │   └── next-adapter.property.test.ts
│   └── fixtures/                          <- 10 minimal project fixtures per stack
├── docs/
│   ├── INDEX.md                           <- docs navigation
│   ├── complete_usage_guide.md            <- full usage guide (all scenarios)
│   ├── kiro_setup_guide.md                <- Kiro-specific setup
│   ├── workspace_setup_guide.md           <- multi-project workspace setup
│   ├── workspace_governance_guide.md      <- cross-team governance patterns
│   ├── cli_workspace_commands.md          <- workspace commands reference
│   ├── cli_developer_commands.md          <- daily developer commands
│   ├── branching_and_ci_setup_guide.md    <- multi-branch, CI setup
│   ├── upgrade_guide.md                   <- upgrading from older versions
│   └── runtime_requirements.md            <- python3/jq platform requirements
├── package.json
├── tsconfig.json
└── jest.config.cjs
```

**134 source files · ~14,700 lines of TypeScript · 837 tests across 24 suites**

---

## License

MIT
