# Workspace Governance Guide

**Version:** 18.0.0
**Audience:** Developers working in multi-project workspaces
**Covers:** git pre-commit hook · PR check · all 7 workspace commands · scope routing · workspace upgrade

---

## Table of Contents

1. [What Gets Generated](#1-what-gets-generated)
2. [Workspace Pre-Commit Hook](#2-workspace-pre-commit-hook)
3. [PR Check](#3-pr-check)
4. [Scope Routing — How Commands Are Selected](#4-scope-routing)
5. [Workspace Commands — Reference & Samples](#5-workspace-commands)
   - [/audit](#audit)
   - [/new-feature](#new-feature)
   - [/edit-feature](#edit-feature)
   - [/explore](#explore)
   - [/fix](#fix)
   - [/refactor](#refactor)
   - [/hotfix](#hotfix)
6. [Project-Level vs Workspace-Level — Decision Table](#6-project-vs-workspace)
7. [Cross-Project Spec Layout](#7-spec-layout)

---

## 1. What Gets Generated

Run `npx ai-gov workspace` once at your workspace root. It scans every project, detects the stack, and writes governance files at two levels.

### Generated file tree

```
my-workspace/
├── CLAUDE.md                          ← redirect: "read .claude/CLAUDE.md"
├── .claude/
│   ├── CLAUDE.md                      ← workspace master rules (all projects)
│   ├── steering/
│   │   ├── workspace-policy.md        ← rules that apply across all projects
│   │   ├── cross-project-rules.md     ← API contracts between projects
│   │   ├── project-registry.md        ← registry of all projects + stacks
│   │   └── workspace-overview.md      ← project layout (read by scope-routing hook)
│   ├── commands/
│   │   ├── audit.md                   ← /audit   workspace command
│   │   ├── new-feature.md             ← /new-feature workspace command
│   │   ├── edit-feature.md            ← /edit-feature workspace command
│   │   ├── explore.md                 ← /explore workspace command
│   │   ├── fix.md                     ← /fix workspace command
│   │   ├── refactor.md                ← /refactor workspace command
│   │   └── hotfix.md                  ← /hotfix workspace command
│   ├── hooks/
│   │   └── cross-project-spec-check.sh  ← scope-routing hook (promptSubmit)
│   └── git-hooks/
│       └── workspace-pre-commit.sh    ← per-project pre-commit checks
│
├── specs/                             ← cross-project specs (workspace root)
│   └── _cross-project-template/
│       ├── requirements.md
│       ├── design.md
│       └── tasks.md
│
├── backend/
│   └── api-server/
│       └── .claude/                   ← project-level governance (own commands)
│
└── frontend/
    └── web-app/
        └── .claude/                   ← project-level governance (own commands)
```

> **Important:** `.claude/` is Claude Code's governance directory. Project-level files are in `<project>/.claude/`. Workspace-level files are in `<workspace-root>/.claude/`.

---

## 2. Workspace Pre-Commit Hook

The workspace pre-commit hook (`workspace-pre-commit.sh`) runs on every `git commit`. It groups staged files by project, reads each project's stack from `project-registry.md`, and runs per-project checks.

### Installation

`ai-gov workspace-init` installs the hook automatically:

```
.git/hooks/pre-commit   →  delegates to .claude/git-hooks/workspace-pre-commit.sh
```

The `.git/hooks/pre-commit` wrapper is a one-liner that calls the hook in your repository (version-controlled).

### What it checks

| Check | Stacks | Trigger |
|-------|--------|---------|
| **File size** | `react`, `angular`, `flutter` | Any staged file > 300 lines |
| **Secrets** | All stacks | AWS key pattern, `sk-...` tokens, inline passwords, private key headers |
| **TODOs** | All stacks | `TODO`, `FIXME`, `HACK`, `XXX` in staged files |

Secrets check skips files matching: `test`, `spec`, `mock`, `fixture`, `.example`, `.template`.

File-size check is frontend-only by design. Java/Python/Node backend services commonly have large files (controllers, services, migrations) and are exempt.

### Sample output — clean commit

```
  🔒 Pre-commit governance check (workspace)
  ────────────────────────────────────────────

  backend/api-server/ (nodejs):
    ✅ All checks passed

  frontend/web-app/ (react):
    ✅ All checks passed

  ✅ All checks passed.
```

### Sample output — issues found

```
  🔒 Pre-commit governance check (workspace)
  ────────────────────────────────────────────

  backend/api-server/ (nodejs):
    ⚠️  TODO: src/services/user.service.ts — 42:// TODO: validate email before save

  frontend/web-app/ (react):
    ❌ FILE SIZE: src/pages/Dashboard.tsx has 347 lines (max 300 for react)
    ❌ SECRETS: credentials detected in src/config/api.ts

  ❌ 2 blocking issue(s). Fix and try again.
  (bypass with: git commit --no-verify)
```

- **Errors** (❌) block the commit.
- **Warnings** (⚠️) allow the commit through.
- `git commit --no-verify` bypasses all checks (use only in emergencies).

### Fallback: no project-registry.md

If `project-registry.md` is missing (e.g., workspace-init was not run), the hook falls back to single-project mode and delegates to `.claude/git-hooks/pre-commit.sh` if it exists.

### Requirements

- `jq` must be installed (`brew install jq` / `apt install jq`). Missing `jq` prints a warning and exits 0.
- Skip conditions: during `git merge`, `git rebase`, or when no files are staged.

---

## 3. PR Check

`ai-gov pr-check` runs in CI on every pull request. It reads the changed files, diffs the PR against the base branch, and runs 8 governance checks.

### Checks run

| Check | What it flags |
|-------|---------------|
| **Architecture** | Files that violate layer boundaries defined in `governance.json` |
| **File size** | Files exceeding the configured line limit (default 300 for frontend) |
| **Credentials** | AWS keys, API tokens, passwords, private keys in the diff |
| **Spec coverage** | New features without a spec in `specs/` |
| **Test coverage** | Source files changed without corresponding test changes |
| **TODOs** | New TODO/FIXME/HACK lines introduced in the diff |
| **Commit messages** | Non-conventional commit messages |
| **PR description** | Missing or minimal PR description |

### CI integration

After `ai-gov init-ci`, the workflow file is written to `.github/workflows/governance.yml` (or `.gitlab-ci.yml` / `bitbucket-pipelines.yml`):

**GitHub Actions:**

```yaml
name: Governance Check
on:
  pull_request:
    branches: [main, develop, master]

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
        run: npm install -g ai-gov@18.0.0

      - name: Run governance check
        run: ai-gov pr-check --base ${{ github.event.pull_request.base.ref }} --format github > /tmp/governance-report.md

      - name: Post PR comment
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('/tmp/governance-report.md', 'utf-8');
            # ... posts/updates PR comment
```

### Running locally

```bash
# Check what CI would flag on your current branch vs main
ai-gov pr-check --base main

# GitHub-formatted output (markdown)
ai-gov pr-check --base main --format github

# GitLab-formatted
ai-gov pr-check --base main --format gitlab

# Machine-readable
ai-gov pr-check --base main --format json
```

### Sample PR comment (GitHub format)

```markdown
## Governance Review

| Check | Status | Details |
|-------|--------|---------|
| Architecture | ✅ Pass | No layer violations |
| File Size | ❌ Fail | `src/pages/Dashboard.tsx`: 347 lines (max 300) |
| Credentials | ✅ Pass | No credentials found |
| Spec Coverage | ⚠️ Warn | New feature files without spec: `src/pages/NewReport.tsx` |
| Test Coverage | ⚠️ Warn | `src/services/report.service.ts` changed but no test file changed |
| TODOs | ✅ Pass | No new TODOs |
| Commit Messages | ✅ Pass | All conventional |
| PR Description | ✅ Pass | Description present |

**Result: ❌ 1 blocker · ⚠️ 2 warnings**
```

### Workspace note

`ai-gov pr-check` runs against the **current working directory** and reads `.claude/governance.json` from that directory. For a workspace:
- Run it from each **project directory** to check that project's files.
- Or run from the **workspace root** — it will use workspace-level governance config if present.

CI typically runs one job per project, or runs from the workspace root with changed-file filtering.

---

## 4. Scope Routing

The `cross-project-spec-check` hook fires on every Claude Code prompt (`promptSubmit`). It reads the prompt, detects which projects are involved, and routes Claude to the correct governance level automatically.

### How it works

```
Developer types prompt
        │
        ▼
cross-project-spec-check.sh runs
        │
        ├── Words match backend keywords only?
        │     → "SCOPE: backend only. Use backend project's /new-feature"
        │
        ├── Words match frontend keywords only?
        │     → "SCOPE: frontend only. Use frontend project's /new-feature"
        │
        ├── Words match BOTH?
        │     → "CROSS-PROJECT SCOPE DETECTED. Use workspace /new-feature"
        │
        └── No match / too short / continuation word?
              → pass through (no routing injected)
```

### Backend keywords (examples)

`api`, `endpoint`, `route`, `controller`, `service`, `repository`, `database`, `migration`, `schema`, `model`, `middleware`, `auth`, `server`, `rest`, `graphql`, `backend`, `query`

Plus: the name of each backend project (e.g., `api-server`).

### Frontend keywords (examples)

`page`, `screen`, `component`, `widget`, `view`, `form`, `modal`, `dialog`, `button`, `input`, `layout`, `navigation`, `ui`, `ux`, `frontend`, `style`, `css`, `theme`

Plus: the name of each frontend/mobile project.

### Skip conditions

The hook does NOT inject routing for:
- Prompts shorter than 4 words
- Continuation words: `ok`, `yes`, `go ahead`, `approved`, `lgtm`, `done`, `next`, `all`, etc.
- Prompts starting with `/` (already a slash command)

### Override

If the hook routes incorrectly, use a slash command directly to override:

```
/fix The backend POST /api/orders endpoint returns 500
```

Slash commands bypass the keyword detector entirely.

---

## 5. Workspace Commands

All 7 workspace commands live in `.claude/commands/` at the workspace root. Invoke them with `/command-name [argument]` in Claude Code.

Every command follows the same pattern:
1. **Step 0 — Classify scope** (single-project or cross-project)
2. If single-project → delegate to that project's own command (this file stops here)
3. If cross-project → enter plan mode and follow the workspace-level gates

---

### /audit

**Purpose:** Full health check of all projects AND workspace-level governance.

**Invoke:** `/audit` (no argument needed)

**What it runs:**

```
Phase 1 — Workspace governance inventory
  W1: Check workspace steering files exist (.claude/CLAUDE.md, workspace-policy.md, etc.)
  W2: Verify project registry matches disk (all projects registered, stacks correct)
  W3: Check each project CLAUDE.md has workspace reference + hook registered

Phase 2 — Per-project audits
  Run full 12-step audit for EVERY project in the workspace
  Each project gets its own scorecard (0-100, grade A/B/C/D)

Phase 3 — Cross-project analysis
  W4: API contract discovery — read actual routes (backend) and API calls (frontend)
  W5: Cross-project spec coverage — which cross-project features have specs?
  W6: Cross-project violations — direct source imports, duplicated types, hardcoded URLs
  W7: Shared resource mapping — database, auth, queues, shared libs

Phase 4 — Fix workspace governance
  W8: Compare reality to steering files, identify gaps
  W9: Update workspace steering files directly (no permission needed)

Phase 5 — Workspace report
  W10: Combined scorecard (60% per-project average + 40% workspace score)
       Persists to .claude/workspace-audit-report.md
       Action items to .claude/workspace-actions.md
```

**Sample — clean workspace:**

```
WORKSPACE AUDIT — my-workspace
Date: 2026-04-30
Projects: 3

━━━ PER-PROJECT SCORECARDS ━━━

| Project                   | Stack  | Overall | Grade | Gaps Fixed | Verdict  |
|---------------------------|--------|---------|-------|------------|----------|
| backend/api-server        | nodejs | 94/100  | A     | 2          | UPDATED  |
| frontend/web-app          | react  | 88/100  | B     | 1          | UPDATED  |
| mobile/mobile-app         | flutter| 91/100  | A     | 0          | ALIGNED  |

━━━ WORKSPACE GOVERNANCE ━━━

  Workspace Files           100/100  A
  Project Registry           95/100  A
  Cross-Project Rules        72/100  C  (API contracts partially documented)
  Workspace References      100/100  A
  API Contract Accuracy      80/100  B  (1 mismatch: GET /api/orders shape differs)
  Cross-Project Specs        60/100  C  (2 cross-project features lack specs)

  WORKSPACE OVERALL          84/100  Grade: B

  COMBINED OVERALL           89/100  Grade: B

━━━ WORKSPACE VERDICT ━━━
  UPDATED — 3 workspace gaps + 3 project gaps fixed
  Workspace and project steering now accurately describe reality.
```

**Sample — with blockers:**

```
  ACTION NEEDED
    • API contract mismatch: frontend calls GET /api/orders but backend
      returns a different response shape (missing 'pagination' field)
    • Cross-project feature 'notifications' spans backend + frontend
      but has no unified spec at specs/notifications/
    • backend/reporting service is on disk but not in project-registry.md
```

---

### /new-feature

**Purpose:** Build a feature that spans backend and frontend in a single coordinated spec.

**Invoke:** `/new-feature user-profile-management`

**Scope routing:**

| Prompt example | Route |
|----------------|-------|
| `"add a REST endpoint for user profiles"` | → backend project's `/new-feature` |
| `"add a user profile page with edit form"` | → frontend project's `/new-feature` |
| `"add user profiles: backend API + frontend page"` | → workspace `/new-feature` (this flow) |

**Gates:**

```
Gate 1 — Unified requirements (backend + frontend in one table, API contract)
Gate 2 — Per-project design (backend layers + frontend layers + shared API contract section)
Gate 3 — Phased tasks (Phase 1: contract → Phase 2: backend → Phase 3: frontend → Phase 4: verify)
```

**Sample prompt:**

```
/new-feature user-profile-management

Story: PROJ-1234
New feature: User profile management
- Backend: REST API for CRUD operations (GET, POST, PUT, DELETE /api/users/:id)
- Frontend: Profile page with display + edit form
- Auth: JWT required on all endpoints
```

**Sample Gate 1 output (Claude shows in plan mode):**

```markdown
# Requirements: user-profile-management (Cross-Project)

| Field | Value |
|-------|-------|
| Feature | user-profile-management |
| Ticket | PROJ-1234 |
| Scope | Cross-project: backend + frontend |
| Status | Draft |

## Requirements by Project

| # | Requirement | Project | Priority |
|---|-------------|---------|----------|
| R1 | GET /api/users/:id returns user profile JSON | backend | P1 |
| R2 | POST /api/users creates new user profile | backend | P1 |
| R3 | PUT /api/users/:id updates user profile | backend | P1 |
| R4 | DELETE /api/users/:id soft-deletes user | backend | P1 |
| R5 | All endpoints require JWT authentication | backend | P1 |
| R6 | Profile page displays user name, email, avatar | frontend | P1 |
| R7 | Edit form with validation (required fields, email format) | frontend | P1 |
| R8 | Error states handled for each 4xx response | both | P1 |

## API Contract

| Method | Endpoint | Request Body | Response Body | Auth |
|--------|----------|-------------|---------------|------|
| GET    | /api/users/:id | — | `{ id, name, email, avatarUrl }` | JWT |
| POST   | /api/users | `{ name, email }` | `{ id, name, email }` | JWT |
| PUT    | /api/users/:id | `{ name?, email? }` | `{ id, name, email }` | JWT |
| DELETE | /api/users/:id | — | `{ success: true }` | JWT |
```

After gate 3 approval, spec is written to:
```
specs/user-profile-management/
├── requirements.md
├── design.md
└── tasks.md
```

**Sample Gate 3 tasks (excerpt):**

```markdown
## Phase 1 — API Contract Definition
- [ ] [S] Define User entity type (shared types)
- [ ] [S] Document endpoint paths in cross-project-rules.md

## Phase 2 — Backend (backend/api-server)
- [ ] [M] Create User entity + migration
- [ ] [M] Create UserRepository with CRUD methods
- [ ] [M] Create UserService with validation
- [ ] [M] Create UsersController with 4 routes
- [ ] [S] Add JWT middleware to all routes
- [ ] [M] Write unit tests for UserService
- [ ] [M] Write integration tests (contract compliance)

## Phase 3 — Frontend (frontend/web-app)
- [ ] [S] Create User TypeScript interfaces
- [ ] [M] Create user.service.ts (API client)
- [ ] [L] Create ProfilePage component
- [ ] [M] Create EditProfileForm with validation
- [ ] [S] Handle 401, 404, 422 error states
- [ ] [M] Write component tests

## Phase 4 — Verification
- [ ] [M] Verify backend endpoints match contract exactly
- [ ] [M] Verify frontend calls match contract exactly
- [ ] [S] Update cross-project-rules.md with final contract
```

---

### /edit-feature

**Purpose:** Extend a cross-project feature that already has a workspace-level spec.

**Invoke:** `/edit-feature user-profile-management`

**How scope is detected:**

1. Checks `specs/user-profile-management/` at workspace root → if found, uses workspace flow
2. If not there, checks each project's own `specs/user-profile-management/` → uses that project's flow
3. If prompt mentions both backend and frontend → workspace flow

**Gates:** Same 3-gate pattern, but the spec is shown diff-style:

- Existing content is preserved unchanged
- New additions are marked `<!-- NEW -->`
- Changes are marked `<!-- CHANGED: was "..." -->`
- Checked tasks `[x]` are never removed

**Sample prompt:**

```
/edit-feature user-profile-management

Add profile picture upload:
- Backend: PUT /api/users/:id/avatar (multipart, max 5MB, PNG/JPEG only)
- Frontend: Avatar upload component on the edit profile form
```

---

### /explore

**Purpose:** Understand code that may span multiple projects. Read-only throughout.

**Invoke:** `/explore user authentication flow`

**What it produces:**

```
━━━ CROSS-PROJECT CODE MAP — user authentication flow ━━━

  END-TO-END DATA FLOW:
    User clicks Login (frontend/web-app: src/pages/LoginPage.tsx)
      → POST /api/auth/login  { email, password }
      ↓
    backend/api-server: src/routes/auth.routes.ts
      → src/controllers/auth.controller.ts  (validates body)
      → src/services/auth.service.ts        (bcrypt compare, JWT sign)
      → src/repositories/user.repository.ts (SELECT by email)
      ↓
    Returns: { token: "eyJ...", user: { id, name, email } }
      → frontend stores token in localStorage
      → redirects to /dashboard

  ── backend/api-server [nodejs] ─────────────────────────
    Route:       src/routes/auth.routes.ts
    Controller:  src/controllers/auth.controller.ts
    Service:     src/services/auth.service.ts
    Repository:  src/repositories/user.repository.ts

  ── frontend/web-app [react] ────────────────────────────
    Page:        src/pages/LoginPage.tsx
    Service:     src/services/auth.service.ts
    State:       src/store/auth.slice.ts

  ── API CONTRACT (observed) ─────────────────────────────
    | Method | Endpoint         | Backend file        | Frontend file         | Match? |
    |--------|------------------|--------------------|-----------------------|--------|
    | POST   | /api/auth/login  | auth.routes.ts     | auth.service.ts       | ✓      |
    | POST   | /api/auth/logout | auth.routes.ts     | auth.service.ts       | ✓      |
    | GET    | /api/auth/me     | auth.routes.ts     | (not called anywhere) | ⚠      |

    Contract documented in cross-project-rules.md: ⚠ STALE (missing /api/auth/me)

━━━ CROSS-PROJECT FINDINGS ━━━
  Spec coverage:  specs/auth/ EXISTS but STALE (missing /api/auth/me)
  Contract:       MISMATCHED — /api/auth/me documented but not consumed by frontend

━━━ WHAT WOULD YOU LIKE TO DO? ━━━
  update spec        → update specs/auth/ to reflect current code
  document contract  → update cross-project-rules.md with actual endpoints
  fix [desc]         → tell me what to fix (files already loaded)
  done               → no changes needed
```

---

### /fix

**Purpose:** Fix a bug. Defaults to single-project; uses workspace flow only when the bug crosses project boundaries.

**Invoke:** `/fix frontend shows 500 error when loading user profile`

**Scope classification:**

```
Scenario A — Single-project bug (default)
  The bug and fix are in one project.
  Example: "null pointer in UserService.getById()"
  → Route to that project's /fix

Scenario B — Cross-project bug (API mismatch)
  The error manifests in one project but the cause is in another.
  Example: "frontend crashes because backend returns { user } but frontend expects { data }"
  → Use workspace flow
```

**Sample cross-project fix (Scenario B):**

```
Prompt: /fix frontend shows 500 error when loading user profile

━━━ CROSS-PROJECT ROOT CAUSE ━━━
  Symptom:    ProfilePage.tsx crashes on line 34 — TypeError: Cannot read 'name' of undefined
  Root cause: backend/api-server GET /api/users/:id returns { user: { name } }
              frontend/web-app expects { data: { name } } (wrong destructure)

  Responsibility: frontend wrapping is wrong (backend response is correct)

  Fix plan:
    backend/api-server:  no change needed — response shape is correct
    frontend/web-app:    src/services/user.service.ts line 18
                         change: const { data } = response
                         to:     const { user: data } = response

  Contract update: no — contract was correct, frontend consumed it wrong
  Scope: 1 file in 1 project

Say apply to proceed.
```

---

### /refactor

**Purpose:** Structural change. Uses workspace flow only when the refactor touches an API contract or changes how projects communicate.

**Invoke:** `/refactor rename user API response field from "user" to "data"`

**Scope classification:**

```
Scenario A — Single-project refactor (default)
  No contract changes. Stays within one project.
  Example: "extract UserCard into its own component"
  → Route to that project's /refactor

Scenario B — Cross-project refactor
  API contract shape changes, or shared types move.
  Example: "rename the 'user' field to 'data' in all API responses"
  → Workspace flow — both projects must update
```

**Sample cross-project refactor gate:**

```
━━━ CROSS-PROJECT IMPACT ANALYSIS ━━━
  Scope: rename 'user' field to 'data' in all API responses

  backend/api-server:
    | File | Current | After |
    |------|---------|-------|
    | src/controllers/auth.controller.ts | { user: ... } | { data: ... } |
    | src/controllers/user.controller.ts | { user: ... } | { data: ... } |
    | tests/auth.test.ts | { user: ... } | { data: ... } |

  frontend/web-app:
    | File | Current | After |
    |------|---------|-------|
    | src/services/auth.service.ts | const { user } | const { data } |
    | src/services/user.service.ts | const { user } | const { data } |

  API contract change: yes — response envelope renames 'user' → 'data' in all endpoints
  Behaviour change: none — structural rename only
  Migration: both projects update simultaneously (no versioning needed for internal workspace)

Say approved to proceed. Tests will run before refactoring begins.
```

---

### /hotfix

**Purpose:** Production emergency. Fastest path to a fix. Workspace flow only when a deploy in one project broke another.

**Invoke:** `/hotfix frontend is completely broken after backend v1.2 deploy`

**Scope classification:**

```
Scenario A — Single-project (most common)
  Production incident in one project.
  Example: "backend is returning 503 on all requests"
  → Route to that project's /hotfix

Scenario B — Cross-project
  A deploy in one project broke another.
  Example: "frontend broke after backend deploy — API response shape changed"
  → Workspace hotfix flow
```

**Sample cross-project hotfix gate:**

```
━━━ CROSS-PROJECT EMERGENCY DIAGNOSIS ━━━
  Issue:      frontend/web-app completely broken — white screen on load
  Trigger:    backend/api-server v1.2.0 deployed 14:30 UTC
  Root cause: backend changed POST /api/auth/login response from
              { token, user } to { accessToken, profile }
              frontend still reads { token, user } → crashes immediately

  Fix plan:
    backend/api-server:  REVERT — restore { token, user } response shape
                         git revert <commit> in api-server
    frontend/web-app:    no change needed (consumer was correct)
    Contract:            update cross-project-rules.md to document correct shape

  Risk: low — revert is clean, no data changes

Say apply to proceed immediately.

━━━ HOTFIX SUMMARY ━━━
  Issue:       frontend white screen after backend v1.2 deploy
  Root cause:  backend changed auth response shape without updating contract
  Fix applied: reverted backend to { token, user } response (1 file)
  Contract:    updated cross-project-rules.md with correct shape
  Follow-up:
    [ ] Review backend v1.2 PR — response shape change was undocumented
    [ ] Add cross-project integration test for auth response shape
    [ ] Update frontend to use { accessToken, profile } in v1.3 (planned)
```

---

## 6. Project-Level vs Workspace-Level — Decision Table

| Situation | Where to type | Which command file runs |
|-----------|---------------|------------------------|
| Bug in one project | Anywhere | `<project>/.claude/commands/fix.md` |
| New feature in one project | Anywhere | `<project>/.claude/commands/new-feature.md` |
| Bug that crosses the API boundary | Workspace root | `.claude/commands/fix.md` |
| New feature spanning backend + frontend | Workspace root | `.claude/commands/new-feature.md` |
| Rename an API endpoint used by frontend | Workspace root | `.claude/commands/refactor.md` |
| Understand the full auth flow end-to-end | Anywhere | `.claude/commands/explore.md` (workspace) |
| Health check one project | Inside that project | `<project>/.claude/commands/audit.md` |
| Health check entire workspace | Workspace root | `.claude/commands/audit.md` |
| Production down — backend only | Anywhere | `<project>/.claude/commands/hotfix.md` |
| Frontend broke after backend deploy | Workspace root | `.claude/commands/hotfix.md` (workspace) |

### The routing rule

The `cross-project-spec-check` hook routes automatically based on keywords. You can also force the level:

```
# Force single-project (type in that project's directory context)
/fix the UserService.create() throws null pointer

# Force workspace level (type at workspace root, or use both-project vocabulary)
/fix frontend shows 500 because backend changed the API response shape
```

---

## 7. Cross-Project Spec Layout

Cross-project specs live at the **workspace root** `specs/` directory — not in either project.

```
my-workspace/
└── specs/
    ├── _cross-project-template/      ← template generated by workspace-init
    │   ├── requirements.md
    │   ├── design.md
    │   └── tasks.md
    ├── user-profile-management/      ← one dir per cross-project feature
    │   ├── requirements.md           ← unified: backend + frontend requirements + API contract
    │   ├── design.md                 ← per-project layer maps + shared API contract section
    │   └── tasks.md                  ← phased: Phase 1 (contract) → 2 (backend) → 3 (frontend)
    └── notifications/
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

**Single-project specs** stay inside their project:

```
backend/api-server/
└── specs/
    └── rate-limiting/               ← backend-only feature spec
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

**Rule:** If a feature touches the API boundary between projects → workspace spec. If it stays inside one project → that project's spec.

### Spec format: unified requirements table

Cross-project requirements tag each row by project:

```markdown
| # | Requirement | Project | Priority |
|---|-------------|---------|----------|
| R1 | POST /api/users creates user | backend | P1 |
| R2 | PUT /api/users/:id updates profile | backend | P1 |
| R3 | Profile page displays user data | frontend | P1 |
| R4 | Edit form validates email format | frontend | P1 |
| R5 | 401 response handled in both projects | both | P1 |
```

### Spec format: phased tasks

Cross-project tasks enforce dependency order:

```markdown
## Implementation Order
> Phase 1 (API contract) → Phase 2 (backend) → Phase 3 (frontend) → Phase 4 (verify)
> Backend must be implemented before frontend. The API contract is defined first.

## Phase 1 — API Contract Definition
- [ ] [S] Define types / schemas
- [ ] [S] Write contract to .claude/steering/cross-project-rules.md

## Phase 2 — Backend (backend/api-server)
- [ ] [M] ...

## Phase 3 — Frontend (frontend/web-app)
- [ ] [M] ...

## Phase 4 — Verification
- [ ] [M] Both sides match the contract
- [ ] [S] Update cross-project-rules.md with final contract
```

---

## Workspace Upgrade

To upgrade governance files across all projects in a workspace without re-running full init:

```bash
# Upgrade hooks + commands across all projects (preserves steering files)
npx ai-gov workspace --upgrade

# Upgrade including steering files (review diffs before committing)
npx ai-gov workspace --upgrade --force

# Upgrade a specific workspace directory
npx ai-gov workspace --upgrade --dir /path/to/workspace
```

### What gets upgraded vs preserved

| Path | Behaviour |
|------|-----------|
| `<project>/.claude/hooks/` | Always regenerated |
| `<project>/.claude/commands/` | Always regenerated |
| `<project>/.claude/CLAUDE.md` | Always regenerated (app name preserved) |
| `<project>/.claude/steering/*.md` | **Preserved** unless `--force` |
| `<workspace>/.claude/steering/workspace-policy.md` | **Preserved** unless `--force` |
| `specs/` | Never touched |

Token files (`.env.mcp`, `~/.config/ai-gov/.env.mcp.global`) are never touched by upgrade.

### Upgrade individual projects

```bash
npx ai-gov upgrade --dir ./backend/api-server
npx ai-gov upgrade --dir ./frontend/web-app
```

---

*ai-gov v18.0.0*
