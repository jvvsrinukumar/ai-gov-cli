import type { WorkspaceConfig } from '../types.js';
import { backendProjects, frontendProjects } from './helpers.js';

export function generateWorkspaceFixCommand(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);

    return `# /fix — Workspace Bug Fix (Cross-Project Aware)

> **Workspace:** ${workspaceName}

> Scope routing is automatic. The hook detects which projects are involved.
> Most bugs live in one project. Cross-project bugs (e.g., API contract mismatch
> causing frontend errors) are coordinated across both.

---

## STEP 0 — Classify Scope

Read \`$ARGUMENTS\`. Determine which scenario applies:

### Scenario A — Single-Project Bug (most common)
The bug is in one project. The fix stays in that project.

**Action:** Identify the project → run that project's \`/fix\` command.

### Scenario B — Cross-Project Bug
The bug manifests in one project but the root cause is in another, or the fix
requires changes in both (e.g., backend returns wrong shape, frontend crashes).

**Indicators:**
- "The frontend shows an error when calling the user API"
- "The API returns 500 but the frontend expects 404"
- Error involves data flowing between projects

**Action:** Continue with this workspace-level flow.

---

> **If Scenario A:** State "This bug is in \`<project>\`. Using that project's /fix flow."
> STOP reading this file.
>
> **If Scenario B:** Continue below.

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately.

---

## STEP 2 — Read Across Projects (in plan mode)

Read the relevant files in BOTH projects:
1. The file where the error manifests (usually frontend)
2. The file that produces the data (usually backend endpoint)
3. The API contract in \`.claude/steering/cross-project-rules.md\`

---

## STEP 3 — Cross-Project Root Cause (THE GATE)

\`\`\`
━━━ CROSS-PROJECT ROOT CAUSE ━━━
  Symptom:     [what the user sees — which project]
  Root cause:  [what is actually wrong — which project, which file]
  Contract:    [does the API contract match what both sides expect?]

  Fix plan:
${backends.length ? `    Backend (\`${backends[0]?.relativePath}\`):  [what changes, or "no change needed"]\n` : ''}${frontends.length ? `    Frontend (\`${frontends[0]?.relativePath}\`): [what changes, or "no change needed"]\n` : ''}
  Contract update: [yes — update cross-project-rules.md / no — contract was correct]

  Scope: [N] files across [N] projects

Say apply to proceed.
Wrong type? Redirect:
  /refactor    — structural issue, not a bug
  /new-feature — capability is missing
  stop         — cancel
\`\`\`

**DO NOT write any file until the developer says apply.**

---

## STEP 4 — Apply Fix (after gate)

Call \`ExitPlanMode\`.

1. Fix the root cause project first (usually backend)
2. Fix the consuming project if needed (usually frontend)
3. Update \`.claude/steering/cross-project-rules.md\` if the contract was wrong

Minimum change only. Do not refactor surrounding code.

---

## STEP 5 — Verify

Run tests in EACH affected project. Report results per project.

If the API contract was updated, verify both sides match the new contract.

---

## RULES

- Most bugs are single-project — default to Scenario A unless cross-project evidence is clear
- Root cause must identify WHICH project owns the bug
- Fix the root cause project first, then the consumer
- If the API contract was wrong, update cross-project-rules.md
- Minimum change — do not refactor while fixing
`;
}
