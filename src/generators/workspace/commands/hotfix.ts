import type { WorkspaceConfig } from '../types.js';
import { backendProjects, frontendProjects } from './helpers.js';

export function generateWorkspaceHotfixCommand(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);

    return `# /hotfix — Workspace Hotfix (Cross-Project Aware)

> **Workspace:** ${workspaceName}

> Fast diagnosis. Most hotfixes are single-project (the backend API is down,
> or the frontend deploy broke). Cross-project hotfixes are rare but happen
> when a deploy in one project breaks the other.

---

## STEP 0 — Classify Scope

Read \`$ARGUMENTS\`. Determine which scenario applies:

### Scenario A — Single-Project Hotfix (most common)
Production issue in one project. Fix stays in that project.

**Action:** Identify the project → run that project's \`/hotfix\` command.

### Scenario B — Cross-Project Hotfix
A deploy in one project broke another (e.g., backend API change broke frontend).

**Indicators:**
- "Frontend broke after backend deploy"
- "API returns new shape, frontend crashes"
- Error involves a contract change between projects

**Action:** Continue with this workspace-level flow.

---

> **If Scenario A:** State "This hotfix is in \`<project>\`. Using that project's /hotfix flow."
> STOP reading this file.
>
> **If Scenario B:** Continue below.

---

## STEP 1 — Enter Plan Mode

Call \`EnterPlanMode\` immediately. Read fast — max 5 files per project.

---

## STEP 2 — Cross-Project Emergency Diagnosis (THE GATE)

\`\`\`
━━━ CROSS-PROJECT EMERGENCY DIAGNOSIS ━━━
  Issue:      [what is broken in production]
  Trigger:    [what deploy or change caused this]
  Root cause: [which project changed, what broke the contract]

  Fix plan:
${backends.length ? `    Backend (\`${backends[0]?.relativePath}\`):  [revert / patch / no change]\n` : ''}${frontends.length ? `    Frontend (\`${frontends[0]?.relativePath}\`): [revert / patch / no change]\n` : ''}    Contract: [was the contract violated? update cross-project-rules.md?]

  Risk: [low / medium / high]

Say apply to proceed immediately.
\`\`\`

**DO NOT apply until the developer says apply.**

---

## STEP 3 — Apply Fix (after gate)

Call \`ExitPlanMode\`. Apply minimal change in the affected project(s).

If the contract was violated, update \`.claude/steering/cross-project-rules.md\`.

---

## STEP 4 — Post-Fix Summary (REQUIRED)

\`\`\`
━━━ HOTFIX SUMMARY — Requires Review ━━━
  Issue:       [production problem]
  Root cause:  [what was wrong, which project]
  Fix applied: [file + change per project]
  Contract:    [updated / unchanged]
  Follow-up:
    [ ] Code review in both projects
    [ ] Add cross-project integration test
    [ ] Monitor [metric] after deploy
    [ ] Update cross-project-rules.md if not already done
\`\`\`

---

## RULES

- Most hotfixes are single-project — default to Scenario A
- Max 5 files per project — if more, reclassify as /refactor
- Post-fix summary is never optional
- If the contract was violated, document it immediately
`;
}
