import type { GovernanceConfig } from '../../types.js';

function getPhases(c: GovernanceConfig): string {
    const state = c.profile.stateFramework || '';
    switch (c.stack) {
        case 'flutter':
            return `- **Phase 1 — Domain** (\`entities/\`, \`value_objects/\`, \`repository interfaces\`, \`use_cases/\`)
- **Phase 2 — Data** (\`repository_impl/\`, \`data_sources/\`, \`dtos/\`, \`mappers/\`)
- **Phase 3 — State** (\`${state.includes('Riverpod') ? 'providers/' : 'cubit/'}\` — ${state || 'BLoC/Cubit'} logic + state classes)
- **Phase 4 — UI** (\`screens/\` or \`widgets/\`, navigation registration in router)
- **Phase 5 — Tests** (cubit unit tests, widget tests, golden tests if needed)`;
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
- **Phase 4 — Component** (smart container component + presentational children)
- **Phase 5 — Tests** (service spec, component spec)`;
        case 'nodejs':
            return `- **Phase 1 — Domain** (entity class/interface, DTOs, validation schemas)
- **Phase 2 — Repository** (data access layer, ${c.scan.detectedORM || 'ORM'} queries)
- **Phase 3 — Service** (business logic, error handling)
- **Phase 4 — Controller/Routes** (API endpoints, request validation, Swagger docs)
- **Phase 5 — Tests** (unit tests for service, integration tests for routes)`;
        case 'python':
            return `- **Phase 1 — Schemas** (Pydantic request/response models)
- **Phase 2 — Repository** (DB queries, ${c.scan.detectedORM || 'SQLAlchemy'} models)
- **Phase 3 — Service** (business logic, error handling)
- **Phase 4 — Router** (FastAPI endpoints, dependency injection, OpenAPI tags)
- **Phase 5 — Tests** (pytest unit tests, integration tests with TestClient)`;
        default:
            return `- **Phase 1 — Domain** (models, interfaces, core types)
- **Phase 2 — Data** (repository, data access)
- **Phase 3 — Logic** (service / state / business rules)
- **Phase 4 — UI/API** (presentation layer, endpoints)
- **Phase 5 — Tests** (unit + integration tests)`;
    }
}

function getExampleFeature(c: GovernanceConfig): string {
    switch (c.stack) {
        case 'flutter': return 'user_profile';
        case 'kotlin': return 'user_profile';
        case 'react': return 'user-profile';
        case 'angular': return 'user-profile';
        case 'nodejs': return 'user-auth';
        case 'python': return 'user_auth';
        default: return 'my-feature';
    }
}

function getLayerFileExample(c: GovernanceConfig, featureName: string): string {
    const ext = c.profile.fileExt;
    const fd = c.profile.featuresDir.replace(/\/$/, '');
    switch (c.stack) {
        case 'flutter':
            return `${fd}/${featureName}/domain/entities/${featureName}_entity${ext}
${fd}/${featureName}/data/repositories/${featureName}_repository_impl${ext}
${fd}/${featureName}/presentation/cubit/${featureName}_cubit${ext}
${fd}/${featureName}/presentation/screens/${featureName}_screen${ext}`;
        case 'kotlin':
            return `${fd}/${featureName}/domain/${featureName.replace(/-/g, '')}UseCase${ext}
${fd}/${featureName}/data/${featureName.replace(/-/g, '')}RepositoryImpl${ext}
${fd}/${featureName}/presentation/${featureName.replace(/-/g, '')}ViewModel${ext}
${fd}/${featureName}/presentation/${featureName.replace(/-/g, '')}Screen${ext}`;
        case 'react':
            return `${fd}/${featureName}/types${ext}
${fd}/${featureName}/hooks/use${featureName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')}${ext}
${fd}/${featureName}/store/${featureName}Slice${ext}
${fd}/${featureName}/${featureName.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join('')}Page${ext}`;
        case 'angular':
            return `${fd}/${featureName}/models/${featureName}.model${ext}
${fd}/${featureName}/services/${featureName}.service${ext}
${fd}/${featureName}/store/${featureName}.actions${ext}
${fd}/${featureName}/${featureName}.component${ext}`;
        case 'nodejs':
            return `${fd}/${featureName}/${featureName}.entity${ext}
${fd}/${featureName}/${featureName}.repository${ext}
${fd}/${featureName}/${featureName}.service${ext}
${fd}/${featureName}/${featureName}.controller${ext}`;
        case 'python':
            return `${fd}/${featureName}/schemas${ext}
${fd}/${featureName}/repository${ext}
${fd}/${featureName}/service${ext}
${fd}/${featureName}/router${ext}`;
        default:
            return `${fd}/${featureName}/model${ext}\n${fd}/${featureName}/service${ext}`;
    }
}

export function generateNewFeatureCommand(c: GovernanceConfig): string {
    const { profile } = c;
    const exampleFeature = getExampleFeature(c);
    const phases = getPhases(c);
    const featuresDir = profile.featuresDir.replace(/\/$/, '');
    const exampleFiles = getLayerFileExample(c, exampleFeature);
    const testCmd = profile.testCmd || 'run tests';
    const stackDisplay = profile.stackDisplay;
    const layerFlow = profile.layerFlow;

    return `# /new-feature — New Feature (Plan Mode · 3-Gate Spec Approval)

**Stack:** ${stackDisplay}
**Layer flow:** ${layerFlow}
**Features dir:** \`${featuresDir}/\`

---

## STEP 0 — Enter Plan Mode (IMMEDIATE)

**The very first thing you must do is call the \`EnterPlanMode\` tool.**

In plan mode you CANNOT write or edit any files. You will only show spec content as text in the chat for developer review. File writes happen only after all 3 gates are approved and you call \`ExitPlanMode\`.

> Feature name from \`$ARGUMENTS\`: use exactly as typed. If blank, ask: "What is the feature name?"

---

## STEP 1 — Read Context

Before generating specs, read:
1. \`.claude/steering/architecture.md\` — layer rules, zone rules if dual-mode project
2. \`.claude/steering/coding-standards.md\` — naming and file conventions

---

## STEP 2 — GATE 1: Requirements

Show the following content as a formatted markdown preview **in the chat** (do NOT write the file):

\`\`\`markdown
# Feature: $ARGUMENTS

## Overview
[1-2 sentence description of what this feature does and why it exists]

## Acceptance Criteria
- [ ] [primary behaviour criterion 1]
- [ ] [primary behaviour criterion 2]
- [ ] [edge case or validation criterion]
- [ ] [error state criterion]

## API Contracts (if applicable)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET    | /api/...  | fetch   |
| POST   | /api/...  | create  |

## Out of Scope
- [explicitly what will NOT be built in this feature]
\`\`\`

**After showing this:**
> "This is the requirements draft for **$ARGUMENTS**. Review and tell me:
> - Any acceptance criteria to add or change?
> - API contracts correct?
> - Anything out of scope that should be in scope?
>
> Say **ok** / **approved** / **looks good** to proceed to design, or tell me what to change."

**DO NOT proceed to Gate 2 until you receive explicit approval.**
Accepted approval words: ok, okay, approved, looks good, yes, good, perfect, proceed, next, lgtm, done.
If developer requests changes, update the content and show it again.

---

## STEP 3 — GATE 2: Design

After Gate 1 approval, show design content **in the chat**:

\`\`\`markdown
# Design: $ARGUMENTS

## Architecture Layer Map
| Layer | Files | Responsibility |
|-------|-------|---------------|
${layerFlow.split(' → ').map((layer, i) => `| ${layer} | \`${featuresDir}/$ARGUMENTS/layer_${i + 1}/\` | [responsibility] |`).join('\n')}

## Data Flow
[request path through layers, e.g. Screen → Cubit → UseCase → Repository → DataSource]

## State Shape (if applicable)
\`\`\`dart / ts / py
// Example state model
\`\`\`

## Error Handling Strategy
[how errors propagate through layers — sealed classes / Result type / exceptions]

## Dependencies on Existing Features/Services
- [list any existing services, cubits, repositories this feature depends on]
\`\`\`

**After showing this:**
> "This is the design for **$ARGUMENTS**. Does the layer breakdown match how you want it structured?
> Say **ok** to proceed to tasks, or tell me what to adjust."

**DO NOT proceed to Gate 3 until you receive explicit approval.**

---

## STEP 4 — GATE 3: Tasks

After Gate 2 approval, show tasks content **in the chat**:

\`\`\`markdown
# Tasks: $ARGUMENTS

## Phase Breakdown
${phases}

## Phase 1 Tasks
- [ ] Create feature folder: \`${featuresDir}/$ARGUMENTS/\`
- [ ] [specific domain entity or model file]
- [ ] [specific interface or type file]

## Phase 2 Tasks
- [ ] [specific data layer file]
- [ ] [wire up to existing DI/injection]

## Phase 3 Tasks
- [ ] [specific state/logic file]
- [ ] [state transitions / events]

## Phase 4 Tasks
- [ ] [specific UI or API file]
- [ ] [register route / endpoint]

## Phase 5 Tasks
- [ ] [unit test for core logic]
- [ ] [integration test for API or widget test for UI]
- [ ] Run: \`${testCmd}\`

## Definition of Done
- [ ] All phase tasks checked
- [ ] \`${testCmd}\` passes
- [ ] No files exceed line limit
- [ ] Feature README exists at \`${featuresDir}/$ARGUMENTS/README.md\`
- [ ] Spec updated if scope changed during implementation
\`\`\`

**After showing this:**
> "Tasks for **$ARGUMENTS** are ready. Does the phase breakdown work?
> Say **ok** to lock the spec and write the files, or adjust the tasks."

**DO NOT write anything until Gate 3 is explicitly approved.**

---

## STEP 5 — Exit Plan Mode + Write Spec Files

After Gate 3 approval:

1. **Call \`ExitPlanMode\` tool**
2. Write \`specs/$ARGUMENTS/requirements.md\` — the approved Gate 1 content
3. Write \`specs/$ARGUMENTS/design.md\` — the approved Gate 2 content
4. Write \`specs/$ARGUMENTS/tasks.md\` — the approved Gate 3 content

Then ask:

> "Spec is locked. Which phases would you like to implement now?
> - **'all'** or **'develop'** — all 5 phases
> - **'phase 1'** — ${layerFlow.split(' → ')[0]} only
> - **'phase 1 and 2'** — first two phases
> - **'phase 1 2 3'** — first three phases
>
> Or say **'spec only'** to stop here and implement later."

---

## STEP 6 — Phase-Selective Implementation

Implement ONLY the phases the developer requested. Strict rules:

- Implement phases in order — never skip ahead
- After each phase: summarise files written + check tasks.md (\`[ ]\` → \`[x]\`)
- Do NOT implement a phase the developer did not request
- If a phase depends on the previous (e.g. Phase 3 needs Phase 2), note this and ask to implement Phase 2 first

**Expected feature folder structure after full implementation:**
\`\`\`
${exampleFiles}
${featuresDir}/${exampleFeature}/README.md
specs/${exampleFeature}/requirements.md
specs/${exampleFeature}/design.md
specs/${exampleFeature}/tasks.md
\`\`\`

---

## RULES (enforced throughout)

- Plan mode is active from Step 0 to end of Step 4 — zero file writes in that window
- Each gate requires an explicit approval word — do not auto-advance
- If developer says something ambiguous, ask for clarification — do not assume approval
- Do not refactor or touch files outside the feature folder unless explicitly asked
- Hooks will fire after each file write (format, analyze, file-size check) — this is expected
`;
}
