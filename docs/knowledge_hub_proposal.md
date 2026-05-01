# AI Product Intelligence Layer (Knowledge Hub)

## Proposal & Design Document

> **Status:** Proposal (Brainstorming Complete)
> **Audience:** Framework maintainers, team leads, contributors
> **Scope:** New capability for the ai-gov governance framework

---

## Core Principle

> **Knowledge capture and consumption must happen inside the development workflow, not outside it.**
>
> Every tool that separates learning from doing — wikis, onboarding docs, sprint meetings — fails because it requires a context switch. The Product Intelligence Layer eliminates that separation. Knowledge flows to the developer at the moment they need it (when they run a command) and flows from the developer as a byproduct of their work (when they finish a command). The developer never leaves the IDE. The knowledge never leaves the codebase.

---

## What This Actually Is

This is not a documentation system.

This is a **continuous knowledge extraction and AI context engine** — a feedback loop between code, AI, and domain knowledge.

```
Developer writes code
    → AI extracts business rules silently
        → Knowledge persists in git
            → AI reads knowledge before next command
                → Developer gets better context
                    → Developer writes better code
                        → AI extracts richer knowledge
                            → (cycle continues, compounding)
```

The governance framework evolution:

| Phase | What Governance Covers |
|-------|----------------------|
| Phase 1 | Code quality (formatting, linting) |
| Phase 2 (current) | Code + structure (architecture enforcement, hooks, steering) |
| Phase 3 (this proposal) | Code + structure + knowledge + AI context |

---

## Table of Contents

1. [The Problem](#1-the-problem)
2. [Why It Is Needed](#2-why-it-is-needed)
3. [How It Works](#3-how-it-works)
4. [Knowledge Confidence Model](#4-knowledge-confidence-model)
5. [AI Agent Roles](#5-ai-agent-roles)
6. [Directory Structure](#6-directory-structure)
7. [Command Integration](#7-command-integration)
8. [The `/knowledge` Command](#8-the-knowledge-command)
9. [Silent Knowledge Capture](#9-silent-knowledge-capture)
10. [Knowledge Validation Layer](#10-knowledge-validation-layer)
11. [Git Integration & Branch Strategy](#11-git-integration--branch-strategy)
12. [Access Model](#12-access-model)
13. [Real-World Scenarios](#13-real-world-scenarios)
14. [Problems Identified & Solutions](#14-problems-identified--solutions)
15. [Pros and Cons](#15-pros-and-cons)
16. [What It Brings to the Table](#16-what-it-brings-to-the-table)
17. [Measuring Impact](#17-measuring-impact)
18. [Is It Really Needed?](#18-is-it-really-needed)
19. [Open Questions](#19-open-questions)

---

## 1. The Problem

AI coding tools collapsed the HOW of software development. A developer can generate React components, API endpoints, database migrations, and Flutter widgets with a single prompt. The technical barrier dropped dramatically.

What AI cannot collapse is the WHAT — the domain knowledge that determines whether the generated code is correct for the business:

- Why the approval flow has 3 stages (regulatory requirement)
- Why user deletion is soft-delete only (legal hold policy)
- Why the notification system batches messages between 9am-6pm (user research data)
- Why the onboarding flow asks for company size before plan selection (conversion optimization)

This knowledge lives in people's heads. Not in code. Not in documentation. Not in any system the AI can read.

**The result:** When a developer uses AI to build a feature, the AI generates technically correct but business-incorrect code. The developer doesn't know the business rules. The AI doesn't have access to them. The code ships with missing edge cases, wrong thresholds, and broken cross-feature interactions.

The governance framework currently solves code quality (architecture enforcement, hooks, steering). It does not solve code correctness — whether the code does the right thing for the business.

---

## 2. Why It Is Needed

### The Requirements Gap

60-70% of software defects originate from requirements, not implementation. When AI writes code in 3 minutes instead of 3 weeks, the spotlight lands squarely on the quality of the requirements. Bad requirements + fast AI = wrong code faster.

### Two Developers, Same AI Tool

**Developer A — Strong technical, weak domain knowledge:**
> "Build a user management system with roles and permissions."

AI generates a generic RBAC system. Works technically. But misses that "Admin" means regional admin, user deactivation must trigger an audit trail, and role changes above Manager require Director approval.

**Developer B — Weak technical, strong domain knowledge:**
> "Build user management. Regional admins see only their region. Deactivation creates an audit entry with reason and admin ID. Role changes above Manager require Director approval. Show warning if user has pending transactions."

AI generates the same CRUD — but with correct business rules from the start. Fewer bugs. Ships faster. Not because Developer B writes better code, but because they eliminated the requirements gap.

### Knowledge Lives in Heads, Dies with Turnover

When a product owner or senior developer leaves, their domain knowledge leaves with them. The code remains, but the WHY behind every business rule is gone. New team members reverse-engineer business logic from code — slowly, incorrectly, and expensively.

### Traditional Knowledge Transfer Fails

| Approach | Why It Fails |
|----------|-------------|
| Confluence/Wiki | Nobody reads it. Always stale. Separated from workflow. |
| Sprint planning | Developer hears the story, forgets it next sprint. |
| Slack threads | Knowledge trapped in conversations nobody searches. |
| Onboarding docs | Read once, never again, outdated in 3 months. |
| "Shadow the PO" | Nobody has time. Doesn't scale. |

All of these fail because they separate learning from doing. The developer must stop coding, go somewhere else, read something, come back, and try to apply it. The context switch kills retention.

---

## 3. How It Works

### The Two Directions of Knowledge Flow

**Knowledge → Developer (Read Side):**
When a developer runs any governance command (`/new-feature`, `/fix`, `/edit-feature`, `/explore`), the AI automatically reads the relevant knowledge files before generating output. The developer gets better specs, more precise fixes, and cross-feature awareness — without doing anything extra.

**Developer → Knowledge (Write Side):**
When a developer finishes a command (approves requirements, completes tasks, commits code), the AI silently extracts business rules, cross-links, and implementation details from the conversation and code, then updates the knowledge files. Minimal additional effort — mostly automated. The developer reviews inferred rules when surfaced, and the team lead resolves conflicts when they arise.

### How Developers Gain Better Product Understanding

Over time, developers who use the framework absorb domain knowledge through repeated exposure:

- Every `/new-feature` exposes them to related features' business rules
- Every `/fix` teaches them WHY code works the way it does
- Every `/explore` shows them the full business context, not just code structure
- Every `/edit-feature` reveals decision history and cross-feature impacts

After 6 months, a developer using this framework can:
- Explain why any feature works the way it does
- Predict which features are affected when something changes
- Write precise requirements because they know the edge cases
- Onboard new team members by pointing them at the knowledge hub

They gain deep product understanding naturally — feature by feature, in context, at the moment it was relevant — because learning IS doing.

---

## 4. Knowledge Confidence Model

### The Weakest Link: AI Extraction Reliability

Code does not equal intent. AI can misinterpret. Silent writes can introduce wrong knowledge. This is the single biggest risk in the proposal.

**Solution: Every knowledge entry carries a confidence tag.**

### Confidence Levels

| Tag | Meaning | Source | Trust Level |
|-----|---------|--------|-------------|
| `[CONFIRMED]` | Verified by a human (developer during requirements, or team lead review) | Requirements gate conversation, team lead manual edit | High — safe to rely on |
| `[INFERRED]` | Extracted from code by AI — plausible but not human-verified | Code scan, `/knowledge` rebuild, silent capture during implementation | Medium — use with awareness, verify when critical |
| `[UNKNOWN]` | The system detected something exists but cannot determine the business reason | Code patterns with no comments, config values with no documentation | Low — needs human input to become useful |

### Example in a Knowledge File

```markdown
## Business Rules
- All record access logged to audit_log table [CONFIRMED]
  Source: requirements gate, /new-feature patient-records, 2024-03-15
- Records NEVER hard-deleted — soft_delete_mixin applied to all models [CONFIRMED]
  Source: team lead manual entry, legal hold policy
- NURSE role cannot view psychiatric notes (record_service.py:67) [INFERRED]
  Source: code scan, conditional check on note_type field
- Records locked after 72 hours — edits create amendment [INFERRED]
  Source: code scan, RECORD_LOCK_HOURS=72 in config
- Why 72 hours specifically? [UNKNOWN]
  Source: config value exists but no comment or documentation found
```

### How Confidence Flows

```
Code scan (/knowledge)           → [INFERRED] or [UNKNOWN]
Requirements gate (/new-feature) → [CONFIRMED]
Team lead manual edit            → [CONFIRMED]
Bug fix context (/fix)           → [INFERRED] (unless developer confirms)
Git hook file tracking           → No confidence tag (structural data only)
```

### Why This Matters

- **Builds trust** — developers know which rules are verified vs guessed
- **Prevents blind reliance** — AI won't treat an `[INFERRED]` rule with the same weight as `[CONFIRMED]`
- **Makes AI safer** — when generating specs, AI can flag: "Note: this business rule is [INFERRED] — verify before implementing"
- **Creates a review path** — team lead can filter for `[INFERRED]` and `[UNKNOWN]` entries to prioritize verification
- **Tracks knowledge maturity** — a feature with all `[CONFIRMED]` rules is well-understood; one with mostly `[UNKNOWN]` needs attention

---

## 5. AI Agent Roles

The Knowledge Hub uses four distinct AI agent responsibilities. These are not separate services — they are roles the AI plays at different moments in the workflow.

### Agent 1: Knowledge Extractor

**When:** During `/knowledge` command, and silently during command execution.
**What it does:**
- Scans code for business rules, data models, cross-feature connections
- Extracts concrete values (thresholds, timeouts, config constants)
- Tags everything with confidence levels (`[INFERRED]`, `[UNKNOWN]`)
- References specific files and line numbers for traceability

**Key constraint:** Never invents rules. Only extracts what is observable in code. When uncertain, tags as `[UNKNOWN]` rather than guessing.

### Agent 2: Context Builder

**When:** At the start of every governance command (`/new-feature`, `/fix`, `/edit-feature`, `/explore`, `/refactor`, `/hotfix`).
**What it does:**
- Reads `knowledge/hub.md` to find relevant features
- Reads the target feature's knowledge file
- Reads linked features' knowledge files (cross-references)
- Builds a context package that the AI uses when generating specs, fixes, or analysis
- Highlights `[CONFIRMED]` rules as constraints, flags `[INFERRED]` rules as "verify if critical"

**Key constraint:** Reads selectively — only files relevant to the current command. Never reads the entire hub (except during `/knowledge` rebuild).

### Agent 3: Conflict Detector

**When:** During requirements gates (`/new-feature`, `/edit-feature`) when new business rules are proposed.
**What it does:**
- Compares proposed rules against existing knowledge across all features
- Identifies direct contradictions (Rule A says X, Rule B says not-X)
- Identifies potential tensions (Rule A assumes X, Rule B might break if X changes)
- Creates conflict files in `knowledge/conflicts/` for team lead review
- Does NOT block the developer — marks conflicting rules as `[PENDING DECISION]`

**Key constraint:** Only flags conflicts, never resolves them. Resolution is a product decision for the team lead.

### Agent 4: Drift Detector

**When:** During `/knowledge` rebuild and `/audit`.
**What it does:**
- Compares knowledge files against actual code state
- Detects stale rules (knowledge says X, code shows Y)
- Detects missing features (code has feature directory, no knowledge file)
- Detects orphaned knowledge (knowledge file exists, feature directory deleted)
- Reports drift with specific diffs: "knowledge says Stripe, code imports Adyen"

**Key constraint:** Reports drift, does not auto-fix. Stale knowledge might be intentionally different (e.g., knowledge documents the intended state, code has a bug). Human review decides.

---

## 6. Directory Structure

### Per-Project Knowledge Hub

```
knowledge/
├── hub.md                          ← Master index — every feature, linked
├── features/                       ← One file per feature (replaces feature READMEs)
│   ├── authentication.md
│   ├── inventory.md
│   ├── cart.md
│   └── ...
├── flows/                          ← Cross-feature business processes
│   ├── order-lifecycle.md
│   └── user-onboarding.md
├── entities/                       ← Data model in business language
│   └── data-model.md
├── integrations/                   ← External services, APIs, webhooks
│   └── external-services.md
├── conflicts/                      ← Team lead's decision inbox
│   └── (generated when conflicts detected)
├── decisions/                      ← Resolved decisions with reasoning
│   └── (filled over time)
└── glossary.md                     ← Domain terms extracted from code
```

### Replaces Feature READMEs (Single Source of Truth)

Previously, each feature had a `README.md` inside its feature folder AND specs in `specs/`. With the Knowledge Hub, the feature knowledge file replaces the feature README to avoid duplication:

**Before (two places, drift risk):**
```
src/features/inventory/README.md    ← architecture, files, status
specs/inventory/requirements.md     ← business rules
```

**After (one place, single source of truth):**
```
knowledge/features/inventory.md     ← everything: business rules + architecture + files + status
specs/inventory/requirements.md     ← detailed spec (for active development only)
```

### Feature Knowledge File Structure

```markdown
# [Feature Name]

## Overview
[What this feature does in business terms]

## Business Rules
- [Rule description] [CONFIRMED]
  Source: [where this was confirmed]
- [Rule description] [INFERRED]
  Source: [file:line where this was observed]
- [Question about business logic] [UNKNOWN]
  Source: [what was observed but not understood]

## Architecture
### Layer Flow
### Files
| File | Layer | Purpose |

## Data Model
[Tables, columns, relationships relevant to this feature]

## Connected Features
[Cross-links to other features with relationship description]

## API Endpoints (if applicable)
| Method | Endpoint | Purpose |

## Environment / Config
[Env vars, feature flags, config values]

## Decisions
[Why things are the way they are — filled over time]

## Recent Changes
[Auto-updated by git hook — file changes with commit refs]

## Status
[Phase checklist — synced with specs/tasks.md]
```

---

## 7. Command Integration

### How Each Command Interacts with the Knowledge Hub

| Command | Reads from Knowledge | Writes to Knowledge | AI Agent | Developer Effort |
|---------|---------------------|--------------------|----|-----------------|
| `/knowledge` | Everything (rebuild) | Everything (full scan) | Extractor + Drift Detector | Runs command, reviews output |
| `/new-feature` | Related features + hub.md | New feature file + cross-links | Context Builder + Extractor + Conflict Detector | Minimal — review inferred rules |
| `/edit-feature` | Target feature + linked features | Updates target feature file | Context Builder + Extractor + Conflict Detector | Minimal — review inferred rules |
| `/fix` | Target feature | Minor update (bug context added) | Context Builder + Extractor | Zero |
| `/explore` | Target feature + linked features | Nothing (read-only command) | Context Builder | Zero |
| `/hotfix` | Target feature | Appends to Recent Changes | Context Builder + Extractor | Zero |
| `/audit` | hub.md (checks for staleness) | Flags stale/missing knowledge | Drift Detector | Zero |
| `/refactor` | Target feature | Updates Files table | Context Builder + Extractor | Zero |
| git commit | — | Recent Changes + Files table | None (pure file ops) | Zero |

### Read Side — What Happens When AI Reads Knowledge

When a developer runs `/new-feature notifications`:

1. **Context Builder** reads `knowledge/hub.md` — finds that notifications is linked to 4 other features
2. **Context Builder** reads `knowledge/features/notifications.md` — gets existing business rules
3. **Context Builder** reads linked features (e.g., `user-settings.md`) — learns about timezone preferences
4. **Context Builder** highlights `[CONFIRMED]` rules as hard constraints, flags `[INFERRED]` rules with "verify if critical"
5. AI generates requirements in Gate 1 that already include: timezone handling, batching rules, soft-delete user exclusion
6. Developer sees precise requirements without having to specify every edge case

**Time added: ~2-3 seconds (file reads). Time saved: potentially hours of revision cycles.**

### Write Side — What Happens When AI Updates Knowledge

When a developer finishes Gate 1 (requirements approved) for `/new-feature flash-sale`:

1. **Extractor** captures business rules from the requirements conversation — tagged `[CONFIRMED]` (human approved them)
2. **Extractor** creates `knowledge/features/flash-sale.md` with extracted rules
3. **Extractor** updates `knowledge/features/inventory.md` — adds flash-sale cross-link
4. **Conflict Detector** checks new rules against existing knowledge — flags contradictions if found
5. **Extractor** updates `knowledge/hub.md` — adds flash-sale to index

**Developer sees none of this. They just approved requirements and moved to design.**

---

## 8. The `/knowledge` Command

### Purpose

Bootstrap the knowledge hub for an existing project, or rebuild it from current codebase state.

### When to Use

- **First time:** After `ai-gov init`, run `/knowledge` to generate the initial knowledge hub from code
- **Rebuild:** When knowledge files have drifted significantly from code reality
- **New team member:** Run to get a fresh, accurate picture of the entire project

### What It Scans

| Source | What It Extracts |
|--------|-----------------|
| Feature directories | Feature names, file structure, layer organization |
| Database schemas / ORM models | Tables, columns, relationships, constraints |
| Route definitions | API endpoints, methods, middleware, auth guards |
| Environment configs (`.env.example`) | External services, feature flags, config values |
| State machines / enums | Status fields, transitions, business states |
| Middleware / guards | Auth checks, role requirements, rate limits |
| Code comments and TODOs | Business context developers left in code |
| Existing specs (`specs/`) | Requirements, design decisions, task status |
| Git history (commit messages) | Business context from commit messages |
| Validation logic | Business rules encoded in validators |

### What It Produces

1. `knowledge/hub.md` — master index with every feature, flow, and cross-link
2. `knowledge/features/*.md` — one file per detected feature (all rules tagged `[INFERRED]` or `[UNKNOWN]`)
3. `knowledge/flows/*.md` — cross-feature business processes (detected from call chains)
4. `knowledge/entities/data-model.md` — database schema in business language
5. `knowledge/integrations/external-services.md` — third-party APIs and services
6. `knowledge/glossary.md` — domain terms extracted from code naming

### Confidence on First Run

On initial bootstrap, ALL extracted knowledge is tagged `[INFERRED]` or `[UNKNOWN]`. Nothing is `[CONFIRMED]` until a human verifies it. This is honest — the AI scanned code, not requirements documents. The team lead reviews and promotes entries to `[CONFIRMED]` as they verify them.

### Behavior on Subsequent Runs

Running `/knowledge` again does NOT destroy existing knowledge. It:

1. Scans codebase for current state
2. Compares against existing knowledge files (**Drift Detector** agent)
3. Shows diff: "3 new features found, 2 knowledge files stale, 1 feature deleted"
4. Updates incrementally — adds new, flags stale, marks deleted
5. Preserves `[CONFIRMED]` entries and manually-added content (decisions, business context)
6. New extractions are tagged `[INFERRED]` — existing `[CONFIRMED]` entries are never downgraded

### Stack-Specific Scanning

The `/knowledge` command adapts its scan to the detected stack, similar to how `/audit` adapts its observation questions:

| Stack | Where Business Rules Hide |
|-------|--------------------------|
| Flutter | State machines in Cubits/BLoCs, validation in entities, route guards |
| React | Custom hooks, Redux/Zustand stores, API service layers, middleware |
| Angular | Services, guards, interceptors, NgRx effects, resolvers |
| Node.js | Middleware chains, service classes, validation schemas, ORM models |
| Python | FastAPI dependencies, service functions, Pydantic validators, middleware |
| Kotlin | UseCases, ViewModels, repository interfaces, Hilt modules |

---

## 9. Silent Knowledge Capture

### Capture Points

Knowledge is captured at specific moments during the developer's normal workflow, without any additional steps:

### Capture Point 1: Requirements Gate (Gate 1 in `/new-feature`, `/edit-feature`)

**When:** Developer approves requirements.
**What is captured:**
- Business rules mentioned in the conversation → tagged `[CONFIRMED]` (human approved)
- Acceptance criteria (encoded as business rules) → tagged `[CONFIRMED]`
- API contracts → tagged `[CONFIRMED]`
- Out-of-scope items (important — documents what was deliberately excluded) → tagged `[CONFIRMED]`
- Cross-feature dependencies mentioned → tagged `[CONFIRMED]`

**How:** **Extractor** agent extracts structured data from the requirements conversation and writes/updates the feature knowledge file before proceeding to Gate 2.

### Capture Point 2: Task Completion (during implementation phases)

**When:** Tasks in `tasks.md` are checked off during implementation.
**What is captured:**
- New files created (updates Files table in knowledge file)
- Data model changes (new tables, columns, relationships) → tagged `[INFERRED]`
- Environment variables added → tagged `[INFERRED]`
- External service integrations discovered during implementation → tagged `[INFERRED]`
- Cross-feature connections discovered (imports from other features) → tagged `[INFERRED]`

**How:** As the AI implements each phase and updates `tasks.md`, the **Extractor** agent simultaneously updates the knowledge file with implementation details.

### Capture Point 3: Git Commit (via hook)

**When:** Developer commits code.
**What is captured:**
- Which files changed, mapped to which features
- Timestamp and commit reference
- New files added to features

**How:** A lightweight git hook (no AI inference — just file path matching and markdown appending):
1. `git diff --cached --name-only` → list of changed files
2. Map files to features using directory structure
3. For each affected feature with a knowledge file:
   - Append to "Recent Changes" section
   - Update "Files" table if new files were added
4. Flag features with code changes but no knowledge file

**Performance:** Adds ~1-2 seconds to commit. No network calls. No AI inference. Pure file operations.
**No confidence tags** — this is structural data (file changes), not business rules.

### Capture Point 4: Bug Fix Context (`/fix`, `/hotfix`)

**When:** After a fix is applied.
**What is captured:**
- Root cause (adds context to why code works the way it does) → tagged `[INFERRED]`
- If the fix revealed a business rule that wasn't documented → tagged `[INFERRED]`

**How:** **Extractor** agent appends a brief note to the feature knowledge file's "Decisions" or "Business Rules" section.

### What Is NOT Captured Silently

- **Conflict resolution** — routes to team lead (see Access Model)
- **WHY decisions were made** — requires human input (team lead adds to Decisions section → `[CONFIRMED]`)
- **Business context from outside the codebase** — customer research, regulatory requirements, competitive analysis (team lead adds manually → `[CONFIRMED]`)

---

## 10. Knowledge Validation Layer

### Why Validation Is Critical

Without validation, the Knowledge Hub becomes Confluence 2.0 — stale, unreliable, ignored. The validation layer ensures knowledge stays accurate and trustworthy.

### Validation Mechanisms

#### 1. Drift Detection (during `/knowledge` rebuild and `/audit`)

The **Drift Detector** agent compares knowledge files against actual code:

| Check | What It Detects | Example |
|-------|----------------|---------|
| Stale rules | Knowledge says X, code shows Y | Knowledge says "Stripe SDK", code imports "Adyen SDK" |
| Missing features | Code has feature directory, no knowledge file | `src/features/reporting/` exists, no `knowledge/features/reporting.md` |
| Orphaned knowledge | Knowledge file exists, feature directory deleted | `knowledge/features/legacy-auth.md` exists, `src/features/legacy-auth/` gone |
| Outdated integrations | External service references changed | `.env.example` has new API URLs not in knowledge |
| Schema drift | Data model in knowledge doesn't match ORM models | Knowledge says 5 columns, model has 8 |

**Output format:**
```
━━━ KNOWLEDGE DRIFT REPORT ━━━

  STALE (knowledge ≠ code):
    knowledge/features/payment.md
      Rule: "Payment provider: Stripe" [INFERRED]
      Code: imports adyen-node-api-library (package.json)
      → STALE — update required

  MISSING (code exists, no knowledge):
    src/features/reporting/ — 12 files, no knowledge file
    src/features/analytics/ — 8 files, no knowledge file

  ORPHANED (knowledge exists, no code):
    knowledge/features/legacy-auth.md — feature directory deleted

  CONFIDENCE SUMMARY:
    Total rules: 147
    [CONFIRMED]: 89 (61%)
    [INFERRED]: 43 (29%)
    [UNKNOWN]: 15 (10%)
```

#### 2. Periodic Audit (integrated into `/audit` command)

The existing `/audit` command gains a new step: Knowledge Health Check.

```
━━━ KNOWLEDGE HEALTH ━━━

  Coverage: 23/27 features have knowledge files (85%)
  Freshness: 4 knowledge files not updated in >30 days
  Confidence: 61% CONFIRMED, 29% INFERRED, 10% UNKNOWN
  Conflicts: 2 unresolved in knowledge/conflicts/
  Drift: 3 stale rules detected (run /knowledge to update)
```

#### 3. PR-Level Validation (CI integration)

PR checks can validate:
- If feature code changed, was the knowledge file updated?
- Are there unresolved conflicts in `knowledge/conflicts/`?
- Do all knowledge files have required sections?
- Are there `[UNKNOWN]` entries older than 30 days? (flag for team lead review)

---

## 11. Git Integration & Branch Strategy

### Development Branches (Full Intelligence)

Development branches (`main`, `develop`, feature branches) carry everything:

```
knowledge/          ← Full knowledge hub, committed
specs/              ← Full specs, committed
.claude/            ← Governance framework, committed
src/                ← Code
```

### Release Branches (Code Only)

Release branches (`release/*`, `production`) strip development-time assets:

```
src/                ← Code only — clean production artifact
```

**How to strip:** Add to `.gitignore` on release branches, or use CI pipeline step:
```bash
# In CI release pipeline
rm -rf knowledge/ specs/ .claude/
```

Or use `.dockerignore` / `.npmignore`:
```
knowledge/
specs/
.claude/
```

### Why This Matters

- Zero overhead in production builds
- No extra files in Docker images or deployment packages
- No risk of internal business documentation in customer-facing artifacts
- Smaller, faster deployments
- Knowledge hub is a development-time asset — like tests, it exists to make development better but doesn't ship

### Knowledge Versioning (Free via Git)

Because knowledge files are committed to git:

- `git log knowledge/features/inventory.md` shows every business rule change
- `git blame` shows who changed what and when
- Feature branches carry knowledge with them — merge brings knowledge updates
- Branch conflicts on knowledge files = two people touched the same feature's business rules (worth reviewing)
- Full audit trail: WHAT was decided (knowledge), HOW it was designed (specs), WHEN it changed (git log), WHO changed it (git author)

### CI Pipeline Integration

**PR checks (development CI):**
- Flag if a PR modifies feature code but doesn't update the corresponding knowledge file
- Check for unresolved conflicts in `knowledge/conflicts/`
- Validate knowledge file format (required sections present)
- Flag `[UNKNOWN]` entries older than 30 days

**Release CI:**
- Strip `knowledge/`, `specs/`, `.claude/` from build artifact

---

## 12. Access Model

| Role | Read Knowledge | Write Knowledge | Resolve Conflicts | Promote Confidence |
|------|---------------|----------------|-------------------|--------------------|
| Any developer | Yes — all files | Indirect — via governance commands and git hooks | No | No (only through requirements gates → `[CONFIRMED]`) |
| Governance commands (AI) | Yes — selective per command | Yes — silent updates as side effect | No — flags conflicts only | Yes — requirements gate entries are `[CONFIRMED]` |
| Git hook | No | Yes — lightweight updates (file changes, timestamps) | No | No |
| Team lead | Yes — all files | Yes — manual edits, decisions, conflict resolution | Yes | Yes — can promote `[INFERRED]` → `[CONFIRMED]` |

### Why Conflicts Route to Team Lead Only

When the AI detects conflicting business rules between features, it does NOT ask the developer to resolve it. This is a product decision.

**What happens:**
1. **Conflict Detector** agent identifies conflict during `/new-feature` or `/edit-feature`
2. AI creates `knowledge/conflicts/<conflict-name>.md` with:
   - Which features conflict
   - Which specific business rules conflict
   - What the options are
3. AI tags it for team lead review
4. Developer is NOT blocked — they continue with non-conflicting parts
5. Conflicting rule is marked `[PENDING DECISION]` in the spec
6. Team lead resolves on their own time
7. Resolution updates both knowledge files automatically, tagged `[CONFIRMED]`

### The `knowledge/conflicts/` Directory

This is the team lead's product decision inbox:

```markdown
# Conflict: Loyalty Program vs Flash Sale

## Detected During
/new-feature loyalty-program (2024-07-15)

## Conflicting Rules
- **flash-sale.md:** "Coupon codes blocked during flash sales" [CONFIRMED]
- **loyalty-program.md (proposed):** "Platinum members get coupons on all purchases" [CONFIRMED]

## Conflict Scenario
Platinum member + flash sale + coupon code = which rule wins?

## Options
1. Flash sale overrides loyalty (no coupons during flash sales, even for platinum)
2. Loyalty overrides flash sale (platinum always gets coupons)
3. New rule: platinum gets loyalty discount but not coupon code during flash sale

## Resolution
[PENDING — @team-lead]
```

---

## 13. Real-World Scenarios

### Scenario 1: E-Commerce Platform (Node.js + React)

Developer joins a team with 40+ features. Runs `/knowledge`.

AI scans the codebase and produces `knowledge/features/inventory.md`:

```markdown
# Inventory

## Business Rules
- Stock check happens BEFORE payment processing (order-service.ts:47) [INFERRED]
- Negative stock allowed for backorder-eligible products (inventory.repository.ts:83) [INFERRED]
- Stock reserved for 15 minutes during checkout (cart-service.ts:112, CART_RESERVATION_TTL) [INFERRED]
- Warehouse priority: nearest to shipping address (fulfillment-service.ts:34) [INFERRED]
- Why is negative stock allowed? [UNKNOWN]
- Stock sync with warehouse API — real-time or batched? (cron job found) [UNKNOWN]

## Connected Features
- cart → reserves stock on add-to-cart
- order-management → decrements stock on order confirmed
- returns → increments stock on return approved
```

Later, developer runs `/new-feature flash-sale`. **Context Builder** reads inventory knowledge and surfaces: "flash sales will hammer the stock reservation system. The 15-minute TTL [INFERRED] might need adjustment. Verify this value before designing flash sale checkout."

**Without knowledge hub:** Developer builds flash sale unaware of the 15-minute reservation TTL. Flash sale launches, 10,000 users hit checkout, reservations pile up, stock shows zero for 15 minutes after items sell out. Production incident.

**With knowledge hub:** AI surfaces the TTL issue at requirements time. Developer and team lead decide on a 2-minute TTL for flash sales. Zero production incidents.

### Scenario 2: Healthcare SaaS (Python/FastAPI)

Knowledge hub captures compliance-critical rules:

```markdown
# Patient Records

## Business Rules
- All record access logged to audit_log table [CONFIRMED]
  Source: requirements gate, /new-feature patient-records, 2024-03-15
- Records NEVER hard-deleted — soft_delete_mixin applied [CONFIRMED]
  Source: team lead, legal hold policy
- NURSE role cannot view psychiatric notes (record_service.py:67) [INFERRED]
- Records locked after 72 hours — edits create amendment [INFERRED]
- Why 72 hours specifically? [UNKNOWN]

## Compliance Markers
- HIPAA: audit logging on all endpoints [CONFIRMED]
- GDPR: export endpoint exists, deletion is soft-delete [CONFIRMED]
```

Developer runs `/fix patient-records` — "patients can't see their psychiatric notes in the portal." **Context Builder** reads knowledge and knows: NURSE role is blocked from psychiatric notes `[INFERRED]`, but PATIENT role access isn't mentioned. The bug is likely a missing role check.

**Without knowledge hub:** Developer might "fix" it by removing the psychiatric filter entirely — breaking the nurse access control. Compliance violation.

**With knowledge hub:** AI identifies the correct fix — add PATIENT role to the allowed list, separate from the NURSE restriction. Compliance preserved.

### Scenario 3: Fintech App (Flutter)

Knowledge hub captures offline-first complexity:

```markdown
# Transaction Sync

## Business Rules
- Transactions stored locally first (Hive box) [CONFIRMED]
  Source: requirements gate, /new-feature transaction-sync
- Sync every 30 seconds when online [CONFIRMED]
- Failed syncs: exponential backoff (30s, 60s, 120s, max 5 min) [INFERRED]
- Transactions older than 7 days without sync trigger user alert [CONFIRMED]
- Duplicate detection via idempotency_key (UUID, client-side) [INFERRED]

## State Machine
CREATED (local) → SYNCING → SYNCED (server confirmed)
                → SYNC_FAILED → retry → SYNCING
                → EXPIRED (7 days, no sync)

## Connected Features
- authentication → sync requires valid token
- balance-display → shows local balance vs confirmed balance
- offline-mode → transaction-sync is core of offline capability
```

Developer runs `/edit-feature balance-display`. **Context Builder** reads balance-display AND transaction-sync knowledge (linked). Knows that "pending" means locally created but not synced, that there's a state machine, and that balance shows two numbers. Requirements are precise from the start.

### Scenario 4: Multi-Tenant B2B Platform (Angular)

Knowledge hub captures tenant isolation rules:

```markdown
# Tenant Management

## Business Rules
- Every DB query filtered by tenant_id (base_repository — global query filter) [CONFIRMED]
  Source: team lead, security architecture review
- Tenant admin manages only users within their tenant [CONFIRMED]
- Trial tenants limited to 5 users [INFERRED]
- Tenant deletion: 30-day soft-delete with data export before purge [INFERRED]

## DANGER ZONES [CONFIRMED — team lead]
- Never bypass base_repository — breaks tenant isolation
- Never cache without tenant_id in cache key — cross-tenant data leak
- Never log full request bodies — may contain other tenant's data
```

When developer runs `/new-feature bulk-export`, **Context Builder** reads this and bakes constraints into requirements: "bulk export MUST go through base_repository `[CONFIRMED]`, cache keys MUST include tenant_id `[CONFIRMED]`, export scoped to requesting tenant."

**Without knowledge hub:** Developer builds bulk export with a raw SQL query for performance. Bypasses tenant filter. Cross-tenant data leak. Security incident.

**With knowledge hub:** AI enforces tenant isolation at requirements time. The dangerous code is never written.

---

## 14. Problems Identified & Solutions

### Problem 1: Knowledge Conflicts Between Features

**Problem:** Two features have contradictory business rules. Developer A builds "no coupons during flash sales." Developer B builds "platinum members get coupons on everything." These conflict, and a developer shouldn't be making product decisions.

**Solution:** Conflicts route to team lead only. The developer is not blocked — they continue working on non-conflicting parts. The conflicting rule is marked `[PENDING DECISION]`. A conflict file is created in `knowledge/conflicts/` as the team lead's decision inbox. The team lead resolves it on their own time. Resolution auto-updates both knowledge files with `[CONFIRMED]` tag.

**Why not let developers resolve it:** Conflict resolution is a product decision, not a technical one. It requires understanding business priorities, customer impact, and strategic direction. Routing it to the team lead ensures the right person makes the call.

---

### Problem 2: Knowledge Overload / Duplication with Feature READMEs

**Problem:** If every feature has a `README.md` inside its folder AND a knowledge file in `knowledge/features/`, that's two places to maintain. They will drift apart. Developers won't know which one is authoritative.

**Solution:** The knowledge hub replaces feature READMEs entirely. One file per feature, in `knowledge/features/`, containing everything: business rules, architecture, file list, status. The feature folder contains only code. No more per-feature README.md.

**Why this works:** Single source of truth eliminates drift. The AI reads one file, not two. Developers look in one place. The `knowledge/hub.md` index serves as the project's table of contents.

**Migration for existing projects:** The `/knowledge` command reads existing feature READMEs, merges their content into knowledge files, and the team can then remove the old READMEs.

---

### Problem 3: Multi-Stack Projects

**Problem:** A project with React frontend + Node.js backend + Flutter mobile. A Flutter developer doesn't care about Node.js middleware. Mixing all stacks in one knowledge hub creates noise.

**Solution:** Each stack/project gets its own knowledge hub. The governance framework already runs per-project (`ai-gov init` runs in each project root). The knowledge hub follows the same boundary.

```
frontend-react/knowledge/     ← React-specific knowledge
backend-nodejs/knowledge/     ← Node.js-specific knowledge
mobile-flutter/knowledge/     ← Flutter-specific knowledge
```

**Shared business rules:** Some business rules apply across stacks (e.g., session duration, role hierarchy). These appear in each stack's knowledge hub independently, written from that stack's perspective. The Flutter knowledge says "token refresh before sync." The Node.js knowledge says "JWT validation middleware." Same business rule, stack-specific implementation context.

**Why not a shared knowledge layer:** A shared `knowledge-shared/` directory adds complexity — the AI reads from two places, the directory structure gets confusing, and for separate repos it's awkward. Each stack being self-contained is simpler. If business rules drift between stacks, `/audit` or `/knowledge` rebuild catches it.

---

### Problem 4: Developer Who Doesn't Use Governance Commands

**Problem:** One developer always codes directly — never uses `/new-feature`, just opens files and writes. Their changes never enter the knowledge hub through the normal command flow.

**Solution:** The git commit hook is the safety net. Even developers who bypass governance commands still commit code. The hook:

1. Maps changed files to features (directory structure matching)
2. Updates "Recent Changes" in the corresponding knowledge file
3. Updates "Files" table if new files were added
4. Flags features with code changes but no knowledge file

**What the hook captures:** WHAT changed and WHEN (file paths, timestamps, commit refs). It does NOT capture WHY (that requires AI analysis, too heavy for a git hook).

**What the hook misses:** Business rules, cross-feature impacts, decision context. These only get captured through governance commands.

**Mitigation:** The next `/knowledge` rebuild picks up all code changes and updates the hub. Even partial coverage (git hook only) is better than zero. And as the team sees the hub's value, holdout developers start using commands because the AI gives better output with knowledge context.

---

### Problem 5: Stale Knowledge

**Problem:** The payment team changed providers 2 months ago. The knowledge hub still references the old provider. Changes made outside governance commands cause drift.

**Solution:** The **Drift Detector** agent (during `/knowledge` rebuild and `/audit`) compares knowledge files against actual code. Additionally, `/audit` checks for knowledge staleness as part of its report. The git commit hook keeps "Recent Changes" current, so even if business rules are stale, the file modification history is accurate.

---

### Problem 6: New Projects with No Existing Code

**Problem:** Brand new project. No code. No features. Empty knowledge hub. Is it useful?

**Solution:** For new projects, the knowledge hub grows WITH the project. The first `/new-feature` creates the first knowledge file with `[CONFIRMED]` rules (from the requirements gate). By the tenth feature, the hub has ten files with cross-links. It's never stale because it was born from the actual development process.

---

### Problem 7: Knowledge Quality — Generic vs Specific

**Problem:** If auto-generated knowledge files are too generic, developers will ignore them.

**Solution:** Knowledge extraction prioritizes concrete values over abstractions. The AI extracts actual values from code — config constants, enum values, conditional thresholds, timeout durations. It references specific files and line numbers. The **Confidence Model** makes quality visible: `[INFERRED]` rules with file references are useful even if not perfect. `[UNKNOWN]` entries honestly flag gaps instead of hiding them.

---

### Problem 8: Performance Impact on Development Workflow

**Problem:** If knowledge operations slow down commands or commits, developers will resent the system.

**Solution:** Strict time budgets:

| Operation | Time Budget | How |
|-----------|------------|-----|
| AI reading knowledge files | ~2-3 seconds | Selective file reads, not full hub |
| AI writing knowledge files (silent) | ~3-5 seconds | Happens between gates, developer doesn't wait |
| Git hook knowledge update | ~1-2 seconds | No AI, pure file operations |
| `/knowledge` full rebuild | 2-5 minutes | On-demand only, not part of normal workflow |

---

### Problem 9: AI Extraction Reliability (The Weakest Link)

**Problem:** Code does not equal intent. AI can misinterpret conditional logic, infer rules that don't exist, or miss context that only a human would understand. Silent writes can introduce wrong knowledge into the hub.

**Solution:** The **Knowledge Confidence Model** (Section 4). Every entry is tagged `[CONFIRMED]`, `[INFERRED]`, or `[UNKNOWN]`. The AI never claims certainty it doesn't have. `[INFERRED]` entries reference specific files and line numbers so humans can verify. `[UNKNOWN]` entries are honest gaps, not hidden ones. The **Drift Detector** catches when inferred rules no longer match code. Team lead review promotes accurate inferences to `[CONFIRMED]` and corrects wrong ones.

---

## 15. Pros and Cons

### Pros

| # | Pro | Impact |
|---|-----|--------|
| 1 | **Developers gain better product understanding without extra effort** — knowledge is absorbed through normal workflow, not documentation reading | Developers write better requirements, catch edge cases earlier, reduce revision cycles |
| 2 | **AI generates more correct code** — reads business rules before generating specs, so output matches business intent from the start | Fewer bugs from requirements gaps (addresses 60-70% of defect root causes) |
| 3 | **Cross-feature impact awareness** — AI surfaces connected features and potential conflicts at requirements time, not in production | Prevents integration bugs, data leaks, compliance violations before code is written |
| 4 | **New developer onboarding drops from weeks to days** — run `/knowledge` + `/explore` on first assigned feature, get full business context immediately | Reduces onboarding cost, faster time-to-productivity for new hires |
| 5 | **Knowledge survives team turnover** — business rules, decisions, and domain context are persisted in git, not in people's heads | Eliminates "bus factor" risk, institutional knowledge is preserved |
| 6 | **Single source of truth** — replaces scattered READMEs, wiki pages, and tribal knowledge with one structured, version-controlled hub | No more "which doc is current?" confusion |
| 7 | **Zero runtime cost** — knowledge files exist only in development branches, stripped from release builds | No performance impact on production, no extra files in deployments |
| 8 | **Conflict detection at requirements time** — contradictory business rules caught before code is written, routed to team lead | Prevents bugs that would otherwise surface months later in production |
| 9 | **Full audit trail via git** — every business rule change is tracked with who, when, and why | Compliance-friendly, supports regulatory audits |
| 10 | **Stack-specific knowledge** — each project/stack has its own hub, developers see only what's relevant | No noise from unrelated stacks, focused context |
| 11 | **Confidence model builds trust** — `[CONFIRMED]` / `[INFERRED]` / `[UNKNOWN]` tags make knowledge reliability visible | Developers and AI know what to trust and what to verify |
| 12 | **Compounds over time** — every feature built adds to the hub, every developer who uses it gets smarter | The longer the team uses it, the more valuable it becomes |
| 13 | **Feedback loop, not documentation** — continuous extraction → AI context → better code → richer extraction | Self-reinforcing system that improves with use |

### Cons

| # | Con | Severity | Mitigation |
|---|-----|----------|-----------|
| 1 | **Initial bootstrap quality depends on code quality** — if code has no comments, poor naming, or inconsistent patterns, the extracted knowledge will have gaps | Medium | Mark uncertain extractions as `[INFERRED]` or `[UNKNOWN]`. Team lead reviews and corrects. Quality improves over time as commands fill in gaps. |
| 2 | **AI extraction may hallucinate business rules** — AI might infer rules that don't exist or misinterpret code intent | Medium-High | Confidence Model prevents blind reliance. All auto-extracted rules reference specific files and line numbers. `[INFERRED]` tag makes it clear what needs human verification. Team lead review catches errors. |
| 3 | **Adds files to the repository** — knowledge directory adds markdown files to the repo, increasing repo size | Low | Markdown files are tiny (1-5KB each). Even 100 features = ~500KB total. Stripped from release branches. |
| 4 | **Git merge conflicts on knowledge files** — two developers editing the same feature's knowledge can cause merge conflicts | Low | Knowledge files are append-mostly. Merge conflicts are actually useful — they signal two people touched the same feature's business rules. |
| 5 | **Doesn't capture knowledge from outside the codebase** — customer research, regulatory requirements, competitive analysis, verbal decisions | Medium | Team lead can manually add to Decisions section as `[CONFIRMED]`. The hub captures what's in the code and conversations; external context requires human input. |
| 6 | **Developers who bypass governance commands get partial coverage only** — git hook captures file changes but not business rules | Medium | Git hook is the safety net. `/knowledge` rebuild catches up. Team adoption of governance commands is the real solution. |
| 7 | **Team lead becomes a bottleneck for conflict resolution** — if conflicts pile up and team lead doesn't review, `[PENDING DECISION]` markers accumulate | Medium | `/audit` surfaces unresolved conflicts. Conflicts are rare in practice. Team lead can delegate to product owner if needed. |
| 8 | **Adds complexity to the governance framework** — new command, new directory, new git hook logic, new capture points in existing commands | Medium | Implementation is incremental — `/knowledge` command first, then silent capture, then git hook. Each piece is independently useful. |
| 9 | **Not zero effort — minimal effort** — developers review inferred rules, team leads resolve conflicts, someone reviews initial bootstrap | Low | Effort is small and contextual (happens during normal workflow). Much less than maintaining a wiki. But it's not literally zero. |
| 10 | **Multi-stack projects may have duplicated business rules** — same rule appears in frontend and backend knowledge hubs independently | Low | Acceptable trade-off for simplicity. Each stack is self-contained. `/audit` can flag drift between stacks. |

---

## 16. What It Brings to the Table

### For Developers

- **Context at the moment of need** — business rules surface when you're about to write code, not in a meeting you forgot
- **Cross-feature awareness** — know what breaks when you change something, before you change it
- **Faster onboarding** — understand a feature's business context in minutes, not weeks
- **Better AI output** — the AI writes more correct code because it understands the business, not just the architecture
- **Invisible learning** — gain better product understanding as a side effect of doing your job
- **Confidence visibility** — know which rules are verified facts vs AI inferences

### For Team Leads

- **Product decision inbox** — conflicts surface automatically, with options, in a structured format
- **Knowledge preservation** — team turnover doesn't destroy institutional knowledge
- **Audit trail** — every business rule change tracked in git with full history
- **Onboarding tool** — point new developers at `knowledge/hub.md` instead of spending days explaining the product
- **Quality signal** — confidence distribution shows which features are well-understood vs under-documented
- **Drift alerts** — know when knowledge has gone stale before it causes bugs

### For the AI

- **Business context** — reads domain knowledge before generating code, producing more accurate output
- **Cross-feature graph** — understands feature dependencies, surfaces impacts automatically
- **Historical context** — knows what was tried before and why it was rejected
- **Domain language** — uses correct business terms from the glossary, not generic technical terms
- **Confidence awareness** — treats `[CONFIRMED]` rules as hard constraints, flags `[INFERRED]` rules for verification

### For the Product

- **Fewer requirements-gap bugs** — the #1 source of defects is addressed at the source
- **Faster feature delivery** — less back-and-forth on "that's not what I meant"
- **Compliance support** — business rules and their origins are documented and traceable
- **Reduced rework** — cross-feature conflicts caught at requirements time, not in production

### For the Governance Framework

- **Completes the picture** — architecture enforcement ensures code is structured correctly; knowledge hub ensures code does the right thing
- **Differentiator** — no other AI governance tool captures and distributes product knowledge automatically
- **Natural extension** — uses existing command infrastructure, spec workflow, and git hooks
- **Increases adoption** — developers get tangibly better AI output, which motivates using the framework

---

## 17. Measuring Impact

### Why Metrics Matter

Without measurement, the Knowledge Hub is a belief, not a capability. These metrics prove (or disprove) its value.

### Before vs After Comparison

| Metric | Before (no Knowledge Hub) | After (with Knowledge Hub) | How to Measure |
|--------|--------------------------|---------------------------|----------------|
| **Onboarding time** | New developer productive in 2-4 weeks | New developer productive in 2-5 days | Time from first commit to first feature PR merged |
| **Requirements-gap bugs** | 60-70% of defects from requirements issues | Target: reduce by 40-50% | Tag bugs as "requirements gap" vs "implementation error" in issue tracker |
| **PR rework cycles** | Average 2-3 revision rounds per feature PR | Target: reduce to 1-2 rounds | Count PR review rounds before merge |
| **Cross-feature incidents** | Integration bugs discovered in staging/production | Target: catch 80% at requirements time | Count bugs tagged "cross-feature" or "integration" |
| **Knowledge bus factor** | 1-2 people know each feature's business rules | All active developers have context | Survey: "can you explain why feature X works this way?" |
| **Spec quality** | Specs missing edge cases, vague acceptance criteria | Specs include cross-feature impacts, specific thresholds | Review spec completeness before/after hub adoption |
| **AI output accuracy** | AI generates generic code, multiple revision cycles | AI generates business-aware code, fewer revisions | Compare first-draft accuracy of AI output |

### Knowledge Health Metrics (ongoing)

These are tracked by `/audit` and reported in the Knowledge Drift Report:

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| **Feature coverage** | >90% features have knowledge files | 70-90% | <70% |
| **Confidence distribution** | >50% `[CONFIRMED]` | 30-50% `[CONFIRMED]` | <30% `[CONFIRMED]` |
| **Staleness** | No files >30 days without update | 1-3 stale files | >3 stale files |
| **Unresolved conflicts** | 0 | 1-2 | >2 |
| **Unknown entries** | <10% of total rules | 10-20% | >20% |

### How to Establish Baseline

Before enabling the Knowledge Hub, capture:
1. Average PR review rounds for the last 10 feature PRs
2. Number of bugs tagged "requirements" or "wrong behavior" in the last quarter
3. Time for last 3 new developers from first day to first merged feature PR
4. Survey developers: "On a scale of 1-5, how well do you understand the business rules of features outside your area?"

After 3 months with the Knowledge Hub, measure the same metrics. The delta is the impact.

---

## 18. Is It Really Needed?

### The Case FOR

**Yes, because the value of AI coding tools is capped by the quality of requirements.** The governance framework currently ensures code quality (architecture, formatting, testing). But technically correct code that implements the wrong business logic is still a bug. The knowledge hub addresses the other half of the quality equation — correctness.

**Yes, because knowledge loss is the most expensive invisible cost in software teams.** When a senior developer leaves, the team spends months rediscovering business rules through trial and error. The knowledge hub makes this cost near-zero.

**Yes, because it's minimal effort to maintain.** Unlike a wiki that requires manual updates, the knowledge hub is maintained mostly automatically as a side effect of normal development. The marginal cost of capturing knowledge is small — the AI does the writing, the developer reviews when relevant, the team lead resolves conflicts when they arise.

**Yes, because it compounds.** Every feature built makes the hub richer. Every developer who uses it gets smarter. The ROI increases over time, not decreases.

**Yes, because it's the missing layer.** AI writes code fast, but correctness depends on context, and context currently doesn't exist in systems. The Knowledge Hub fixes that gap.

### The Case AGAINST

**Maybe not, if the team is small and stable.** A 3-person team that's been together for 5 years already shares domain knowledge through daily conversation. The knowledge hub adds structure they might not need. (Counter: even small teams have turnover eventually, and the hub costs almost nothing to maintain.)

**Maybe not, if the product is simple.** A CRUD app with no complex business rules doesn't benefit much from a knowledge hub. The business logic is obvious from the code. (Counter: products that start simple rarely stay simple. The hub grows with the product.)

**Maybe not, if the team doesn't use AI coding tools.** The knowledge hub's primary value is making AI output more accurate. If the team writes all code manually, the hub is just documentation — useful but not transformative. (Counter: AI adoption is accelerating. Building the knowledge infrastructure now prepares the team for the shift.)

**Maybe not, if the team already has excellent product documentation.** If the product owner maintains a living, accurate, developer-readable product spec, the knowledge hub duplicates that effort. (Counter: this is extremely rare. Most product documentation is stale, scattered, or written for stakeholders, not developers.)

### The Verdict

The knowledge hub is needed for any team that:
1. Uses AI coding tools (or plans to)
2. Has more than 5 features with cross-feature dependencies
3. Has experienced (or will experience) team turnover
4. Has business rules that aren't obvious from reading the code

For teams that meet none of these criteria, it's optional but harmless. For teams that meet all four, it's the missing layer in AI-driven development.

---

## 19. Open Questions

These questions remain for the implementation phase:

1. **Knowledge file format** — Is the proposed markdown structure optimal, or should it be more structured (YAML frontmatter for confidence tags, JSON schema for machine parsing)?

2. **Glossary auto-detection** — How aggressively should the AI extract domain terms? Should it flag every non-standard term, or only terms that appear in multiple features?

3. **Flow detection** — How does the AI detect cross-feature flows? Call chain analysis? Import graph? Or does it rely on developers mentioning connections during requirements?

4. **Conflict detection sensitivity** — How strict should conflict detection be? Flag only direct contradictions, or also potential tensions?

5. **Knowledge file size limits** — Should there be a maximum size for a knowledge file? What happens when a feature is so complex that its knowledge file becomes unwieldy?

6. **Team lead notification** — How is the team lead notified of new conflicts? In-tool notification? Separate file they check? Integration with ticket system?

7. **Migration path** — How do existing projects with feature READMEs transition? Automatic merge? Manual review? Gradual replacement?

8. **Monorepo shared knowledge** — For monorepos with multiple stacks, is a shared knowledge layer needed? Or is per-package knowledge sufficient?

9. **Confidence promotion workflow** — How does the team lead efficiently review and promote `[INFERRED]` entries? Batch review tool? Inline in knowledge files?

10. **Agent boundaries** — Should the four AI agent roles (Extractor, Context Builder, Conflict Detector, Drift Detector) be implemented as distinct modules, or as behavioral modes of the same command logic?

11. **Metrics baseline** — What's the minimum data needed to establish a meaningful before/after comparison? How long should the baseline period be?

---

## Summary

The AI Product Intelligence Layer (Knowledge Hub) extends the ai-gov governance framework from code quality enforcement to continuous knowledge extraction and AI context awareness.

It is not a documentation system. It is a feedback loop:

```
Code → AI extracts knowledge → Knowledge persists in git →
AI reads knowledge → Better code → Richer knowledge → (compounds)
```

**What it solves:** The gap between what AI can build (technically correct code) and what the business needs (correct behavior). This gap is the #1 source of software defects, and it widens as AI makes implementation faster.

**How it solves it:** By capturing domain knowledge silently during normal development workflow, distributing it to the AI and developers at the moment of need, and validating it continuously against the actual codebase.

**What it costs:** Minimal additional effort — mostly automated. Developers review inferred rules during requirements gates. Team leads resolve conflicts when they arise. The git hook captures structural changes with zero effort. The `/knowledge` rebuild is on-demand.

**What it enables:** Developers gain better product understanding naturally. AI generates business-aware code. Knowledge survives team turnover. Cross-feature conflicts are caught at requirements time. The governance framework becomes complete — ensuring code is not just well-structured, but correct.

---

*Document generated from brainstorming sessions. Subject to revision during implementation planning.*
