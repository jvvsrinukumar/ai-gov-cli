import type { WorkspaceConfig, WorkspaceProject } from '../types.js';
import { backendProjects } from './helpers.js';

function frontendProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
  return projects.filter(p =>
    p.group === 'frontend' ||
    p.stack === 'react' || p.stack === 'angular'
  );
}

function mobileProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
  return projects.filter(p =>
    p.group === 'mobile' ||
    p.stack === 'flutter' || p.stack === 'kotlin' || p.stack === 'swiftui'
  );
}

export function generateWorkspaceNewFeatureCommand(config: WorkspaceConfig): string {
  const { workspaceName, projects } = config;

  const backends = backendProjects(projects);
  const frontends = frontendProjects(projects);
  const mobiles = mobileProjects(projects);

  const hasBackend = backends.length > 0;
  const hasFrontend = frontends.length > 0;
  const hasMobile = mobiles.length > 0;

  return `# /new-feature — Workspace New Feature (Cross-Project Aware)

> **Workspace:** ${workspaceName}
> **Projects:** ${projects.length}
${hasBackend ? `> **Backend:** ${backends.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}${hasFrontend ? `> **Frontend:** ${frontends.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}${hasMobile ? `> **Mobile:** ${mobiles.map(p => `\`${p.relativePath}\``).join(', ')}\n` : ''}
---

> **Scope routing is automatic.** The \`cross-project-spec-check\` hook reads
> \`.claude/steering/workspace-overview.md\` and your prompt to determine which
> projects are involved. You do NOT need to classify manually.
>
> - **Backend only** → uses backend project's own \`/new-feature\` command
> - **Frontend only** → uses frontend project's own \`/new-feature\` command
> - **Both (cross-project)** → uses this workspace-level flow

---

## How Scope Routing Works

The hook fires on every prompt. It reads your message and routes to one of three paths:

### Path 1 — Backend only
You mention only backend work (e.g., "add a new API endpoint for user profiles").
Claude Code says: "This task involves backend only. Using backend-level governance."
Spec goes in: \`${backends[0]?.relativePath || 'backend/<project>'}/specs/<feature>/\`
Uses the backend project's own spec templates and architecture rules.

### Path 2 — Frontend only
You mention only frontend work (e.g., "add a user profile page").
Claude Code says: "This task involves frontend only. Using frontend-level governance."
Spec goes in: \`${frontends[0]?.relativePath || 'frontend/<project>'}/specs/<feature>/\`
Uses the frontend project's own spec templates and architecture rules.

### Path 3 — Cross-project (this flow)
You mention both (e.g., "add user profiles with an API endpoint and a UI page").
Claude Code says: "This task spans 2 projects: backend, frontend. Using cross-project governance."
Spec goes in: \`specs/<feature>/\` **at the workspace root** (not in either project).
Uses the workspace-level cross-project spec templates.

---

## The Ideal Cross-Project Prompt

\`\`\`
Story: TICKET-1234
New feature: User profile management
- Backend: REST API for CRUD operations on user profiles
- Frontend: Profile page with edit form
[attach design screenshots]
\`\`\`

This makes the cross-project scope explicit. Claude Code creates ONE workspace-level spec
with the API contract defined first, then per-project design and tasks.

---

## STEP 0 — Enter Plan Mode (IMMEDIATE)

**Call \`EnterPlanMode\` immediately.**

In plan mode you CANNOT write or edit any files. You will show spec content as text
in the chat for developer review. File writes happen only after all 3 gates are approved.

> Feature name from \`$ARGUMENTS\`: use exactly as typed. If blank, ask: "What is the feature name?"

---

## STEP 1 — Read Context from ALL Affected Projects

For each affected project, read:
1. \`<project>/.claude/steering/architecture.md\` — layer rules, zone rules
2. \`<project>/.claude/steering/coding-standards.md\` — naming, conventions
3. \`<workspace-root>/.claude/steering/cross-project-rules.md\` — existing API contracts
4. \`<workspace-root>/.claude/steering/workspace-overview.md\` — project registry

---

## STEP 2 — GATE 1: Unified Requirements

Show ONE unified requirements document covering ALL affected projects:

\`\`\`markdown
# Requirements: $ARGUMENTS (Cross-Project)

| Field | Value |
|-------|-------|
| **Feature** | $ARGUMENTS |
| **Ticket** | _from prompt or ask_ |
| **Scope** | Cross-project: ${hasBackend ? 'backend' : ''}${hasBackend && hasFrontend ? ' + ' : ''}${hasFrontend ? 'frontend' : ''} |
| **Status** | Draft |

## Overview
[1-2 sentence description — what this feature does across the workspace]

## Requirements by Project

| # | Requirement | Project | Priority |
|---|-------------|---------|----------|
| R1 | [backend requirement — e.g. "REST endpoint returns user profile"] | backend | P1 |
| R2 | [backend requirement — e.g. "Validate email format on create"] | backend | P1 |
| R3 | [frontend requirement — e.g. "Profile page displays user data"] | frontend | P1 |
| R4 | [frontend requirement — e.g. "Edit form with validation"] | frontend | P1 |
| R5 | [shared — e.g. "Error states handled consistently"] | both | P1 |

## API Contract (the bridge between projects)

> This is the source of truth. Both projects implement against this contract.

| Method | Endpoint | Request Body | Response Body | Auth | Status |
|--------|----------|-------------|---------------|------|--------|
| GET    | /api/... | —           | \`{ ... }\`    | JWT  | new    |
| POST   | /api/... | \`{ ... }\`  | \`{ ... }\`    | JWT  | new    |

### Error Responses
| Status | When | Response Body |
|--------|------|--------------|
| 400    | validation fails | \`{ error: "..." }\` |
| 401    | not authenticated | \`{ error: "Unauthorized" }\` |
| 404    | not found | \`{ error: "Not found" }\` |

## Out of Scope
- [explicitly what will NOT be built]
\`\`\`

**After showing:**
> "These are the unified requirements for **$ARGUMENTS** spanning backend and frontend.
> The API contract is the critical bridge — both projects implement against it.
> Say **ok** to proceed to design, or tell me what to change."

**DO NOT proceed until explicit approval.**

---

## STEP 3 — GATE 2: Per-Project Design (one document)

Show ONE design document with per-project sections:

\`\`\`markdown
# Design: $ARGUMENTS (Cross-Project)

## Shared API Contract
[repeat the contract table from requirements — this is the source of truth]

---

## Backend Design — \`<backend project>\` [<stack>]

### Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
| [per backend stack layers] | \`<path>\` | [responsibility] |

### Data Flow
[request path through backend layers: Route → Controller → Service → Repository → DB]

### Data Model
\`\`\`sql
-- or ORM model definition
\`\`\`

---

## Frontend Design — \`<frontend project>\` [<stack>]

### Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
| [per frontend stack layers] | \`<path>\` | [responsibility] |

### Data Flow
[user action → API call → state update → UI render]

### State Shape
\`\`\`typescript
// or relevant language
interface FeatureState {
  data: T | null;
  loading: boolean;
  error: string | null;
}
\`\`\`

### Error Handling
[how frontend handles each backend error response from the contract]
\`\`\`

**After showing:**
> "Design covers both projects in one document. The API contract is the shared interface.
> Say **ok** to proceed to tasks, or adjust."

**DO NOT proceed until explicit approval.**

---

## STEP 4 — GATE 3: Phased Tasks (dependency-ordered)

Show ONE tasks document with phases ordered by dependency:

\`\`\`markdown
# Tasks: $ARGUMENTS (Cross-Project)

## Implementation Order
> **Phase 1 (API contract) → Phase 2 (backend) → Phase 3 (frontend)**
> The API contract is defined first. Backend implements it. Frontend consumes it.
> If developers work in parallel, frontend can mock the contract until backend is ready.

---

## Phase 1 — API Contract Definition
- [ ] **[S]** Define request/response schemas (shared types)
- [ ] **[S]** Document endpoint paths, methods, auth requirements
- [ ] **[S]** Define error response shapes
- [ ] **[S]** Write contract to \`.claude/steering/cross-project-rules.md\`

## Phase 2 — Backend Implementation (\`<backend project>\`)
- [ ] **[M]** Create domain model / entity
- [ ] **[M]** Create repository / data access layer
- [ ] **[M]** Create service with business logic
- [ ] **[M]** Create controller / route matching the API contract
- [ ] **[S]** Add request validation
- [ ] **[S]** Add error responses matching the contract
- [ ] **[M]** Write unit tests for service
- [ ] **[M]** Write integration tests for endpoints — verify contract compliance

## Phase 3 — Frontend Implementation (\`<frontend project>\`)
- [ ] **[S]** Create TypeScript interfaces matching the API contract
- [ ] **[M]** Create API client / service for the new endpoints
- [ ] **[M]** Create state management (store / hook / cubit)
- [ ] **[L]** Create page component + child components
- [ ] **[S]** Add error handling for each API error response
- [ ] **[S]** Register route / navigation
- [ ] **[M]** Write component tests
- [ ] **[M]** Write API integration tests (mock server)

## Phase 4 — Cross-Project Verification
- [ ] **[M]** Backend endpoints match the API contract exactly
- [ ] **[M]** Frontend API calls match the API contract exactly
- [ ] **[S]** Error responses handled correctly on both sides
- [ ] **[S]** Update \`.claude/steering/cross-project-rules.md\` with final contract
- [ ] **[S]** Feature README in both projects

## Definition of Done
- [ ] All backend phases complete and tests pass
- [ ] All frontend phases complete and tests pass
- [ ] End-to-end flow verified
- [ ] API contract documented in cross-project-rules.md
\`\`\`

**After showing:**
> "Tasks are phased by dependency: contract first, then backend, then frontend.
> Say **ok** to lock the spec and write files, or adjust."

**DO NOT write anything until Gate 3 is explicitly approved.**

---

## STEP 5 — Exit Plan Mode + Write Spec Files

After Gate 3 approval:

1. **Call \`ExitPlanMode\` tool**
2. Write ONE unified spec at the **workspace root**:
   - \`specs/$ARGUMENTS/requirements.md\` — the approved Gate 1 content
   - \`specs/$ARGUMENTS/design.md\` — the approved Gate 2 content
   - \`specs/$ARGUMENTS/tasks.md\` — the approved Gate 3 content
3. Update \`.claude/steering/cross-project-rules.md\` with the new API contract

> **The spec lives at the workspace root, NOT in either project.**
> This is intentional — a cross-project feature belongs to the workspace, not to one project.

Then ask:

> "Spec is locked at \`specs/$ARGUMENTS/\`.
> How would you like to implement?
> - **'all'** — Phase 1 (contract) → Phase 2 (backend) → Phase 3 (frontend) → Phase 4 (verify)
> - **'backend'** — Phase 1 + Phase 2 only (frontend later)
> - **'frontend'** — Phase 3 only (assumes backend API exists or will be mocked)
> - **'phase 1'** — API contract definition only
> - **'spec only'** — stop here, implement later"

---

## STEP 6 — Dependency-Ordered Implementation

Implement in the order the developer requested.

**Critical rules:**
- Phase 1 (contract) is always done first — it defines what both projects build against
- Phase 2 (backend) completes before Phase 3 (frontend) starts, unless developer explicitly requests parallel work
- When working in a project, follow THAT project's architecture and coding standards
- Read the project's \`.claude/CLAUDE.md\` before writing any file in that project
- Do NOT apply one project's patterns to another
- After completing backend endpoints: verify they match the API contract
- After completing frontend API calls: verify they match the API contract
- Update the workspace-root \`tasks.md\` as phases complete (\`[ ]\` → \`[x]\`)

**After all requested phases:**
> "Implementation complete.
> Phase 1 (contract): ✓
> Phase 2 (backend): [N] tasks done in \`<project>\`
> Phase 3 (frontend): [N] tasks done in \`<project>\`
> API contract documented in cross-project-rules.md.
> Continue with remaining phases?"

---

## RULES

- Scope routing is automatic — the hook determines if this is single-project or cross-project
- If single-project: the hook routes to that project's own \`/new-feature\` — this file is not used
- Cross-project features produce ONE spec at the workspace root, not separate specs per project
- The API contract is defined in Phase 1 before any implementation begins
- Plan mode is active from Step 0 through end of Step 4 — zero file writes
- Each gate requires explicit approval — do not auto-advance
- Backend is implemented before frontend by default (API must exist before consumer)
- Never import directly between project source directories
`;
}
