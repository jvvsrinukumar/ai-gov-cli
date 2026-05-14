import type { WorkspaceConfig, WorkspaceProject } from '../types.js';
import { backendProjects, frontendProjects } from './helpers.js';

function mobileProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
    return projects.filter(p =>
        p.group === 'mobile' ||
        p.stack === 'flutter' || p.stack === 'kotlin' || p.stack === 'swiftui',
    );
}

export function generateWorkspaceBacklogCommand(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;
    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);
    const mobiles = mobileProjects(projects);
    const hasMobile = mobiles.length > 0;

    const verifyPhase = hasMobile ? 5 : 4;
    const projectPaths = projects.map(p => `\`${p.relativePath}\``).join(', ');

    return `# /backlog — Workspace Rewrite Backlog Generator

> **Workspace:** ${workspaceName}
> **Projects:** ${projects.length} (${projectPaths})
${backends.length > 0 ? `> **Backend:** ${backends.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}${frontends.length > 0 ? `> **Frontend:** ${frontends.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}${hasMobile ? `> **Mobile:** ${mobiles.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}
---

> ## ⚠️ EXECUTION RULES
>
> 1. **This is a read-only extraction tool.** Do NOT modify any source code or assessment docs.
> 2. **All 6 phases are REQUIRED.** Run every phase. Do not stop early.
> 3. **You extract what EXISTS.** Do not invent features, infer priorities, or add new functionality.
> 4. **HUMAN INPUT sections are placeholders — not questions to ask now.** The developer fills them in later.
> 5. **Output goes to \`docs/backlog/\` at the workspace root.** Overwrites on re-run.
> 6. **Backend is always Phase 2. Frontend is always Phase 3.** API contract is Phase 0. This order is non-negotiable.

---

## WHAT THIS COMMAND DOES

This is NOT a product backlog tool. It mines \`docs/assessment/\` from each project for
rebuild-able units, maps the API contracts that bridge backend and frontend, orders
everything by technical dependency, and formats stories as \`/new-feature\`-ready prompts.

By the end: \`docs/backlog/\` at the workspace root has 6 files covering all projects.

---

## PHASE 1 — DISCOVER ASSESSMENTS

For each project, check whether \`<project>/docs/assessment/\` exists with the required docs.

**Required per project:**
- \`<project>/docs/assessment/01_current_state_analysis.md\`
- \`<project>/docs/assessment/02_decision.md\`

**Workspace-level check:**
- \`.claude/steering/cross-project-rules.md\` — primary source for API contracts between projects.
- If not found: print "⚠️ cross-project-rules.md not found — API contracts will be sparse. Run /audit at workspace root first." Continue.

**Assessment discovery table:**

\`\`\`
ASSESSMENT DISCOVERY
${projects.map(p => `  ${p.relativePath.padEnd(30)} [${p.stack.padEnd(8)}]  docs/assessment/: ✓ / ✗`).join('\n')}

  cross-project-rules.md: ✓ found / ✗ not found
\`\`\`

**For each project where assessment is MISSING:**
- Print: "⚠️ Run /assess in <project> first — excluding from backlog."
- Exclude that project from story generation. Do NOT stop entirely — generate what is available.

**For each project where Doc 02 is "Leave It":**
- Include in the index as "No rebuild stories — Leave It decision. Review in 6 months."
- Do not generate stories for that project.

**Stale check:**
For each project with an assessment, read the date from Doc 01.
If older than 30 days: print "⚠️ <project> assessment is >30 days old — consider re-running /assess."

After completing discovery, print the table and say "Assessment discovery complete — proceeding to feature extraction." Continue immediately.

---

## PHASE 2 — EXTRACT FEATURE INVENTORY (PER PROJECT)

For each project with a valid assessment:

**From Doc 01:** Build a feature unit list — significant directories and modules.

**From Doc 09 (if available):** Build the skip list — PENDING entries only.
- Skip KEPT entries (developer decision to keep).
- Skip DELETED entries (already gone).
- Cross-reference: remove feature units whose paths appear in the skip list.

**For backend projects — API contract mapping:**
- Read \`.claude/steering/cross-project-rules.md\`.
- Find all endpoints owned/served by this backend project.
- Map each endpoint group to the feature unit that owns it (route group → module).

**For frontend projects — API consumption mapping:**
- Read \`.claude/steering/cross-project-rules.md\`.
- Find all endpoints consumed by this frontend project.
- Map consumed endpoint groups to the feature units that call them.

**Per-project inventory summary:**

\`\`\`
FEATURE INVENTORY — <project> [<stack>]
  <module>   path: <path>   layer: <layer>   [endpoints: N if backend / consumed: N if frontend]
  SKIP: <path>   Reason: <from Doc 09>
\`\`\`

---

## PHASE 3 — GENERATE REBUILD STORIES (PER PROJECT)

For each project, generate stories using the format below.

**Story ID prefixes:**
${backends.length > 0 ? `- Backend (${backends.map(p => p.name).join(', ')}): \`BACK-NN\`\n` : ''}${frontends.length > 0 ? `- Frontend (${frontends.map(p => p.name).join(', ')}): \`FRONT-NN\`\n` : ''}${hasMobile ? `- Mobile (${mobiles.map(p => p.name).join(', ')}): \`MOB-NN\`\n` : ''}- Multiple projects of same type: use project abbreviation prefix — \`<ABBR>-NN\`

**Cross-project dependency rule:**
- If a frontend story consumes an API endpoint owned by a backend feature unit → add that backend story ID as a dependency.
- If the backend story does not yet exist in the inventory → note "⚠️ backend endpoint not in backlog — add manually."

**Story format (use for every story):**

\`\`\`
<STORY-ID> — Rebuild <module name>

Rebuild:           <module name and its responsibility>
Source module:     <file paths from Doc 01>
Why rebuild:       <debt pattern from Doc 07, OR "Clean architecture rewrite">
Debt items:        <IDs and severity from Doc 07, OR "none">
Dependency impact: <libraries to change from Doc 08, OR "none">
Dependencies:      <story IDs that must complete first, OR "none">
Phase:             <workspace phase number — backend=2, frontend=3, mobile=4>
Parallel-safe:     yes / no (depends on <STORY-ID>)
\`\`\`

**For /new-feature prompt** (copy this block directly into /new-feature):

\`\`\`
Story: <STORY-ID>
Feature: <module name>

<backend or frontend context and responsibility>
Existing contract: <extracted endpoints OR "⚠️ not found — fill manually">
Constraints: <migration constraints from Doc 11 if applicable, OR "none">
\`\`\`

**⚠️ HUMAN INPUT NEEDED** (fill before running /new-feature):
- [ ] Business priority: P1 / P2 / P3?
- [ ] Keep all functionality or drop anything?
- [ ] Any new requirements to add while rebuilding?
- [ ] Acceptance criteria beyond contract compliance?

---

## PHASE 4 — ORDER BY DEPENDENCY (WORKSPACE-WIDE)

Order ALL stories across ALL projects into workspace phases:

\`\`\`
WORKSPACE PHASE ORDER

Phase 0 — API Contract Definition
  Shared contracts that span backend and frontend.
  Define before any implementation begins.

Phase 1 — Shared Infrastructure
  Config, database connections, auth utilities, shared types.
  Things all other phases depend on.
${projects.map(p => `  ${p.relativePath}: [infra stories if any]`).join('\n')}

Phase 2 — Backend Implementation
${backends.length > 0 ? backends.map(p => `  ${p.relativePath}: [stories in dependency order]`).join('\n') : '  (no backend projects)'}

Phase 3 — Frontend Implementation
${frontends.length > 0 ? frontends.map(p => `  ${p.relativePath}: [stories — after backend stories they depend on]`).join('\n') : '  (no frontend projects)'}
${hasMobile ? `\nPhase 4 — Mobile Implementation\n${mobiles.map(p => `  ${p.relativePath}: [stories]`).join('\n')}` : ''}

Phase ${verifyPhase} — Cross-Project Verification
  Verify API contracts match between projects.
  End-to-end flow confirmed.
\`\`\`

**Parallel-safe rules:**
- Backend stories in Phase 2 with no shared dependencies: parallel-safe.
- Frontend stories in Phase 3 that depend only on completed Phase 2 stories (not each other): parallel-safe.
- Mark each story explicitly.

---

## PHASE 5 — WRITE OUTPUT FILES

Write all 6 files to \`docs/backlog/\` at the **workspace root** (never inside a project directory). Overwrite if they exist.

### \`docs/backlog/00_index.md\`

\`\`\`markdown
# Backlog — ${workspaceName}

**Generated:** <today>
**Projects:** ${projects.length}
**Source:** per-project docs/assessment/

## Project status

| Project | Stack | Assessment | Decision | Stories |
|---------|-------|-----------|----------|---------|
${projects.map(p => `| \`${p.relativePath}\` | ${p.stack} | ✓/✗ | [from Doc 02] | [N] |`).join('\n')}

## How to use this backlog

1. Open \`docs/backlog/combined-backlog.md\`
2. Fill in Priority (P1/P2/P3) for each story
3. Mark any stories SKIP if you decide not to rebuild them
4. Pick a story → copy its \`/new-feature prompt\` block
5. Run \`/new-feature\` at the **workspace root** and paste the prompt block
6. Claude routes automatically: backend-only / frontend-only / cross-project

## Human review checklist

- [ ] Business priority assigned for all stories
- [ ] Skip/keep decisions confirmed for flagged stories
- [ ] New features added manually where needed
- [ ] Cross-project stories have API contract reviewed
\`\`\`

### \`docs/backlog/backend-stories.md\`

All backend stories in dependency order. One section per backend project if multiple exist.
Use the story format from Phase 3.

### \`docs/backlog/frontend-stories.md\`

All frontend stories in dependency order. One section per frontend project if multiple exist.
For each story that depends on a backend story: note "Depends on BACK-NN — backend must be complete first OR mock the contract."

### \`docs/backlog/combined-backlog.md\`

\`\`\`markdown
# Combined Backlog — ${workspaceName}

| ID | Feature | Project | Phase | Source Module | Cross-project | Dependencies | Priority | Status |
|----|---------|---------|-------|--------------|---------------|--------------|----------|--------|
| BACK-01 | ... | backend | 2 | src/... | — | none | ⚠️ TBD | [ ] not started |
| FRONT-01 | ... | frontend | 3 | src/... | BACK-01 | BACK-01 | ⚠️ TBD | [ ] not started |
\`\`\`

### \`docs/backlog/skip-list.md\`

Combined skip list from all projects. One section per project.

### \`docs/backlog/phases.md\`

\`\`\`markdown
# Implementation Phases — ${workspaceName}

> Technical dependency order — NOT business priority order.
> Backend always before frontend. API contract always first.
> Stories marked "Parallel-safe: yes" can be worked simultaneously.

## Phase 0 — API Contract
[shared contracts between projects]

## Phase 1 — Infrastructure
[per project infra stories]

## Phase 2 — Backend
[backend stories in dependency order]

## Phase 3 — Frontend
[frontend stories — backend dependencies noted]
${hasMobile ? '\n## Phase 4 — Mobile\n[mobile stories]' : ''}

## Phase ${verifyPhase} — Cross-Project Verification
[verification tasks]
\`\`\`

---

## PHASE 6 — SUMMARY

\`\`\`
━━━ BACKLOG GENERATED — ${workspaceName} ━━━

  Projects with stories:  [N] of ${projects.length}
  Projects skipped:       [N] (Leave It or missing assessment)

  Stories by project:
${projects.map(p => `    ${p.relativePath} [${p.stack}]:  [N] stories`).join('\n')}

  Total rebuild stories:  [N]
  Skipped modules:        [N] (from dead code analysis)
  Cross-project stories:  [N] (frontend depends on backend)
  Parallel-safe:          [N] stories can run simultaneously

  ⚠️  Human review needed:
    - [N] stories need business priority (P1/P2/P3)
    - [N] stories have "keep or drop?" questions
    - [N] stories have sparse API contracts (run /audit for richer data)
    - 0 new features included (add manually to docs/backlog/backend-stories.md or frontend-stories.md)

  cross-project-rules.md: [found / not found]

  Next steps:
    1. Review docs/backlog/combined-backlog.md
    2. Fill in Priority column + keep/drop decisions
    3. Pick a story → copy its /new-feature prompt block
    4. Run /new-feature at workspace root
    5. Say 'all' / 'backend' / 'frontend' to scope implementation
\`\`\`

---

## RULES

- Do NOT read source files — read only docs/assessment/ and .claude/steering/cross-project-rules.md
- Do NOT assign priority — mark as ⚠️ TBD for human to fill
- Phase 0 (API contract) always exists even with 0 stories — it signals "define contract first"
- Backend always Phase 2, frontend always Phase 3 — never reverse this
- Output always goes to workspace-root docs/backlog/ — never inside a project directory
- Single-project workspace: works fine — combined-backlog.md has one project's stories only
- Do NOT stop if one project is missing an assessment — exclude it and continue with remaining projects
`;
}
