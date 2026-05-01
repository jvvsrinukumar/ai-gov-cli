import type { WorkspaceConfig } from '../types.js';
import { backendProjects, frontendProjects } from './helpers.js';

export function generateWorkspaceRefactorCommand(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);

    return `# /refactor — Workspace Refactor (Cross-Project Aware)

> **Workspace:** ${workspaceName}

> Scope routing is automatic. Most refactors are single-project.
> Cross-project refactors (e.g., changing an API contract shape, extracting
> a shared library) require coordination across projects.

---

## STEP 0 — Classify Scope

Read \`$ARGUMENTS\`. Determine which scenario applies:

### Scenario A — Single-Project Refactor (most common)
The refactor is contained within one project. No API contract changes.

**Action:** Identify the project → run that project's \`/refactor\` command.

### Scenario B — Cross-Project Refactor
The refactor changes an API contract, moves shared logic, or restructures
how projects communicate.

**Indicators:**
- "Change the user API response shape"
- "Extract shared types into a common package"
- "Rename the auth endpoints"
- Any change that affects both the producer and consumer of an API

**Action:** Continue with this workspace-level flow.

---

> **If Scenario A:** State "This refactor is in \`<project>\`. Using that project's /refactor flow."
> STOP reading this file.
>
> **If Scenario B:** Continue below.

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately.

---

## STEP 2 — Read Across Projects (in plan mode)

Read the relevant files in ALL affected projects:
1. The files being refactored
2. All callers/consumers of the code being changed
3. The API contract in \`.claude/steering/cross-project-rules.md\`

---

## STEP 3 — Cross-Project Impact Analysis (THE GATE)

\`\`\`
━━━ CROSS-PROJECT IMPACT ANALYSIS ━━━
  Scope: $ARGUMENTS

  Projects affected:
${backends.length ? `    Backend (\`${backends[0]?.relativePath}\`):\n      | File | Current | After |\n      |------|---------|-------|\n      | [file] | [current] | [after] |\n` : ''}
${frontends.length ? `    Frontend (\`${frontends[0]?.relativePath}\`):\n      | File | Current | After |\n      |------|---------|-------|\n      | [file] | [current] | [after] |\n` : ''}
  API contract change:
    [describe what changes in the contract, or "no contract change"]

  Behaviour change: None — structural refactor only.
  Migration needed: [yes — both projects must update simultaneously / no]

Say approved to proceed. Tests will run before refactoring begins.
Wrong type? Redirect:
  /fix     — if this is actually a bug
  /hotfix  — if production is broken
  stop     — cancel
\`\`\`

**DO NOT write any file until the developer says approved.**

---

## STEP 4 — Run Tests Before Refactoring (after gate)

Call \`ExitPlanMode\`.

Run tests in EACH affected project. If any project's tests fail before the
refactor, stop — fix first, then refactor.

---

## STEP 5 — Apply Refactor (dependency order)

1. If the API contract changes: update \`.claude/steering/cross-project-rules.md\` first
2. Refactor the producer (backend) first
3. Refactor the consumer (frontend) to match
4. If extracting shared code: create the shared package first, then update both consumers

---

## STEP 6 — Run Tests After Refactoring

Run tests in ALL affected projects. All must pass before closing.

---

## RULES

- Most refactors are single-project — default to Scenario A
- Cross-project refactors require the API contract to be updated first
- Tests must pass in ALL affected projects before and after
- No behaviour changes — if a bug is found, note it for \`/fix\`
- No feature additions during refactor
`;
}
