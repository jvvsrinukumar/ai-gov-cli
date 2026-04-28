# ai-gov: Multi-Branch Setup, Git Hooks & CI/CD PR Check — Complete Guide

> This guide is written for freshers, students, and junior developers.
> Every step is explained. Nothing is assumed. Copy-paste and follow.

**Version:** 16.0.0
**Last updated:** April 2026

---

## Table of Contents

1. [Understanding Branches — Why Teams Use Multiple Branches](#1-understanding-branches)
2. [The Standard Branch Structure](#2-the-standard-branch-structure)
3. [How ai-gov Fits Into This Branch Structure](#3-how-ai-gov-fits-into-this-branch-structure)
4. [Team Lead: Full Setup (One-Time)](#4-team-lead-full-setup)
5. [Developer: What You Do After Team Lead Sets Up](#5-developer-what-you-do)
6. [Git Hooks — How They Work in Real Time](#6-git-hooks-real-time)
7. [PR Check — How It Works in Real Time](#7-pr-check-real-time)
8. [CI Setup: GitHub (Personal Account)](#8-ci-setup-github-personal)
9. [CI Setup: GitHub (Office/Organization Account)](#9-ci-setup-github-office)
10. [CI Setup: GitLab (Personal Account)](#10-ci-setup-gitlab-personal)
11. [CI Setup: GitLab (Office/Group Account)](#11-ci-setup-gitlab-office)
12. [CI Setup: Bitbucket (Personal Account)](#12-ci-setup-bitbucket-personal)
13. [CI Setup: Bitbucket (Office/Team Account)](#13-ci-setup-bitbucket-office)
14. [Multi-Branch CI Configuration](#14-multi-branch-ci-configuration)
15. [Challenges You Will Face & How to Fix Them](#15-challenges-and-fixes)
16. [Complete Cheat Sheet](#16-cheat-sheet)

---

## 1. Understanding Branches

### What is a branch?

Think of a branch like a copy of your project. You make changes in your copy without affecting anyone else. When your changes are ready, you merge them back.

### Why not just use one branch?

If 5 developers all push to the same branch:
- Developer A's half-finished code breaks Developer B's feature
- Untested code goes to production
- No one can review anything before it goes live
- One bug can take down the entire app

### The rule

> Code flows in ONE direction: `feature → develop → qa → staging → production`
> Code NEVER flows backwards.

---

## 2. The Standard Branch Structure

```
production (or main/master)     ← Live app. Only tested, approved code.
    ↑
staging                         ← Final testing before production.
    ↑
qa                              ← QA team tests here.
    ↑
develop (or dev)                ← All developers merge here first.
    ↑
feature/xyz                     ← Your working branch. One per task.
```

### What each branch is for

| Branch | Who uses it | What happens here | Protected? |
|--------|------------|-------------------|------------|
| `production` (or `main`) | DevOps / Release manager | Live code. Deployed to real users. | YES — no direct push |
| `staging` | QA lead / Tech lead | Pre-production testing. Mirrors production environment. | YES — no direct push |
| `qa` | QA team | QA tests features here before staging. | YES — no direct push |
| `develop` (or `dev`) | All developers | Integration branch. All features merge here first. | YES — only via PR |
| `feature/*` | Individual developer | Your working branch. You create one per task. | NO — you push freely |
| `hotfix/*` | Senior dev / Tech lead | Emergency production fix. Branches from `production`. | NO — but reviewed fast |
| `bugfix/*` | Individual developer | Bug fix. Branches from `develop`. | NO — you push freely |
| `release/*` | Tech lead | Release preparation. Branches from `develop`. | Depends on team |

### Real example — developer daily flow

```bash
# 1. You get a task: "Build login screen" (JIRA-101)
git checkout develop
git pull origin develop
git checkout -b feature/JIRA-101-login-screen

# 2. You code for 2 days, committing as you go
git add .
git commit -m "feat(auth): add login screen UI"
git push origin feature/JIRA-101-login-screen

# 3. You open a PR: feature/JIRA-101-login-screen → develop
#    CI runs pr-check automatically
#    Team lead reviews
#    PR gets merged into develop

# 4. When enough features are ready, tech lead merges develop → qa
# 5. QA tests. If bugs found, you fix on a bugfix branch → develop → qa
# 6. When QA approves, tech lead merges qa → staging
# 7. Final check on staging. If good, tech lead merges staging → production
```

---

## 3. How ai-gov Fits Into This Branch Structure

ai-gov checks code at THREE points:

```
Developer writes code
        │
        ▼
   ┌─────────────┐
   │  GIT HOOKS   │  ← Checks BEFORE commit (local machine)
   │  (Layer 2)   │     Runs: secrets, file size, commit message format
   └──────┬──────┘
          │
          ▼
   Developer pushes & opens PR
          │
          ▼
   ┌─────────────┐
   │  CI PR CHECK │  ← Checks BEFORE merge (on the server)
   │  (Layer 3)   │     Runs: architecture, credentials, specs, tests, TODOs
   └──────┬──────┘
          │
          ▼
   Code gets merged
```

### Which branches should PR check run on?

The generated CI config runs on PRs targeting these branches by default:

```yaml
# GitHub Actions (default)
on:
  pull_request:
    branches: [main, develop, master]
```

**You should add ALL your protected branches.** Here's why:

| PR direction | Should pr-check run? | Why |
|---|---|---|
| `feature/*` → `develop` | YES | Catch issues before they enter the integration branch |
| `develop` → `qa` | YES | Double-check before QA gets it |
| `qa` → `staging` | YES | Final automated check before staging |
| `staging` → `production` | YES | Last safety net before production |
| `hotfix/*` → `production` | YES | Even emergency fixes should be checked |

---

## 4. Team Lead: Full Setup (One-Time)

### Prerequisites — install these first

```bash
# Check if you have everything
node --version     # Need 18.0.0 or higher
npm --version      # Any recent version
git --version      # Any recent version
jq --version       # Need 1.6 or higher — THIS IS THE MOST MISSED ONE

# Install jq if missing
# macOS:
brew install jq

# Ubuntu/Debian/WSL2:
sudo apt-get update && sudo apt-get install -y jq

# Windows (PowerShell as admin):
winget install jqlang.jq
```

### Step 1 — Go to your project

```bash
cd /path/to/your-project
```

### Step 2 — Generate governance files (Layer 1)

```bash
npx ai-gov init
```

This creates ~40 files in `.claude/`, `specs/`, and `CLAUDE.md`.

### Step 3 — Add git hooks (Layer 2)

```bash
npx ai-gov init --git-hooks
```

This creates:
- `.claude/git-hooks/` — the actual check scripts (committed to git)
- `.git/hooks/pre-commit` — thin wrapper (local only, NOT committed)
- `.git/hooks/commit-msg` — thin wrapper (local only, NOT committed)

### Step 4 — Add CI check (Layer 3)

Pick your platform:

```bash
# GitHub
npx ai-gov init --ci github

# GitLab
npx ai-gov init --ci gitlab

# Bitbucket
npx ai-gov init --ci bitbucket
```

### Step 5 — Modify CI config for your branch structure

This is the critical step most guides skip. The default config only watches `main`, `develop`, `master`. You need to add your other branches.

**See [Section 14: Multi-Branch CI Configuration](#14-multi-branch-ci-configuration) for exact files to edit.**

### Step 6 — Verify everything

```bash
npx ai-gov doctor
```

All checks should show `✓`.

### Step 7 — Commit and push

```bash
git add .claude/ specs/ CLAUDE.md
git add .github/workflows/governance-check.yml   # GitHub
# OR
git add .gitlab-ci.yml                            # GitLab
# OR
git add bitbucket-pipelines.yml                   # Bitbucket

git commit -m "chore: add ai-gov governance framework v16.0.0"
git push origin develop    # or whatever your main integration branch is
```

### Step 8 — Tell your team

Send this message to your team:

```
Team — I've added ai-gov governance to the project. Here's what you need to do:

1. Pull the latest develop branch:
   git checkout develop && git pull

2. Install git hooks (one-time, takes 5 seconds):
   npx ai-gov init --git-hooks

3. Make sure jq is installed:
   jq --version
   If not: brew install jq (macOS) or sudo apt install jq (Linux)

That's it. From now on:
- Your commits will be checked automatically (secrets, file size, commit message format)
- Your PRs will get a governance comment automatically (no action needed)
- If something is blocked, the error message tells you exactly what to fix
```

---

## 5. Developer: What You Do After Team Lead Sets Up

### One-time setup (do this ONCE after cloning or after team lead pushes governance files)

```bash
# Step 1: Pull latest code
git checkout develop
git pull origin develop

# Step 2: Install git hooks locally
npx ai-gov init --git-hooks

# Step 3: Verify jq is installed
jq --version
# If you see "jq-1.6" or higher → you're good
# If you see "command not found" → install it:
#   macOS: brew install jq
#   Linux: sudo apt-get install -y jq
#   Windows: winget install jqlang.jq

# Step 4: Verify setup
npx ai-gov doctor
# All checks should show ✓
```

### That's it. You're done with setup.

From now on, everything is automatic:
- You commit → git hooks check your code
- You open a PR → CI checks your PR
- You don't need to run any extra commands

### Your daily workflow

```bash
# 1. Start your task
git checkout develop
git pull origin develop
git checkout -b feature/JIRA-101-login-screen

# 2. Write code normally

# 3. Commit (hooks run automatically)
git add src/features/auth/login-screen.tsx
git commit -m "feat(auth): add login screen with form validation"
#    ↑ hooks check: secrets? file size? commit message format?
#    If all pass → commit succeeds
#    If something fails → you see the error, fix it, commit again

# 4. Push and open PR
git push origin feature/JIRA-101-login-screen
# Open PR on GitHub/GitLab/Bitbucket: feature/JIRA-101-login-screen → develop
#    ↑ CI runs pr-check automatically
#    A comment appears on your PR with results
#    If blockers → fix and push again (comment updates automatically)

# 5. Get PR reviewed and merged
```

### What you DON'T need to do

- ❌ Don't need to run `ai-gov init` (team lead already did it)
- ❌ Don't need to configure CI (team lead already did it)
- ❌ Don't need to run `ai-gov pr-check` manually (CI does it)
- ❌ Don't need to install any CI tokens or secrets
- ❌ Don't need to remember governance rules (hooks enforce them)

### What you CAN do (optional)

```bash
# Check your branch locally before pushing (saves time)
npx ai-gov pr-check --base develop

# See what the PR comment would look like
npx ai-gov pr-check --base develop --format github
```

---

## 6. Git Hooks — How They Work in Real Time

### What happens when you type `git commit`

```
You type: git commit -m "feat(auth): add login screen"
                │
                ▼
        .git/hooks/pre-commit fires
                │
                ▼
        Calls .claude/git-hooks/pre-commit.sh
                │
                ▼
        Reads .claude/git-hooks/config.json
        (which checks are enabled? what thresholds?)
                │
                ▼
        Runs each enabled check on your STAGED files:
        ┌─────────────────────────────────────────┐
        │ 1. file-size.sh   → Is any file > 300 lines?     │
        │ 2. secrets.sh     → Any API keys/passwords?       │
        │ 3. no-todos.sh    → Any TODO/FIXME left?          │
        │ 4. no-debug.sh    → Any console.log/print left?   │
        │ 5. format-check.sh → Code formatted? (OFF by default) │
        │ 6. lint-check.sh   → Lint clean? (OFF by default)     │
        └─────────────────────────────────────────┘
                │
                ▼
        All pass? → pre-commit exits 0 → git continues
                │
                ▼
        .git/hooks/commit-msg fires
                │
                ▼
        Calls .claude/git-hooks/commit-msg.sh
                │
                ▼
        Validates your commit message:
        - Matches pattern: <type>(<scope>): <description>
        - Type is one of: feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
        - Description is at least 10 characters
        - (Optional) Contains ticket reference like JIRA-123
                │
                ▼
        Pass? → commit-msg exits 0 → COMMIT SUCCEEDS
        Fail? → commit-msg exits 1 → COMMIT REJECTED
```

### Scenario: Everything passes

```bash
$ git add src/features/auth/login.tsx
$ git commit -m "feat(auth): add login screen with email validation"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ✅ All checks passed.

[feature/login abc1234] feat(auth): add login screen with email validation
 1 file changed, 89 insertions(+)
```

### Scenario: Secret detected (BLOCKED)

```bash
$ git add src/config/api.ts    # This file contains: const API_KEY = "AKIAIOSFODNN7EXAMPLE"
$ git commit -m "feat: add API configuration"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ❌ SECRETS: src/config/api.ts — AWS Access Key ID detected (AKIA pattern)
     → Use environment variables or AWS Secrets Manager

  ❌ 1 blocking issue(s) found. Fix and try again.
  (bypass with: git commit --no-verify)
```

**How to fix:**
```bash
# 1. Remove the hardcoded key from src/config/api.ts
# 2. Use environment variable instead:
#    const API_KEY = process.env.API_KEY
# 3. Add the key to .env (which is in .gitignore)
# 4. Stage and commit again
git add src/config/api.ts
git commit -m "feat: add API configuration using env variables"
```

### Scenario: File too large (BLOCKED)

```bash
$ git add src/features/payment/PaymentScreen.tsx    # 380 lines
$ git commit -m "feat(payment): add payment screen"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ❌ FILE SIZE: src/features/payment/PaymentScreen.tsx has 380 lines (max 300)
     → Split into smaller components before committing

  ❌ 1 blocking issue(s) found. Fix and try again.
  (bypass with: git commit --no-verify)
```

**How to fix:**
```bash
# Split PaymentScreen.tsx into:
#   PaymentScreen.tsx (200 lines) — main screen
#   PaymentForm.tsx (120 lines) — form component
#   PaymentSummary.tsx (60 lines) — summary component
git add src/features/payment/
git commit -m "feat(payment): add payment screen with form and summary"
```

### Scenario: Bad commit message (BLOCKED)

```bash
$ git commit -m "fix stuff"

  ❌ COMMIT MESSAGE: doesn't follow conventional format

  Expected: <type>(<scope>): <description>
  Types:    feat|fix|refactor|hotfix|docs|test|chore|style|perf|ci|build
  Minimum:  10 characters in description

  Examples:
    feat: add user profile edit screen
    fix(auth): resolve null pointer in login flow
    refactor: extract auth logic into usecase layer

  Your message: "fix stuff"
```

**How to fix:**
```bash
git commit -m "fix(auth): resolve null pointer in login validation"
```

### Scenario: TODO found (WARNING — not blocked)

```bash
$ git add src/features/payment/PaymentService.ts
$ git commit -m "feat(payment): add payment service layer"

  🔒 Pre-commit governance check
  ───────────────────────────────
  ⚠️  TODO: src/features/payment/PaymentService.ts — // TODO: handle retry logic

  ⚠️  1 warning(s). Commit allowed — consider fixing.

[feature/payment abc5678] feat(payment): add payment service layer
```

The commit goes through. Warnings don't block. But the PR check will also flag it.

### Scenario: Emergency bypass

```bash
$ git commit --no-verify -m "hotfix: emergency production fix for payment crash"
```

This skips ALL git hooks. Use only in emergencies. The CI pr-check will still catch issues when you open the PR.

---

## 7. PR Check — How It Works in Real Time

### The complete flow

```
STEP 1: Developer pushes branch
$ git push origin feature/JIRA-101-login-screen

STEP 2: Developer opens PR on GitHub/GitLab/Bitbucket
Target: feature/JIRA-101-login-screen → develop

STEP 3: CI platform detects the PR event
GitHub Actions / GitLab CI / Bitbucket Pipelines triggers automatically

STEP 4: CI runner executes the governance workflow
┌──────────────────────────────────────────────┐
│ 1. Checkout the code (with full git history) │
│ 2. Install Node.js 20                       │
│ 3. Install jq                               │
│ 4. Install ai-gov CLI                       │
│ 5. Run: ai-gov pr-check --base develop      │
│    ├── Get list of changed files (vs develop)│
│    ├── Get the diff                          │
│    ├── Run 8 checks:                         │
│    │   ├── Architecture (layer violations)   │
│    │   ├── File Size (> 300 lines)           │
│    │   ├── Credentials (API keys, passwords) │
│    │   ├── Spec Coverage (feature has spec?) │
│    │   ├── Test Coverage (source has test?)  │
│    │   ├── TODOs (TODO/FIXME in new code)    │
│    │   ├── Commit Messages (conventional?)   │
│    │   └── PR Description (template exists?) │
│    └── Output formatted report               │
│ 6. Post report as PR comment                 │
└──────────────────────────────────────────────┘

STEP 5: Developer sees the comment on the PR
If blockers → fix, push again → comment updates (no duplicates)
If warnings only → merge is allowed, but consider fixing
If all pass → merge confidently
```

### What the 8 checks actually do

| # | Check | What it looks for | Result if found | Can it block merge? |
|---|-------|-------------------|-----------------|---------------------|
| 1 | Architecture | UI files and data layer files changed in same PR (possible layer violation) | ⚠️ Warning | No |
| 2 | File Size | Any source file > 300 lines | ⚠️ Warning | No |
| 3 | Credentials | AWS keys (AKIA pattern), API keys, passwords, tokens in the diff | ❌ Blocker | **YES — exit code 1** |
| 4 | Spec Coverage | Feature files (`src/features/*`) without matching spec in `specs/` | ⚠️ Warning | No |
| 5 | Test Coverage | Source files without a corresponding `.test.` or `.spec.` file | ⚠️ Warning | No |
| 6 | TODOs | `TODO`, `FIXME`, `HACK`, `XXX` in newly added lines | ⚠️ Warning | No |
| 7 | Commit Messages | Commits not following `type(scope): description` format | ⚠️ Warning | No |
| 8 | PR Description | Whether a PR template file exists in the repo | ⏭️ Skip (info only) | No |

**Only Credentials is a hard blocker.** Everything else is a warning — merge is allowed but the comment shows what to improve.

### What the PR comment looks like

**All checks pass:**
```markdown
## 🏛️ Governance Review

**Changed files:** 5 | **Blockers:** 0 | **Warnings:** 0

> ✅ **All governance checks passed.**

✅ **Architecture**: No layer boundary violations detected
✅ **File Size**: All files within size limits
✅ **Credentials**: No credentials detected in diff
✅ **Spec Coverage**: All feature files have matching specs
✅ **Test Coverage**: All source files have corresponding tests
✅ **TODOs**: No TODO/FIXME/HACK/XXX in added lines
✅ **Commit Messages**: All 3 commit(s) follow conventional format
⏭️ **PR Description**: PR template exists

---
*Generated by ai-gov*
```

**With warnings:**
```markdown
## 🏛️ Governance Review

**Changed files:** 8 | **Blockers:** 0 | **Warnings:** 2

> ⚠️ **This PR has warnings. Merge is allowed but consider addressing them.**

✅ **Architecture**: No layer boundary violations detected
⚠️ **File Size**: 1 file(s) exceed 300 lines
  - `src/features/auth/login.tsx`: 342 lines (max 300)
✅ **Credentials**: No credentials detected in diff
✅ **Spec Coverage**: All feature files have matching specs
⚠️ **Test Coverage**: 1 source file(s) without tests
  - `src/features/auth/AuthService.ts`: No corresponding test file found
✅ **TODOs**: No TODO/FIXME/HACK/XXX in added lines
✅ **Commit Messages**: All 5 commit(s) follow conventional format

---
*Generated by ai-gov*
```

**With blocker (credential detected):**
```markdown
## 🏛️ Governance Review

**Changed files:** 3 | **Blockers:** 1 | **Warnings:** 0

> ❌ **This PR has blocking issues that must be resolved before merge.**

✅ **Architecture**: No layer boundary violations detected
✅ **File Size**: All files within size limits
❌ **Credentials**: 1 potential credential(s) found
  - `src/config/api.ts`: AWS Access Key ID detected (AKIA pattern) — use environment variables
✅ **Spec Coverage**: All feature files have matching specs
✅ **TODOs**: No TODO/FIXME/HACK/XXX in added lines
✅ **Commit Messages**: All 2 commit(s) follow conventional format

---
*Generated by ai-gov*
```

---

## 8. CI Setup: GitHub (Personal Account)

### What is a "personal account" on GitHub?

When you sign up on github.com with your email, you get a personal account. Your repos live at `github.com/your-username/your-repo`. You are the only owner.

### Step-by-step setup

#### Step 1: Make sure your repo is on GitHub

```bash
# If you haven't pushed yet:
git remote add origin https://github.com/your-username/your-project.git
git push -u origin develop
```

#### Step 2: Generate the CI workflow file

```bash
cd /path/to/your-project
npx ai-gov init --ci github
```

This creates: `.github/workflows/governance-check.yml`

#### Step 3: Look at what was created

The file looks like this:

```yaml
name: Governance Check
on:
  pull_request:
    branches: [main, develop, master]

permissions:
  pull-requests: write
  contents: read

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Install governance CLI
        run: npm install -g ai-gov@16.0.0

      - name: Run governance check
        run: ai-gov pr-check --base ${{ github.event.pull_request.base.ref }} --format github > /tmp/governance-report.md

      - name: Post PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('/tmp/governance-report.md', 'utf-8');
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number
            });
            const existing = comments.find(c => c.body.includes('Governance Review'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body: report
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body: report
              });
            }
```

**Key things to understand:**

| Line | What it means |
|------|---------------|
| `on: pull_request: branches: [main, develop, master]` | This workflow runs when someone opens a PR targeting main, develop, or master |
| `permissions: pull-requests: write` | Allows the workflow to post comments on PRs |
| `permissions: contents: read` | Allows the workflow to read your code |
| `fetch-depth: 0` | Downloads full git history (needed to compare branches) |
| `${{ github.event.pull_request.base.ref }}` | Automatically uses the PR's target branch (e.g., "develop") |
| `if: always()` | Posts the comment even if the check found blockers |

#### Step 4: Commit and push

```bash
git add .github/workflows/governance-check.yml
git commit -m "ci: add governance PR check workflow"
git push origin develop
```

#### Step 5: Test it

```bash
# Create a test branch
git checkout -b test/governance-check
echo "// test file" > test-governance.ts
git add test-governance.ts
git commit -m "test: verify governance check works"
git push origin test/governance-check
```

Now go to GitHub → your repo → Pull Requests → New Pull Request:
- Base: `develop`
- Compare: `test/governance-check`
- Click "Create Pull Request"

Wait 1-2 minutes. A comment will appear on the PR with the governance report.

#### Step 6: Clean up test

After verifying, close the PR and delete the test branch:
```bash
git checkout develop
git branch -D test/governance-check
git push origin --delete test/governance-check
```

### Do I need to create any tokens or secrets?

**NO.** GitHub Actions automatically provides `GITHUB_TOKEN` to every workflow. The `permissions` block in the YAML tells GitHub what the token can do. You don't create, copy, or paste anything.

### Do I need to enable GitHub Actions?

For personal repos, GitHub Actions is enabled by default. If it's not:
1. Go to your repo on GitHub
2. Click "Settings" tab
3. Click "Actions" → "General" in the left sidebar
4. Select "Allow all actions and reusable workflows"
5. Click "Save"

### Free tier limits

GitHub gives you **2,000 minutes/month** of Actions for free on personal accounts. Each governance check takes about 30-60 seconds. That's roughly 2,000-4,000 PR checks per month for free.

---

## 9. CI Setup: GitHub (Office/Organization Account)

### What's different from personal?

In an organization:
- Repos live at `github.com/your-company/your-repo`
- There's an org admin who controls settings
- Actions might be restricted by org policy
- Branch protection rules are usually stricter

### Step-by-step setup

#### Steps 1-4: Same as personal account

The workflow file is identical. Generate it the same way:

```bash
npx ai-gov init --ci github
git add .github/workflows/governance-check.yml
git commit -m "ci: add governance PR check workflow"
git push origin develop
```

#### Step 5: Check if Actions is allowed (org admin may need to do this)

If the workflow doesn't run:

1. Ask your org admin to go to: `github.com/organizations/YOUR-ORG/settings/actions`
2. Under "Actions permissions", select "Allow all actions and reusable workflows"
   - OR at minimum, allow: `actions/checkout`, `actions/setup-node`, `actions/github-script`
3. Click "Save"

#### Step 6: Check workflow permissions (org admin may need to do this)

If the comment doesn't appear on the PR:

1. Go to repo → Settings → Actions → General
2. Scroll to "Workflow permissions"
3. Select "Read and write permissions"
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Click "Save"

**Why this is needed:** Some orgs set default workflow permissions to "Read-only". The governance check needs "write" to post PR comments.

#### Step 7: Make governance check a required status check (recommended)

This prevents merging if the governance check fails (i.e., credentials detected):

1. Go to repo → Settings → Branches
2. Click "Add branch protection rule" (or edit existing)
3. Branch name pattern: `develop` (repeat for `qa`, `staging`, `production`)
4. Check "Require status checks to pass before merging"
5. Search for "governance" and select the "governance" check
6. Click "Save changes"

Now if someone's PR has a credential blocker, GitHub won't allow the merge button.

### Common org issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Workflow doesn't run at all | Actions disabled at org level | Org admin enables Actions |
| Workflow runs but comment doesn't appear | Workflow permissions set to read-only | Change to read-write in repo settings |
| "Resource not accessible by integration" error | Token doesn't have PR write permission | Enable "Allow GitHub Actions to create and approve pull requests" |
| Workflow runs on some repos but not others | Per-repo Actions settings differ | Check each repo's Settings → Actions → General |

---

## 10. CI Setup: GitLab (Personal Account)

### What is a "personal account" on GitLab?

When you sign up on gitlab.com, your repos live at `gitlab.com/your-username/your-project`. GitLab CI/CD is enabled by default on all projects.

### Step-by-step setup

#### Step 1: Generate the CI config

```bash
cd /path/to/your-project
npx ai-gov init --ci gitlab
```

This creates or appends to `.gitlab-ci.yml`:

```yaml
stages:
  - test

governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@16.0.0
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

**Key things to understand:**

| Line | What it means |
|------|---------------|
| `image: node:20` | Uses a Node.js 20 Docker image to run the check |
| `$CI_MERGE_REQUEST_TARGET_BRANCH_NAME` | Automatically uses the MR's target branch (e.g., "develop") |
| `$CI_PIPELINE_SOURCE == "merge_request_event"` | Only runs when a Merge Request is created or updated |

#### Step 2: Commit and push

```bash
git add .gitlab-ci.yml
git commit -m "ci: add governance MR check"
git push origin develop
```

#### Step 3: Test it

```bash
git checkout -b test/governance-check
echo "// test" > test-governance.ts
git add test-governance.ts
git commit -m "test: verify governance check works"
git push origin test/governance-check
```

Go to GitLab → your project → Merge Requests → New Merge Request:
- Source: `test/governance-check`
- Target: `develop`
- Click "Create Merge Request"

The pipeline runs automatically. Check the pipeline output in the MR.

### Do I need to create any tokens?

**NO.** GitLab CI automatically provides `CI_JOB_TOKEN` to every pipeline job. No configuration needed.

### Important: GitLab CI output format

The default GitLab setup outputs to the pipeline log (terminal format). The report appears in the job output, not as an MR comment. To get MR comments, you need the GitLab API — see the advanced section below.

### Advanced: Post as MR comment (optional)

To post the report as an actual MR comment (like GitHub does), add this to your `.gitlab-ci.yml`:

```yaml
governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq curl
    - npm install -g ai-gov@16.0.0
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab > /tmp/report.md
    - |
      # Post as MR comment using GitLab API
      REPORT=$(cat /tmp/report.md)
      curl --request POST \
        --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
        --header "Content-Type: application/json" \
        --data "$(jq -n --arg body "$REPORT" '{body: $body}')" \
        "$CI_API_V4_URL/projects/$CI_PROJECT_ID/merge_requests/$CI_MERGE_REQUEST_IID/notes"
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

For this, you DO need a token:
1. Go to GitLab → your profile → Preferences → Access Tokens
2. Create a token with `api` scope
3. Go to your project → Settings → CI/CD → Variables
4. Add variable: Key = `GITLAB_TOKEN`, Value = your token, check "Mask variable"

### Free tier limits

GitLab gives you **400 CI/CD minutes/month** on the free tier. Each governance check takes about 1-2 minutes (includes Docker image pull + npm install). That's roughly 200-400 checks per month.

---

## 11. CI Setup: GitLab (Office/Group Account)

### What's different from personal?

In a GitLab group:
- Projects live at `gitlab.com/your-company/your-project`
- Group admins control CI/CD settings
- Shared runners may be configured differently
- CI/CD minutes may be pooled across the group

### Step-by-step setup

#### Steps 1-3: Same as personal account

```bash
npx ai-gov init --ci gitlab
git add .gitlab-ci.yml
git commit -m "ci: add governance MR check"
git push origin develop
```

#### Step 4: Check if CI/CD is enabled (group admin may need to do this)

If the pipeline doesn't run:

1. Go to your project → Settings → General → Visibility, project features, permissions
2. Ensure "CI/CD" is enabled
3. Go to Settings → CI/CD → Runners
4. Ensure shared runners are available (or a group runner is assigned)

#### Step 5: Make governance check a required pipeline (recommended)

1. Go to project → Settings → Merge Requests
2. Under "Merge checks", enable "Pipelines must succeed"
3. Click "Save changes"

Now MRs can't be merged if the governance pipeline fails.

#### Step 6: Set up MR comment token at group level (optional, for MR comments)

Instead of per-project tokens, group admins can set a group-level CI/CD variable:

1. Go to your group → Settings → CI/CD → Variables
2. Add: Key = `GITLAB_TOKEN`, Value = a group access token with `api` scope
3. Check "Mask variable"
4. This token is now available to ALL projects in the group

### Common GitLab issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Pipeline doesn't run | CI/CD disabled on project | Enable in project settings |
| "No runners available" | No shared/group runners | Group admin assigns runners |
| Pipeline runs on every push (not just MRs) | Missing `rules` in YAML | Ensure `rules: - if: $CI_PIPELINE_SOURCE == "merge_request_event"` |
| `npm: command not found` | Wrong Docker image | Use `image: node:20` |
| Pipeline takes too long | npm install on every run | Consider caching `node_modules` |

---

## 12. CI Setup: Bitbucket (Personal Account)

### What is a "personal account" on Bitbucket?

When you sign up on bitbucket.org, your repos live at `bitbucket.org/your-username/your-repo`. Bitbucket Pipelines is the CI/CD service.

### Step-by-step setup

#### Step 1: Enable Bitbucket Pipelines

Unlike GitHub and GitLab, Pipelines is NOT enabled by default:

1. Go to your repo on Bitbucket
2. Click "Repository settings" (gear icon)
3. Click "Pipelines" → "Settings"
4. Toggle "Enable Pipelines" to ON

#### Step 2: Generate the CI config

```bash
cd /path/to/your-project
npx ai-gov init --ci bitbucket
```

This creates `bitbucket-pipelines.yml`:

```yaml
image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@16.0.0
            - ai-gov pr-check --base $BITBUCKET_PR_DESTINATION_BRANCH --format terminal
```

**Key things to understand:**

| Line | What it means |
|------|---------------|
| `image: node:20` | Uses Node.js 20 Docker image |
| `pull-requests: '**':` | Runs on ALL pull requests, regardless of target branch |
| `$BITBUCKET_PR_DESTINATION_BRANCH` | Automatically uses the PR's target branch |
| `--format terminal` | Outputs to pipeline log (Bitbucket doesn't have native PR comment API in pipelines) |

#### Step 3: Commit and push

```bash
git add bitbucket-pipelines.yml
git commit -m "ci: add governance PR check"
git push origin develop
```

#### Step 4: Test it

Create a branch, push, and open a PR on Bitbucket. The pipeline runs automatically. Check the pipeline output in the PR's "Pipelines" tab.

### Do I need to create any tokens?

**NO** for the basic setup. Bitbucket Pipelines provides built-in credentials automatically.

### Bitbucket output

The default Bitbucket setup outputs to the pipeline log (terminal format). You see the results in the "Pipelines" tab of the PR. To post as a PR comment, you'd need the Bitbucket API — see advanced section below.

### Advanced: Post as PR comment (optional)

```yaml
image: node:20

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq curl
            - npm install -g ai-gov@16.0.0
            - ai-gov pr-check --base $BITBUCKET_PR_DESTINATION_BRANCH --format terminal > /tmp/report.txt
            - cat /tmp/report.txt
            - |
              # Post as PR comment
              REPORT=$(cat /tmp/report.txt)
              curl -X POST \
                -u "$BB_USER:$BB_APP_PASSWORD" \
                -H "Content-Type: application/json" \
                -d "$(jq -n --arg body "$REPORT" '{content: {raw: $body}}')" \
                "https://api.bitbucket.org/2.0/repositories/$BITBUCKET_REPO_FULL_NAME/pullrequests/$BITBUCKET_PR_ID/comments"
```

For this, you need an App Password:
1. Go to Bitbucket → Personal settings → App passwords
2. Create one with `pullrequest:write` permission
3. Go to your repo → Repository settings → Pipelines → Repository variables
4. Add: `BB_USER` = your Bitbucket username
5. Add: `BB_APP_PASSWORD` = the app password (check "Secured")

### Free tier limits

Bitbucket gives you **50 build minutes/month** on the free tier. Each governance check takes about 1-2 minutes. That's roughly 25-50 checks per month. For teams, the Standard plan ($3/user/month) gives 2,500 minutes.

---

## 13. CI Setup: Bitbucket (Office/Team Account)

### What's different from personal?

In a Bitbucket workspace (team/company):
- Repos live at `bitbucket.org/your-company/your-repo`
- Workspace admins control Pipelines settings
- Build minutes are shared across the workspace
- Branch permissions are managed at workspace level

### Step-by-step setup

#### Steps 1-3: Same as personal account

```bash
npx ai-gov init --ci bitbucket
git add bitbucket-pipelines.yml
git commit -m "ci: add governance PR check"
git push origin develop
```

#### Step 4: Enable Pipelines (workspace admin may need to do this)

1. Repo → Repository settings → Pipelines → Settings → Enable

#### Step 5: Set up workspace-level variables (for PR comments, optional)

Instead of per-repo variables, workspace admins can set workspace-level pipeline variables:

1. Go to Bitbucket → Workspace settings → Pipelines → Workspace variables
2. Add `BB_USER` and `BB_APP_PASSWORD`
3. These are available to ALL repos in the workspace

#### Step 6: Add branch restrictions (recommended)

1. Go to repo → Repository settings → Branch restrictions
2. Add restriction for `develop`, `qa`, `staging`, `production`:
   - "Require passing builds to merge" → Enable
   - "Require approvals" → Set to 1 or more

### Common Bitbucket issues

| Issue | Cause | Fix |
|-------|-------|-----|
| "Pipelines is not enabled" | Not turned on | Enable in repo settings |
| Pipeline doesn't trigger on PR | `bitbucket-pipelines.yml` not on the source branch | The file must exist on the branch you're pushing |
| "Build minutes exceeded" | Free tier limit (50 min/month) | Upgrade plan or optimize pipeline |
| `apt-get` fails | Docker image doesn't have apt | Use `node:20` image (Debian-based, has apt) |

---

## 14. Multi-Branch CI Configuration

### The problem with the default config

The default generated config only watches `main`, `develop`, and `master`:

```yaml
# GitHub default
on:
  pull_request:
    branches: [main, develop, master]
```

If your team uses `qa`, `staging`, `production` branches, PRs targeting those branches won't trigger the governance check.

### Fix: Add all your protected branches

#### GitHub Actions

Edit `.github/workflows/governance-check.yml`:

```yaml
name: Governance Check
on:
  pull_request:
    branches:
      - main
      - master
      - develop
      - dev
      - qa
      - staging
      - production
      - release/*

permissions:
  pull-requests: write
  contents: read

jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install jq
        run: sudo apt-get install -y jq

      - name: Install governance CLI
        run: npm install -g ai-gov@16.0.0

      - name: Run governance check
        run: ai-gov pr-check --base ${{ github.event.pull_request.base.ref }} --format github > /tmp/governance-report.md

      - name: Post PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('/tmp/governance-report.md', 'utf-8');
            const { data: comments } = await github.rest.issues.listComments({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number
            });
            const existing = comments.find(c => c.body.includes('Governance Review'));
            if (existing) {
              await github.rest.issues.updateComment({
                owner: context.repo.owner, repo: context.repo.repo,
                comment_id: existing.id, body: report
              });
            } else {
              await github.rest.issues.createComment({
                owner: context.repo.owner, repo: context.repo.repo,
                issue_number: context.issue.number, body: report
              });
            }
```

**What changed:** Added `qa`, `staging`, `production`, `release/*` to the `branches` list.

**What `release/*` means:** Any branch starting with `release/` (e.g., `release/v2.0`, `release/sprint-5`) will also trigger the check.

#### GitLab

The GitLab config already handles all branches automatically because it uses `merge_request_event`:

```yaml
governance-check:
  stage: test
  image: node:20
  before_script:
    - apt-get update && apt-get install -y jq
    - npm install -g ai-gov@16.0.0
  script:
    - ai-gov pr-check --base $CI_MERGE_REQUEST_TARGET_BRANCH_NAME --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

`$CI_MERGE_REQUEST_TARGET_BRANCH_NAME` automatically resolves to whatever branch the MR targets. No changes needed.

If you want to restrict to specific target branches only:

```yaml
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event" && $CI_MERGE_REQUEST_TARGET_BRANCH_NAME =~ /^(main|develop|qa|staging|production)$/
```

#### Bitbucket

The Bitbucket config already handles all branches because `'**'` matches all PR targets:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          # ...
```

If you want to restrict to specific target branches, Bitbucket doesn't support target-branch filtering in `bitbucket-pipelines.yml` natively. The `'**'` pattern matches the SOURCE branch pattern. To filter by target, add a check in the script:

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - apt-get update && apt-get install -y jq
            - npm install -g ai-gov@16.0.0
            - |
              # Only run for specific target branches
              TARGET="$BITBUCKET_PR_DESTINATION_BRANCH"
              if [[ "$TARGET" =~ ^(main|develop|qa|staging|production)$ ]]; then
                ai-gov pr-check --base "$TARGET" --format terminal
              else
                echo "Skipping governance check — target branch '$TARGET' is not protected"
              fi
```

### Which PRs trigger the check for each branch flow?

| PR direction | GitHub | GitLab | Bitbucket |
|---|---|---|---|
| `feature/*` → `develop` | ✅ (if `develop` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `bugfix/*` → `develop` | ✅ (if `develop` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `develop` → `qa` | ✅ (if `qa` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `qa` → `staging` | ✅ (if `staging` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `staging` → `production` | ✅ (if `production` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `hotfix/*` → `production` | ✅ (if `production` in branches list) | ✅ (automatic) | ✅ (automatic) |
| `release/*` → `production` | ✅ (if `release/*` in branches list) | ✅ (automatic) | ✅ (automatic) |

### The `--base` flag explained

The `--base` flag tells `ai-gov pr-check` which branch to compare against. In CI, this is set automatically:

| Platform | How `--base` is set | Example value |
|---|---|---|
| GitHub | `${{ github.event.pull_request.base.ref }}` | `develop` |
| GitLab | `$CI_MERGE_REQUEST_TARGET_BRANCH_NAME` | `develop` |
| Bitbucket | `$BITBUCKET_PR_DESTINATION_BRANCH` | `develop` |

You never hardcode `--base main`. The CI variable automatically resolves to whatever branch the PR targets. So:
- PR `feature/login` → `develop` → base is `develop`
- PR `develop` → `qa` → base is `qa`
- PR `staging` → `production` → base is `production`

---

## 15. Challenges You Will Face & How to Fix Them

### Challenge 1: "jq: command not found" — hooks silently skip

**What happens:** You commit code, see no governance output at all. No errors, no checks, nothing. Commits go through unchecked.

**Why:** Every hook script starts with `command -v jq &>/dev/null || exit 0`. If jq isn't installed, hooks exit silently with success.

**How to detect:**
```bash
jq --version
# If you see "command not found" → that's the problem
```

**How to fix:**
```bash
# macOS
brew install jq

# Ubuntu/Debian/WSL2
sudo apt-get update && sudo apt-get install -y jq

# Windows
winget install jqlang.jq
# AND make sure you're using Git Bash, not PowerShell
```

**Prevention:** Add `jq --version` to your project's README setup instructions. Run `ai-gov doctor` — it checks for jq.

---

### Challenge 2: ".git/hooks/ not installed" — developer forgot to run init --git-hooks

**What happens:** Developer clones the repo, starts committing. No governance checks fire. They think everything is fine.

**Why:** `.git/hooks/` is local to each machine. Git doesn't commit it. Each developer must run `npx ai-gov init --git-hooks` once.

**How to detect:**
```bash
ls -la .git/hooks/pre-commit
# If "No such file or directory" → wrappers not installed
```

**How to fix:**
```bash
npx ai-gov init --git-hooks
```

**Prevention:** Add a `postinstall` script to `package.json`:
```json
{
  "scripts": {
    "postinstall": "npx ai-gov init --git-hooks 2>/dev/null || true"
  }
}
```

Now every time someone runs `npm install`, git hooks are installed automatically. The `|| true` ensures it doesn't fail if ai-gov isn't available.

---

### Challenge 3: "Existing hook system detected: husky"

**What happens:** You run `npx ai-gov init --git-hooks` and it doesn't install wrappers. Instead it prints integration guidance.

**Why:** ai-gov detects husky (or lefthook, or pre-commit) and doesn't want to overwrite your existing hooks.

**How to fix — Option A: Integrate with husky (recommended)**

Add to `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bash .claude/git-hooks/pre-commit.sh
```

Add to `.husky/commit-msg`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
bash .claude/git-hooks/commit-msg.sh "$1"
```

**How to fix — Option B: Replace husky entirely**
```bash
npx ai-gov init --git-hooks --force
```

---

### Challenge 4: "permission denied" on hook scripts

**What happens:**
```
bash: .claude/git-hooks/pre-commit.sh: Permission denied
```

**Why:** The shell scripts don't have execute permission. This happens when:
- You cloned on Windows and pushed from there
- Git didn't preserve file permissions
- Someone committed the files without running `ai-gov init`

**How to fix:**
```bash
chmod +x .claude/git-hooks/*.sh
chmod +x .claude/git-hooks/checks/*.sh
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/commit-msg
```

**Prevention:** ai-gov automatically sets `chmod 755` when generating. If you're on Windows, use Git Bash.

---

### Challenge 5: CI pipeline fails with "npm: command not found"

**What happens:** The CI job fails before even running ai-gov.

**Why:** The CI runner doesn't have Node.js installed.

**How to fix:**

GitHub: Make sure `actions/setup-node@v4` is before the ai-gov step (it is in the default config).

GitLab: Make sure `image: node:20` is set.

Bitbucket: Make sure `image: node:20` is at the top of `bitbucket-pipelines.yml`.

---

### Challenge 6: CI shows "0 changed files"

**What happens:** The governance check runs but reports 0 changed files and all checks pass (vacuously).

**Why:** The CI runner doesn't have full git history. It can't compute the diff.

**How to fix:**

GitHub: Make sure `fetch-depth: 0` is set in the checkout step:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0    # ← This is critical
```

GitLab: Add `GIT_DEPTH: 0` or `GIT_STRATEGY: clone`:
```yaml
governance-check:
  variables:
    GIT_DEPTH: 0
  # ... rest of config
```

Bitbucket: Add `clone: depth: full`:
```yaml
clone:
  depth: full

pipelines:
  pull-requests:
    # ...
```

---

### Challenge 7: GitHub PR comment doesn't appear

**What happens:** The CI job runs successfully (green check) but no comment appears on the PR.

**Why:** The workflow doesn't have permission to write PR comments.

**How to fix:**

1. Check the workflow file has:
```yaml
permissions:
  pull-requests: write
  contents: read
```

2. For organization repos, go to: Settings → Actions → General → Workflow permissions → "Read and write permissions" → Save

3. Also check: "Allow GitHub Actions to create and approve pull requests" is enabled

---

### Challenge 8: Developer bypasses hooks with --no-verify

**What happens:** A developer uses `git commit --no-verify` to skip all checks.

**Why:** Git allows this by design. You can't prevent it locally.

**How to handle:**
- The CI pr-check catches everything the pre-commit missed
- If you made governance a required status check (GitHub) or required pipeline (GitLab), the PR can't be merged with blockers
- Talk to the developer — `--no-verify` should only be used for genuine emergencies

---

### Challenge 9: False positive on secrets check

**What happens:** The secrets check flags a test fixture or example value as a credential.

**How to fix — Option A: Add inline ignore**
```typescript
const testApiKey = "AKIAIOSFODNN7EXAMPLE"; // nosecret
```
or
```typescript
const testApiKey = "AKIAIOSFODNN7EXAMPLE"; // ai-gov:ignore
```

**How to fix — Option B: Add directory to skip list**

Edit `.claude/git-hooks/config.json`:
```json
"secrets": {
  "enabled": true,
  "skip-dirs": ["test", "tests", "__tests__", "fixtures", "mocks", "seeds", "your-custom-dir"]
}
```

---

### Challenge 10: Different teams want different rules

**What happens:** Frontend team wants 200-line max, backend team wants 500-line max.

**How to handle:** ai-gov uses a single `config.json` per repo. For monorepos with different standards:

Option A: Use the most lenient setting and rely on code review for stricter enforcement.

Option B: For monorepos, each sub-project can have its own `.claude/git-hooks/config.json` if you structure the hooks to read from the sub-project directory.

---

### Challenge 11: CI takes too long (slow pipeline)

**What happens:** Each governance check takes 2-3 minutes because it installs Node.js, jq, and ai-gov every time.

**How to fix — GitHub (cache npm):**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'npm'
```

**How to fix — GitLab (cache node_modules):**
```yaml
governance-check:
  cache:
    key: governance
    paths:
      - node_modules/
  # ... rest of config
```

**How to fix — Bitbucket (use caches):**
```yaml
definitions:
  caches:
    governance-npm: /root/.npm

pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          caches:
            - governance-npm
          script:
            # ...
```

---

### Challenge 12: Merge conflicts in .gitlab-ci.yml

**What happens:** Multiple developers add CI jobs and get merge conflicts in the YAML file.

**Why:** `npx ai-gov init --ci gitlab` appends to `.gitlab-ci.yml`. If two people do this on different branches, conflict.

**How to fix:** Only the team lead should run `--ci gitlab` once. After that, edit the file manually if needed. Don't re-run the command.

---

### Challenge 13: Windows developers — bash scripts don't run

**What happens:** On Windows, `git commit` triggers the hook but bash isn't found.

**Why:** The hook scripts are bash scripts. Windows doesn't have bash by default.

**How to fix:**
1. Install Git for Windows (includes Git Bash): https://git-scm.com/download/win
2. Make sure Git Bash is in your PATH
3. Use Git Bash terminal (not PowerShell or CMD) for git operations

OR use WSL2:
1. Install WSL2: `wsl --install`
2. Run all git commands from WSL2 terminal

---

## 16. Cheat Sheet

### For team lead (one-time setup)

```bash
cd your-project

# Generate everything
npx ai-gov init
npx ai-gov init --git-hooks
npx ai-gov init --ci github    # or gitlab or bitbucket

# Edit CI config to add all branches (see Section 14)
# Edit .claude/git-hooks/config.json to customize thresholds

# Verify
npx ai-gov doctor

# Commit
git add .claude/ specs/ CLAUDE.md .github/    # adjust for your platform
git commit -m "chore: add ai-gov governance framework v16.0.0"
git push origin develop
```

### For every developer (one-time after clone)

```bash
git clone <repo-url>
cd your-project
npm install
npx ai-gov init --git-hooks    # installs local .git/hooks/ wrappers
jq --version                   # verify jq is installed
npx ai-gov doctor              # verify everything
```

### Daily workflow

```bash
# Start task
git checkout develop && git pull
git checkout -b feature/JIRA-101-my-task

# Code...

# Commit (hooks run automatically)
git add .
git commit -m "feat(scope): description at least 10 chars"

# Push and open PR (CI runs automatically)
git push origin feature/JIRA-101-my-task
# Open PR: feature/JIRA-101-my-task → develop

# Optional: check locally before pushing
npx ai-gov pr-check --base develop
```

### Emergency bypass

```bash
# Skip git hooks (CI still catches issues)
git commit --no-verify -m "hotfix: emergency fix description"
```

### Quick reference — commit message format

```
feat(auth): add login screen with email validation     ✅
fix(payment): resolve null pointer in checkout flow     ✅
refactor: extract auth logic into separate service      ✅
docs: update API documentation for v2 endpoints        ✅
test(cart): add unit tests for cart calculations        ✅
chore: upgrade dependencies to latest versions          ✅

fix stuff                                               ❌ (no type, too short)
feat: fix                                               ❌ (description < 10 chars)
FEAT: add login                                         ❌ (type must be lowercase)
add login screen                                        ❌ (missing type prefix)
```

### Auth summary — no login needed anywhere

| Platform | Auth method | Who sets it up | Login needed? |
|---|---|---|---|
| Local (`pr-check`) | None — runs on your machine | Anyone | No |
| GitHub Actions | `GITHUB_TOKEN` (auto-provided) | Team lead (one-time) | No |
| GitLab CI | `CI_JOB_TOKEN` (auto-provided) | Team lead (one-time) | No |
| Bitbucket Pipelines | Built-in pipeline credentials | Team lead (one-time) | No |
| GitLab MR comments | Personal/Group access token | Team lead (one-time) | Token setup only |
| Bitbucket PR comments | App password | Team lead (one-time) | App password only |

---

*This guide covers ai-gov v16.0.0. For CLI reference and troubleshooting, see [complete_usage_guide.md](./complete_usage_guide.md).*
