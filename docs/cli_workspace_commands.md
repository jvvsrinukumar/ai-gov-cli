# Workspace Commands Guide
## How Commands Work Across Projects

**Version:** 16.0.0
**Audience:** Developers working in multi-project workspaces

> **See [`workspace_governance_guide.md`](./workspace_governance_guide.md) for the full reference.**
> That document covers the pre-commit hook, PR check, scope routing, all 7 commands with sample output,
> and the cross-project spec layout. This file is a quick summary + examples.

---

## Two Levels of Commands

Every project in the workspace has its own 7 commands. The workspace root also has 7 commands. The hook decides which level runs.

### Project-Level Commands (per project)

Each project gets these in `<project>/.claude/commands/`:

| Command | Gates | Purpose |
|---------|-------|---------|
| `/new-feature [name]` | 3 | Build something new within this project |
| `/edit-feature [name]` | 3 | Extend an existing feature in this project |
| `/explore [scope]` | 1 | Understand code in this project |
| `/fix [description]` | 1 | Fix a bug in this project |
| `/refactor [scope]` | 1 | Structural improvement in this project |
| `/hotfix [issue]` | 1 | Production emergency in this project |
| `/audit` | — | Health check for this project |

### Workspace-Level Commands (workspace root)

The workspace root gets these in `<workspace>/.claude/commands/`:

| Command | Gates | Purpose |
|---------|-------|---------|
| `/new-feature [name]` | 3 | Build a feature spanning backend + frontend |
| `/edit-feature [name]` | 3 | Extend a cross-project feature |
| `/explore [scope]` | 1 | Trace end-to-end flows across projects |
| `/fix [description]` | 1 | Fix a bug that spans projects |
| `/refactor [scope]` | 1 | Refactor that changes API contracts |
| `/hotfix [issue]` | 1 | Production emergency spanning projects |
| `/audit` | — | Health check for all projects + workspace |

---

## How Routing Works

The `cross-project-spec-check` hook fires on every prompt. It reads your message and routes automatically:

```
Developer types a prompt
        │
        ▼
cross-project-spec-check.sh fires
  Reads the message, looks for backend/frontend keywords
        │
        ├── Backend keywords only → "Using backend-level governance"
        │   → Routes to backend project's commands
        │
        ├── Frontend keywords only → "Using frontend-level governance"
        │   → Routes to frontend project's commands
        │
        └── Both backend + frontend keywords → "Cross-project governance"
            → Routes to workspace-level commands
```

**You don't need to think about which level to use.** Just describe what you want to do. The hook figures it out.

---

## Where Specs Live

This is the critical rule:

| Scope | Spec location | Example |
|-------|--------------|---------|
| Backend only | `backend/<project>/specs/<feature>/` | `backend/api/specs/user-auth/` |
| Frontend only | `frontend/<project>/specs/<feature>/` | `frontend/web/specs/dark-mode/` |
| Cross-project | `specs/<feature>/` at workspace root | `specs/user-profiles/` |

Cross-project features get ONE unified spec at the workspace root. Not two separate specs.

---

## Complete Examples

### Example 1 — Backend-Only Feature

**Prompt:**
```
/new-feature user-auth
Add JWT authentication with refresh tokens to the API
```

**What happens:**
1. Hook detects: backend keywords (API, authentication, JWT, tokens)
2. Hook says: "This task involves backend only. Using backend-level governance."
3. Claude Code runs the backend project's `/new-feature` command
4. Spec goes in: `backend/api/specs/user-auth/`
5. 3-gate flow: requirements → design → tasks (all backend-specific)
6. Phases: Domain → Repository → Service → Controller → Tests

**Spec structure:**
```
backend/api/specs/user-auth/
  requirements.md    ← backend acceptance criteria, API endpoints
  design.md          ← backend layer map, data model, auth flow
  tasks.md           ← Phase 1-5 (backend stack phases)
```

---

### Example 2 — Frontend-Only Feature

**Prompt:**
```
/new-feature dark-mode
Add dark mode toggle to the settings page
```

**What happens:**
1. Hook detects: frontend keywords (page, settings, toggle, UI)
2. Hook says: "This task involves frontend only. Using frontend-level governance."
3. Claude Code runs the frontend project's `/new-feature` command
4. Spec goes in: `frontend/web/specs/dark-mode/`
5. 3-gate flow: requirements → design → tasks (all frontend-specific)
6. Phases: Types → State → Components → Tests

**Spec structure:**
```
frontend/web/specs/dark-mode/
  requirements.md    ← frontend acceptance criteria, UI behaviour
  design.md          ← component tree, state shape, theme approach
  tasks.md           ← Phase 1-5 (frontend stack phases)
```

---

### Example 3 — Cross-Project Feature

**Prompt:**
```
Story: APDB-1234
/new-feature user-profiles
- Backend: REST API for CRUD operations on user profiles
- Frontend: Profile page with edit form
```

**What happens:**
1. Hook detects: both backend (API, CRUD, REST) and frontend (page, form) keywords
2. Hook says: "This task spans 2 projects: backend, frontend. Using cross-project governance."
3. Claude Code runs the workspace-level `/new-feature` command
4. Spec goes in: `specs/user-profiles/` at the workspace root
5. 3-gate flow with unified spec:
   - Gate 1: unified requirements with per-project tags + API contract
   - Gate 2: per-project design sections + shared contract
   - Gate 3: phased tasks (contract → backend → frontend)

**Spec structure (ONE spec at workspace root):**
```
specs/user-profiles/
  requirements.md
    ├── Requirements table tagged by project (R1: backend, R2: frontend)
    ├── API contract (the bridge — both projects implement against this)
    └── Error responses

  design.md
    ├── Shared API contract section
    ├── Backend design (layer map, data model, data flow)
    └── Frontend design (component tree, state shape, API client)

  tasks.md
    ├── Phase 1 — API Contract Definition
    ├── Phase 2 — Backend Implementation
    ├── Phase 3 — Frontend Implementation
    └── Phase 4 — Cross-Project Verification
```

**Implementation order:**
```
Phase 1: Define the API contract (shared types, endpoints, error shapes)
    ↓
Phase 2: Build backend (model → repo → service → controller → tests)
    ↓
Phase 3: Build frontend (types → API client → state → components → tests)
    ↓
Phase 4: Verify both sides match the contract
```

---

### Example 4 — Backend-Only Bug Fix

**Prompt:**
```
/fix login returns 500 when email has uppercase letters
```

**What happens:**
1. Hook detects: backend keywords (login, 500, API implied)
2. Routes to backend project's `/fix` command
3. Plan mode → read → root cause → proposed fix gate → apply

```
━━━ ROOT CAUSE ━━━
  File:    src/services/auth.service.ts
  Line ~47: email comparison is case-sensitive
  Cause:   email.includes(input) should be email.toLowerCase().includes(input.toLowerCase())

━━━ PROPOSED FIX ━━━
  Files to change:
    • src/services/auth.service.ts — normalize email comparison
  Say apply to proceed.
```

---

### Example 5 — Cross-Project Bug Fix

**Prompt:**
```
/fix the user profile page shows "undefined" for the phone number field
```

**What happens:**
1. Hook detects: frontend (page, profile) — initially routes to frontend
2. Claude Code reads the frontend code, discovers the API returns `phoneNumber` but frontend expects `phone`
3. This is a contract mismatch — Claude Code escalates to cross-project fix

```
━━━ CROSS-PROJECT ROOT CAUSE ━━━
  Symptom:     Frontend shows "undefined" for phone number
  Root cause:  Backend returns { phoneNumber: "..." } but frontend reads { phone: "..." }
  Contract:    cross-project-rules.md says "phone" — backend is wrong

  Fix plan:
    Backend (backend/api):  Rename phoneNumber → phone in UserDTO
    Frontend (frontend/web): No change needed — already expects "phone"
    Contract update: No — contract was correct, backend violated it

Say apply to proceed.
```

---

### Example 6 — Cross-Project Refactor

**Prompt:**
```
/refactor change the user API response from flat to nested format
```

**What happens:**
1. Hook detects: both backend (API, response) and frontend (implied consumer)
2. Routes to workspace-level `/refactor`
3. Impact analysis shows both projects affected

```
━━━ CROSS-PROJECT IMPACT ANALYSIS ━━━
  Scope: Change user API response shape

  Backend (backend/api):
    | File | Current | After |
    |------|---------|-------|
    | src/dto/user.dto.ts | { name, email, phone } | { name, contact: { email, phone } } |
    | src/controllers/user.controller.ts | returns flat DTO | returns nested DTO |

  Frontend (frontend/web):
    | File | Current | After |
    |------|---------|-------|
    | src/services/user.service.ts | reads user.email | reads user.contact.email |
    | src/components/UserProfile.tsx | displays user.phone | displays user.contact.phone |

  API contract change: Yes — response shape changes
  Migration: Both projects must update simultaneously

Say approved to proceed.
```

---

### Example 7 — Explore Then Decide

**Prompt:**
```
/explore how does the payment flow work end-to-end
```

**What happens:**
1. Hook detects: both backend (payment, API implied) and frontend (flow, end-to-end)
2. Routes to workspace-level `/explore`
3. Claude Code reads files across both projects, traces the full flow

```
━━━ CROSS-PROJECT CODE MAP — payment flow ━━━

  END-TO-END DATA FLOW:
    User clicks "Pay" (frontend)
      → src/components/PaymentForm.tsx — collects card details
      → src/services/payment.service.ts — POST /api/payments
      ↓
    API endpoint (backend)
      → src/routes/payments.ts — receives request
      → src/services/payment.service.ts — validates, calls Stripe
      → src/repositories/payment.repo.ts — saves to DB
      ↓
    Response
      → backend returns { id, status, amount }
      → frontend updates PaymentState → shows confirmation

━━━ WHAT WOULD YOU LIKE TO DO? ━━━
  create spec   → document this flow as a cross-project spec
  fix [desc]    → found a bug in the flow
  refactor      → restructure the flow
  new-feature   → add to the payment flow
  done          → just needed to understand it
```

---

### Example 8 — Edit an Existing Cross-Project Feature

**Prompt:**
```
/edit-feature user-profiles
Add password change functionality — new API endpoint + modal in the UI
```

**What happens:**
1. Claude Code checks `specs/user-profiles/` at workspace root — exists (cross-project spec)
2. Routes to workspace-level `/edit-feature`
3. Reads existing spec, shows updated version with `<!-- NEW -->` markers

```
Updated tasks — new items marked NEW, existing progress preserved.

## Phase 2 — Backend Implementation
- [x] Create user entity                    (done — unchanged)
- [x] Create user repository                (done — unchanged)
- [x] Create user service                   (done — unchanged)
- [x] Create user controller                (done — unchanged)
- [ ] Add PUT /api/users/:id/password endpoint  <!-- NEW -->
- [ ] Add password validation service           <!-- NEW -->
- [ ] Write tests for password change           <!-- NEW -->

## Phase 3 — Frontend Implementation
- [x] Create UserProfile component          (done — unchanged)
- [x] Create user API service               (done — unchanged)
- [ ] Add PasswordChangeModal component         <!-- NEW -->
- [ ] Add password validation (client-side)     <!-- NEW -->
- [ ] Wire modal to PUT endpoint                <!-- NEW -->
- [ ] Write component tests                     <!-- NEW -->
```

---

### Example 9 — Workspace Audit

**Prompt:**
```
/audit
```

**What happens (at workspace root):**
1. Phase 1: Check workspace steering files (workspace-policy, cross-project-rules, project-registry, workspace-overview)
2. Phase 2: Run full 12-step audit for EACH project
3. Phase 3: Cross-project analysis (API contracts, spec coverage, violations, shared resources)
4. Phase 4: Fix workspace steering gaps
5. Phase 5: Combined scorecard

```
WORKSPACE AUDIT — my-workspace
Date: 2026-04-30
Projects: 4

━━━ PER-PROJECT SCORECARDS ━━━
| Project | Stack | Overall | Grade | Gaps | Verdict |
|---------|-------|---------|-------|------|---------|
| backend/api | nodejs | 88/100 | B | 2 | UPDATED |
| backend/worker | nodejs | 92/100 | A | 0 | ALIGNED |
| frontend/web | react | 85/100 | B | 1 | UPDATED |
| frontend/mobile | flutter | 78/100 | B | 3 | ACTION NEEDED |

━━━ WORKSPACE GOVERNANCE ━━━
  Workspace Files:      100/100  A
  Project Registry:      90/100  A
  Cross-Project Rules:   70/100  C  (3 undocumented API contracts)
  Workspace References: 100/100  A
  API Contract Accuracy: 75/100  B  (2 mismatches found)
  Cross-Project Specs:   80/100  B  (1 feature missing unified spec)

  WORKSPACE OVERALL:     86/100  Grade: B
  COMBINED OVERALL:      87/100  Grade: B

━━━ VERDICT ━━━
  UPDATED — 6 project gaps + 3 workspace gaps fixed
```

---

### Example 10 — Running a Project-Specific Audit

If you're working inside a specific project directory, the project-level `/audit` runs:

**Prompt (while in `backend/api/`):**
```
/audit
```

This runs only the 12-step project audit for `backend/api`. It does NOT run the workspace-level audit. To audit the whole workspace, run `/audit` from the workspace root.

---

## Command Routing Summary

| What you type | Where you are | What runs |
|--------------|---------------|-----------|
| `/audit` | workspace root | Workspace audit (all projects + cross-project) |
| `/audit` | `backend/api/` | Project audit (backend/api only) |
| `/new-feature X` | workspace root | Hook decides: single-project or cross-project |
| `/new-feature X` | `backend/api/` | Backend project's /new-feature |
| `/fix X` | workspace root | Hook decides: single-project or cross-project |
| `/fix X` | `backend/api/` | Backend project's /fix |
| `/explore X` | workspace root | Hook decides: single-project or cross-project |
| `/explore X` | `frontend/web/` | Frontend project's /explore |

**Rule of thumb:**
- Working in a project directory → project-level commands fire
- Working at workspace root → hook auto-routes based on your prompt
- Cross-project features → one unified spec at workspace root
- Single-project features → spec in that project's `specs/`

---

## Generated File Structure

After `ai-gov workspace --dir /path/to/workspace`, the full structure is:

```
my-workspace/
  .claude/
    CLAUDE.md                                    ← workspace master rules
    steering/
      workspace-policy.md                        ← rules for all projects
      cross-project-rules.md                     ← API contracts between projects
      project-registry.md                        ← project inventory
      workspace-overview.md                      ← project layout (used by hook)
    commands/
      audit.md                                   ← workspace audit
      new-feature.md                             ← cross-project new feature
      edit-feature.md                            ← cross-project edit feature
      explore.md                                 ← cross-project explore
      fix.md                                     ← cross-project fix
      refactor.md                                ← cross-project refactor
      hotfix.md                                  ← cross-project hotfix
    hooks/
      cross-project-spec-check.sh                ← auto-routes by scope
    git-hooks/
      workspace-pre-commit.sh                    ← monorepo orchestrator (delegates to each project)
                                                   also useful for CI / manual use in multi-repo
  specs/
    _cross-project-template/                     ← unified spec templates
      requirements.md
      design.md
      tasks.md
  CLAUDE.md                                      ← redirect to .claude/CLAUDE.md

  backend/
    api/
      .claude/
        CLAUDE.md                                ← project rules + workspace reference
        steering/                                ← 8 stack-specific steering files
        hooks/                                   ← 11 project hooks
        git-hooks/                               ← pre-commit.sh + commit-msg.sh + checks/
        commands/                                ← 7 project commands
        settings.json
      specs/
        _template/                               ← project spec templates
      .git/                                      ← only present in multi-repo layout
        hooks/
          pre-commit                             ← thin wrapper → .claude/git-hooks/pre-commit.sh
          commit-msg                             ← thin wrapper → .claude/git-hooks/commit-msg.sh

  frontend/
    web/
      .claude/
        CLAUDE.md                                ← project rules + workspace reference
        steering/                                ← 8 stack-specific steering files
        hooks/                                   ← 11 project hooks
        git-hooks/                               ← pre-commit.sh + commit-msg.sh + checks/
        commands/                                ← 7 project commands
        settings.json
      specs/
        _template/                               ← project spec templates
      .git/                                      ← only present in multi-repo layout
        hooks/
          pre-commit                             ← thin wrapper → .claude/git-hooks/pre-commit.sh
          commit-msg                             ← thin wrapper → .claude/git-hooks/commit-msg.sh
```

---

## Monorepo vs Multi-Repo: Git Hook Detection

`ai-gov workspace` automatically detects your layout and installs git hooks in the right place.

### Monorepo (single `.git/` at workspace root)

```
my-workspace/
  .git/
    hooks/
      pre-commit    ← installed by ai-gov workspace
                    ← delegates to .claude/git-hooks/workspace-pre-commit.sh
  backend/
    api/            ← no own .git/ — uses workspace root's hook
  frontend/
    web/            ← no own .git/ — uses workspace root's hook
```

All commits anywhere in the workspace go through one hook. The workspace pre-commit script runs the pre-commit checks for each project that has changed files.

### Multi-Repo (each project has its own `.git/`)

```
my-workspace/
  backend/
    api/
      .git/
        hooks/
          pre-commit    ← installed by ai-gov workspace
                        ← delegates to backend/api/.claude/git-hooks/pre-commit.sh
          commit-msg    ← installed by ai-gov workspace
  frontend/
    web/
      .git/
        hooks/
          pre-commit    ← installed by ai-gov workspace
                        ← delegates to frontend/web/.claude/git-hooks/pre-commit.sh
          commit-msg    ← installed by ai-gov workspace
```

Each project runs its own governance checks independently. Commits in `backend/api/` go through its pre-commit. Commits in `frontend/web/` go through its pre-commit.

### Existing hook system detection

If `ai-gov workspace` finds husky, lefthook, or pre-commit already installed in a project, it skips that project's `.git/hooks/` installation and prints integration guidance:

```
  backend/api: existing husky hook system detected — skipping auto-install
    Manually add to your husky config: bash .claude/git-hooks/pre-commit.sh
```

The per-project `.claude/git-hooks/pre-commit.sh` is always generated — only the `.git/hooks/` wrapper is skipped.

---

## Upgrading workspace hooks

When a new version of ai-gov is released, upgrade each project individually:

```bash
npx ai-gov upgrade --dir ./backend/api
npx ai-gov upgrade --dir ./frontend/web
```

Or use a loop for larger workspaces:

```bash
for dir in backend/* frontend/*; do
  [ -d "$dir/.claude" ] && npx ai-gov upgrade --dir "$dir"
done
```

This regenerates hooks, commands, and CLAUDE.md in each project without touching steering files. See [`upgrade_guide.md`](./upgrade_guide.md) for full details.

---

## FAQ

**Q: What if I'm at the workspace root and type a backend-only prompt?**
The hook detects it's backend-only and routes to the backend project's command. You don't need to `cd` into the project first.

**Q: What if the hook gets the routing wrong?**
Tell Claude Code: "This is actually a cross-project feature" or "This is backend only." Claude Code will switch to the correct flow.

**Q: Can I force workspace-level governance for a single-project task?**
Yes, but you shouldn't need to. If you want a unified spec at the workspace root for a single-project feature, just mention both projects in your prompt.

**Q: What happens to existing project-level specs when I run workspace audit?**
They stay where they are. The workspace audit checks both locations. It flags cross-project features that have separate specs instead of a unified one, but doesn't move them automatically.

**Q: Can I have both a project-level spec and a workspace-level spec for the same feature?**
You shouldn't. If a feature spans projects, it should have ONE spec at the workspace root. If it's single-project, it should have ONE spec in that project. The audit will flag duplicates.

**Q: How do I migrate from separate specs to a unified spec?**
Run `/explore <feature>` at the workspace root. Choose "create spec" — Claude Code will read both project-level specs and create one unified spec at the workspace root. Then delete the project-level specs.

**Q: Do workspace git hooks require jq?**
No. Since v16.0.0, all generated hook scripts use python3 with jq as a fallback. python3 is built-in on macOS and standard Linux, so no installation is needed on most machines. Run `npx ai-gov doctor` in any project to verify the runtime is available. See [`runtime_requirements.md`](./runtime_requirements.md) for platform-specific details.

**Q: A developer joined the team and their git hooks aren't firing — what do I do?**
The hook scripts are in `.claude/git-hooks/` (committed to git, so they get them on `git clone`). The `.git/hooks/pre-commit` wrappers are NOT committed (they're local). The new developer needs to run once:
```bash
cd <project-dir>
npx ai-gov init --git-hooks
```
This installs the local wrappers. The scripts themselves are already there from the clone.

**Q: Why is `workspace-pre-commit.sh` generated even in multi-repo mode?**
It's always generated because it is useful for CI pipelines and manual runs even when each project has its own git hooks. The CI governance check (`ai-gov pr-check`) is separate from git hooks and does not depend on either.

