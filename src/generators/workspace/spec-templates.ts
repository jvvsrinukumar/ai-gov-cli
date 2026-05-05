import { join } from 'path';
import type { WorkspaceConfig } from './types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { backendProjects, frontendProjects } from './commands/helpers.js';

export function generateWorkspaceSpecTemplates(config: WorkspaceConfig, opts: WriteOptions): void {
    const { workspaceDir, projects } = config;
    const agent = config.agent ?? 'claude-code';
    const specsRoot = agent === 'kiro' ? '.kiro/specs' : 'specs';
    const crossProjectRulesPath = agent === 'kiro'
        ? '.kiro/steering/cross-project-rules.md'
        : '.claude/steering/cross-project-rules.md';

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);

    const backendList = backends.map(p => p.relativePath).join(', ') || '_none_';
    const frontendList = frontends.map(p => p.relativePath).join(', ') || '_none_';

    const templateDir = join(workspaceDir, specsRoot, '_cross-project-template');

    safeWrite(join(templateDir, 'requirements.md'), `# Requirements — [Feature Name] (Cross-Project)

| Field | Value |
|-------|-------|
| **Feature** | _replace_ |
| **Ticket** | _replace_ |
| **Scope** | Cross-project |
| **Backend** | ${backendList} |
| **Frontend** | ${frontendList} |
| **Status** | Draft |

## Overview
_1-2 sentence description of what this feature does across the workspace_

## Requirements by Project

| # | Requirement | Project | Priority |
|---|-------------|---------|----------|
| R1 | _backend requirement_ | backend | P1 |
| R2 | _frontend requirement_ | frontend | P1 |
| R3 | _shared requirement_ | both | P1 |

## API Contract

> This is the source of truth. Both projects implement against this contract.

| Method | Endpoint | Request Body | Response Body | Auth | Status |
|--------|----------|-------------|---------------|------|--------|
| \`GET\` | \`/api/example\` | — | \`{ ... }\` | JWT | new |
| \`POST\` | \`/api/example\` | \`{ ... }\` | \`{ ... }\` | JWT | new |

### Error Responses
| Status | When | Response Body |
|--------|------|--------------|
| 400 | validation fails | \`{ error: "..." }\` |
| 401 | not authenticated | \`{ error: "Unauthorized" }\` |
| 404 | not found | \`{ error: "Not found" }\` |

## Out of Scope
- _list explicitly_

## Open Questions
_Max 3 items_
`, opts);

    safeWrite(join(templateDir, 'design.md'), `# Design — [Feature Name] (Cross-Project)

## Shared API Contract
_Copy the API contract table from requirements.md — this is the source of truth_

---

## Backend Design — \`_backend project path_\` [_stack_]

### Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
| _Route/Controller_ | \`_path_\` | _HTTP handling_ |
| _Service_ | \`_path_\` | _Business logic_ |
| _Repository_ | \`_path_\` | _Data access_ |

### Data Flow
\`\`\`
Request → Middleware (auth) → Controller → Service → Repository → DB → Response
\`\`\`

### Data Model
\`\`\`
_define the data model / entity / table_
\`\`\`

---

## Frontend Design — \`_frontend project path_\` [_stack_]

### Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
| _Component_ | \`_path_\` | _UI rendering_ |
| _State_ | \`_path_\` | _State management_ |
| _Service_ | \`_path_\` | _API calls_ |

### Data Flow
\`\`\`
User action → API call → State update → UI render
\`\`\`

### State Shape
\`\`\`
_define the state model_
\`\`\`

### Error Handling
_How frontend handles each backend error response from the contract_
`, opts);

    safeWrite(join(templateDir, 'tasks.md'), `# Tasks — [Feature Name] (Cross-Project)

## Status Guide
| Marker | Meaning |
|--------|---------|
| \`- [ ]\` | Pending |
| \`- [x]\` | Done |
| \`⚠️ BLOCKED:\` | Cannot proceed |

## Implementation Order
> **Phase 1 (API contract) → Phase 2 (backend) → Phase 3 (frontend) → Phase 4 (verify)**
> Backend is implemented before frontend. The API contract is defined first.

---

## Phase 1 — API Contract Definition
- [ ] **[S]** Define request/response schemas
- [ ] **[S]** Document endpoint paths, methods, auth requirements
- [ ] **[S]** Define error response shapes
- [ ] **[S]** Write contract to \`${crossProjectRulesPath}\`

## Phase 2 — Backend Implementation (\`_backend project_\`)
- [ ] **[M]** Create domain model / entity
- [ ] **[M]** Create repository / data access layer
- [ ] **[M]** Create service with business logic
- [ ] **[M]** Create controller / route matching the API contract
- [ ] **[S]** Add request validation
- [ ] **[S]** Add error responses matching the contract
- [ ] **[M]** Write unit tests for service
- [ ] **[M]** Write integration tests — verify contract compliance

## Phase 3 — Frontend Implementation (\`_frontend project_\`)
- [ ] **[S]** Create types / interfaces matching the API contract
- [ ] **[M]** Create API client / service for the new endpoints
- [ ] **[M]** Create state management
- [ ] **[L]** Create page / screen component
- [ ] **[S]** Add error handling for each API error response
- [ ] **[S]** Register route / navigation
- [ ] **[M]** Write component tests
- [ ] **[M]** Write API integration tests (mock server)

## Phase 4 — Cross-Project Verification
- [ ] **[M]** Backend endpoints match the API contract exactly
- [ ] **[M]** Frontend API calls match the API contract exactly
- [ ] **[S]** Error responses handled correctly on both sides
- [ ] **[S]** Update \`${crossProjectRulesPath}\` with final contract
- [ ] **[S]** Feature README in both projects

---
## Blockers
| Blocker | Affects | Waiting On |
|---------|---------|-----------|
| _none_ | — | — |
`, opts);
}
