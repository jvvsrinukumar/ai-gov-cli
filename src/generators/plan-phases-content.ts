/**
 * Shared plan-phases prompt body — consumed by Claude Code (/plan-phases) and Kiro.
 *
 * Accepts uploaded documents (PRDs, user stories, epics) and generates a phased
 * implementation plan in docs/phases/phase0/, docs/phases/phase1/, … docs/phases/phaseN/.
 *
 * No tasks.md — developers pick stories and run /new-feature (or other commands) directly.
 * Stories must be crystal clear; if the source doc is unclear, flag it explicitly.
 */
import type { GovernanceConfig } from '../types.js';
import { generateKnowledgePreambleCommand } from '../utils/knowledge-preamble.js';

export interface PlanPhasesContentParams {
  config: GovernanceConfig;
  /** User-facing command name in headings and prose. */
  commandName: string;
  /** Cross-references to sibling commands. */
  crossRefs: {
    backlog: string;
    newFeature: string;
    assess: string;
  };
}

export function generatePlanPhasesContent(p: PlanPhasesContentParams): string {
  const { config: c, commandName, crossRefs } = p;
  const { project, profile } = c;
  const stackDisplay = profile.stackDisplay;

  return `# ${commandName} — Document-to-Phases Generator

> **Project:** ${project.appName}
> **Stack:** ${stackDisplay}

---

> ## ⚠️ EXECUTION RULES — READ BEFORE STARTING
>
> 1. **Input required:** The user MUST provide at least one document — a PRD, user stories, epic description, feature spec, or any planning artifact. If no document content is provided, ask: "Please upload or paste your document (PRD, user stories, epic, or feature spec) so I can generate the phased plan." *(This is the only gate — once a document is present, Rule #5 takes over and the pipeline runs end-to-end without stopping.)*
> 2. **ZERO HALLUCINATION — ABSOLUTE RULE.** Every single piece of data in the output MUST be directly traceable to the uploaded document. You MUST NOT:
>    - Invent user stories that are not in the document
>    - Fabricate acceptance criteria the document does not state
>    - Guess API endpoints, data shapes, or technical details not mentioned
>    - Assume business rules that are not written in the document
>    - Fill in "reasonable" defaults for missing information
>    - Add context, constraints, or dependencies you inferred but cannot quote from the doc
>    - If information is not in the document, write: **"⚠️ NOT IN DOC — developer must provide"**
> 3. **All phases are generated.** The number of phases is derived from the document — do not hardcode a fixed count.
> 4. **Output goes to \`docs/phases/\`.** Each phase gets its own folder: \`docs/phases/phase0/\`, \`docs/phases/phase1/\`, etc.
> 5. **DO NOT STOP between steps.** Complete the full pipeline in one run.
> 6. **Stories must be CRYSTAL CLEAR.** Every story must have unambiguous acceptance criteria and enough context for a developer to run \`${crossRefs.newFeature}\` directly. If the source document is unclear, vague, or missing critical details — DO NOT guess or invent. Flag it with a \`⚠️ DOC CLARITY\` warning.
> 7. **No tasks.md.** Developers use the stories directly with \`${crossRefs.newFeature}\` or other commands. Do NOT generate implementation task files.
> 8. **Completion contract — emit on the very last line:**
>     \`PHASES_COMPLETE: phases=<N> stories=<total> clarity_warnings=<N> docs_generated=<file_count>\`

---

## WHAT THIS COMMAND DOES

Accepts uploaded documents (PRDs, user stories, epics, feature specs) and:
1. Validates document clarity — flags sections that are too vague to implement
2. Parses and categorizes user stories / requirements **using ONLY what the document says**
3. Groups them into logical implementation phases based on dependency order
4. Generates a folder structure under \`docs/phases/\` with one folder per phase
5. Each phase folder contains a README and stories extracted verbatim from the source doc

**Data provenance rule:** Every field in every story MUST come from the document. If a field cannot be filled from the document, it gets: \`⚠️ NOT IN DOC — developer must provide\`. Never fill gaps with assumptions.
${generateKnowledgePreambleCommand()}
---

## KNOWLEDGE HUB INTEGRATION

If \`knowledge/\` exists at the project root, use it as **supplementary context** for:

| Knowledge file | How it helps plan-phases |
|----------------|------------------------|
| \`knowledge/tech-overview.md\` | Understand existing architecture → better phase ordering (infra vs service vs UI) |
| \`knowledge/product-overview.md\` | Understand product domain → validate stories make sense in context |
| \`knowledge/tech-[slug].md\` | Map uploaded stories to existing modules/layers |
| \`knowledge/product-[slug].md\` | Cross-reference business rules mentioned in stories |

**Rules for using knowledge hub data:**
- Knowledge hub helps you ORDER phases and VALIDATE dependencies — it does NOT add new stories
- If knowledge hub reveals that a story contradicts existing architecture → add a note: "⚠️ CONFLICTS WITH KNOWLEDGE HUB: [explanation]"
- If knowledge hub shows a dependency the doc doesn't mention → add: "ℹ️ Dependency derived from knowledge hub (tech-[slug].md): [explanation]"
- \`[CONFIRMED]\` entries in knowledge: trust them for ordering decisions
- \`[INFERRED]\` entries in knowledge: note them but don't treat as absolute truth
- If \`knowledge/\` doesn't exist: skip silently, proceed with document data only

---

## STEP 0 — ZERO HALLUCINATION CHECKLIST

Before writing ANY output, internalize these rules:

| Field | Source | If missing in doc |
|-------|--------|-------------------|
| Story title | Document heading or explicit title | Use first sentence of the story paragraph |
| User role ("As a…") | Document states the actor | \`⚠️ NOT IN DOC — who is the user?\` |
| Action ("I want…") | Document describes what they do | \`⚠️ NOT IN DOC — what action?\` |
| Outcome ("So that…") | Document states the why/benefit | \`⚠️ NOT IN DOC — what's the benefit?\` |
| Acceptance criteria | Document lists criteria or testable outcomes | \`⚠️ NOT IN DOC — no criteria provided\` |
| API endpoints | Document specifies routes/methods | \`⚠️ NOT IN DOC\` (do NOT invent endpoints) |
| Data shapes | Document shows request/response models | \`⚠️ NOT IN DOC\` (do NOT invent schemas) |
| Priority | Document assigns priority | Derive from dependency order only — state "derived, not in doc" |
| Dependencies | Document states what depends on what | Derive from logical ordering — state "derived from context" |
| Business rules | Document spells them out | \`⚠️ NOT IN DOC — no business rules stated\` |
| Error handling | Document describes error cases | \`⚠️ NOT IN DOC\` (do NOT invent error scenarios) |
| Constraints | Document lists constraints | "none stated in doc" |

**The golden rule:** If you cannot point to a specific sentence or paragraph in the uploaded document that supports a claim — do not make that claim.

---

## STEP 1 — VALIDATE DOCUMENT CLARITY

**Before extracting stories, assess the document quality.**

For each section or story in the document, check:

| Clarity Check | Pass Criteria |
|---------------|---------------|
| Who is the user/actor? | Explicitly stated or clearly implied |
| What is the desired action? | Specific, not vague ("manage things") |
| What is the success outcome? | Measurable or observable result |
| Acceptance criteria present? | At least 1 testable criterion |
| No contradictions? | Does not conflict with other sections |
| Technical feasibility clear? | No impossible or undefined integrations |

**If a section/story FAILS clarity checks:**

Do NOT skip it. Instead:
1. Include it in the output with a \`⚠️ DOC CLARITY\` block
2. State exactly what is unclear
3. Suggest what the developer needs to clarify before implementing

\`\`\`markdown
⚠️ DOC CLARITY — This story cannot be implemented as-is

**What's unclear:**
- [specific ambiguity 1]
- [specific ambiguity 2]

**What the developer needs to provide:**
- [question 1]
- [question 2]

**Source text (verbatim from doc):**
> [the unclear passage]
\`\`\`

**If the ENTIRE document is unclear:**

Print:
\`\`\`
⚠️ DOCUMENT NOT IN CLEAR STATE

This document cannot be converted to implementable stories because:
- [reason 1]
- [reason 2]

Suggestions to fix:
- [suggestion 1]
- [suggestion 2]

Please revise the document and re-run ${commandName}.
\`\`\`
Stop. Do not generate phase folders.

---

## STEP 2 — PARSE INPUT DOCUMENT

Read the uploaded document(s) provided by the user. Extract:

**From PRDs / Feature Specs:**
- Feature name / epic name
- Business objectives
- User stories (if embedded)
- Acceptance criteria
- Technical constraints
- Dependencies between features

**From User Story Documents:**
- Story IDs (if provided) or assign sequential IDs: \`US-001\`, \`US-002\`, …
- Story title
- Description / "As a… I want… So that…"
- Acceptance criteria
- Priority (if specified) — otherwise derive from dependency order
- Dependencies between stories

**Print extracted summary:**

\`\`\`
━━━ DOCUMENT PARSED ━━━
  Document type:      [PRD / User Stories / Epic / Mixed]
  Title/Epic:         [extracted title]
  Stories found:      [N]
  Crystal clear:      [N] of [N] stories are implementation-ready
  Clarity warnings:   [N] stories need developer input (⚠️ DOC CLARITY)
  With criteria:      [N] of [N] have acceptance criteria
  With priorities:    [N] of [N] have explicit priority
  Dependencies:       [N] inter-story dependencies identified
\`\`\`

> If no stories can be extracted at all, ask: "I couldn't find clear user stories in this document. Can you highlight which sections are the stories, or paste them separately?"

---

## STEP 3 — DERIVE PHASE GROUPING

Group stories into phases using this logic:

**Phase 0 — Foundation / Setup:**
- Infrastructure stories (auth, config, DB setup, project scaffolding)
- Shared utilities, base classes, common types
- Stories with NO dependencies on other stories
- CI/CD pipeline setup if mentioned

**Phase 1..N — Feature Phases (dependency-ordered):**
- Group stories that can be implemented together (no circular deps within a phase)
- A story goes into the earliest phase where ALL its dependencies are satisfied by prior phases
- Within a phase, mark stories as parallel-safe if they don't depend on each other

**Phasing rules:**
1. No phase should have more than 8-10 stories (split if larger)
2. Data/infrastructure stories always come before logic/UI stories
3. If the document specifies phases/milestones, respect that grouping
4. If no explicit ordering exists, derive from: data layer → service layer → UI layer
5. Stories with \`⚠️ DOC CLARITY\` warnings still get placed in the correct phase — they just carry the warning tag

**Print phase summary table:**

| Phase | Name | Stories | Clear | ⚠️ Unclear | Depends On | Parallel-Safe |
|-------|------|---------|-------|------------|------------|---------------|
| 0 | Foundation | [N] | [N] | [N] | — | [N] |
| 1 | [derived name] | [N] | [N] | [N] | Phase 0 | [N] |
| … | | | | | | |

---

## STEP 4 — GENERATE PHASE FOLDERS

Create the following structure under \`docs/phases/\`:

\`\`\`
docs/phases/
├── README.md                    (index / overview)
├── phase0/
│   ├── README.md                (phase overview)
│   └── stories.md               (all stories — crystal clear, ready for ${crossRefs.newFeature})
├── phase1/
│   ├── README.md
│   └── stories.md
├── phase2/
│   ├── README.md
│   └── stories.md
└── phaseN/
    ├── README.md
    └── stories.md
\`\`\`

> **No tasks.md.** Developers pick a story → run \`${crossRefs.newFeature}\` → that command handles spec creation and task breakdown.

---

## STEP 5 — WRITE FILES

### \`docs/phases/README.md\` (Index)

\`\`\`markdown
# Implementation Phases — ${project.appName}

**Generated:** <today>
**Stack:** ${stackDisplay}
**Source document:** <document title or "uploaded document">
**Total stories:** <N>
**Total phases:** <N>
**Clarity warnings:** <N> stories need developer clarification before implementation

## Phase Overview

| Phase | Name | Stories | Clear | ⚠️ Unclear | Status |
|-------|------|---------|-------|------------|--------|
| 0 | Foundation | [N] | [N] | [N] | [ ] not started |
| 1 | [name] | [N] | [N] | [N] | [ ] not started |
| … | | | | | |

## How to Use

1. Work through phases in order (Phase 0 first)
2. Within a phase, parallel-safe stories can be worked simultaneously
3. **Resolve ⚠️ DOC CLARITY warnings first** — unclear stories cannot be implemented reliably
4. For each clear story, copy the \`${crossRefs.newFeature} prompt\` block and run \`${crossRefs.newFeature}\`
5. Check off stories as completed
6. Do not start a phase until all dependencies from prior phases are done

## Document Source Summary

[1-2 paragraph summary of what the uploaded document describes]

## Clarity Issues (if any)

[List all stories with ⚠️ DOC CLARITY warnings — developer must resolve these before implementing]

| Story ID | Issue | What's Needed |
|----------|-------|---------------|
| US-<ID> | [brief issue] | [what developer needs to provide] |
\`\`\`

### \`docs/phases/phase<N>/README.md\`

\`\`\`markdown
# Phase <N> — <Phase Name>

**Stories:** <N>
**Depends on:** Phase <N-1> (or "none" for Phase 0)
**Parallel-safe stories:** <N> of <N>
**Clarity warnings:** <N> stories need clarification

## Objective
[What this phase accomplishes — 1-2 sentences]

## Stories in this Phase
| ID | Title | Priority | Parallel-Safe | Clear? | Status |
|----|-------|----------|---------------|--------|--------|
| US-001 | [title] | P1 | yes | ✅ | [ ] |
| US-002 | [title] | P2 | yes | ⚠️ | [ ] |

## Entry Criteria
- [ ] All Phase <N-1> stories completed (or "N/A" for Phase 0)
- [ ] All ⚠️ DOC CLARITY issues in this phase resolved
- [ ] [any specific prerequisite]

## Exit Criteria
- [ ] All stories in this phase pass acceptance criteria
- [ ] Tests passing for all implemented features
- [ ] No regressions in prior phase functionality
\`\`\`

### \`docs/phases/phase<N>/stories.md\`

Each story must be **crystal clear** — a developer should be able to read it and immediately run \`${crossRefs.newFeature}\` without needing to ask questions. **Every field comes from the document — nothing is invented.**

\`\`\`markdown
# Stories — Phase <N>: <Phase Name>

---

## US-<ID> — <Story Title>

**Priority:** P<1|2|3> (source: doc / derived from dependency order)
**Parallel-safe:** yes / no (depends on US-<ID>)
**Clarity:** ✅ Clear / ⚠️ Needs clarification

### User Story
As a [specific role — FROM DOC], I want [specific action — FROM DOC], so that [outcome — FROM DOC].

> **Source (verbatim from doc):** "[exact quote from the uploaded document that this story is based on]"

### Context
[ONLY context that exists in the source document. Do NOT add background knowledge or assumptions.
Quote relevant passages. If the doc gives no additional context, write: "No additional context provided in source document."]

### Acceptance Criteria
[ONLY criteria stated or directly implied in the document]
- [ ] [criterion from doc]
- [ ] [criterion from doc]
- [ ] ⚠️ NOT IN DOC — no error handling criteria specified

### API Contract (if mentioned in doc)
| Method | Endpoint | Request | Response | Notes |
|--------|----------|---------|----------|-------|
| [FROM DOC] | [FROM DOC] | [FROM DOC or "⚠️ NOT IN DOC"] | [FROM DOC or "⚠️ NOT IN DOC"] | — |

> If the document does not mention API details: "No API contract specified in source document."

### Dependencies
- Depends on: [FROM DOC or "derived from logical ordering — not explicitly stated"]
- Depended on by: [FROM DOC or "derived from logical ordering — not explicitly stated"]

### ${crossRefs.newFeature} Prompt

> Copy this block and paste it into \`${crossRefs.newFeature}\`:

\\\`\\\`\\\`
Story: US-<ID>
Feature: <feature-name-slug>

<context — ONLY from doc, no additions>

Acceptance criteria (from source doc):
- [criterion 1 — verbatim from doc]
- [criterion 2 — verbatim from doc]

API contract: [from doc, or "not specified in source doc — define before implementing"]

Constraints: [from doc, or "none stated in source doc"]

Dependencies: [from doc or derived]
\\\`\\\`\\\`

---
\`\`\`

**For stories with clarity issues, append this block:**

\`\`\`markdown
### ⚠️ DOC CLARITY — Cannot implement as-is

**What's unclear in the source document:**
- [specific ambiguity — quote the vague text]
- [missing information]

**Questions the developer must answer:**
1. [specific question]
2. [specific question]

**Source text (verbatim):**
> [the exact passage from the uploaded doc that is unclear]

**Once clarified:** Update this story's description and acceptance criteria, remove this warning block, then run \`${crossRefs.newFeature}\`.
\`\`\`

---

## STEP 6 — SUMMARY

\`\`\`
━━━ PHASES GENERATED — ${project.appName} ━━━

  Source:              <document title>
  Total stories:       [N]
  Total phases:        [N] (Phase 0 through Phase [N-1])
  Crystal clear:       [N] stories ready for ${crossRefs.newFeature}
  ⚠️ Clarity warnings: [N] stories need developer input first
  Parallel-safe:       [N] stories can be worked simultaneously within their phase

  Phase breakdown:
    Phase 0: [N] stories — [phase name] ([N] clear, [N] unclear)
    Phase 1: [N] stories — [phase name] ([N] clear, [N] unclear)
    …

  Files written:       [N] files across [N] phase folders
  Output location:     docs/phases/

  Next steps:
    1. Review docs/phases/README.md for the overview
    2. **Resolve ⚠️ DOC CLARITY warnings** — unclear stories block implementation
    3. Start with Phase 0 — pick a clear (✅) story
    4. Copy the "${crossRefs.newFeature} prompt" block from the story
    5. Run ${crossRefs.newFeature} to implement it
    6. Or run ${crossRefs.backlog} to generate a combined backlog view
\`\`\`

---

## STORY CLARITY STANDARDS

A story is **crystal clear** (✅) only when ALL of these are true:

| Standard | Requirement |
|----------|-------------|
| Actor | Specific role identified (not just "user") |
| Action | Single, specific action (not compound/vague) |
| Outcome | Observable result that can be verified |
| Criteria | At least 2 testable acceptance criteria |
| Scope | Clear boundaries — what's in and what's NOT |
| Data | Input/output shapes defined (if data-oriented) |
| Errors | At least 1 error/edge case criterion |
| No jargon | No undefined terms or acronyms without expansion |

A story gets **⚠️ DOC CLARITY** when ANY of these are true:
- Acceptance criteria use words like "appropriate", "correct", "properly" without defining what that means
- Story depends on undefined external systems not in scope
- Multiple interpretations are possible
- Business rules are referenced but not spelled out
- "TBD", "TODO", or "to be decided" appears
- The source doc contradicts itself about this story's scope

---

## EDGE CASES

| Situation | Handling |
|-----------|----------|
| Document has no clear stories | Flag as "DOCUMENT NOT IN CLEAR STATE" — stop and explain what's needed |
| All stories are independent | Put everything in Phase 1 (Phase 0 only if infra exists) |
| Document specifies its own phases | Respect the document's phasing — map to phase0/, phase1/, etc. |
| Duplicate stories detected | Deduplicate and note in README |
| Stories reference external systems | Flag as dependency in technical notes; if undefined → clarity warning |
| Very large document (50+ stories) | Cap phases at ~8-10 stories each; create more phases |
| Document is a single epic with no breakdown | Break the epic into logical stories first, then phase them |
| Half the doc is clear, half is vague | Generate all phases; clear stories get ✅, vague ones get ⚠️ |
| Doc uses vague language throughout | Flag as "DOCUMENT NOT IN CLEAR STATE" with specific improvement suggestions |

---

## WHAT THIS COMMAND DOES NOT DO

| Temptation | Why not |
|------------|---------|
| Write implementation code | This is a planning tool — use ${crossRefs.newFeature} for code |
| Generate tasks.md | Developers run ${crossRefs.newFeature} which handles task breakdown |
| Modify existing source files | Only writes to docs/phases/ |
| Guess missing requirements | Flags with \`⚠️ NOT IN DOC\` instead — NEVER invents data |
| Invent acceptance criteria | Extracts from doc ONLY; if doc doesn't have them → \`⚠️ NOT IN DOC\` |
| Fabricate API endpoints | Only includes endpoints explicitly written in the source document |
| Add "reasonable" defaults | If the doc doesn't say it, the output doesn't contain it |
| Assume business rules | Only includes rules explicitly stated in the document |
| Prioritize by business value | Uses dependency order; business priority can be overlaid manually |
| Fill in technical details | Architecture decisions belong to the developer, not this tool |
| Write to governance-state.json | This command is doc-only — it does NOT flow into governance-state.json. Phase ordering and priority are ephemeral outputs, not tracked state. |

---

## FINAL OUTPUT — completion contract

The very last line of this run must be exactly:

\`\`\`
PHASES_COMPLETE: phases=<N> stories=<total> clarity_warnings=<N> docs_generated=<file_count>
\`\`\`

Substitute the actual counts. No other text after it.
`;
}
