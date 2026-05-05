import { join } from 'path';
import type { GovernanceConfig } from '../types.js';
import { safeWrite, type WriteOptions } from '../utils/safe-write.js';

export function generateSpecTemplates(c: GovernanceConfig, opts: WriteOptions): void {
    const dir = c.projectDir;
    const b = c.blocks, p = c.profile, proj = c.project;

    safeWrite(join(dir, 'specs', '_template', 'requirements.md'), `# Requirements — [Feature Name]

| Field | Value |
|-------|-------|
| **Feature** | _replace_ |
| **${proj.ticketSystem}** | _replace_ |
| **Author** | _replace_ |
| **Status** | Draft |

## User Stories

### US-1 — _title_ \`[P1]\`
**As a** [role], **I want to** [action], **so that** [benefit].

\`\`\`
Scenario 1: [happy path]
  Given [precondition]
  When  [action]
  Then  [result]
\`\`\`

## Data Source
- [ ] Remote API
- [ ] Local Database / ${p.localStorageName}
- [ ] In-Memory Only

### API Endpoints (if Remote API)
**Readiness:**
- [ ] API is live
- [ ] Contract available, not live yet
- [ ] No contract yet — blocked

| Method | Endpoint | Purpose |
|--------|----------|---------|
| \`POST\` | \`/api/example\` | _describe_ |

## Out of Scope
- _list explicitly_

## Open Questions
_Max 3 \`[NEEDS CLARIFICATION]\` items_
`, opts);

    safeWrite(join(dir, 'specs', '_template', 'design.md'), `# Design — [Feature Name]

## Hard Rules Compliance
| # | Rule | Compliant? | Justification if No |
|---|------|:----------:|---------------------|
${b.hardRulesCompliance}

## Layer Mapping
| Layer | Responsibility | Applies? |
|-------|---------------|----------|
${b.designLayerTable}

## File List
### New Files
| File | Layer | Purpose |
|------|-------|---------|
${b.designFiles}

### Modified Files
| File | Change |
|------|--------|
| _e.g. routes file_ | _add route_ |

${c.isBackend ? `## API Flow
\`\`\`
Request → Middleware (auth/RBAC) → Handler → Model/Service → Response
\`\`\`

## Integration Points
| System | Purpose | Direction |
|--------|---------|-----------|
| _e.g. MySQL_ | _describe_ | in / out |` : `## State Design
\`\`\`
Initial → Loading → Success(data) | Error(failure)
\`\`\`

## Navigation
\`\`\`
[Entry] → [This Feature] → [Next]
\`\`\``}
`, opts);

    const uiLabel = c.isBackend ? 'API Layer' : 'UI';
    safeWrite(join(dir, 'specs', '_template', 'tasks.md'), `# Tasks — [Feature Name]

## Status Guide
| Marker | Meaning |
|--------|---------|
| \`- [ ]\` | Pending |
| \`- [x]\` | Done |
| \`⚠️ BLOCKED:\` | Cannot proceed |
| \`_(deferred)_\` | Deferred |

## Size Guide: S < 30min · M 30min–2h · L 2h+

---

## Phase 1 — Setup
- [ ] **[S]** Generate scaffold${c.scan.scaffoldTool ? ` (${c.scan.scaffoldTool})` : ''}
- [ ] **[S]** Define domain model(s)

## Phase 2 — Data Layer
${b.taskDataPhase}

## Phase 3 — Business Logic
${b.taskLogicPhase}

## Phase 4 — State
${b.taskStatePhase}

## Phase 5 — ${uiLabel}
${b.taskUIPhase}

## Phase 6 — Tests
${b.taskTestPhase}

## Phase 7 — Wrap-Up
- [ ] **[S]** Post-task checklist (${c.agent === 'kiro' ? '.kiro/steering/constitution.md' : '.claude/CLAUDE.md'})
- [ ] **[S]** Update feature README

---
## Blockers
| Blocker | Affects | Waiting On |
|---------|---------|-----------|
| _none_ | — | — |
`, opts);
}
