import type { WorkspaceConfig, WorkspaceProject } from '../types.js';

function projectOptionsList(projects: WorkspaceProject[]): string {
  return projects
    .map(p => `- \`${p.relativePath}\` — ${p.stack}${p.group ? ` (${p.group})` : ''}`)
    .join('\n');
}

export function generateWorkspaceExploreCommand(config: WorkspaceConfig): string {
  const { workspaceName, projects } = config;

  return `# /explore — Workspace Explore (Cross-Project Aware)

> **Workspace:** ${workspaceName}
> **Projects:** ${projects.length}

> Use when you need to understand a feature, module, or data flow that may span multiple projects.
> The entire reading phase is in plan mode — nothing is written until you choose a next action.
> Transitions seamlessly into /fix, /refactor, create spec, or /new-feature — without re-reading files.

---

> **Scope routing is automatic.** The \`cross-project-spec-check\` hook reads
> your prompt and determines which projects are involved.
>
> - **Single project** → uses that project's own \`/explore\` command
> - **Cross-project** → uses this workspace-level flow

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately. You will stay in plan mode throughout the entire reading phase.
No files written or modified until the developer chooses a next action at the gate.

---

## STEP 2 — Identify Affected Projects

Based on \`$ARGUMENTS\`, identify which projects are involved:

\`\`\`
CROSS-PROJECT EXPLORATION SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploring: $ARGUMENTS

  Projects to read:
    [list each project relevant to this exploration]

  Available projects:
${projectOptionsList(projects)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

If scope is unclear: "To confirm — should I explore [X] across all projects, or focus on [specific projects]?"

---

## STEP 3 — Read Files Across Projects (in plan mode)

For each affected project, read:
- Source files related to the scope (all layers — routes, services, models, components, etc.)
- Spec files: check BOTH \`<project>/specs/\` AND \`<workspace-root>/specs/\`
  (cross-project specs live at the workspace root)
- Test files (if they exist)
- The project's \`.claude/steering/architecture.md\`

Also read:
- \`<workspace-root>/.claude/steering/cross-project-rules.md\` — documented API contracts
- \`<workspace-root>/.claude/steering/workspace-overview.md\` — project relationships

---

## STEP 4 — Cross-Project Code Map (output while still in plan mode)

\`\`\`
━━━ CROSS-PROJECT CODE MAP — $ARGUMENTS ━━━

  END-TO-END DATA FLOW:
    [trace the complete flow from user action to data source and back]

    User action (frontend)
      → [frontend file] — [what it does]
      → API call: [METHOD /endpoint]
      ↓
    API endpoint (backend)
      → [backend route/controller file] — [receives request]
      → [backend service file] — [business logic]
      → [backend repository/model file] — [data access]
      → [database / external service]
      ↓
    Response
      → [backend serializes response]
      → [frontend receives and updates state]
      → [frontend renders UI]
\`\`\`

For each project involved, show:
\`\`\`
  ── <project path> [<stack>] ──────────────────────────────────

    Layer structure observed:
      [layer] → [directory/file] — [what it does]

    Patterns in use:
      HTTP/Network: [client or framework pattern]
      State:        [state approach]
      Data access:  [ORM / raw SQL / SDK]
      Naming:       [file + class naming convention]

    Files read:
      [file path] — [N] lines — [role in the flow]
\`\`\`

Also show:
\`\`\`
  ── API CONTRACT (observed) ───────────────────────────────────

    | Method | Endpoint | Backend file | Frontend file | Match? |
    |--------|----------|-------------|---------------|--------|
    | GET    | /api/... | routes/x.ts | services/x.ts | ✓ / ✗  |

    Contract documented in cross-project-rules.md: ✓ / ✗ MISSING / ⚠ STALE
\`\`\`

---

## STEP 5 — Cross-Project Findings (output while still in plan mode)

\`\`\`
━━━ CROSS-PROJECT FINDINGS ━━━

  Spec coverage:
    Workspace root (specs/): [ ] MISSING / [ ] EXISTS / [ ] STALE
    <project A> (specs/):    [ ] MISSING / [ ] EXISTS / [ ] STALE
    <project B> (specs/):    [ ] MISSING / [ ] EXISTS / [ ] STALE

  Tests:
    <project A>: [ ] SCENARIO A / B / C
    <project B>: [ ] SCENARIO A / B / C

  API contract status:
    [ ] DOCUMENTED — cross-project-rules.md has this contract
    [ ] UNDOCUMENTED — contract exists in code but not in steering
    [ ] MISMATCHED — documented contract differs from actual code
    [ ] MISSING — no contract found

  Cross-project issues:
    • [e.g. "frontend calls GET /api/users but backend returns different shape"]
    • [e.g. "error handling mismatch — backend returns 422, frontend only handles 400"]
    • [e.g. "shared type defined differently in both projects"]
    • [or "None spotted"]

  Architecture match:
    <project A>: [ ] Matches steering / [ ] Zone mismatch
    <project B>: [ ] Matches steering / [ ] Zone mismatch
\`\`\`

---

## STEP 6 — Next Action Gate (still in plan mode)

Based on findings above, show only the relevant options:

\`\`\`
━━━ WHAT WOULD YOU LIKE TO DO? ━━━

  [show if no spec found at workspace root OR in either project]
  create spec   → I'll write ONE unified spec at specs/[name]/ at the workspace root
                  documenting what exists RIGHT NOW across both projects.
                  This is a reverse spec — records reality, not a new design.

  [show if spec exists but is STALE]
  update spec   → I'll update the spec to match what the code actually does.
                  Drifted sections will be marked <!-- UPDATED -->.

  [show if API contract is UNDOCUMENTED or MISMATCHED]
  document contract → I'll update cross-project-rules.md with the actual API contract.

  new-feature   → Build something new that spans these projects.
                  I'll transition to the workspace /new-feature flow with context loaded.

  fix [desc]    → Tell me what bug to fix. Files are already loaded — no re-reading.
                  If the fix spans projects, I'll coordinate changes in both.

  refactor      → Describe the structural change. I have the cross-project map ready.

  done          → You have the context you needed. No changes.
\`\`\`

**DO NOT write any file until the developer states their choice.**

---

## STEP 7A — Developer says: create spec

Call \`ExitPlanMode\`.

Write ONE unified spec at the **workspace root** documenting what already exists:

**\`specs/[name]/requirements.md\`** — derived from observed behaviour:
- Requirements table tagged by project (backend / frontend / both)
- API contract: from actual route and service files
- Out of scope: what was NOT found in the code

**\`specs/[name]/design.md\`** — from the Code Map:
- Per-project layer maps (actual layers observed)
- Shared API contract section
- Data flow: actual flow traced in Step 4
- Deviations: any issues from Findings

**\`specs/[name]/tasks.md\`** — what needs to happen next:
- Phase 1: address cross-project issues (contract mismatches, missing error handling)
- Phase 2: backend cleanup / test coverage
- Phase 3: frontend cleanup / test coverage

> The spec lives at the workspace root because it describes a cross-project feature.

---

## STEP 7B — Developer says: document contract

Call \`ExitPlanMode\`.

Update \`.claude/steering/cross-project-rules.md\` with the actual API contract
discovered in Step 4. Include endpoint table, owner project, consumers, and
update the Change Impact Matrix.

---

## STEP 7C — Developer says: new-feature

Call \`ExitPlanMode\`.

Transition into the workspace \`/new-feature\` flow. Files are already loaded —
skip the context reading step. The Cross-Project Code Map provides the
architectural context needed for the design gates.

---

## STEP 7D — Developer says: fix [desc]

Call \`ExitPlanMode\`.

If the fix is within one project: transition to that project's \`/fix\` flow.
If the fix spans projects (e.g. API contract mismatch): coordinate fixes in both.
Files already loaded — skip reading steps.

---

## STEP 7E — Developer says: refactor / done

Call \`ExitPlanMode\`.
Refactor: show impact table per project, get approval, then apply.
Done: no files written.

---

## RULES

- Scope routing is automatic — the hook determines if this is single-project or cross-project
- \`EnterPlanMode\` immediately — the entire exploration phase is read-only
- Cross-project specs live at the workspace root \`specs/\`, not in individual projects
- The Cross-Project Code Map traces the FULL end-to-end flow across project boundaries
- API contract accuracy is a first-class finding — mismatches are always flagged
- Do not apply one project's patterns to another during exploration
- When transitioning to fix/refactor/new-feature: do not re-read files already loaded
`;
}
