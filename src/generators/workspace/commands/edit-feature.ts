import type { WorkspaceConfig } from '../types.js';

export function generateWorkspaceEditFeatureCommand(config: WorkspaceConfig): string {
    const { workspaceName } = config;

    return `# /edit-feature — Workspace Edit Feature (Cross-Project Aware)

> **Workspace:** ${workspaceName}

> Scope routing is automatic. If the feature has a cross-project spec at the
> workspace root, this workspace-level flow is used. If the spec is in a single
> project, that project's own \`/edit-feature\` is used.

---

## STEP 0 — Classify Scope

Read \`$ARGUMENTS\`. Determine which scenario applies:

### Scenario A — Single-Project Edit
The feature lives in one project. Its spec is at \`<project>/specs/<feature>/\`.

**Action:** Identify the project → run that project's \`/edit-feature\` command.

### Scenario B — Cross-Project Edit
The feature spans projects. Its spec is at \`<workspace-root>/specs/<feature>/\`.
The edit may add backend endpoints, frontend pages, or both.

**How to detect:**
1. Check \`specs/$ARGUMENTS/\` at the workspace root — if it exists, this is cross-project
2. If not at workspace root, check each project's \`specs/$ARGUMENTS/\`
3. If the developer's description mentions both backend and frontend changes, treat as cross-project

**Action:** Continue with this workspace-level flow.

---

> **If Scenario A:** State "This feature's spec is in \`<project>\`. Using that project's /edit-feature flow."
> STOP reading this file.
>
> **If Scenario B:** Continue below.

---

## STEP 1 — Enter Plan Mode (IMMEDIATE)

Call \`EnterPlanMode\` immediately.

---

## STEP 2 — Read Existing Cross-Project Spec

Read ALL of these:
1. \`specs/$ARGUMENTS/requirements.md\` — existing unified requirements
2. \`specs/$ARGUMENTS/design.md\` — existing per-project design
3. \`specs/$ARGUMENTS/tasks.md\` — existing phased tasks (note checked ✓ items)
4. \`.claude/steering/cross-project-rules.md\` — existing API contract

After reading, summarise:
> "I've read the cross-project spec for **$ARGUMENTS**.
> Current state: [X tasks done, Y remaining]
> Backend phases: [done / in progress / not started]
> Frontend phases: [done / in progress / not started]
> I understand the addition/change. Proceeding to updated spec..."

---

## STEP 3 — GATE 1: Updated Requirements

Show the FULL updated unified \`requirements.md\`.
- Keep existing requirements intact
- Mark new additions with \`<!-- NEW -->\`
- Mark changed items with \`<!-- CHANGED: was "..." -->\`
- If the API contract changes, update the contract table

**After showing:**
> "Updated requirements — changes marked NEW/CHANGED.
> Does this capture the edit? Say **ok** to proceed."

---

## STEP 4 — GATE 2: Updated Design

Show the FULL updated \`design.md\` with per-project sections.
- Mark new layers/files with \`<!-- NEW -->\`
- If the API contract changes, update the shared contract section

**After showing:**
> "Updated design. Say **ok** to proceed to tasks."

---

## STEP 5 — GATE 3: Updated Tasks

Show the FULL updated \`tasks.md\`.

**Critical rules:**
- Keep all \`[x]\` tasks exactly as they are
- Keep all existing \`[ ]\` tasks unchanged
- Add new tasks at the bottom of the relevant phase, marked \`<!-- NEW -->\`
- If the edit adds a new phase, add it after existing phases
- Preserve the Phase 1 (contract) → Phase 2 (backend) → Phase 3 (frontend) order

**After showing:**
> "Updated tasks — new items marked NEW, existing progress preserved.
> Say **ok** to write the updated spec."

---

## STEP 6 — Exit Plan Mode + Write Updated Spec

After Gate 3 approval:

1. Call \`ExitPlanMode\`
2. Write updated spec at the workspace root:
   - \`specs/$ARGUMENTS/requirements.md\`
   - \`specs/$ARGUMENTS/design.md\`
   - \`specs/$ARGUMENTS/tasks.md\`
3. If the API contract changed, update \`.claude/steering/cross-project-rules.md\`

Then ask:
> "Spec updated. Which new tasks to implement?
> - **'all new'** — implement only the new tasks
> - **'backend new'** — new backend tasks only
> - **'frontend new'** — new frontend tasks only
> - **'spec only'** — stop here"

---

## STEP 7 — Implementation

Implement only the new tasks requested. Follow dependency order:
contract changes first, then backend, then frontend.

---

## RULES

- Cross-project specs live at the workspace root — check there first
- Existing spec content is never silently deleted
- Each gate requires explicit approval
- Preserve the contract → backend → frontend phase order
- If the API contract changes, update cross-project-rules.md
`;
}
