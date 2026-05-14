# Developer Commands Guide

**Audience:** Developers · Daily use reference
**Date:** 2026-05-14 · **CLI version:** 18.0.0

---

## Table of Contents

1. [Claude Code — Built-in Commands](#1-claude-code--built-in-commands)
   - 1.1 [Daily Development](#11-daily-development)
   - 1.2 [Code Review & Analysis](#12-code-review--analysis)
   - 1.3 [Planning & Workflow](#13-planning--workflow)
   - 1.4 [Session & Context](#14-session--context)
   - 1.5 [Memory & Docs](#15-memory--docs)
   - 1.6 [Diagnostics](#16-diagnostics)
   - 1.7 [Governance Commands](#17-governance-commands)
2. [Graphify Commands](#2-graphify-commands) *(optional — separate tool)*
   - 2.1 [Build the Graph](#21-build-the-graph)
   - 2.2 [Query the Graph](#22-query-the-graph)
   - 2.3 [Navigate the Graph](#23-navigate-the-graph)
   - 2.4 [Maintain the Graph](#24-maintain-the-graph)
3. [Stack-Specific Examples](#3-stack-specific-examples)
   - Flutter
   - Node.js / Next.js
   - Python
   - React / Next.js
   - Kotlin
   - Angular
4. [Daily Workflow Cheatsheet](#4-daily-workflow-cheatsheet)

---

## 1. Claude Code — Built-in Commands

> Type `/` in Claude Code CLI to see all available commands.
> Type `/` + letters to filter.

---

### 1.1 Daily Development

| Command | What it does | When to use |
|---|---|---|
| `/init` | Creates a `CLAUDE.md` in your project | First time setting up a project |
| `/plan [description]` | Enters plan mode — Claude drafts a plan before touching any code | Before any new feature or refactor |
| `/review` | Reviews a pull request in the current session | Before merging a PR |
| `/security-review` | Scans pending git diff for security issues (injection, auth, data exposure) | Before committing sensitive changes |
| `/diff` | Opens interactive diff viewer for uncommitted changes | Reviewing your own work before commit |
| `/simplify` | Runs 3 parallel review agents on recently changed files — checks quality, reuse, efficiency | After completing a feature |
| `/copy` | Copies last Claude response to clipboard | Grabbing a code block to paste |
| `/export [filename]` | Exports the full conversation as plain text | Saving a design discussion for the team |

---

### 1.2 Code Review & Analysis

| Command | What it does | When to use |
|---|---|---|
| `/review [PR number]` | Reviews a PR locally | Quick PR review |
| `/ultrareview [PR number]` | Deep multi-agent review in cloud sandbox | Important PRs, security-sensitive changes |
| `/security-review` | Flags injection, auth flaws, data exposure in current diff | Before any auth or API change |
| `/simplify [focus]` | Reviews changed files for code quality and efficiency, fixes issues | Post-feature cleanup |
| `/diff` | Interactive diff viewer with per-turn history | Understanding what changed in a session |

---

### 1.3 Planning & Workflow

| Command | What it does | When to use |
|---|---|---|
| `/plan [description]` | Drafts a plan first — Claude does not write code until plan approved | Start of every feature |
| `/ultraplan <prompt>` | Drafts plan in browser, execute remotely or send back to terminal | Large cross-cutting features |
| `/batch <instruction>` | Orchestrates large changes across 5–30 parallel agents in git worktrees | Big refactors, multi-file migrations |
| `/schedule` | Create recurring routines (e.g. daily lint check, weekly dependency audit) | Automating repetitive tasks |
| `/loop [interval] [prompt]` | Runs a prompt on a recurring interval | Polling CI, watching a deploy |

---

### 1.4 Session & Context

| Command | What it does | When to use |
|---|---|---|
| `/clear` | Starts a fresh conversation | Switching to an unrelated task |
| `/compact [instructions]` | Summarises conversation to free up context | Long sessions getting expensive |
| `/resume [session]` | Resumes a previous conversation by ID or picker | Continuing yesterday's work |
| `/branch` | Creates a conversation branch at current point | Exploring an alternative approach without losing current thread |
| `/rewind` | Rewinds to a previous point in conversation | Claude went off-track — step back |
| `/context` | Visualises context usage as a coloured grid | Checking if you're near the context limit |
| `/cost` | Shows token usage for this session | Monitoring AI spend |
| `/btw <question>` | Asks a side question without polluting the main conversation | Quick clarification mid-task |

---

### 1.5 Memory & Docs

| Command | What it does | When to use |
|---|---|---|
| `/memory` | Edits CLAUDE.md memory files, enables auto-memory | Adding persistent project rules |
| `/init` | Initialises project with a CLAUDE.md guide | New project setup |
| `/insights` | Generates a report on session patterns and friction points | Team retrospective |
| `/team-onboarding` | Generates onboarding guide from last 30 days of session history | Onboarding a new developer |
| `/recap` | Generates a one-line summary of the current session | End-of-day handoff note |

---

### 1.6 Diagnostics

| Command | What it does | When to use |
|---|---|---|
| `/doctor` | Diagnoses Claude Code installation — press `f` to auto-fix | Something not working |
| `/status` | Shows version, model, account, connectivity | Quick health check |
| `/help` | Lists all available commands | Discovering what's available |
| `/skills` | Lists installed skills (press `t` to sort by token cost) | Checking what slash commands are registered |
| `/permissions` | Manages allow / ask / deny rules for tools | Tightening or loosening tool permissions |
| `/hooks` | Views active hook configurations | Debugging why a hook is firing or not |
| `/release-notes` | Shows changelog in an interactive version picker | After an update |

---

### 1.7 Governance Commands

> These commands are generated by `ai-gov init` and installed as slash commands in `.claude/`.
> They enforce and verify the AI governance framework for your project.

| Command | What it does | When to use |
|---|---|---|
| `/audit` | 12-step project truth check — scans governance files, reads actual code, scores 6 categories, self-heals steering | Start of sprint, after major refactor, onboarding a new developer |
| `/assess` | Evidence-based refactor vs rewrite assessment — reads actual code, scores complexity, outputs recommendation | Before proposing a large rewrite |
| `/backlog` | Generates structured backlog from latest `/assess` report — phases, milestones, priorities | After `/assess`, when planning sprints |
| `/jira` | Reads spec `tasks.md` estimates, creates Jira stories + sub-tasks via Jira MCP server | When syncing specs to Jira (requires `ai-gov mcp init` with Jira) |

#### /audit — Detail

`/audit` is a full project health check that goes beyond file existence. It reads actual source code and scores six categories:

| Category | What's Checked |
|---|---|
| **Governance** | All 8 steering files present, hook versions match current CLI, settings.json complete |
| **Architecture** | Layer violations, god files (>300 lines), widgets calling repos directly |
| **Code Patterns** | % of code using detected architecture (BLoC vs setState, functional vs class, etc.) |
| **Feature Structure** | Each feature folder has spec + README + correct layer split |
| **Test Coverage** | Scenario A (no tests) / B (partial, per-feature breakdown) / C (comprehensive, checks for hollow specs) |
| **Dead Code** | Unreachable exports, orphaned files, unused DI tokens |

**Score:** Each category 0-100, graded A/B/C/D. Overall = average.

**VERDICT:**
- `PASS` — all categories B or above
- `PASS WITH UPDATES` — steering was stale, now updated by Step 11
- `ACTION NEEDED` — code-level findings that require dev attention

**Self-healing:** In Step 11, Claude directly writes accurate content to `.claude/steering/` files. No `ai-gov init --overwrite` round-trip. Run `/audit` again after fixing findings — scorecard will improve.

```
# Run from inside a claude session:
/audit

# Safe to rerun at any time — idempotent
# After fixing findings, rerun to verify scorecard improved
```

---

## 2. Graphify Commands

> **Note:** Graphify is a separate optional tool — not included in `ai-gov`. Install separately if your team uses it.
> `/graphify` commands are typed in Claude Code CLI chat.
> `graphify` commands (no slash) are typed in the terminal.

---

### 2.1 Build the Graph

| Command | What it does |
|---|---|
| `/graphify .` | Full pipeline — extract, cluster, analyse, generate HTML + report |
| `/graphify . --update` | Re-index only new/changed files (code-only = free, no LLM) |
| `/graphify . --mode deep` | Aggressive INFERRED edge extraction — richer but more guesses |
| `/graphify . --directed` | Builds directed graph preserving edge direction (source → target) |
| `/graphify . --watch` | Auto-rebuilds on file saves (code changes = free, docs = LLM) |
| `/graphify . --no-viz` | Skips HTML output — report + JSON only (faster) |
| `/graphify . --wiki` | Builds agent-crawlable wiki (`wiki/index.md` + one article per community) |

---

### 2.2 Query the Graph

| Command | What it does |
|---|---|
| `/graphify query "your question"` | BFS traversal — broad context, nearest neighbours first |
| `/graphify query "your question" --dfs` | DFS traversal — traces a specific chain or dependency path |
| `/graphify query "your question" --budget 3000` | Caps answer at N tokens (default 2000) |
| `/graphify explain "ComponentName"` | Plain-language explanation of one node + all its connections |
| `/graphify path "ModuleA" "ModuleB"` | Shortest path between two concepts — shows every hop |

---

### 2.3 Navigate the Graph

| Command | What it does |
|---|---|
| `/graphify explain "ClassName"` | What is this, what does it connect to, why it matters |
| `/graphify path "A" "B"` | How does A reach B — step-by-step hop explanation |
| `/graphify query "..." --dfs` | Trace a specific dependency chain end-to-end |
| `open graphify-out/graph.html` | Interactive visual — zoom, filter by community, click nodes |

---

### 2.4 Maintain the Graph

| Command | What it does |
|---|---|
| `/graphify . --update` | Run after any code change to keep graph accurate |
| `/graphify . --cluster-only` | Re-run community detection without re-extracting (free) |
| `graphify . --watch` *(terminal)* | Background watcher — auto-updates on file saves |

---

## 3. Stack-Specific Examples

---

### Flutter

```
# Before starting a feature
/graphify query "does a connectivity cubit already exist?"
/graphify query "what is the error handling pattern used across features?"
/graphify explain "AppInterceptors"

# Architecture check
/graphify query "does any widget call a repository directly?"
/graphify path "LoginPage" "AuthRepository"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `flutter_bloc` — everything flows through it
- Community: `DI & Connectivity Core` — check before adding new singletons
- Gap: isolated nodes = feature files with no layer connections (skip detected)

---

### Node.js

```
# Before starting a feature
/graphify query "what middleware is already registered on the router?"
/graphify query "what error handling pattern is used across routes?"
/graphify explain "errorMiddleware"

# Dependency check
/graphify path "UserController" "Database"
/graphify query "which services call external APIs directly?"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `express app` — all routes attach here
- Community: `Auth Middleware` — check before adding any protected route
- Gap: controllers with no service layer = business logic leak

---

### Python (FastAPI)

```
# Before starting an endpoint
/graphify query "what dependencies are injected via Depends() already?"
/graphify query "what is the error response structure?"
/graphify explain "AppError"

# Layer check
/graphify path "UserRouter" "Database"
/graphify query "does any router call the database directly?"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `FastAPI app` — all routers mount here
- Community: `Auth Depends` — check before adding any secured endpoint
- Gap: routers with no service layer = logic in wrong layer

---

### React / Next.js

```
# Before building a component
/graphify query "is there already a hook for fetching user data?"
/graphify query "what is the global error boundary pattern?"
/graphify explain "useAuth"

# Data flow check
/graphify path "OrdersPage" "APIClient"
/graphify query "which components fetch data without a custom hook?"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `APIClient` — all data fetching flows through it
- Community: `Custom Hooks` — check before writing a new fetch hook
- Gap: components with direct API calls = hook layer bypassed

---

### Kotlin (Android)

```
# Before building a screen
/graphify query "is there already a ViewModel for order management?"
/graphify query "what is the sealed class pattern for UI state?"
/graphify explain "AppException"

# Architecture check
/graphify path "OrdersScreen" "OrderRepository"
/graphify query "does any ViewModel call a DataSource directly?"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `Hilt component` — all DI bindings root here
- Community: `StateFlow patterns` — check before adding new UI state
- Gap: ViewModels with DataSource imports = UseCase layer skipped

---

### Angular

```
# Before building a feature module
/graphify query "is there already a service for user authentication?"
/graphify query "what is the HTTP interceptor chain?"
/graphify explain "AuthInterceptor"

# Dependency check
/graphify path "OrderComponent" "APIService"
/graphify query "which components subscribe to observables directly?"

# After coding
/graphify . --update
```

**What to look for:**
- God node: `HttpClient` — all HTTP goes through it
- Community: `Auth Guards` — check before adding any protected route
- Gap: components with direct `HttpClient` injection = service layer bypassed

---

## 4. Daily Workflow Cheatsheet

```
START OF SPRINT / ONBOARDING
─────────────────────────────
/audit                           ← project truth check: governance + architecture
                                   + code patterns + tests + dead code — 6-category
                                   health scorecard. Self-heals steering files.

START OF DAY
────────────
/resume                          ← pick up where you left off
/graphify query "what exists     ← check before writing anything
  for [today's feature]?"

DURING DEVELOPMENT
──────────────────
/plan [feature description]      ← always plan before coding
/graphify explain "ClassName"    ← understand before touching
/graphify path "A" "B"           ← find the right seam
/diff                            ← review your own changes
/btw "quick question"            ← side question without polluting context
/context                         ← check if context is getting full
/compact                         ← free up context if needed

END OF FEATURE
──────────────
/simplify                        ← quality + efficiency review
/security-review                 ← catch issues before commit
/graphify . --update             ← keep graph current for teammates
/review [PR]                     ← review before merging
/export session-notes.txt        ← save decisions made

END OF SPRINT
─────────────
/audit                           ← rerun — scorecard should improve after fixes

END OF DAY
──────────
/recap                           ← one-line session summary
/export                          ← save conversation if needed
```

---

## Rule of Thumb

| Question | Command |
|---|---|
| Does this already exist? | `/graphify query "..."` |
| How do I plug into the codebase? | `/graphify path "A" "B"` |
| What is this component? | `/graphify explain "..."` |
| What's my plan before coding? | `/plan` |
| Is my code clean? | `/simplify` |
| Is my code secure? | `/security-review` |
| Is this project properly governed? | `/audit` |
| Is steering accurate for my project? | `/audit` (Step 11 self-heals it) |
| Am I running out of context? | `/context` then `/compact` |
| Something broken with Claude Code? | `/doctor` |

---

*Claude Code CLI only — governance hooks and slash commands do not work in the chat extension. Graphify is a separate optional tool.*
