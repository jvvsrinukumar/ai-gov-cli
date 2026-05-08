import type { GovernanceConfig } from '../../../types.js';

export function generateProductKnowledgeCommand(c: GovernanceConfig): string {
    const { profile } = c;
    const stackDisplay = profile.stackDisplay;
    const sourceDir = profile.sourceDir || 'src/';
    const featuresDir = profile.featuresDir || sourceDir;
    const layerFlow = profile.layerFlow;
    const isBackend = c.isBackend;
    const scan = c.scan;

    // Stack-adaptive reading strategy
    let readingStrategy: string;
    if (c.stack === 'angular') {
        readingStrategy = `- Read: services/, guards/, interceptors/, resolvers/, NgRx effects/
- User flows: derive from route configs + component names
- Permissions: derive from guards and interceptors
- Domain objects: derive from interfaces/models + service method signatures`;
    } else if (c.stack === 'react') {
        readingStrategy = `- Read: hooks/, store/ or context/, api/ or services/, route files
- User flows: derive from route definitions + page component names
- Permissions: derive from route guards, auth hooks, or middleware
- Domain objects: derive from TypeScript interfaces, API response types`;
    } else if (c.stack === 'flutter') {
        readingStrategy = `- Read: Cubits/BLoCs (state + events), entity validators, route guards, navigation
- User flows: derive from navigation/router config + screen names
- Permissions: derive from route guards, role checks in BLoCs
- Domain objects: derive from entity classes, freezed models`;
    } else if (c.stack === 'kotlin') {
        readingStrategy = `- Read: UseCases, ViewModels, repository interfaces, navigation graph, Hilt modules
- User flows: derive from navigation graph + screen/fragment names
- Permissions: derive from use case preconditions, auth interceptors
- Domain objects: derive from domain model classes, sealed classes`;
    } else if (c.stack === 'swiftui') {
        readingStrategy = `- Read: ViewModels, ObservableObject publishers, NavigationStack routes, Core Data models
- User flows: derive from NavigationStack/NavigationLink structure + View names
- Permissions: derive from auth state checks in ViewModels
- Domain objects: derive from Core Data entities, Codable structs`;
    } else if (c.stack === 'python') {
        readingStrategy = `- Read: FastAPI dependencies, service functions, Pydantic validators, middleware
- User flows: derive from router endpoints + dependency chains
- Permissions: derive from Depends() guards, middleware, decorators
- Domain objects: derive from Pydantic schemas, SQLAlchemy models`;
    } else if (c.stack === 'java') {
        readingStrategy = `- Read: @RestController endpoints, @Service classes, @PreAuthorize annotations, @Entity
- User flows: derive from controller endpoints + service method chains
- Permissions: derive from Spring Security config, @PreAuthorize, role enums
- Domain objects: derive from @Entity classes, DTOs, enums`;
    } else if (c.stack === 'nodejs' && scan.detectedSubtype === 'nestjs') {
        readingStrategy = `- Read: controllers, services, guards, interceptors, DTOs
- User flows: derive from controller endpoints + service orchestration
- Permissions: derive from guards, decorators (@Roles, @UseGuards)
- Domain objects: derive from entities, DTOs, enums`;
    } else if (c.stack === 'nodejs') {
        readingStrategy = `- Read: route handlers, middleware, services, validators, ORM models
- User flows: derive from route definitions + middleware chains
- Permissions: derive from auth middleware, role checks
- Domain objects: derive from ORM models, validation schemas`;
    } else if (isBackend) {
        readingStrategy = `- Read: route handlers, middleware, services, validators, ORM models
- User flows: derive from route definitions + middleware chains
- Permissions: derive from auth middleware, role checks
- Domain objects: derive from ORM models, validation schemas`;
    } else {
        readingStrategy = `- Read: UI components, state management, navigation/routing, API layer
- User flows: derive from navigation config + screen/page names
- Permissions: derive from route guards, auth state checks
- Domain objects: derive from data models, API response types`;
    }

    return `# /product-knowledge — Extract Product Knowledge (Read-Only)

**Stack:** ${stackDisplay}

> Reads the codebase and writes a persistent product knowledge document.
> Answers: WHAT does this product do? What are the user flows, domain objects, and business rules?
> Output: \`knowledge/product-[scope].md\` — committed to git as project reference.
> All entries tagged [INFERRED] until a human promotes them to [CONFIRMED].

---

## EXECUTION RULES

1. **Read-only** — no source files modified. Only output is the knowledge file.
2. **Tag everything [INFERRED]** — nothing is confirmed until a human verifies.
3. **Derive from code** — user flows come from routes/navigation, not imagination.
4. **"Needs Clarification" is mandatory** — WHY questions that code cannot answer.
5. **Do not judge** — observe and record. No recommendations.

---

## STEP 1 — Determine Scope

Scope comes from \`$ARGUMENTS\`:

| Input | Scope | Output file |
|-------|-------|-------------|
| *(empty)* | Whole-product overview | \`knowledge/product-overview.md\` |
| \`auth\` | One feature/domain area | \`knowledge/product-auth.md\` |
| \`payments\` | One feature/domain area | \`knowledge/product-payments.md\` |
| \`permissions\` | One cross-cutting concern | \`knowledge/product-permissions.md\` |

**Slugification:** lowercase, spaces → hyphens. "user auth" → \`knowledge/product-user-auth.md\`.

---

## STEP 2 — Read Files (Stack-Adaptive)

**Project context:**
- Source root: \`${sourceDir}\`
- Features directory: \`${featuresDir}\`
- Layer flow: \`${layerFlow}\`

**Where business logic hides in ${stackDisplay}:**
${readingStrategy}

Read files relevant to the scope. Focus on:
1. Route/navigation definitions (user flows)
2. Models/entities/schemas (domain objects)
3. Guards/middleware/interceptors (permissions)
4. Enums/constants/state machines (business states)
5. Validators/business rules (constraints)

---

## STEP 3 — Write Knowledge File

Create the \`knowledge/\` directory if it doesn't exist.

Write the output file with this exact structure:

\`\`\`markdown
# Product Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: [today's date]

---

## User Flows

### [Flow Name] [INFERRED]
1. [step derived from route/navigation + component names]
2. [step]
3. [step]
Entry point: \\\`[file path]\\\`

### [Flow Name] [INFERRED]
...

---

## Domain Objects

### [Entity/Model Name] [INFERRED]
- **Fields:** [key fields and their types]
- **Business meaning:** [what this represents in the domain]
- **Relationships:** [links to other domain objects]
- **Source:** \\\`[file path]\\\`

### [Entity/Model Name] [INFERRED]
...

---

## Permissions & Roles

| Role | Can do | Cannot do | Source | Confidence |
|------|--------|-----------|--------|------------|
| [role] | [capabilities] | [restrictions] | \\\`[file]\\\` | [INFERRED] |
...

*(If no permission system detected: "No role-based access control observed in code.")*

---

## Business States

### [Enum/State Name] [INFERRED]
- States: [list of possible states]
- Transitions: [observed state changes]
- Source: \\\`[file path]\\\`

### [Enum/State Name] [INFERRED]
...

*(If no state machines detected: "No explicit state machines or status enums observed.")*

---

## Needs Clarification

- [WHY question code cannot answer] [UNKNOWN]
- [threshold or magic number with no comment explaining the value] [UNKNOWN]
- [business rule with no documentation explaining the reasoning] [UNKNOWN]
- [feature that exists but whose purpose is unclear from code alone] [UNKNOWN]
...
\`\`\`

---

## STEP 4 — Confirm Output

After writing the file, report:

\`\`\`
━━━ PRODUCT KNOWLEDGE WRITTEN ━━━

  File: knowledge/product-[scope].md
  Scope: [what was mapped]
  User flows documented: [N]
  Domain objects documented: [N]
  Business states documented: [N]
  Unknowns flagged: [N]

  All entries are [INFERRED]. Review and promote to [CONFIRMED] as needed.
  "Needs Clarification" items are WHY questions — only humans can answer them.
\`\`\`

---

## RULES

- Output goes in \`knowledge/\` at project root — not inside \`.claude/\`
- Create the \`knowledge/\` directory if it doesn't exist
- If the output file already exists, overwrite it (knowledge is regenerated, not appended)
- Derive user flows from actual route/navigation code — do not invent flows
- Domain objects come from actual model/entity/schema files — not from guessing
- If permissions are not observable in code, say so — do not assume "no permissions"
- "Needs Clarification" must contain at least one entry if ANY business logic lacks comments
- Keep the file concise — this is a reference document for onboarding, not exhaustive docs
`;
}
