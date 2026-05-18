# AI Governance CLI

[![pipeline status](https://vgit.techvedika.com/tvdatascience/ai-governance/ai-governance-cli/badges/main/pipeline.svg)](https://vgit.techvedika.com/tvdatascience/ai-governance/ai-governance-cli/-/commits/main)
[![npm version](https://img.shields.io/npm/v/ai-gov.svg)](https://www.npmjs.com/package/ai-gov)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)

> The scaffolding layer for AI agent team adoption. When multiple developers use Claude Code or Kiro on the same codebase without shared rules, you get inconsistency at machine speed. This CLI fixes that.

**Version:** 20.0.0 · **Stacks:** Flutter · Kotlin · Node.js · React · Next.js · Angular · SwiftUI · Python · Java · **Agents:** Claude Code · Kiro

---

## The Problem It Solves

When one developer uses Claude Code, the output is fast and often good. When five developers use it on the same codebase with no shared rules, you get five different interpretations of the architecture, five different commit styles, and no one noticing when Claude drifts from the spec.

`ai-gov init` scans your project, detects your stack, and generates ~40 governance files that give the AI agent the same architectural context every session — for every developer. It optionally installs git hooks that enforce commit standards, and a CI check that runs on every pull request.

---

## What's New in v20 — Production-Ready Release

v20 closes the review loop. Eight acceptance criteria, mechanically verified by `/doctor production-ready`. Once it says PASSING, the framework is production-ready and further audits are informational only.

| Change | What it does |
|--------|--------------|
| **Shared governance-state.json** | Single JSON source of truth for audit, assess, backlog, doctor. Markdown files become rendered views. Schema v1 with versioned migration. |
| **Kiro parity for assess + backlog** | `workflow-assess` and `workflow-backlog` Kiro hooks — both agents now have full command coverage. |
| **Zero human-input gates** | `/assess` Business Pressure derived from 6 observable git/code signals. `/backlog` priority from `severity × dependency × commit_frequency`. Pipeline never blocks. |
| **Completion contracts** | Every command emits a grep-able line (`AUDIT_COMPLETE:`, `ASSESS_COMPLETE:`, `BACKLOG_COMPLETE:`). Absent = run incomplete. |
| **Scanner confidence fields** | 15 key scanner attributes wrapped with `{ value, confidence, source }`. Audit delta is structured data, not prose. |
| **`/doctor production-ready`** | Mechanical AC-1 through AC-8 evaluation. Returns PASSING or BLOCKING with exact items. No prose verdicts. |
| **Prompt surgery** | 10× "DO NOT STOP" collapsed to one execution contract + one completion line. Test Coverage split out of governance grade (greenfield projects stop being penalized). |
| **243 new tests** | audit.test.ts, assess.test.ts, doctor.test.ts — all at ≥30 assertion parity with backlog.test.ts. Total: 1,588 tests across 48 suites. |

---

## Framework Overview — Three Layers

| Layer | Command | What it does |
|-------|---------|--------------|
| **Layer 1 — AI Steering** | `npx ai-gov init` | Generates agent steering files, hooks, slash commands, and spec templates. The AI agent reads these automatically every session. |
| **Layer 2 — Git Hooks** | `npx ai-gov init --git-hooks` | Generates pre-commit and commit-msg scripts. Checks file size, secrets, TODOs, debug statements, architecture boundaries, and commit message format on every `git commit`. |
| **Layer 3 — CI + PR Check** | `npx ai-gov init --ci github` | Generates a CI pipeline that runs governance checks on every PR. |

You can use Layer 1 only, or Layer 1 + 2, or all three. They are independent.

---

## Command Pipeline — How the Commands Connect

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│   /audit     │────▶│   /assess    │────▶│   /backlog   │────▶│  /doctor prod-ready  │
│ (truth check)│     │ (decision)   │     │ (stories)    │     │  (mechanical gate)   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────────────┘
       │                    │                    │                         │
       ▼                    ▼                    ▼                         ▼
  Fixes steering      11 documents         Story prompts            PASSING / BLOCKING
  files in-place      + recommendation     for /new-feature         (8 ACs evaluated)
```

### `/audit` — Project Truth Check (12 steps, 6 phases)

Reads your actual source code, discovers what patterns/tools/layers are in use, then compares that to what steering files say. Every mismatch is fixed immediately (not just reported). Outputs a scorecard and writes 3 persistent records.

**What it checks:** governance files exist → hooks present + versioned → settings wired → directory map → code observation (reads 15-25 files per directory) → gap analysis against every steering file → fix steering in-place → spec coverage → test coverage → dead code scan → scorecard + persist.

**Scoring (4 governance categories):**
- Governance Files (are steering files present?)
- Governance Accuracy (do they state correct facts?)
- Steering Coverage (are all directories documented?)
- Dead File Risk (files that could confuse the agent?)

Test Coverage is reported separately as **Project Maturity** — informational only, does not affect the grade. A greenfield project with zero tests can still score A if its steering is accurate.

### `/assess` — Refactor vs Rewrite Decision Framework (11 documents)

Reads the entire codebase, measures 6 dimensions (file metrics, dependency health, test coverage, git archaeology, import graph, debt patterns), then scores a 7-dimension matrix to recommend one of:

| Recommendation | When |
|----------------|------|
| **Leave It** | Debt is stable, not costing velocity |
| **Refactor** | Architecture is limiting but fixable incrementally |
| **Strangler Fig** | Some modules fine, others beyond refactor — need side-by-side |
| **Rewrite** | Architecture is wrong paradigm, EOL deps, platform-level pressure |

**Business Pressure** (previously required human input) is now derived from 6 observable signals: bug commit density, aged developer-actions, contributor churn, EOL dependencies, revert/hotfix density, core staleness. Every inferred value carries `evidence[]` + `confidence` + `reviewRequired` — pipeline never blocks.

### `/backlog` — Rebuild Story Generator

Reads `docs/assessment/` (not source code directly), extracts feature units, derives priority from `severity × dependency_count × commit_frequency`, formats stories as `/new-feature`-ready prompts. Skip-list from dead code analysis. No human gates — priority is computed, override post-generation.

### `/doctor production-ready` — Mechanical Gate

Evaluates 8 acceptance criteria. Returns exactly PASSING or BLOCKING with the list. No prose. No grades. No fuzzy verdicts. Once PASSING, further audits are informational.

### `/new-feature` — Spec-First Development (3 gates)

Enters plan mode → Requirements gate → Design gate → Tasks gate → implements layer by layer. Knowledge files read before acting. Silent capture of confirmed business rules post-approval.

### `/fix`, `/hotfix`, `/refactor`, `/explore`, `/edit-feature`

Each command follows the same pattern: plan mode first, structured approach, layer-aware implementation, verification step.

---

## Quick Start

### Prerequisites

- **Node.js** >= 18
- **python3 or jq** — used by generated bash hook scripts to read config

### Initialize governance on your project

```bash
# Auto-detects stack and agent
npx ai-gov init

# Force a specific stack
npx ai-gov init --stack react       # flutter|kotlin|nodejs|react|next|angular|swiftui|python|java

# Force a specific agent
npx ai-gov init --agent kiro        # or: claude-code

# All three layers at once
npx ai-gov init --git-hooks --ci github

# Preview — nothing written
npx ai-gov init --dry-run
```

### What gets generated

**Claude Code (`--agent claude-code`, default):**
```
your-project/
├── CLAUDE.md                              ← root pointer for Claude
├── .claude/
│   ├── CLAUDE.md                          ← master rules (read every session)
│   ├── settings.json                      ← registers all hooks
│   ├── governance-state.json              ← canonical state (v20+)
│   ├── steering/                          ← 8 steering files
│   │   ├── constitution.md                ← hard rules
│   │   ├── architecture.md                ← layers, structure, high-risk files
│   │   ├── coding-standards.md            ← naming, patterns, file size
│   │   ├── ai-usage-policy.md             ← autonomy boundaries
│   │   ├── workflow.md                    ← feature/bug/hotfix flow
│   │   ├── spec-first-workflow.md         ← spec-before-code enforcement
│   │   ├── feature-readme.md              ← per-feature README policy
│   │   └── prompt-templates.md            ← reusable task templates
│   ├── hooks/                             ← 11 IDE hooks
│   ├── commands/                          ← 11 slash commands
│   │   ├── audit.md, assess.md, backlog.md
│   │   ├── new-feature.md, edit-feature.md, fix.md
│   │   ├── refactor.md, hotfix.md, explore.md
│   │   ├── tech-knowledge.md, product-knowledge.md
│   │   └── detect-conflicts.md
│   └── git-hooks/                         ← (with --git-hooks)
├── knowledge/                             ← AI-extracted product/tech knowledge
└── specs/_template/                       ← copy per feature
```

**Kiro (`--agent kiro`):**
```
your-project/
├── .kiro/
│   ├── governance-state.json              ← canonical state (v20+)
│   ├── steering/                          ← YAML front-matter steering files
│   ├── hooks/                             ← 14 automated hooks + 13 workflow hooks
│   │   ├── block-dangerous-commands.kiro.hook
│   │   ├── protect-files.kiro.hook
│   │   ├── workflow-audit.kiro.hook
│   │   ├── workflow-assess.kiro.hook      ← NEW in v20
│   │   ├── workflow-backlog.kiro.hook     ← NEW in v20
│   │   ├── workflow-new-feature.kiro.hook
│   │   ├── workflow-fix.kiro.hook
│   │   └── ... (13 workflow hooks total)
│   └── specs/_template/
```

---

## Governance State (v20)

All governance commands share a single JSON state file: `.claude/governance-state.json` (or `.kiro/governance-state.json`).

```json
{
  "version": 1,
  "project": { "name": "my-app", "stack": "nodejs", "agent": "claude-code" },
  "scannerSnapshot": { "stateFramework": { "value": "Zustand", "confidence": "high", "source": "manifest" } },
  "auditRuns": [{ "runNumber": 1, "scores": {...}, "verdict": "UPDATED" }],
  "deadCode": [{ "path": "src/old.ts", "status": "PENDING" }],
  "developerActions": [{ "action": "Set up tests", "status": "OPEN" }],
  "assessment": { "recommendation": "Refactor", "confidence": "high" },
  "backlog": { "stories": [...], "skipList": [...] },
  "assumptions": [{ "field": "assessment.businessPressure", "confidence": "high" }],
  "acceptanceCriteria": { "AC-1": { "status": "PASSING" } }
}
```

**Migration from v19:** Run `npx ai-gov migrate-state` — reads existing markdown artifacts, hydrates JSON, never deletes markdown files.

---

## Workspace — Multi-Project Setup

```bash
npx ai-gov workspace --dir /path/to/workspace
```

Generates per-project governance + workspace-level cross-project rules (API contracts, shared resources, project registry).

**Workspace audit** runs the full 12-step audit per project, then adds cross-project analysis: API contract discovery, mismatch detection, cross-project spec coverage, shared resource mapping.

**Workspace backlog** reads all projects' `docs/assessment/`, maps API contracts between backend and frontend, orders stories into workspace phases (Phase 0=API contract, Phase 2=backend, Phase 3=frontend, Phase 4=mobile).

---

## Git Hooks (Layer 2)

```bash
npx ai-gov init --git-hooks
```

Generates pre-commit and commit-msg scripts. What developers see:

```
  🔒 Pre-commit governance check
  ───────────────────────────────
  ✅ All checks passed.
```

Or:
```
  BLOCKED  secrets: src/config/api.ts — AWS Access Key ID (AKIA pattern)
```

**Checks:** file-size (frontend only) · secrets · no-todos · no-debug · format-check · lint-check · architecture boundaries · conventional commits.

Configure in `.claude/git-hooks/config.json`. Bypass: `git commit --no-verify`.

---

## CI Check (Layer 3)

```bash
npx ai-gov init --ci github      # or: gitlab | bitbucket
```

Runs `ai-gov pr-check` on every PR. 8 checks: architecture violations, file size, credentials (blocks by default), spec coverage, test coverage, TODOs, commit messages, PR description.

---

## Developer Workflow

### Team lead (once)
```bash
npx ai-gov init --git-hooks --ci github
npx ai-gov doctor
git add .claude/ CLAUDE.md .github/
git commit -m "chore: add ai-gov governance v20.0.0"
git push
```

### Each developer (once after clone)
```bash
npx ai-gov onboard
```

### Periodic governance check
```bash
# In Claude Code: type /audit
# In Kiro: trigger workflow-audit from Agent Hooks panel
```

### Upgrade after ai-gov version updates
```bash
npx ai-gov upgrade              # updates hooks + commands, keeps steering
npx ai-gov upgrade --force      # also overwrites steering files
```

---

## Stack Detection

The scanner reads manifest files and produces tailored governance:

| Stack | Detected from | Key detections |
|-------|--------------|----------------|
| **Flutter** | `pubspec.yaml` | State (Riverpod/BLoC/Provider/GetX), DI, router, network, local DB, Mason, FVM |
| **Kotlin** | `build.gradle.kts` | UI (Compose/XML), DI (Hilt/Koin), state (StateFlow/LiveData), ORM, multi-module |
| **Node.js** | `package.json` | Framework (NestJS/Express/Fastify), ORM, DI, API type, auth, queues, monorepo |
| **React** | `package.json` | State (Zustand/Redux/Jotai), router, forms, CSS approach, UI libs |
| **Next.js** | `package.json` | App vs Pages Router, RSC, state, styling |
| **Angular** | `package.json` | Version, Signals (v17+), state (NgRx/NGXS/Akita), SSR, Nx |
| **SwiftUI** | `Package.swift` | TCA, DI, state (@Observable), async/await, local DB |
| **Python** | `pyproject.toml` | Framework (FastAPI/Django/Flask), ORM, auth, cache, queue |
| **Java** | `pom.xml` / `build.gradle` | Framework (Spring Boot/Quarkus/Micronaut), DI, ORM, Java version, OSGi, Lombok |

---

## Knowledge Hub

Extract persistent AI context from your codebase:

| Command | What it produces |
|---------|-----------------|
| `/tech-knowledge <scope>` | `knowledge/tech-[scope].md` — architecture, patterns, dependencies |
| `/product-knowledge <scope>` | `knowledge/product-[scope].md` — user flows, domain objects, business rules |
| `/detect-conflicts` | `knowledge/conflicts/` — cross-feature contradictions |

Knowledge files are committed to git, cheap to read (small), expensive to regenerate (full code scan). All entries tagged `[INFERRED]` until human-promoted to `[CONFIRMED]`. Confirmed entries are protected by a pre-commit hook.

---

## Kiro vs Claude Code

| Aspect | Claude Code | Kiro |
|--------|-------------|------|
| Output directory | `.claude/` | `.kiro/` |
| Steering files | Plain markdown | Markdown + YAML front-matter |
| Hooks | Bash scripts registered in settings.json | JSON files auto-discovered |
| Commands | `.claude/commands/*.md` (slash commands) | `userTriggered` workflow hooks |
| Enforcement | Hard block via `exit 2` | Agent-enforced via `askAgent` |
| Commands available | 13 slash commands | 13 workflow hooks (full parity in v20) |

---

## All CLI Commands

| Command | Purpose |
|---------|---------|
| `ai-gov init` | Generate governance for existing project |
| `ai-gov init --git-hooks` | Add git pre-commit + commit-msg checks |
| `ai-gov init --ci github\|gitlab\|bitbucket` | Add CI pipeline |
| `ai-gov doctor` | Diagnose governance setup issues |
| `ai-gov doctor production-ready` | Mechanical v20 AC verification (PASSING/BLOCKING) |
| `ai-gov migrate-state` | Hydrate governance-state.json from v19 markdown |
| `ai-gov onboard` | New developer setup (wires git hooks locally) |
| `ai-gov upgrade` | Update hooks + commands, preserve steering |
| `ai-gov workspace` | Multi-project governance |
| `ai-gov pr-check` | Run 8 governance checks against branch diff |
| `ai-gov mcp init` | Configure team MCP tools |
| `ai-gov mcp onboard` | Developer token setup |
| `ai-gov project init` | Scaffold a new project from scratch |
| `ai-gov uninstall` | Remove governance files |

---

## MCP Governance

Configure team tools (Jira, Figma, PostgreSQL, GitHub, Linear, Notion, Slack, Sentry) without committing tokens to git.

```bash
npx ai-gov mcp init          # Team lead: select tools, write .mcp.json
npx ai-gov mcp onboard       # Each dev: set personal tokens
npx ai-gov mcp validate      # CI: verify all tokens present
```

Two-level token storage: global (`~/.config/ai-gov/.env.mcp.global`) for cross-project tokens, project (`.env.mcp`) for repo-specific secrets.

---

## When to Use This

**Worth it when:**
- Teams of 3+ using Claude Code or Kiro on the same codebase
- Production codebases where architecture consistency matters
- Regulated environments needing an audit trail
- Mixed-stack workspaces (Node.js + React + Flutter)
- Evaluating legacy apps for rewrite decisions (`/assess` → `/backlog` pipeline)

**Not worth it when:**
- Solo dev prototyping
- Small utilities (<500 lines)
- Teams not using Claude Code or Kiro

**What it will not do:**
- Make Claude deterministic — steering gives a better starting point, not absolute control
- Replace engineering discipline — `--no-verify` exists
- Maintain itself — `architecture.md` needs human editing as the project evolves (or run `/audit` periodically)

---

## Test Suite

```bash
npm test                    # 1,588 tests across 48 suites
npm run lint                # ESLint 9 flat config
npm run typecheck           # TypeScript strict mode
```

---

## License

MIT
