import type { WorkspaceConfig } from '../types.js';

export function generateWorkspaceAuditCommand(config: WorkspaceConfig): string {
  const { workspaceName, projects } = config;

  const groups = [...new Set(projects.map(p => p.group).filter(Boolean))];
  const hasGroups = groups.length > 0;

  const projectPaths = projects.map(p => `\`${p.relativePath}\``).join(', ');

  return `# /audit — Workspace Health Check

> **Workspace:** ${workspaceName}
> **Projects:** ${projects.length} (${projectPaths})
> **Layout:** ${hasGroups ? 'Grouped (' + groups.join(', ') + ')' : 'Flat'}

---

> ## ⚠️ EXECUTION RULES — READ BEFORE STARTING
>
> 1. **ALL phases are REQUIRED. Run every step. Do not stop early.**
> 2. **Do NOT output a VERDICT until the final step.**
> 3. **This is a WORKSPACE audit — it checks each project AND the cross-project governance layer.**
> 4. **Each project has its own \`.claude/\` governance. The workspace has its own \`.claude/\` at the root.**
> 5. **Cross-project specs live at the workspace root \`specs/\`, not in individual projects.**

---

## WHAT THIS AUDIT DOES

This audit runs in two stages:
1. **Per-project audit** — runs the full 12-step project truth check for each project
2. **Workspace-level audit** — checks cross-project governance, API contracts, workspace steering accuracy, and cross-project spec coverage

By the end, every project's \`.claude/steering/\` is accurate AND the workspace-level
\`.claude/steering/\` correctly describes the relationships between projects.

---

## PHASE 1 — WORKSPACE GOVERNANCE INVENTORY

### Step W1 — Workspace steering files

Read and confirm each workspace-level file exists and is non-empty:

- \`<workspace-root>/CLAUDE.md\` (redirect file)
- \`<workspace-root>/.claude/CLAUDE.md\` (workspace master rules)
- \`<workspace-root>/.claude/steering/workspace-policy.md\`
- \`<workspace-root>/.claude/steering/cross-project-rules.md\`
- \`<workspace-root>/.claude/steering/project-registry.md\`
- \`<workspace-root>/.claude/steering/workspace-overview.md\` (used by cross-project-spec-check hook)

Report: ✓ present / ✗ MISSING / ⚠ empty for each file.

### Step W2 — Project registry accuracy

Read \`.claude/steering/project-registry.md\`. For each project listed:
- Does the project directory actually exist on disk?
- Does the project have a \`.claude/CLAUDE.md\`?
- Is the stack listed in the registry correct? (check manifest files)

For each project directory on disk that is NOT in the registry:
- Flag as UNREGISTERED — governance may be missing

\`\`\`
PROJECT REGISTRY CHECK
${projects.map(p => `  ${p.relativePath}  [${p.stack}]  — registered: ✓ / exists: ✓`).join('\n')}
  [any unregistered projects found]
\`\`\`

### Step W3 — Workspace reference injection + hook check

For each project, check:
1. Its \`.claude/CLAUDE.md\` contains the "Workspace Rules" section with correct relative paths
2. The \`cross-project-spec-check\` hook is registered at the workspace level

\`\`\`
WORKSPACE REFERENCE CHECK
${projects.map(p => `  ${p.relativePath}/.claude/CLAUDE.md  — workspace reference: ✓ / ✗ MISSING`).join('\n')}

CROSS-PROJECT HOOK
  cross-project-spec-check: ✓ registered / ✗ MISSING
\`\`\`

> **After Step W3:** Say "Workspace governance scaffolding checked — proceeding to per-project audits" and continue.

---

## PHASE 2 — PER-PROJECT AUDITS

Run the **full project-level /audit** for each project in the workspace. For each project:

1. Navigate to the project directory
2. Execute all 12 steps of the project audit (governance files, hooks, settings, directory map, code observation, gap analysis, steering updates, spec coverage, test coverage, dead code, gap summary, scorecard)
3. Record the project's scorecard

**Project audit order:**

${projects.map((p, i) => `### Project ${i + 1}: \`${p.relativePath}\` [${p.stack}]

Run the full 12-step audit as defined in this project's \`.claude/commands/audit.md\`.

After completing, record:
\`\`\`
PROJECT SCORECARD — ${p.name}
  Governance Files:     __/100
  Governance Accuracy:  __/100
  Steering Coverage:    __/100
  Test Coverage:        __/100
  Dead File Risk:       __/100
  OVERALL:              __/100  Grade: _
  Gaps fixed: [N]
  Verdict: ALIGNED / UPDATED / ACTION NEEDED
\`\`\`
`).join('\n')}

> **After all project audits:** Say "All ${projects.length} project audits complete — proceeding to cross-project analysis" and continue.

---

## PHASE 3 — CROSS-PROJECT ANALYSIS

### Step W4 — API contract discovery

For each project, identify what it **exposes** and what it **consumes**:

**Backend projects** — look for:
- Route/endpoint definitions (Express routes, NestJS controllers, FastAPI routers, Spring controllers)
- List each endpoint: method, path, purpose
- Auth middleware applied (which endpoints are protected?)

**Frontend projects** — look for:
- API client files, service files, or fetch calls
- What backend endpoints are called?
- What base URL / API prefix is used?

**Mobile projects** — look for:
- API client / network layer
- What backend endpoints are called?

Compile into:
\`\`\`
API CONTRACT MAP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [backend project] EXPOSES:
    POST /api/auth/login          — user authentication
    GET  /api/users/:id           — fetch user profile
    ...

  [frontend project] CONSUMES:
    POST /api/auth/login          → src/services/auth.service.ts
    GET  /api/users/:id           → src/services/user.service.ts
    ...

  MISMATCHES:
    [frontend calls GET /api/users but backend only has GET /api/users/:id]
    [frontend calls POST /api/orders but no backend endpoint found]
    OR: "No mismatches found"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
\`\`\`

### Step W5 — Cross-project spec coverage

Check \`<workspace-root>/specs/\` for cross-project specs.

For each feature that spans multiple projects (identified by API contract map):
- Does a unified spec exist at the workspace root?
- Or are there separate specs in each project (legacy pattern — should be unified)?
- Is the spec current or stale?

\`\`\`
CROSS-PROJECT SPEC COVERAGE
  specs/user-auth/     — ✓ EXISTS (requirements + design + tasks)
  specs/notifications/ — ✗ MISSING (feature spans backend + frontend but no unified spec)
  [list each cross-project feature]
\`\`\`

### Step W6 — Cross-project dependency check

Check for violations of workspace rules:
- Any direct source imports between projects?
- Any shared types duplicated across projects?
- Any hardcoded URLs pointing to other projects?
- Any shared secrets or .env values that should be project-specific?

\`\`\`
CROSS-PROJECT VIOLATIONS
  [list each violation with file path and description]
  OR: "No cross-project violations found"
\`\`\`

### Step W7 — Shared resource mapping

Identify resources shared across projects:
- Database: do multiple projects connect to the same database?
- Auth: is there a shared auth service? Who owns it?
- Message queues: any event-driven communication?
- Shared libraries: any \`packages/\` or \`libs/\` directory?

\`\`\`
SHARED RESOURCES
  Database:    [shared / separate per project]
  Auth:        [owner project → consumers]
  Queue/Events: [if any]
  Shared libs:  [if any]
\`\`\`

### Step W8 — Compare reality to workspace steering

Read each workspace steering file and compare to what was discovered:

**cross-project-rules.md — check:**
- Does the "Project API Contracts" table match actual endpoints from Step W4?
- Does the "Shared Resources" table match Step W7?
- Does the "Change Impact Matrix" reflect actual dependencies?

**project-registry.md — check:**
- All projects listed with correct stacks?
- Descriptions filled in or still placeholder?

**workspace-overview.md — check:**
- Does it accurately describe the project layout?
- Is it used by the cross-project-spec-check hook?

**workspace-policy.md — check:**
- Do the rules match the actual project structure?

For each mismatch:
\`\`\`
WORKSPACE GAP: <steering file> says "<claim>"
  Reality: <what was actually found>
  Impact: <what Claude Code would do wrong>
\`\`\`

---

## PHASE 4 — FIX WORKSPACE GOVERNANCE

### Step W9 — Update workspace steering files

Fix every workspace gap identified in Step W8. Update directly — do not ask for permission.

**Rules:**
- Update \`cross-project-rules.md\` with actual API contracts from Step W4
- Update \`project-registry.md\` with correct project descriptions
- Update \`workspace-overview.md\` if project layout has changed
- Update \`workspace-policy.md\` if rules don't match reality
- Add any missing workspace references to project CLAUDE.md files

Record each update:
\`\`\`
UPDATED: .claude/steering/cross-project-rules.md
  Added: actual API contracts for [project] (12 endpoints)
  Corrected: [frontend] consumes column — was empty, now lists 8 endpoints
\`\`\`

---

## PHASE 5 — WORKSPACE REPORT

### Step W10 — Final workspace scorecard

\`\`\`
WORKSPACE AUDIT — ${workspaceName}
Date: <today>
Projects: ${projects.length}

━━━ PER-PROJECT SCORECARDS ━━━

| Project | Stack | Overall | Grade | Gaps Fixed | Verdict |
|---------|-------|---------|-------|------------|---------|
${projects.map(p => `| \`${p.relativePath}\` | ${p.stack} | __/100 | _ | _ | _ |`).join('\n')}

━━━ WORKSPACE GOVERNANCE ━━━

  Workspace Files       <score>/100  <Grade>
    (workspace steering files present and non-empty)

  Project Registry      <score>/100  <Grade>
    (all projects registered, stacks correct, descriptions filled)

  Cross-Project Rules   <score>/100  <Grade>
    (API contracts documented, shared resources mapped, impact matrix filled)

  Workspace References  <score>/100  <Grade>
    (every project CLAUDE.md has workspace reference with correct paths)

  API Contract Accuracy <score>/100  <Grade>
    (documented contracts match actual endpoints — deduct 10 per mismatch)

  Cross-Project Specs   <score>/100  <Grade>
    (features spanning projects have unified spec at workspace root)

  WORKSPACE OVERALL     <score>/100  Grade: <A/B/C/D>
    (average of 6 workspace categories above)

  COMBINED OVERALL      <score>/100  Grade: <A/B/C/D>
    (weighted: 60% average of project scores + 40% workspace score)

━━━ GRADE SCALE ━━━
  A: 90-100  B: 75-89  C: 60-74  D: <60

━━━ CROSS-PROJECT FINDINGS ━━━
  API mismatches: [N] (see Step W4)
  Cross-project specs missing: [N] (see Step W5)
  Cross-project violations: [N] (see Step W6)
  Shared resources undocumented: [N] (see Step W7)
  Workspace steering gaps fixed: [N] (see Step W9)

━━━ WORKSPACE VERDICT ━━━
  ALIGNED
    All projects and workspace governance are accurate.
    Development can start across all projects.
  OR
  UPDATED — [N] workspace gaps + [N] project gaps fixed
    Workspace and project steering now accurately describe reality.
    Development can start. Rerun /audit after major changes.
  OR
  ACTION NEEDED
    Governance updated, but developer decisions required:
    • [specific items — e.g. "API contracts between X and Y are mismatched"]
    • [specific items — e.g. "project Z has no tests"]
    • [specific items — e.g. "cross-project feature X has no unified spec"]
\`\`\`

> **After printing the scorecard, write the persistent audit records:**

### Persist: .claude/workspace-audit-report.md

Append a new run entry (same format as project audit-report.md but with workspace-level
scores and per-project summary table). Do not overwrite previous entries.

### Persist: .claude/workspace-actions.md

Action items that require developer decisions at the workspace level:
- API contract mismatches that need resolution
- Cross-project features missing unified specs
- Cross-project violations that need architectural decisions
- Shared resources that need an owner assignment
- Projects missing governance that need init

Use the same status tracking: \`[ ] OPEN\` · \`[x] DONE <date>\` · \`[→] DEFERRED <reason>\`

---

## RULES

- Run ALL per-project audits — do not skip any project
- Per-project audits use each project's own \`/audit\` command definition
- Workspace-level checks run AFTER all project audits complete
- Cross-project API discovery requires reading actual route/endpoint files — do not guess
- Cross-project specs live at the workspace root \`specs/\`, not in individual projects
- Update workspace steering files directly — no permission needed
- The workspace audit is rerunnable — scores improve as findings are fixed
`;
}
