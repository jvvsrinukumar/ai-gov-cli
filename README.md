# AI Governance CLI

> Scan-adaptive governance framework for Claude Code. Detects your stack automatically and generates steering files, git hooks, CI configs, and spec templates — all tailored to what's actually in your project.

**Version:** 15.2.0
**Stacks:** Flutter · Kotlin · Node.js · React · Angular · SwiftUI · Python
**Agent:** Claude Code

---

## What it does in one sentence

`ai-gov init` scans your project, figures out your stack, and generates ~40 governance files that teach Claude Code your architecture rules — and optionally installs git hooks that enforce commit standards and a CI check that runs on every pull request.

---

## Three layers — each optional, each builds on the previous

| Layer | Command | What it does |
|-------|---------|--------------|
| **Layer 1 — AI Steering** | `npx ai-gov init` | Generates Claude Code steering files, hooks, and spec templates in `.claude/`. Claude reads these automatically and follows your architecture rules. |
| **Layer 2 — Git Hooks** | `npx ai-gov init --git-hooks` | Generates pre-commit and commit-msg bash scripts. Runs when any developer does `git commit`. Checks file size, secrets, TODOs, debug statements, and commit message format. |
| **Layer 3 — CI + PR Check** | `npx ai-gov init --ci github` | Generates a CI pipeline that runs governance on every PR and posts results as a comment. Also available standalone: `npx ai-gov pr-check`. |

You can do Layer 1 only. Or Layer 1 + 2. Or all three. They're independent.

---

## Installation

### Prerequisites

- **Node.js** >= 18
- **jq** — required by all bash hook scripts

```bash
# macOS
brew install jq

# Ubuntu / Debian
sudo apt install jq

# Windows (winget)
winget install jqlang.jq
# Also install Git Bash: https://git-scm.com/download/win
# Or enable WSL2: wsl --install
```

> **Windows note:** The CLI (`ai-gov init`) runs on bare Windows. The generated bash scripts require Git Bash or WSL2. Without it, hooks are silently skipped.

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
git add .claude/ specs/ CLAUDE.md
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

> **Important for new team members:** The `.git/hooks/` wrappers are local — git does not commit them. Each developer must run `npx ai-gov init --git-hooks` once after cloning the repo. The actual check scripts in `.claude/git-hooks/` ARE committed, so the logic is shared. The wrapper is just a pointer.

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
git add .claude/ specs/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance framework v15.2.0"
git push
```

After this, every developer on the team:

- Gets the Claude Code steering rules automatically (they are in `.claude/`, which is committed)
- Gets the git hook logic automatically (`.claude/git-hooks/` is committed)
- Needs to run `npx ai-gov init --git-hooks` **once** after cloning to install the local `.git/hooks/` wrappers
- Gets CI checks automatically on every PR (the workflow file is committed)

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
| `-s, --stack <stack>` | Force a specific stack: `flutter\|kotlin\|nodejs\|react\|angular\|swiftui\|python` | auto-detect |
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

### `ai-gov doctor`

```bash
ai-gov doctor [-d <path>]
```

Checks: CLAUDE.md exists, settings.json valid, all 10+ hooks present, jq installed, git hooks wired.

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

---

## When to use this (and when not to)

### Worth it when

- **Teams of 3+ using Claude Code** on a shared codebase — the spec-first enforcement prevents "Claude rewrote the auth module because someone said fix the login bug"
- **Production codebases** where architecture consistency matters — hooks catch layer violations in real time
- **Regulated environments** needing an audit trail — spec files document what was planned vs what was built
- **Onboarding new devs** who use Claude Code — steering files teach Claude your project's patterns

### Overkill when

- **Solo dev prototyping** — the spec-first hook blocks every file write without filling out three markdown templates
- **Small utilities** — a 200-line Express API does not need 40 governance files
- **Teams that do not use Claude Code** — this framework is designed specifically for Claude Code's hook system

### What it will not do

- Won't write your code — it governs HOW Claude writes code
- Won't catch runtime bugs — hooks check structure and process, not logic
- Won't replace code review — it reduces the surface area of what needs reviewing

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
│   ├── profiles.ts                        <- defaults per stack (7 profiles)
│   ├── content-blocks.ts                  <- template variable computation
│   ├── scanners/                          <- 7 stack scanners (40+ detection points each)
│   ├── generators/
│   │   ├── index.ts                       <- governance file orchestrator
│   │   ├── git-hooks/                     <- git hook generators
│   │   │   ├── index.ts
│   │   │   ├── pre-commit.ts
│   │   │   ├── commit-msg.ts
│   │   │   ├── config.ts
│   │   │   └── checks/
│   │   │       ├── file-size.ts
│   │   │       ├── secrets.ts
│   │   │       ├── no-todos.ts
│   │   │       ├── no-debug.ts            <- stack-aware debug patterns
│   │   │       ├── format-check.ts
│   │   │       └── lint-check.ts
│   │   └── ci/
│   │       ├── github.ts
│   │       ├── gitlab.ts
│   │       └── bitbucket.ts
│   ├── commands/
│   │   ├── init-git-hooks.ts              <- hook detection + wrapper installation
│   │   └── init-ci.ts                     <- CI file writing
│   ├── pr-check/
│   │   ├── index.ts                       <- orchestrator
│   │   ├── types.ts                       <- CheckResult, CheckItem
│   │   ├── checks/                        <- 8 checks
│   │   │   ├── architecture.ts
│   │   │   ├── file-size.ts
│   │   │   ├── credentials.ts
│   │   │   ├── spec-coverage.ts
│   │   │   ├── test-coverage.ts
│   │   │   ├── todos.ts
│   │   │   ├── commit-messages.ts
│   │   │   └── pr-description.ts
│   │   └── formatters/                    <- 4 output formats
│   │       ├── terminal.ts
│   │       ├── github.ts
│   │       ├── gitlab.ts
│   │       └── json.ts
│   └── utils/
│       ├── safe-write.ts                  <- write with dry-run/diff/version-check
│       ├── git.ts                         <- getChangedFiles, getDiff, getCommitMessages
│       ├── file-helpers.ts                <- pkgHas, pubspecHas, gradleHas
│       ├── logger.ts                      <- colored console output
│       └── tty.ts                         <- TTY detection + line reading
├── tests/
│   ├── git-hooks.test.ts                  <- 10 tests
│   ├── pr-check.test.ts                   <- 8 tests
│   ├── generators.test.ts                 <- generator smoke tests
│   ├── scanners.test.ts                   <- 40+ scanner tests across 6 stacks
│   └── fixtures/                          <- minimal manifest files per stack
├── docs/
│   ├── complete_usage_guide.md            <- full usage guide (all scenarios)
│   └── branching_and_ci_setup_guide.md    <- multi-branch, CI setup for all platforms
├── package.json
├── tsconfig.json
└── jest.config.cjs
```

**83 source files · ~8,500 lines of TypeScript · 129 tests**

---

## License

MIT
