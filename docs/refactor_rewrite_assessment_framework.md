# Refactor / Rewrite Assessment Framework

**ai-gov CLI — Feature Proposal**
**Version:** 1.0
**Date:** May 2026
**Author:** Srinu Jonnalagadda
**Status:** Proposed

---

## Executive Summary

Teams regularly face the question: "Should we rewrite this codebase, refactor it, or leave it alone?" Today, this decision is made based on developer frustration, architect opinion, or client pressure — not evidence.

This proposal adds a structured assessment command (`/assess`) to the ai-gov governance framework. It produces a set of evidence-based documents that measure the actual state of a codebase and recommend one of four options: **Rewrite**, **Refactor**, **Strangler Fig**, or **Leave It**. The recommendation is backed by measured metrics, not opinions.

The goal: **no team should start a 6-month rewrite based on a feeling.**

---

## The Problem

### How the conversation starts

Someone — a junior developer, a newly joined architect, a client, or a CTO — says one of these:

- "We need to refactor this"
- "We should rewrite it properly"
- "Can we upgrade to the new framework version?"
- "Why does it take 3 sprints to add a single field?"
- "Why is everything so slow to build?"

### How it usually ends

| What happens | Frequency | Cost |
|-------------|:---------:|------|
| Team agrees to rewrite, starts, abandons halfway | Common | 6-18 months wasted, morale damaged |
| Team agrees to refactor, scope creeps into a rewrite | Common | Unpredictable timeline, same outcome |
| Team debates endlessly, does nothing | Very common | Decision paralysis, debt compounds |
| Team makes an evidence-based decision | Rare | This is what the framework enables |

### Why it fails

- **No measurement.** "The code is bad" is not actionable. Which files? How bad? Compared to what?
- **No options beyond two.** Teams think it's "rewrite or refactor." They miss strangler fig (incremental migration) and leave it (conscious acceptance).
- **No exit criteria.** Refactors that start without a definition of "done" become permanent background work that never ships.
- **Survivorship bias.** The one successful rewrite gets talked about. The five that failed get quietly buried.

---

## The Four Options

Most frameworks present three options. We present four, because the fourth is the most common real outcome — and the one nobody puts in the proposal.

### Option 1: Rewrite

Start fresh. New codebase, same domain.

- **When it's right:** The core data model is wrong for current requirements (not just messy — wrong). More than 60% of the codebase would change in a refactor. The technology stack is architecturally incompatible with requirements.
- **The reality:** Most rewrites take 2-3x longer than estimated. The new codebase inherits the same domain complexity. Within 2 years, teams often describe the rewrite as "the new legacy."
- **Required safeguards:** Test coverage of the current system to validate the rewrite. A working strangler strategy — never a big-bang cutover. A rollback plan for every phase.

### Option 2: Refactor

Systematic, measurable improvement of existing code.

- **When it's right:** Test coverage above 40% (or you can add tests before touching the code). The architecture is correct but the implementation is messy. Debt is isolated — 20% of files cause 80% of pain. Work can be done in phases of 1-2 weeks each with deployable checkpoints.
- **The reality:** The most reliable option when the architecture is sound. Fails when scope creeps or when there's no test safety net.
- **Required safeguards:** Each phase must be independently deployable. Metrics must show measurable improvement after each phase.

### Option 3: Strangler Fig

Leave the old code running. Build new functionality alongside it. Migrate piece by piece.

- **When it's right:** New features keep being blocked by old architecture. You need to upgrade a core library but can't do it in one step. Team has mixed skill levels — new developers work in clean code while old code continues running. You need to change things but cannot afford downtime.
- **The reality:** The only option with a safe exit ramp. You can stop at any point and the system still works. Old and new coexist.
- **Required safeguards:** Clear routing between old and new paths. Feature flags or API versioning. A retirement timeline for old modules.

### Option 4: Leave It

Consciously accept the debt. Freeze the surface area. Focus on stability. Do not touch what works.

- **When it's right:** The system works and customers depend on it. Risk of breakage outweighs benefit of cleanup. Team has no bandwidth and no test safety net. The "messy" parts are stable and rarely changed. You cannot measure improvement — if you can't define done, don't start.
- **The reality:** This is not failure. It is the correct answer in more situations than architects admit. Modules that haven't been touched in 14 months are stable. They may be messy. They are working. The debt in them is not costing you anything today.
- **Required safeguards:** Document the decision explicitly. Set a review date (6-12 months). Define triggers that would reopen the conversation (e.g., "if bugs in this module exceed 5 per quarter, reassess").

---

## The Assessment Document Set

The `/assess` command generates 11 documents. Together, they form a complete decision package.

```
docs/assessment/
├── 00_index.md                      ← Navigation + summary
├── 01_current_state_analysis.md     ← Measured metrics from the actual codebase
├── 02_decision.md                   ← Rewrite / Refactor / Strangler / Leave It
├── 03_implementation_phases.md      ← Phase plan (if proceeding)
├── 04_risk_assessment.md            ← Risk matrix + rollback plan per phase
├── 05_governance.md                 ← Rules for AI agents + developers during migration
├── 06_effort_estimation.md          ← Timeline, team size, cost-benefit
├── 07_technical_debt_inventory.md   ← Specific debt items with file:line references
├── 08_dependency_impact.md          ← Libraries: keep / upgrade / replace / remove
├── 09_dead_code_removal.md          ← Zero-risk cleanup list (quick wins)
├── 10_performance_impact.md         ← Before/after measurable targets
└── 11_migration_compatibility.md    ← How old and new coexist during transition
```

### What each document delivers

| Document | Question it answers | Data source |
|----------|-------------------|-------------|
| **00 Index** | What is this assessment? Where do I start? | Generated summary |
| **01 Current State** | How bad is it, measured? | Claude reads the actual folder structure and source files — same approach as `/audit`. No external tools required. |
| **02 Decision** | Rewrite, refactor, strangler, or leave it? | Evidence from doc 01 + decision criteria |
| **03 Phases** | If we proceed, what ships when? | Phase plan with deployable checkpoints |
| **04 Risks** | What can go wrong? How do we roll back? | Risk matrix per phase |
| **05 Governance** | What rules apply during migration? | AI agent constraints + developer guidelines |
| **06 Effort** | How long? How many people? Is it worth it? | Timeline + cost-benefit analysis |
| **07 Debt Inventory** | Where exactly is the debt? | File:line references, not vibes |
| **08 Dependencies** | Which libraries stay, go, or upgrade? | Dependency audit with breaking change analysis |
| **09 Dead Code** | What can we delete today with zero risk? | Unreferenced files, unused exports |
| **10 Performance** | What are the measurable targets? | Before/after benchmarks |
| **11 Migration Compat** | How do old and new coexist? | API compatibility, data migration, feature flags |

**Caveat on doc 09 (Dead Code Removal):** "Zero risk" means zero risk *after human verification*. Dead code detection has false positives — dynamic imports, reflection, config-driven loading, and convention-based frameworks (e.g., Spring component scanning, Angular lazy routes) can make live code appear unused. The generated doc 09 flags every candidate with a confidence level (High / Medium / Low) and the detection method used. Items marked "Low confidence" require manual verification before deletion. The doc explicitly states: *"Do not bulk-delete this list. Review each item. When in doubt, leave it."*

---

## The Document That Changes Decisions: Current State Analysis

Teams propose rewrites based on feeling. Document 01 forces measurement.

### Sample metrics table

| Metric | Value | Threshold | Signal |
|--------|:-----:|:---------:|--------|
| Total files | 342 | — | Baseline |
| Files > 300 lines | 47 | > 20 | Refactor candidates |
| Average cyclomatic complexity | 18 | > 10 | High — code is hard to reason about |
| Test coverage | 12% | < 40% | No safety net for changes |
| Circular dependencies | 8 | > 3 | Architecture problem |
| Build time | 4m 20s | > 3 min | Debt tax on every developer, every day |
| Last modified (core modules) | 14 months | > 6 months | Stable — don't touch |
| Bugs per module (6 months) | varies | — | Shows where debt actually hurts |
| Avg time to add a new feature | 3 weeks | baseline | Debt velocity metric |
| Developers who understand core | 1 of 8 | < 25% | Knowledge cliff risk |

### The two columns that matter most

**"Last modified"** — Modules that haven't been touched in 14 months are stable. They may be messy. They are working. The debt in them is not costing you anything today. Leave them.

**"Bugs per module"** — If `src/payment/` has generated 18 of your last 24 production bugs, that's where the refactor happens — not everywhere. This column turns "the whole codebase is bad" into "these 5 modules are the problem."

### How the data is collected

The source of truth is the **actual folder structure and code on disk** — exactly how `/audit` works. Claude reads files, observes what is there, and records facts. No external tools are required to run the assessment.

**Primary scan — Claude reads the filesystem directly (all stacks):**

| Metric | How it's collected |
|--------|-------------------|
| Total files, files > 300 lines | Directory walk, line count per file |
| Test file ratio / coverage tier | Count files matching `*test*`, `*spec*`, `__tests__/` vs total source files. Scored as Scenario A (none), B (partial), or C (comprehensive) — same approach as `/audit` `getTestCoverageInstructions()` |
| Last modified per module | `git log --format=%ai -1 -- <dir>` per significant directory |
| Dependency age | Read manifest (package.json, pom.xml, pubspec.yaml, pyproject.toml, build.gradle) — compare declared versions to known EOL dates |
| Import graph / circular deps | Parse import/require statements from source files |
| Dead code candidates | Exported symbols with zero internal importers, unreferenced files |
| Developers who touched core | `git shortlog -sn -- <dir>` |
| File size distribution | Histogram of line counts across source files |

**Optional tool-assisted metrics (improve precision when available, never required):**

| Metric | Tool | What it adds |
|--------|------|-------------|
| Exact coverage % | `jest --coverage`, `pytest --cov`, `jacoco`, `flutter test --coverage` | Precise % instead of Scenario tier |
| Cyclomatic complexity score | `eslint` complexity rule, `radon cc`, `pmd` | Numeric score instead of "high/medium" estimate from file size |
| Build time | `time npm run build`, `time mvn package` | Exact measurement instead of "slow/fast" observation |
| Lint violation count | `eslint`, `ruff`, `checkstyle`, `dart analyze` | Exact count of violations |

When a tool is not available, the metric row shows `N/A — install [tool] to measure` rather than a guess. The assessment explicitly marks which metrics are observed vs. tool-measured, so the team knows where gaps exist.

**Polyglot / workspace projects:**

For projects with multiple stacks (e.g., Java backend + TypeScript frontend), `/assess` runs per-project scans using ai-gov's existing stack detection and produces one `01_current_state_analysis.md` per project plus a workspace-level rollup. `02_decision.md` at workspace level may recommend different options per project (e.g., "Refactor the backend, Leave the frontend"). This reuses the same workspace discovery that `ai-gov workspace` already does — no new scanning infrastructure needed.

---

## Real-World Patterns in 3-4 Year Projects

These are the five patterns the assessment identifies and addresses:

### 1. The Working Spaghetti

The code works. Nobody fully understands it. Everyone is afraid to touch the core modules because last time someone did, production went down for 4 hours.

**Instinct:** Rewrite.
**Correct answer (usually):** Leave it. Wrap it with an API. Build new features outside it.

### 2. The Copy-Paste Expansion

Rapid feature delivery was done by copying an existing flow and modifying it. Now there are 12 nearly-identical but subtly different payment flows, auth handlers, or notification services.

**Instinct:** Refactor into a single abstraction.
**Correct answer:** Only if you can do it incrementally with tests. Otherwise you're introducing subtle bugs across 12 flows simultaneously.

### 3. The Version Pinning Trap

`package.json` shows React 16, Node 14, an ORM at a 4-year-old version. Every dependency has a "don't upgrade this" comment. Upgrading one breaks three others.

**Instinct:** Rewrite.
**Correct answer:** Strangler fig. New modules use current versions. Old modules stay pinned until they're retired.

### 4. The Abandoned Abstraction

A senior developer built something clever — a generic event bus, a meta-programming layer, a DSL. They left. Nobody else understood it. Everyone works around it. It still runs but nobody touches it.

**Instinct:** Rewrite it properly.
**Correct answer:** Leave it running. Route new work around it. Remove it only when you can delete it entirely in one commit.

### 5. The Layer Boundary Erosion

Started with clean layers (Controller → Service → Repository). Over 4 years, "just this once" exceptions accumulated. Controllers have business logic. Services query the database directly.

**Instinct:** Rewrite with proper architecture.
**Correct answer:** Refactor. Layer violations are isolated problems you can fix file by file with tests.

---

## Decision Criteria Matrix

This matrix is embedded in the generated `02_decision.md`. Teams score each dimension and the framework recommends an option.

| Dimension | Leave It (1) | Strangler (2) | Refactor (3) | Rewrite (4) |
|-----------|:---:|:---:|:---:|:---:|
| **Test coverage** | < 10% — can't safely change anything | 10-30% — can test new paths | > 40% — safety net exists | > 70% — can validate rewrite |
| **Architecture** | Sound enough, stable | Fundamentally limiting new features | Sound but messy implementation | Core data model is wrong |
| **Dependency health** | Pinned but working | Mixed — some EOL, some current | Outdated but upgradeable | Major deps EOL, no migration path |
| **Team knowledge** | 1 person knows it, but it's stable | Mixed — some areas understood | Team understands the domain | Original team gone, no docs |
| **Business pressure** | No complaints from users | New features blocked | Slowing down delivery | Platform change required |
| **Codebase scope** | > 100K lines — too big to rewrite | 50-100K — can strangle | 20-50K — refactor feasible | < 20K — rewrite feasible |
| **Stability** | Core modules untouched 6+ months | Some modules active, some frozen | Active development everywhere | Everything is being patched constantly |

**Scoring rules:**

1. **Veto dimension: Test coverage.** Regardless of all other scores, if Test coverage scores 1 (< 10%), the recommendation cannot be Rewrite or Refactor. You cannot safely change what you cannot test. The only valid options are Leave It or Strangler Fig (where new code has tests, old code is untouched).

2. **Majority rule with tiebreak.** Count which column has the most scores.
   - Clear majority (4+ of 7) → that option wins.
   - Tie between two options → the **lower-risk option wins** (Leave It beats Strangler, Strangler beats Refactor, Refactor beats Rewrite). The burden of proof is on the more aggressive option.
   - Three-way split → default to **Strangler Fig**. It's the only option with a safe exit ramp at every stage.

3. **Override: single dimension at 4 (Rewrite).** If any single dimension scores 4 but the majority says Refactor or Strangler, flag it as a **constraint**. Example: Architecture scores 4 (core data model is wrong) but everything else says Refactor → the recommendation is Refactor, but doc 03 must include a phase for data model migration. The constraint doesn't force a rewrite, but it shapes the plan.

**Warning thresholds (red flags):**
- Test coverage scores 1 + recommendation is Rewrite → **Blocked.** You cannot validate a rewrite without tests on the current system. Add tests first, re-run `/assess`.
- Codebase scope scores 1 + recommendation is Rewrite → **Blocked.** Rewriting 100K+ lines is a multi-year project with high failure rate. Use Strangler Fig instead.
- Any refactor estimated at > 6 months without shipping → **It's a rewrite.** Call it what it is and re-score accordingly.
- Test coverage scores 1 + recommendation is Refactor → **Conditional.** Phase 1 must be "add tests to critical paths" before any code changes. The refactor does not start until coverage reaches 30%.

---

## Integration with ai-gov (ai-governance framework)

### How it works

```bash
# Developer or architect runs the assessment
# In Claude Code, use the slash command:
/assess

# Claude Code reads the codebase, produces the 11 docs
# in docs/assessment/ with real measured data
```

### What the command does

1. **Reads the actual folder structure and source files** — same approach as `/audit`. Claude maps every significant directory, reads 15–25 source files per directory, and observes what is actually there: file counts, line counts, test file presence, import patterns, dependency manifests, git log for last-modified dates. No external tools required.
2. **Identifies patterns** — which of the 5 real-world patterns apply, based on what was observed
3. **Fills in 01_current_state_analysis.md** with observed data, flagging where tool-assisted metrics (coverage %, complexity scores) would add precision if available
4. **Generates 02_decision.md** with the scoring matrix pre-filled from observations
5. **Produces remaining docs** as structured templates with project-specific context
6. **Flags areas needing human input** — business pressure, team knowledge, and performance targets require human judgment

### Re-running the assessment

`/assess` is **idempotent and diff-aware**. Teams will re-run it — after adding tests, after cleaning dead code, after a quarter of new development. The command handles this:

- **First run:** Generates all 11 docs in `docs/assessment/` with current metrics.
- **Subsequent runs:** Reads the existing `01_current_state_analysis.md`, preserves previous metrics as a "Previous" column, and adds the new scan as "Current". The delta is visible immediately.
- **02_decision.md:** Re-scored on every run. If the team added tests (coverage went from 12% to 45%), the scoring shifts. The previous recommendation is preserved as history, not overwritten.
- **Human-edited sections** (business pressure, team knowledge notes, custom annotations) are preserved in a `<!-- HUMAN -->` block that the generator never touches.

Sample re-run output in `01_current_state_analysis.md`:

| Metric | Previous (Jan 2026) | Current (May 2026) | Delta | Signal |
|--------|:---:|:---:|:---:|--------|
| Test coverage | 12% | 38% | +26% | Approaching safety net threshold |
| Files > 300 lines | 47 | 31 | -16 | Refactor candidates reduced |
| Dead code files | 23 | 8 | -15 | Cleanup working |

This means the assessment is a **living document**, not a one-shot artifact. The team can track whether their incremental work is actually moving the needle before committing to a larger decision.

### What it does NOT do

- It does not make the decision. It presents evidence. Humans decide.
- It does not promise accuracy on subjective dimensions (team knowledge, business pressure). It flags these for human input.
- It does not replace architecture review. It provides the data that makes architecture review productive.

---

## Cost-Benefit Summary

### Cost of building this feature

- 1 new generator file (`src/generators/commands/assess.md`)
- 11 template generators for the assessment docs
- Reuses existing scanner infrastructure — no new scanning code needed
- Estimated effort: 2-3 days of development

### Cost of NOT having this feature

| Scenario | Cost |
|----------|------|
| Failed rewrite (6-18 months) | 3-9 developer-years wasted |
| Unnecessary refactor (3-6 months) | 1.5-3 developer-years on low-value work |
| Decision paralysis (ongoing) | Debt compounds, velocity decreases quarter over quarter |
| Successful evidence-based decision | Avoided any of the above |

### The real ROI

If this framework prevents **one** unnecessary rewrite across your 50+ developers, it saves 6-18 months of team capacity. The feature takes 2-3 days to build.

---

## Appendix A: The Honest Truths

These are embedded in the generated assessment docs so teams confront them before starting:

1. **Most proposed rewrites are refactors in disguise.** If you're keeping the same domain model, same business rules, and same user flows — you're refactoring, not rewriting. Call it what it is so you estimate correctly.

2. **Rewrites take 2-3x longer than estimated. Always.** The new codebase inherits the same domain complexity. You'll rediscover every edge case the old code handles.

3. **"The code is ugly" is not a reason to rewrite.** "The code can't support the next 3 features we need" is. Aesthetic preferences are not business justification.

4. **Refactoring without tests is surgery without anesthesia.** If test coverage is below 40%, the first phase of any refactor must be adding tests — not changing code.

5. **The safest first move is always the same:** Delete dead code (doc 09), upgrade safe dependencies (doc 08), add tests to critical paths. Then reassess. Often this is enough.

6. **Leave It is not failure.** It is a conscious, documented decision to accept known debt because the cost of fixing it exceeds the cost of living with it. Set a review date and move on.

---

## Appendix B: Sample Timeline

For a team considering this assessment:

| Week | Activity |
|------|----------|
| Day 1 | Run `/assess` — generates docs with codebase metrics |
| Day 2-3 | Team fills in human-judgment sections (business pressure, team knowledge, performance targets) |
| Day 4 | Review `02_decision.md` scoring matrix as a team |
| Day 5 | Decision made. If proceeding: `03_implementation_phases.md` becomes the roadmap |

**Total time to decision: 1 week.**
Compare to: months of debate, false starts, and abandoned rewrites.

---

## Approval

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering Lead | | | |
| Product Owner | | | |
| Architecture | | | |

**Decision:** ☐ Approved — build the `/assess` command
**Priority:** ☐ Next release ☐ Backlog ☐ Deferred
