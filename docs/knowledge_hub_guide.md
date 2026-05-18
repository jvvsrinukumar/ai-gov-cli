# Knowledge Hub Guide
## Claude Code + Kiro — All 5 Phases + v19.1 Hardening

**Audience:** Developers, team leads
**Version:** v19.1.0 · **Date:** 2026-05-18
**Status:** Shipped — all phases active, hardened

---

## What's new since v17.2.0

**v19.0 (knowledge commands + ergonomics):**
- New read-only `/knowledge [scope]` command — viewer for developers who don't have write access.
- HTML export from `/tech-knowledge` and `/product-knowledge` with Mermaid diagrams.
- `merge=union` set on `knowledge/*.md` in `.gitattributes` — parallel team edits don't conflict.
- `/fix` and `/hotfix` now silently capture business rules into `knowledge/product-*.md` (in addition to `/new-feature` and `/edit-feature`).

**v19.1 (hardening):**
- **Pre-commit guard on `[CONFIRMED]`.** Removing a `[CONFIRMED]` line from `knowledge/*.md` is blocked at commit time. Bypass: `AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m '<message>'`. See section 11.
- **`/fix` DO-NOT-CAPTURE blocklist.** Default is now "no business rules extracted." Captures only when the root cause is a misunderstood requirement, an unenforced constraint, or a missing role check.
- **Mechanical drift detection.** Replaces fuzzy "many commits passed" with `git diff --stat OLD_HASH..HEAD` against covered paths. Threshold: > 10 files OR > 200 lines → flagged as significant drift.
- **Honest Mermaid wording.** HTML export now says "requires internet to render diagrams" — the export depends on the Mermaid CDN, it is not truly self-contained.
- **Dynamic onboard listing.** `npx ai-gov onboard` groups every `knowledge/*.md` file by prefix instead of hard-coding `tech-` and `product-`.

---

## Table of Contents

1. [What the Knowledge Hub Is](#1-what-the-knowledge-hub-is)
2. [The Confidence Model — INFERRED / CONFIRMED / STALE](#2-the-confidence-model)
3. [Phase 1 — Extract Knowledge On Demand](#3-phase-1--extract-knowledge-on-demand)
   - 3.1 [Claude Code: /tech-knowledge](#31-claude-code-tech-knowledge)
   - 3.2 [Claude Code: /product-knowledge](#32-claude-code-product-knowledge)
   - 3.3 [Claude Code: /knowledge (read-only viewer)](#33-claude-code-knowledge-read-only-viewer)
   - 3.4 [Kiro: Tech Knowledge workflow](#34-kiro-tech-knowledge-workflow)
   - 3.5 [Kiro: Product Knowledge workflow](#35-kiro-product-knowledge-workflow)
4. [Phase 2 — Context Builder (Read Before Acting)](#4-phase-2--context-builder)
5. [Phase 3 — Silent Capture (Write After Gate 1 or Fix)](#5-phase-3--silent-capture)
6. [Phase 4 — Drift Detection in /audit](#6-phase-4--drift-detection)
7. [Phase 5 — Conflict Detection](#7-phase-5--conflict-detection)
   - 7.1 [Claude Code: /detect-conflicts](#71-claude-code-detect-conflicts)
   - 7.2 [Kiro: Detect Conflicts workflow](#72-kiro-detect-conflicts-workflow)
8. [The knowledge/ Directory Layout](#8-the-knowledge-directory-layout)
9. [Team Workflow — Day-to-Day Usage](#9-team-workflow--day-to-day-usage)
10. [Stack-Specific Examples](#10-stack-specific-examples)
11. [Pre-commit Guard & Bypass (v19.1)](#11-pre-commit-guard--bypass-v191)

---

## 1. What the Knowledge Hub Is

The Knowledge Hub is a persistent, git-committed intelligence layer that sits between your codebase and your AI agent. It solves a specific problem: **AI agents have no memory across sessions**. Every `/fix` or `/new-feature` starts from zero — the agent re-reads the same files, re-infers the same patterns, and sometimes draws different conclusions.

The Knowledge Hub breaks that reset cycle:

```
Developer runs /tech-knowledge
    → AI reads codebase, writes knowledge/tech-auth.md
        → knowledge/ committed to git
            → Every future /fix or /new-feature reads knowledge/ first
                → Developer approves /new-feature Gate 1
                    → AI writes [CONFIRMED] entries silently to knowledge/product-auth.md
                        → /audit checks if knowledge still matches code
                            → /detect-conflicts surfaces contradictions across features
```

**What it is not:** This is not a documentation system. You are not writing docs. The AI extracts, you verify, git tracks history. Knowledge grows as a byproduct of normal work.

---

## 2. The Confidence Model

Every entry in every knowledge file carries one of three tags. This is the core contract.

| Tag | Meaning | Source | Trust level |
|-----|---------|--------|-------------|
| `[INFERRED]` | AI extracted from code — not human-verified | `/tech-knowledge`, `/product-knowledge` | Use as starting point. Verify against actual code. |
| `[CONFIRMED]` | Human-verified — explicitly approved | Gate 1 approval in `/new-feature` or `/edit-feature`, or manual edit | Trust fully. Never overwritten by AI. |
| `[UNKNOWN]` | Observable but not understood — requires human input | "Needs Clarification" section in extraction | Do not rely on — flag for team discussion. |

**Merge rules (enforced silently after Gate 1):**

- `[CONFIRMED]` entries are **never** overwritten by AI. Only a human can change them.
- An `[INFERRED]` entry that matches a requirement → upgraded to `[CONFIRMED]`.
- An `[INFERRED]` entry that requirements don't address → left unchanged.
- New entries from requirements not in the file → appended as `[CONFIRMED]`.

**Drift detection adds two more states** (Phase 4, reported in `/audit` only — not written to files):

| State | Meaning | Action |
|-------|---------|--------|
| `[STALE]` | Code contradicts the entry — the thing changed or was removed | Re-run `/tech-knowledge` or `/product-knowledge` |
| `[UNVERIFIABLE]` | No code found to verify the entry — may be deleted or moved | Human review required |

---

## 3. Phase 1 — Extract Knowledge On Demand

These are the write 
mands. You run them once to bootstrap knowledge for a feature or the whole project. Output is a markdown file in `knowledge/` — committed to git.

### 3.1 Claude Code: `/tech-knowledge`

**When:** After project setup, before a sprint, or when onboarding a new team member.

**What it does:** Reads the codebase and writes `knowledge/tech-[scope].md` — the HOW file. Layers, patterns, conventions, file inventory.

**Usage:**

```
/tech-knowledge                 → knowledge/tech-overview.md  (whole project)
/tech-knowledge auth            → knowledge/tech-auth.md
/tech-knowledge payments        → knowledge/tech-payments.md
/tech-knowledge state           → knowledge/tech-state.md
/tech-knowledge user auth       → knowledge/tech-user-auth.md  (slugified)
```

**Example session (React project, `/tech-knowledge auth`):**

```
You: /tech-knowledge auth

Claude: [reads src/features/auth/, src/hooks/useAuth.ts, src/api/auth.ts, src/store/authSlice.ts]

━━━ TECH KNOWLEDGE WRITTEN ━━━

  File: knowledge/tech-auth.md
  Scope: auth
  Layers mapped: 4
  Files inventoried: 7
  Unknowns flagged: 2

  All entries are [INFERRED]. Review and promote to [CONFIRMED] as needed.
  "Needs Clarification" items require human input — code cannot answer them.
```

**Output file — `knowledge/tech-auth.md`:**

```markdown
# Tech Knowledge — auth | React / TypeScript

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: 2026-05-07

---

## Layer Map

UI → src/features/auth/LoginPage.tsx — login form, handles submit [INFERRED]
UI → src/features/auth/ResetPasswordPage.tsx — reset flow [INFERRED]
Hook → src/hooks/useAuth.ts — auth state + actions, wraps Redux [INFERRED]
Store → src/store/authSlice.ts — Redux slice: user, token, isAuthenticated [INFERRED]
API → src/api/auth.ts — axios calls: /login, /logout, /refresh, /reset-password [INFERRED]
Guard → src/components/PrivateRoute.tsx — redirects to /login if !isAuthenticated [INFERRED]
Types → src/types/auth.ts — User, AuthState, LoginPayload [INFERRED]

---

## Patterns in Use

| Pattern | Value | Confidence |
|---------|-------|------------|
| HTTP client | axios (src/api/auth.ts) | [INFERRED] |
| State management | Redux Toolkit (authSlice) | [INFERRED] |
| Data access | REST API | [INFERRED] |
| DI | none (direct import) | [INFERRED] |
| Naming (files) | camelCase hooks, PascalCase pages | [INFERRED] |
| Naming (classes) | N/A (functional components) | [INFERRED] |
| Error handling | try/catch in API layer, toast notifications | [INFERRED] |

---

## File Inventory

| File | Layer | Lines | Notes |
|------|-------|-------|-------|
| src/features/auth/LoginPage.tsx | UI | 87 | Calls useAuth().login |
| src/features/auth/ResetPasswordPage.tsx | UI | 64 | Two-step: email then OTP |
| src/hooks/useAuth.ts | Hook | 42 | Dispatches to authSlice |
| src/store/authSlice.ts | Store | 95 | Stores token in localStorage |
| src/api/auth.ts | API | 56 | Axios with interceptor for token refresh |
| src/components/PrivateRoute.tsx | Guard | 22 | Checks isAuthenticated |
| src/types/auth.ts | Types | 18 | User, AuthState, LoginPayload |

---

## Conventions

- Auth-related hooks named useAuth* [INFERRED]
- Feature components co-located in src/features/[feature]/ [INFERRED]
- API functions exported from src/api/[domain].ts [INFERRED]
- Guard components in src/components/ not in features/ [INFERRED]

---

## Needs Clarification

- Token stored in localStorage — is this intentional given XSS risk? [UNKNOWN]
- OTP expiry time is hardcoded to 300s — business requirement or default? [UNKNOWN]
```

---

### 3.2 Claude Code: `/product-knowledge`

**When:** After `/tech-knowledge` for the same scope, or independently when you want to document WHAT, not HOW.

**What it does:** Reads the codebase and writes `knowledge/product-[scope].md` — the WHAT file. User flows, domain objects, permissions, business states.

**Usage:**

```
/product-knowledge              → knowledge/product-overview.md
/product-knowledge auth         → knowledge/product-auth.md
/product-knowledge payments     → knowledge/product-payments.md
```

**Example session (NestJS project, `/product-knowledge payments`):**

```
You: /product-knowledge payments

Claude: [reads src/payments/payments.controller.ts, src/payments/payments.service.ts,
         src/payments/entities/payment.entity.ts, src/payments/dto/*.ts,
         src/payments/guards/PaymentOwnerGuard.ts]

━━━ PRODUCT KNOWLEDGE WRITTEN ━━━

  File: knowledge/product-payments.md
  Scope: payments
  User flows documented: 3
  Domain objects documented: 2
  Business states documented: 1
  Unknowns flagged: 3

  All entries are [INFERRED]. Review and promote to [CONFIRMED] as needed.
  "Needs Clarification" items are WHY questions — only humans can answer them.
```

**Output file — `knowledge/product-payments.md`:**

```markdown
# Product Knowledge — payments | Node.js / NestJS

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: 2026-05-07

---

## User Flows

### Create Payment [INFERRED]
1. POST /payments with PaymentCreateDto
2. Service validates merchant ID exists
3. Stripe charge created via StripeService
4. Payment entity saved with status PENDING
5. Webhook from Stripe updates status to COMPLETED or FAILED
Entry point: `src/payments/payments.controller.ts:createPayment`

### Refund Payment [INFERRED]
1. POST /payments/:id/refund (owner or admin only)
2. Guard: PaymentOwnerGuard checks payment.userId === request.user.id
3. Stripe refund initiated
4. Payment status set to REFUNDED
Entry point: `src/payments/payments.controller.ts:refundPayment`

### List Payments [INFERRED]
1. GET /payments — returns paginated list
2. Filtered by userId from JWT
3. Admin can pass ?userId= to view any user's payments
Entry point: `src/payments/payments.controller.ts:findAll`

---

## Domain Objects

### Payment [INFERRED]
- **Fields:** id, userId, merchantId, amount, currency, status, stripeChargeId, createdAt, refundedAt
- **Business meaning:** A single charge from a user to a merchant
- **Relationships:** belongs to User, belongs to Merchant
- **Source:** `src/payments/entities/payment.entity.ts`

### PaymentCreateDto [INFERRED]
- **Fields:** merchantId (required), amount (required, min 50), currency (enum: USD/EUR/GBP), metadata (optional)
- **Business meaning:** Input validation for payment creation
- **Source:** `src/payments/dto/create-payment.dto.ts`

---

## Permissions & Roles

| Role | Can do | Cannot do | Source | Confidence |
|------|--------|-----------|--------|------------|
| user | Create payment, list own payments, refund own payments | View other users' payments | `PaymentOwnerGuard` | [INFERRED] |
| admin | All of the above + view any user's payments | N/A | `@Roles('admin')` decorator | [INFERRED] |

---

## Business States

### PaymentStatus [INFERRED]
- States: PENDING, COMPLETED, FAILED, REFUNDED
- Transitions: PENDING → COMPLETED (Stripe webhook), PENDING → FAILED (Stripe webhook), COMPLETED → REFUNDED (refund endpoint)
- Source: `src/payments/entities/payment.entity.ts`

---

## Needs Clarification

- Minimum payment amount is 50 (cents?) — is this a business rule or Stripe minimum? [UNKNOWN]
- REFUNDED payments can apparently be refunded again — is this intentional? [UNKNOWN]
- currency enum only has USD/EUR/GBP but Stripe supports more — intentional restriction? [UNKNOWN]
```

---

### 3.3 Claude Code: `/knowledge` (read-only viewer)

**When:** Any developer wants to see what knowledge already exists, without re-scanning code.

**What it does:** Reads and displays committed `knowledge/*.md` files. **Zero writes. Zero code scanning.** Available to everyone on the team — even developers who don't have permission to run `/tech-knowledge` or `/product-knowledge`.

**Usage:**

```
/knowledge              → list all knowledge files, then show overview files
/knowledge auth         → show knowledge/tech-auth.md + knowledge/product-auth.md
/knowledge tech         → show all knowledge/tech-*.md files
/knowledge product      → show all knowledge/product-*.md files
/knowledge all          → show every file in knowledge/
```

**Example session:**

```
You: /knowledge auth

Claude: ━━━ knowledge/tech-auth.md ━━━

  [contents shown verbatim]

  ━━━ knowledge/product-auth.md ━━━

  [contents shown verbatim]

  ━━━ CONTEXT LOADED ━━━
    Files shown: 2 (tech-auth.md, product-auth.md)
    [CONFIRMED] entries are human-verified. [INFERRED] entries are AI-extracted — verify before relying on them.
    Stale? Team lead re-runs /tech-knowledge or /product-knowledge when code changes significantly.
```

**When `knowledge/` doesn't exist:**

```
━━━ NO KNOWLEDGE BASE FOUND ━━━

  The knowledge/ directory does not exist in this project.

  Team lead: run /tech-knowledge and /product-knowledge, then commit and push.
  Developer: ask your team lead to generate and push knowledge files.
```

---

### 3.4 Kiro: Tech Knowledge Workflow

In Kiro, the same extraction runs as a **userTriggered workflow hook**. You trigger it from Kiro's workflow panel, not the terminal.

**Hook file:** `.kiro/hooks/workflow-tech-knowledge.kiro.hook`

**How it works differently from Claude Code:**
- Kiro asks for scope in STEP 0 (interactive) — Claude Code reads scope from `$ARGUMENTS` directly.
- The hook runs as an `askAgent` action — Kiro spins up an agent session to execute it.
- Output file is identical: `knowledge/tech-[slug].md`.

**Example Kiro session:**

```
[User triggers "Tech Knowledge" workflow in Kiro]

Kiro: What scope should I map?
  — Leave empty for a whole-project overview
  — Name a feature (e.g. 'auth', 'payments')
  — Name a layer (e.g. 'services', 'data')
  — Name a pattern (e.g. 'state', 'error handling')

User: auth

Kiro: [reads codebase, writes knowledge/tech-auth.md]

  File: knowledge/tech-auth.md
  Layers mapped: 4
  Files inventoried: 7
  Unknowns flagged: 2
  All entries [INFERRED] — review and promote to [CONFIRMED] as needed.
```

**Hook JSON structure:**

```json
{
  "name": "Tech Knowledge",
  "version": "17.2.0",
  "description": "Extract technical knowledge from codebase — patterns, layers, conventions",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "TECH KNOWLEDGE — Extract technical knowledge for React / TypeScript.\n..."
  }
}
```

---

### 3.5 Kiro: Product Knowledge Workflow

Identical pattern to Tech Knowledge. Hook: `.kiro/hooks/workflow-product-knowledge.kiro.hook`.

STEP 0 asks: *"What product area should I document?"*

Output: `knowledge/product-[slug].md` — same structure as Claude Code output.

---

## 4. Phase 2 — Context Builder

**What:** Before acting on any `/new-feature`, `/edit-feature`, `/fix`, `/explore`, `/refactor`, or `/assess` command, the AI **automatically** reads the relevant knowledge file.

**You do nothing.** The preamble is injected into every command. It runs silently.

**The reading priority order:**

```
1. knowledge/tech-[slug].md       — HOW this area is built
2. knowledge/product-[slug].md    — WHAT this area does
3. knowledge/tech-overview.md     — fallback if no slug match
4. knowledge/product-overview.md  — fallback if no slug match
```

Slug is derived from `$ARGUMENTS`. `/fix auth login redirect` → slug `auth-login-redirect`.
If no match: skip silently. No error. The command proceeds as normal.

**Claude Code — injected preamble (visible in .claude/commands/*.md):**

```markdown
## KNOWLEDGE CONTEXT — Read Before Acting

If `knowledge/` exists at the project root:

1. Derive a slug from `$ARGUMENTS`: lowercase, spaces → hyphens, empty → `overview`
2. Read in this priority order — skip files that don't exist:
   - `knowledge/tech-[slug].md` — HOW this area is built
   - `knowledge/product-[slug].md` — WHAT this area does
   - `knowledge/tech-overview.md` — fallback if no slug match
   - `knowledge/product-overview.md` — fallback if no slug match
3. If `knowledge/` is absent or no files match: skip silently. Proceed as normal.

**Using knowledge:**
- `[CONFIRMED]` entries — human-verified. Trust them.
- `[INFERRED]` entries — AI-extracted. Use as starting point; verify against actual code.
- If code contradicts an `[INFERRED]` entry, note the discrepancy in your response.

Do not edit the knowledge file — drift detection is a separate concern.
```

**Kiro — equivalent preamble (inside workflow hook prompt strings):**

```
## KNOWLEDGE CONTEXT — Read Before Acting

After getting scope from the user, check knowledge/:
- Slug: lowercase scope, spaces → hyphens. Empty → "overview".
- Read if they exist: knowledge/tech-[slug].md, knowledge/product-[slug].md
- Fallbacks: knowledge/tech-overview.md, knowledge/product-overview.md
- [CONFIRMED]: trust. [INFERRED]: use as starting point, verify against code.
- If knowledge/ doesn't exist: skip silently, proceed with workflow.
```

**Commands affected:**

| Command | Claude Code | Kiro |
|---------|-------------|------|
| `/new-feature` | ✓ | ✓ `workflow-new-feature` |
| `/edit-feature` | ✓ | ✓ `workflow-edit-feature` |
| `/fix` | ✓ | ✓ `workflow-fix` |
| `/explore` | ✓ | ✓ `workflow-explore` |
| `/refactor` | ✓ | ✓ `workflow-refactor` |
| `/assess` | ✓ | — (no Kiro equivalent) |

---

## 5. Phase 3 — Silent Capture

**What:** When a developer approves Gate 1 in `/new-feature` or `/edit-feature` (or finishes a `/fix` / `/hotfix`), the AI **automatically** extracts product knowledge and writes entries to `knowledge/product-[slug].md` — with no developer action required.

| Source command | Confidence | Trigger |
|---|---|---|
| `/new-feature` | `[CONFIRMED]` | Gate 1 approval |
| `/edit-feature` | `[CONFIRMED]` (only on `<!-- NEW -->` / `<!-- CHANGED -->` items) | Gate 1 approval |
| `/fix`, `/hotfix` | `[INFERRED]` | After fix applied — only when the fix has business meaning |

**Gate 1** is the requirements review gate: the AI presents requirements, the developer says `ok` / `approved` / `yes` / `lgtm` / `proceed`.

**The only output from the AI after capture:**

```
↳ Knowledge captured: knowledge/product-payments.md (3 entries added, 1 upgraded)
```

Or if nothing extractable:

```
↳ Knowledge capture: no extractable entries in requirements.
```

Then the command proceeds directly to Gate 2 (spec review).

**Claude Code example — `/new-feature` silent capture:**

```
You: /new-feature add refund flow to payments

Claude: [reads codebase + knowledge/product-payments.md]

## Requirements

**Overview:** Add the ability for users to request refunds on completed payments
within 30 days of purchase. Refunds are subject to merchant approval.

**Acceptance Criteria:**
- User can request refund on any COMPLETED payment
- Refund request sets payment status to REFUND_REQUESTED
- Merchant receives notification (email) of refund request
- Merchant can approve or reject within 7 days
- If merchant approves: status → REFUNDED, Stripe refund initiated
- If merchant rejects or no response in 7 days: status → REFUND_REJECTED

...

[GATE 1] Do these requirements match your intent? (ok / edit)

You: ok

↳ Knowledge captured: knowledge/product-payments.md (2 entries added, 1 upgraded)

## Spec
...
```

**What was captured:**

```markdown
## Business States

### PaymentStatus [CONFIRMED]
- States: PENDING, COMPLETED, FAILED, REFUNDED, REFUND_REQUESTED, REFUND_REJECTED
- Transitions: COMPLETED → REFUND_REQUESTED (user request), REFUND_REQUESTED → REFUNDED (merchant approval),
  REFUND_REQUESTED → REFUND_REJECTED (merchant rejection or 7-day timeout)
- Source: Gate 1 approved requirements, 2026-05-07

## User Flows

### Request Refund [CONFIRMED]
1. User requests refund on a COMPLETED payment (within 30 days)
2. Payment status set to REFUND_REQUESTED
3. Merchant notified by email
4. Merchant approves or rejects within 7 days
5. On approval: REFUNDED + Stripe refund. On rejection/timeout: REFUND_REJECTED
```

Note the upgrades: `REFUNDED` was `[INFERRED]`. After Gate 1 approval confirming it, it becomes `[CONFIRMED]` — and two new states (`REFUND_REQUESTED`, `REFUND_REJECTED`) are added.

**`/edit-feature` difference:** Only extracts from lines marked `<!-- NEW -->` or `<!-- CHANGED: ... -->` in the diff view — does not re-capture existing unchanged requirements.

**`/fix` and `/hotfix` — DO-NOT-CAPTURE blocklist (v19.1):** Bug fixes do not always reveal business rules. The default after a fix is **"no business rules extracted."** Capture only happens when the root cause is a misunderstood requirement, an unenforced business constraint, or a missing role/permission check.

Explicit blocklist — never capture from these fix types:

- null/undefined check, off-by-one, typo, missing await, type coercion
- wrong import path, wrong constant value with no business meaning
- test-only change, log/format change, lint cleanup
- dependency upgrade, config tweak, build fix
- race condition fix with no domain-level implication

When a fix matches the blocklist, the AI outputs:

```
↳ Knowledge capture: fix was technical — no business rules extracted.
```

When a fix is captured (e.g. it enforced a missing role check), entries are tagged `[INFERRED]` with source `bug fix · /fix · [date]` and appended under a `## Business Rules` section.

**Kiro difference:** Same logic runs inside `workflow-new-feature.kiro.hook` and `workflow-edit-feature.kiro.hook` at the equivalent Gate 1 position.

---

## 6. Phase 4 — Drift Detection

**What:** `/audit` (and Kiro `workflow-audit`) includes a knowledge health check. It reads every entry in every knowledge file, finds the corresponding code, and classifies each entry as Current / [STALE] / [UNVERIFIABLE].

**This is read-only.** The audit does not modify knowledge files. It reports what is wrong.

**Mechanical drift check (v19.1):** In addition to entry-level classification, the audit now extracts the `Generated: ... (git: [OLD_HASH])` line from each knowledge file and runs:

```
git diff --stat OLD_HASH..HEAD -- [paths covered by this knowledge file]
```

If > 10 files changed OR > 200 lines added/removed in covered paths → the file is flagged as **"significant drift likely — [N] files changed, [N] lines delta since last generation."**

This replaces the prior fuzzy "many commits have passed" judgment with a concrete number. The same mechanical check now runs on every `/tech-knowledge` and `/product-knowledge` re-execution.

**Example audit output section:**

```
━━━ KNOWLEDGE HEALTH ━━━

  Files checked:    3
  Entries checked:  24

  ✓ Current:        21
  ⚠ Stale:          2
  ? Unverifiable:   1

  Stale entries (require action):
    knowledge/tech-auth.md → "Token stored in localStorage" [INFERRED]
      — code now uses httpOnly cookies (src/api/auth.ts:setTokenCookie)
    knowledge/product-payments.md → "PaymentStatus: PENDING, COMPLETED, FAILED, REFUNDED" [CONFIRMED]
      — REFUND_REQUESTED and REFUND_REJECTED missing from list

  Unverifiable entries (require human review):
    knowledge/tech-auth.md → "OTP expiry hardcoded to 300s" [UNKNOWN]
      — no code found at previously referenced location

  Recommended action:
    Run /tech-knowledge or /product-knowledge to regenerate stale files from current code.
    Or manually update the knowledge file and promote accurate entries to [CONFIRMED].
```

**When there is nothing to fix:**

```
━━━ KNOWLEDGE HEALTH ━━━

  Files checked: 3 · Entries checked: 24
  ✓ All 24 knowledge entries verified against current code.
```

**When knowledge/ doesn't exist yet:**

```
━━━ KNOWLEDGE HEALTH ━━━

  No knowledge/ directory found — skipping health check.
  Run /tech-knowledge or /product-knowledge to initialize.
```

**Responding to stale entries:**

| Action | When | How |
|--------|------|-----|
| Re-run `/tech-knowledge auth` | Stale `[INFERRED]` entries — code changed and re-generation will pick it up | Overwrites the whole file |
| Manually edit + promote | Stale `[CONFIRMED]` entries — human verification needed | Edit the file, change tag, commit |
| Re-run `/product-knowledge auth` | Stale product knowledge | Overwrites the whole file |

---

## 7. Phase 5 — Conflict Detection

**What:** Reads all `knowledge/product-*.md` files and surfaces contradicting business rules across features. Writes a decision inbox to `knowledge/conflicts/`. This is a team lead tool — the output is a set of decisions that need to be made.

### 7.1 Claude Code: `/detect-conflicts`

**Usage:**

```
/detect-conflicts                    → compare all knowledge/product-*.md files
/detect-conflicts auth payments      → compare only auth and payments
```

**Example — conflict between auth and payments:**

```
You: /detect-conflicts auth payments

Claude: [reads knowledge/product-auth.md, knowledge/product-payments.md]

━━━ CONFLICT DETECTION COMPLETE ━━━

  Files compared:    2
  Pairs checked:     1
  Conflicts found:   2
  Already resolved:  0 (skipped)

  Files written:     1
  knowledge/conflicts/auth-vs-payments.md

  Action required: Review knowledge/conflicts/ and resolve each open conflict.
  Conflicts marked [x] Resolved will not be re-raised on next run.
```

**Output — `knowledge/conflicts/auth-vs-payments.md`:**

```markdown
# Conflict Report: auth vs payments

> Team lead decision inbox. Mark each conflict resolved once a decision is made.
> Do not add secrets, PII, or credentials.

---

## Permission Conflict — Guest user access to payments

**auth** (`knowledge/product-auth.md`):
> "Guest users can browse product catalog and add to cart without login [CONFIRMED]"

**payments** (`knowledge/product-payments.md`):
> "All payment endpoints require authenticated user (JWT required) [INFERRED]"

**Why this conflicts:** Auth allows guest users, but payments requires login — a guest cannot complete checkout.
**Decision needed:** Should guest checkout be supported, or should cart require login before proceeding to payment?

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — [decision made] -->

---

## Business State Conflict — Order status enum

**auth** (`knowledge/product-auth.md`):
> "User account can be in states: ACTIVE, SUSPENDED, PENDING_VERIFICATION [CONFIRMED]"

**payments** (`knowledge/product-payments.md`):
> "Payment requires verified user (VERIFIED status) [INFERRED]"

**Why this conflicts:** Auth defines no VERIFIED state, but payments depends on one.
**Decision needed:** Is VERIFIED a separate account state, or is PENDING_VERIFICATION → ACTIVE the verification step?

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — Payment uses ACTIVE to mean verified. PENDING_VERIFICATION is pre-activation only. -->
```

**Resolving conflicts:** Edit the file and change `[ ] Unresolved` to `[x] Resolved — [decision]`. On the next run, resolved entries are skipped.

**Four conflict types detected:**

| Type | Example |
|------|---------|
| **Permission** | Same role, contradicting access to same resource |
| **Domain object** | Same entity, contradicting fields or business meaning |
| **Business state** | Same enum, different values or transitions |
| **Flow assumption** | Flow A assumes precondition that Flow B contradicts |

**Conservative threshold:** Only clear contradictions are flagged. Two files describing different aspects of the same entity is NOT a conflict. Different detail levels are NOT conflicts.

### 7.2 Kiro: Detect Conflicts Workflow

Hook: `.kiro/hooks/workflow-detect-conflicts.kiro.hook`

**How it differs from Claude Code:**
- STEP 0 asks for scope interactively: *"Which features should I compare?"*
- Leave empty → compare all. Name two or more → compare those.
- Single feature → error: "Conflict detection requires at least two features."

**Hook JSON structure:**

```json
{
  "name": "Detect Conflicts",
  "version": "17.2.0",
  "description": "Cross-feature conflict detection — surfaces contradicting business rules across knowledge files",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "DETECT CONFLICTS — Cross-feature conflict detection for React / TypeScript.\n..."
  }
}
```

---

## 8. The `knowledge/` Directory Layout

```
knowledge/
├── tech-overview.md          ← whole-project tech extraction
├── tech-auth.md              ← auth feature tech extraction
├── tech-payments.md          ← payments feature tech extraction
├── tech-auth.html            ← (optional) HTML export — gitignored
├── product-overview.md       ← whole-product extraction
├── product-auth.md           ← auth feature product extraction
├── product-payments.md       ← payments feature product extraction
└── conflicts/
    ├── auth-vs-payments.md   ← conflict report (alphabetical slug order)
    └── auth-vs-onboarding.md
```

**Rules:**
- `knowledge/` lives at the project root — not inside `.claude/` or `.kiro/`
- Committed to git — knowledge is part of the codebase, not ephemeral AI context
- No secrets, PII, or credentials — ever
- `conflicts/` subdirectory is created automatically by `/detect-conflicts`
- Tech and product files are overwritten on re-run (Phase 1). Conflict files are appended (Phase 5).

**git config (v19.0, written automatically by `npx ai-gov init`):**

```gitignore
# .gitignore
knowledge/*.html
```

```gitattributes
# .gitattributes
knowledge/*.md merge=union
```

`merge=union` means parallel additions from different branches are both kept on merge — no conflicts. HTML exports are local sharing artifacts only and are gitignored.

---

## 9. Team Workflow — Day-to-Day Usage

**Project bootstrap (team lead, once):**

```bash
# After ai-gov init
/tech-knowledge          # maps whole project → knowledge/tech-overview.md
/product-knowledge       # maps whole product → knowledge/product-overview.md

# Per major feature area
/tech-knowledge auth
/product-knowledge auth
/tech-knowledge payments
/product-knowledge payments

# Commit
git add knowledge/
git commit -m "chore: bootstrap Knowledge Hub"
```

**During a sprint (developer, recurring):**

```bash
# Knowledge is read automatically by /new-feature, /fix, /explore, etc.
# No action needed for Phase 2 to work.

# After Gate 1 approval in /new-feature or /edit-feature:
# ↳ Knowledge captured: knowledge/product-payments.md (2 entries added)
# This happens silently — no developer action needed.

# To browse existing knowledge without re-scanning code:
/knowledge auth
/knowledge product
/knowledge all
```

**Resolving stale `[CONFIRMED]` entries (team lead):**

```bash
# Discovered by /audit knowledge health, or surfaced during regeneration.
# Step 1: re-run extraction to refresh the file with current code
/tech-knowledge auth

# Step 2: the regenerated file will retain the stale [CONFIRMED] under "Drift Detected"
# Step 3: edit the file — remove the now-incorrect [CONFIRMED] line manually
# Step 4: commit with the bypass (the guard would otherwise block the removal)
AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m "chore(auth): regenerate after token-storage refactor"
```

**Weekly audit (team lead):**

```bash
/audit
# Includes ━━━ KNOWLEDGE HEALTH ━━━ section automatically
# If stale entries found: re-run extraction for those files
```

**After multiple features shipped (team lead, recurring):**

```bash
/detect-conflicts
# Generates knowledge/conflicts/ decision inbox
# Review, add decisions, commit the file
```

**When a developer changes a domain object:**

```bash
# 1. Code change committed
# 2. Next /audit will catch the stale entry
# 3. Re-run /tech-knowledge [scope] or /product-knowledge [scope]
# 4. [CONFIRMED] entries for that scope may need manual review
```

---

## 10. Stack-Specific Examples

### Angular

`/product-knowledge permissions` will:
- Read `services/`, `guards/`, `interceptors/`
- Derive permissions from `CanActivate` guards and `HttpInterceptor` role checks
- Map roles from service method signatures and `@angular/core` injection tokens

### React / TypeScript

`/product-knowledge auth` will:
- Read `hooks/`, `store/` or `context/`, `api/`
- Derive user flows from route definitions + page component names
- Derive permissions from route guards, auth hooks (`useAuth`, `usePermission`)
- Map domain objects from TypeScript interfaces and API response types

### Flutter

`/product-knowledge onboarding` will:
- Read Cubits/BLoCs (state + events), route guards, navigation config
- Derive flows from `GoRouter` or `NavigationStack` config + screen names
- Map roles from BLoC role checks, entity validators
- Domain objects from `freezed` models, entity classes

### Kotlin / Android

`/product-knowledge checkout` will:
- Read UseCases, ViewModels, repository interfaces, navigation graph, Hilt modules
- Derive flows from navigation graph + Fragment/Screen names
- Map permissions from use case preconditions, auth interceptors
- Domain objects from domain model classes, sealed classes

### Python / FastAPI

`/tech-knowledge api` will:
- Read `FastAPI` dependencies, service functions, middleware
- Map layers: router → service → repository → model
- Detect `Depends()` chains for DI pattern
- Domain objects from Pydantic schemas, SQLAlchemy models

### Java / Spring Boot

`/product-knowledge users` will:
- Read `@RestController` endpoints, `@Service` classes, `@PreAuthorize` annotations, `@Entity`
- Derive flows from controller endpoints + service method chains
- Map permissions from Spring Security config, `@PreAuthorize`, role enums
- Domain objects from `@Entity` classes, DTOs, enums

### Node.js / NestJS

`/product-knowledge payments` will:
- Read controllers, services, guards, interceptors, DTOs
- Derive flows from controller endpoints + service orchestration
- Map permissions from guards, `@Roles()`, `@UseGuards()` decorators
- Domain objects from entities, DTOs, enums

### Node.js (Express/Fastify/Hapi)

`/product-knowledge auth` will:
- Read route handlers, middleware, services, validators, ORM models
- Derive flows from route definitions + middleware chains
- Map permissions from auth middleware, role checks
- Domain objects from ORM models (Prisma, Mongoose, TypeORM), validation schemas

---

## Agent Comparison: Claude Code vs Kiro

| Aspect | Claude Code | Kiro |
|--------|-------------|------|
| **Trigger** | `/tech-knowledge [scope]` in terminal | "Tech Knowledge" workflow in Kiro panel |
| **Scope input** | From `$ARGUMENTS` directly | STEP 0 interactive question |
| **Output format** | Same `knowledge/*.md` files | Same `knowledge/*.md` files |
| **Preamble injection** | In `.claude/commands/*.md` | In workflow hook `then.prompt` |
| **Silent capture** | After Gate 1 in `/new-feature` | After Gate 1 in `workflow-new-feature` |
| **Conflict detection** | `/detect-conflicts [scope]` | "Detect Conflicts" workflow |
| **Hook file** | Not applicable (slash commands) | `.kiro/hooks/workflow-*.kiro.hook` |
| **Session type** | Inline in current Claude session | New `askAgent` session per workflow |

**The key difference:** Claude Code slash commands run in your current session — you see the AI's reasoning inline. Kiro workflow hooks spin up a fresh `askAgent` session — the prompt is fully self-contained, which is why Kiro hooks include `> This is a new session — you have no conversation history.` at the top.

Both agents produce identical output files. If your team uses both (e.g. Kiro for development, Claude Code for reviews), the `knowledge/` directory is shared — there is no duplication or conflict between the two.

---

## 11. Pre-commit Guard & Bypass (v19.1)

`[CONFIRMED]` entries are human-verified. A pre-commit hook now blocks any commit that **removes** a `[CONFIRMED]` line from a `knowledge/*.md` file.

**Why it blocks:**

```
  ⛔ Knowledge guard: 1 [CONFIRMED] entry/entries removed
    ✗ knowledge/product-auth.md: removed — - Users must verify email before login [CONFIRMED]

  [CONFIRMED] entries are human-verified — removal requires explicit override.
  To bypass: AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m 'your message'
```

**What is allowed without bypass:**

- Adding new `[CONFIRMED]` entries
- Modifying `[INFERRED]` entries (any direction)
- Adding new knowledge files (no `HEAD` version yet)
- Adding new sections, lines, anything that does not remove an existing `[CONFIRMED]` line

**When to bypass:**

Legitimate reasons to remove a `[CONFIRMED]` line:

- Regeneration via `/tech-knowledge` or `/product-knowledge` resolved drift and the `[CONFIRMED]` claim is now wrong
- Schema change made the entry obsolete (e.g. a field was removed from the domain object)
- Team decided to retire a feature

**How to bypass:**

```bash
AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m "refactor(auth): regenerate after schema change"
```

The env var also accepts `true`, `TRUE`, or `True`. Any other value (or absence) means the guard runs normally.

> ⚠ The pre-commit hook runs **before** git writes the commit message, so a `Knowledge-override:` trailer cannot work. The env-var bypass is the only reliable mechanism at pre-commit time.

**Why an env var and not `--no-verify`:**

- `git commit --no-verify` disables **all** governance checks (secrets, file size, architecture, knowledge guard).
- `AI_GOV_KNOWLEDGE_OVERRIDE=1` disables **only** the knowledge guard — every other governance check still runs.

Prefer the targeted bypass.

---

## 12. Configuration Reference

| File | Purpose | Where |
|---|---|---|
| `.gitattributes` | `knowledge/*.md merge=union` | Project root |
| `.gitignore` | `knowledge/*.html` (local HTML exports) | Project root |
| `.claude/git-hooks/checks/knowledge-confirmed.sh` | The pre-commit guard | Generated by `ai-gov init --git-hooks` |
| `.claude/git-hooks/config.json` | Per-check enable/disable | Set `"pre-commit"."knowledge-confirmed".enabled = false` to disable the guard team-wide |
| `AI_GOV_KNOWLEDGE_OVERRIDE` | Env var bypass for the guard | Per-commit, by the developer |
