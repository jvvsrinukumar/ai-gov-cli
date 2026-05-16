import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowProductKnowledge(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const sourceDir = c.profile.sourceDir || 'src/';
    const featuresDir = c.profile.featuresDir || sourceDir;
    const layerFlow = c.profile.layerFlow;
    const isBackend = c.isBackend;
    const scan = c.scan;

    // Stack-adaptive reading strategy
    let readingStrategy: string;
    if (c.stack === 'angular') {
        readingStrategy = 'Read: services/, guards/, interceptors/, resolvers/, NgRx effects. Derive flows from route configs + component names. Permissions from guards/interceptors. Domain objects from interfaces/models.';
    } else if (c.stack === 'react') {
        readingStrategy = 'Read: hooks/, store/ or context/, api/ or services/, route files. Derive flows from route definitions + page components. Permissions from route guards, auth hooks. Domain objects from TypeScript interfaces, API response types.';
    } else if (c.stack === 'flutter') {
        readingStrategy = 'Read: Cubits/BLoCs (state + events), entity validators, route guards, navigation. Derive flows from navigation/router config + screen names. Permissions from route guards, role checks. Domain objects from entity classes, freezed models.';
    } else if (c.stack === 'kotlin') {
        readingStrategy = 'Read: UseCases, ViewModels, repository interfaces, navigation graph, Hilt modules. Derive flows from navigation graph + screen/fragment names. Permissions from use case preconditions, auth interceptors. Domain objects from domain model classes, sealed classes.';
    } else if (c.stack === 'swiftui') {
        readingStrategy = 'Read: ViewModels, ObservableObject publishers, NavigationStack routes, Core Data models. Derive flows from NavigationStack/NavigationLink structure + View names. Permissions from auth state checks in ViewModels. Domain objects from Core Data entities, Codable structs.';
    } else if (c.stack === 'python') {
        readingStrategy = 'Read: FastAPI dependencies, service functions, Pydantic validators, middleware. Derive flows from router endpoints + dependency chains. Permissions from Depends() guards, middleware, decorators. Domain objects from Pydantic schemas, SQLAlchemy models.';
    } else if (c.stack === 'java') {
        readingStrategy = 'Read: @RestController endpoints, @Service classes, @PreAuthorize annotations, @Entity. Derive flows from controller endpoints + service method chains. Permissions from Spring Security config, @PreAuthorize, role enums. Domain objects from @Entity classes, DTOs, enums.';
    } else if (c.stack === 'nodejs' && scan.detectedSubtype === 'nestjs') {
        readingStrategy = 'Read: controllers, services, guards, interceptors, DTOs. Derive flows from controller endpoints + service orchestration. Permissions from guards, decorators (@Roles, @UseGuards). Domain objects from entities, DTOs, enums.';
    } else if (c.stack === 'nodejs') {
        readingStrategy = 'Read: route handlers, middleware, services, validators, ORM models. Derive flows from route definitions + middleware chains. Permissions from auth middleware, role checks. Domain objects from ORM models, validation schemas.';
    } else if (isBackend) {
        readingStrategy = 'Read: route handlers, middleware, services, validators, ORM models. Derive flows from route definitions + middleware chains. Permissions from auth middleware, role checks. Domain objects from ORM models, validation schemas.';
    } else {
        readingStrategy = 'Read: UI components, state management, navigation/routing, API layer. Derive flows from navigation config + screen/page names. Permissions from route guards, auth state checks. Domain objects from data models, API response types.';
    }

    return JSON.stringify({
        name: 'Product Knowledge',
        version: c.hookVersion,
        description: 'Extract product knowledge from codebase — user flows, domain objects, business states',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `PRODUCT KNOWLEDGE — Extract product knowledge for ${stackDisplay}.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Source: ${sourceDir}
Features: ${featuresDir}

> This is a new session — you have no conversation history.

## EXECUTION RULES

1. Read-only — no source files modified. Only output is the knowledge file.
2. Tag everything [INFERRED] — nothing is confirmed until a human verifies.
3. Derive from code — user flows come from routes/navigation, not imagination.
4. "Needs Clarification" is mandatory — WHY questions that code cannot answer.
5. Do not judge — observe and record. No recommendations.

---

## STEP 0 — Ask scope

Ask: "What product area should I document?
 — Leave empty for a whole-product overview
 — Name a feature (e.g. 'auth', 'payments', 'onboarding')
 — Name a cross-cutting concern (e.g. 'permissions', 'notifications')"

Use the answer to determine scope and output filename.
Slugify: lowercase, spaces → hyphens. Empty → "overview".
Output file: knowledge/product-[slug].md

---

## STEP 1 — Read files (stack-adaptive)

Where business logic hides in ${stackDisplay}:
${readingStrategy}

Focus on:
1. Route/navigation definitions (user flows)
2. Models/entities/schemas (domain objects)
3. Guards/middleware/interceptors (permissions)
4. Enums/constants/state machines (business states)
5. Validators/business rules (constraints)

---

## STEP 2 — Write knowledge file

Create knowledge/ directory if it doesn't exist.
Write knowledge/product-[slug].md with this structure:

# Product Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: [today's date]

---

## User Flows

### [Flow Name] [INFERRED]
1. [step from route/navigation]
2. [step]
Entry point: \`[file]\`

---

## Domain Objects

### [Entity Name] [INFERRED]
- Fields: [key fields]
- Business meaning: [what it represents]
- Relationships: [links]
- Source: \`[file]\`

---

## Permissions & Roles

| Role | Can do | Cannot do | Source | Confidence |
|------|--------|-----------|--------|------------|
(If none detected: "No role-based access control observed in code.")

---

## Business States

### [Enum/State Name] [INFERRED]
- States: [list]
- Transitions: [observed changes]
- Source: \`[file]\`
(If none detected: "No explicit state machines or status enums observed.")

---

## Needs Clarification

- [WHY question code cannot answer] [UNKNOWN]

---

## STEP 3 — Report

After writing, output:
  File: knowledge/product-[slug].md
  User flows: [N]
  Domain objects: [N]
  Business states: [N]
  Unknowns flagged: [N]
  All entries [INFERRED] — review and promote to [CONFIRMED] as needed.`,
        },
    }, null, 2) + '\n';
}
