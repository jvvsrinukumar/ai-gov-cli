import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowNewFeature(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const layerFlow = c.profile.layerFlow;
    const featuresDir = c.profile.featuresDir.replace(/\/$/, '');
    const testCmd = c.profile.testCmd || 'run tests';
    const phases = getPhases(c);
    const fileExt = c.profile.fileExt;

    return JSON.stringify({
        name: 'New Feature',
        version: c.hookVersion,
        description: 'Start a new feature using the spec-first 3-gate workflow',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `NEW FEATURE — Spec-first 3-gate workflow for ${stackDisplay}.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Features dir: ${featuresDir}/
Test command: ${testCmd}
File extension: ${fileExt}

> This is a new session — you have no conversation history. Get context from disk first.

## STEP 0 — Orient from disk before asking anything

Read .kiro/specs/ to check for existing work:
- If a feature folder exists with incomplete tasks (- [ ] items in tasks.md), it is in progress.
- List any in-progress features: name + how many tasks remain.

Then ask exactly ONE question to the user:

If IN-PROGRESS features exist:
  "I found these in-progress features:
   [list each: name — N tasks remaining, next: <first unchecked task>]

   Continue one of these, or start a new feature?
   If continuing: which one?
   If new: Feature name + brief description (1-2 sentences)."

If NO in-progress features:
  "What feature are you building?
   — Feature name (e.g. payment-checkout, user-profile)
   — What it should do (1-2 sentences)
   — Any specific requirements or constraints"

Do not ask any further questions after the user answers. Use their answer to drive all three gates.

---

## GATE 1 — REQUIREMENTS

Draft and show IN CHAT (do NOT write any file yet):

\`\`\`markdown
# Feature: <name>

## Overview
[1-2 sentences from user's description]

## Acceptance Criteria
- [ ] [primary behaviour]
- [ ] [edge case or validation]
- [ ] [error state]

## API Contracts (if applicable)
| Method | Endpoint | Purpose |
|--------|----------|---------|

## Out of Scope
- [what is explicitly excluded]
\`\`\`

Ask: "Does this capture the requirements? Say **ok** to proceed to design, or tell me what to change."
Do NOT write any files. Do NOT proceed until user says ok / approved / yes / lgtm / proceed.

---

## GATE 2 — DESIGN

After Gate 1 approval, draft and show IN CHAT:

\`\`\`markdown
# Design: <name>

## Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
${layerFlow.split(' → ').map(layer => `| ${layer} | ${featuresDir}/<name>/... | [responsibility] |`).join('\n')}

## Data Flow
[request path through layers — one line per hop]

## State Shape (if applicable)
[key data model — types or class outline]

## Error Handling
[how errors propagate through layers]

## Dependencies on Existing Features
- [list existing services, repos, or state this feature uses — or "none"]
\`\`\`

Ask: "Does the layer breakdown work? Say **ok** to proceed to tasks, or tell me what to adjust."
Do NOT write any files. Do NOT proceed until user says ok.

---

## GATE 3 — TASKS

After Gate 2 approval, draft and show IN CHAT:

\`\`\`markdown
# Tasks: <name>

## Phase Breakdown
${phases}

## Phase 1 Tasks
- [ ] Create feature folder: ${featuresDir}/<name>/
- [ ] [specific model or entity file]

## Phase 2 Tasks
- [ ] [specific data layer file]
- [ ] [wire to existing DI or service registry]

## Phase 3 Tasks
- [ ] [specific logic/state file]

## Phase 4 Tasks
- [ ] [specific UI or API endpoint file]
- [ ] [register route or screen]

## Phase 5 — Tests
- [ ] [unit test for core logic]
- [ ] [integration or widget test]
- [ ] Run: ${testCmd}

## Definition of Done
- [ ] All phase tasks checked
- [ ] \`${testCmd}\` passes
- [ ] Feature README exists at ${featuresDir}/<name>/README.md
\`\`\`

Ask: "Tasks look right? Say **ok** to lock the spec and write files, or adjust the tasks."
Do NOT write any files. Do NOT proceed until user says ok.

---

## STEP 5 — Write spec files

After Gate 3 approval, write:
- .kiro/specs/<name>/requirements.md — Gate 1 content
- .kiro/specs/<name>/design.md — Gate 2 content
- .kiro/specs/<name>/tasks.md — Gate 3 content

Then ask: "Spec is locked. Which phases to implement now?
- **all** — implement all 5 phases
- **phase 1** — first phase only
- **phase 1 2** — first two phases
- **spec only** — stop here, implement later"

---

## STEP 6 — Implement requested phases only

Implement ONLY the phases the user requested. In order. Do not skip ahead.
After each phase: list files written + mark tasks done in tasks.md ([ ] → [x]).
Run ${testCmd} after Phase 5 or after the last requested phase.`,
        },
    }, null, 2) + '\n';
}

function getPhases(c: GovernanceConfig): string {
    const state = c.profile.stateFramework || '';
    switch (c.stack) {
        case 'flutter':
            return `- **Phase 1 — Domain** (entities, value objects, repository interfaces, use cases)
- **Phase 2 — Data** (repository impl, data sources, DTOs, mappers)
- **Phase 3 — State** (${state.includes('Riverpod') ? 'providers' : 'cubit'} — ${state || 'BLoC/Cubit'} logic + state classes)
- **Phase 4 — UI** (screens or widgets, navigation registration)
- **Phase 5 — Tests** (cubit unit tests, widget tests)`;
        case 'kotlin':
            return `- **Phase 1 — Domain** (data classes, use cases, repository interface)
- **Phase 2 — Data** (repository impl, data source, API/DB models)
- **Phase 3 — ViewModel** (StateFlow UI state, sealed class, Hilt injection)
- **Phase 4 — UI** (Composable screen, navigation graph registration)
- **Phase 5 — Tests** (ViewModel unit tests, repository tests)`;
        case 'react':
            return `- **Phase 1 — Types** (interfaces, TypeScript types, constants)
- **Phase 2 — API/Service** (API calls, custom data-fetching hook)
- **Phase 3 — State** (${state || 'state management'} store/slice/hook)
- **Phase 4 — Components** (page component + child components)
- **Phase 5 — Tests** (component tests, custom hook tests)`;
        case 'angular':
            return `- **Phase 1 — Models** (interfaces, types, enums)
- **Phase 2 — Service** (HTTP service, data transformation)
- **Phase 3 — State** (${state || 'NgRx'} actions / reducer / effects / selectors)
- **Phase 4 — Component** (smart container + presentational children)
- **Phase 5 — Tests** (service spec, component spec)`;
        case 'nodejs':
            return `- **Phase 1 — Domain** (entity, DTOs, validation schemas)
- **Phase 2 — Repository** (data access, ${c.scan.detectedORM || 'ORM'} queries)
- **Phase 3 — Service** (business logic, error handling)
- **Phase 4 — Controller/Routes** (API endpoints, request validation)
- **Phase 5 — Tests** (unit tests for service, integration tests for routes)`;
        case 'python':
            return `- **Phase 1 — Schemas** (Pydantic request/response models)
- **Phase 2 — Repository** (DB queries, ${c.scan.detectedORM || 'SQLAlchemy'} models)
- **Phase 3 — Service** (business logic, error handling)
- **Phase 4 — Router** (FastAPI endpoints, dependency injection)
- **Phase 5 — Tests** (pytest unit tests, integration tests with TestClient)`;
        case 'java':
            return `- **Phase 1 — Domain** (JPA entities, DTOs, repository interfaces)
- **Phase 2 — Repository** (Spring Data repository, JPA queries)
- **Phase 3 — Service** (business logic, transaction management)
- **Phase 4 — Controller** (REST endpoints, request validation)
- **Phase 5 — Tests** (JUnit 5 unit tests, MockMvc integration tests)`;
        default:
            return `- **Phase 1 — Domain** (models, interfaces, core types)
- **Phase 2 — Data** (repository, data access)
- **Phase 3 — Logic** (service / state / business rules)
- **Phase 4 — UI/API** (presentation layer, endpoints)
- **Phase 5 — Tests** (unit + integration tests)`;
    }
}
