import type { GovernanceConfig } from '../../../types.js';
import { KNOWLEDGE_HTML_CSS } from '../../../utils/knowledge-html-template.js';

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

> Reads the live codebase and writes a committed product knowledge file.
> Answers: WHAT does this product do? What are the user flows, domain objects, and business rules?
> Output: \`knowledge/product-[scope].md\` — committed to git as persistent AI context.
> Cheap to read (small file), expensive to regenerate (full code scan) — regenerate only when code changes significantly.
> All entries tagged [INFERRED] until a human promotes them to [CONFIRMED].

---

## EXECUTION RULES

1. **Read-only on source** — no source files modified. Only the knowledge file is written.
2. **Tag everything [INFERRED]** — nothing is confirmed until a human verifies.
3. **Derive from code** — user flows come from routes/navigation, not imagination.
4. **Preserve [CONFIRMED] entries** — on re-run, never downgrade or overwrite a [CONFIRMED] entry. Flag drift instead.
5. **"Needs Clarification" is mandatory** — WHY questions that code cannot answer.
6. **Do not judge** — observe and record. No recommendations.

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

## STEP 2 — Check for Existing File

Before reading any source code, check if \`knowledge/product-[scope].md\` already exists.

**If it exists:**
- Read the file and extract all entries tagged \`[CONFIRMED]\` — these must be preserved exactly.
- Note the \`Generated:\` line — extract the git hash (the \`[OLD_HASH]\` value after "git:").
- Run: \`git diff --stat [OLD_HASH]..HEAD -- [source paths covered by this scope]\`
- If > 10 files changed OR > 200 lines added/removed in the diff stat → mark "significant drift likely — [N] files changed, [N] lines delta since last generation" in the output.
- If ≤ 10 files changed AND ≤ 200 lines delta → proceed as an incremental update.
- If the hash is the same as HEAD → file is current, proceed as incremental update.

**If it does not exist:** proceed as a first-time extraction.

---

## STEP 3 — Read Source Files (Stack-Adaptive)

**Project context:**
- Source root: \`${sourceDir}\`
- Features directory: \`${featuresDir}\`
- Layer flow: \`${layerFlow}\`

**Where business logic hides in ${stackDisplay}:**
${readingStrategy}

Run: \`git rev-parse --short HEAD\` to get the current git hash. Store as **[GIT_HASH]**.

Read files relevant to the scope. Focus on:
1. Route/navigation definitions (user flows)
2. Models/entities/schemas (domain objects)
3. Guards/middleware/interceptors (permissions)
4. Enums/constants/state machines (business states)
5. Validators/business rules (constraints)

---

## STEP 4 — Write Knowledge File

Create the \`knowledge/\` directory if it doesn't exist.

Write \`knowledge/product-[scope].md\` with this exact structure:

\`\`\`markdown
# Product Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits to [CONFIRMED] entries are preserved on re-run.

Generated: [today's date] (git: [GIT_HASH])

---

## User Flows

### [Flow Name] [INFERRED]
1. [step derived from route/navigation + component names]
2. [step]
3. [step]
Entry point: \`[file path]\`

\`\`\`mermaid
flowchart TD
  A([Start]) --> B[Step 1]
  B --> C{Decision?}
  C -->|yes| D[Step 2a]
  C -->|no| E[Step 2b]
  D --> F([End])
  E --> F
\`\`\`
(One node per step. Diamonds for decisions, rounded rectangles for start/end. Derive labels from route/component/function names observed in code.)

### [Flow Name] [INFERRED]
...

---

## Domain Objects

### [Entity/Model Name] [INFERRED]
- **Fields:** [key fields and their types]
- **Business meaning:** [what this represents in the domain]
- **Relationships:** [links to other domain objects]
- **Source:** \`[file path]\`

### [Entity/Model Name] [INFERRED]
...

---

## Domain Relationships [INFERRED]

\`\`\`mermaid
erDiagram
  ENTITY-A ||--o{ ENTITY-B : "has many"
  ENTITY-A }o--|| ENTITY-C : "belongs to"
\`\`\`
(One node per domain object above. Cardinality: ||--|| one-to-one, ||--o{ one-to-many, }o--|{ many-to-many.)

---

## Permissions & Roles

| Role | Can do | Cannot do | Source | Confidence |
|------|--------|-----------|--------|------------|
| [role] | [capabilities] | [restrictions] | \`[file]\` | [INFERRED] |
...

*(If no permission system detected: "No role-based access control observed in code.")*

---

## Business States

### [Enum/State Name] [INFERRED]
- States: [list of possible states]
- Transitions: [observed state changes]
- Source: \`[file path]\`

\`\`\`mermaid
stateDiagram-v2
  [*] --> State1
  State1 --> State2 : trigger / event
  State2 --> State3 : trigger / event
  State3 --> [*]
\`\`\`
(One node per state value. Edges = observed transitions. Label = the event/function that causes the transition.)

### [Enum/State Name] [INFERRED]
...

*(If no state machines detected: "No explicit state machines or status enums observed.")*

---

## Drift Detected

*(Only present on re-run when existing [CONFIRMED] entries conflict with current code.)*

- [CONFIRMED entry text] — code now shows [what code shows instead] → REVIEW REQUIRED
...

*(If no drift: omit this section entirely.)*

---

## Needs Clarification

- [WHY question code cannot answer] [UNKNOWN]
- [threshold or magic number with no comment explaining the value] [UNKNOWN]
- [business rule with no documentation explaining the reasoning] [UNKNOWN]
- [feature that exists but whose purpose is unclear from code alone] [UNKNOWN]
...
\`\`\`

**Preservation rule:** If the file previously contained [CONFIRMED] entries, copy them verbatim into the new file. If code now contradicts a [CONFIRMED] entry, add it to "Drift Detected" — do NOT remove or overwrite the [CONFIRMED] entry itself. A human must resolve drift.

---

## STEP 5 — Optional Export

After writing the committed file, ask:

> The knowledge file has been written to \`knowledge/product-[scope].md\` and is ready to commit.
> Want an additional export? Reply with a format or skip:
>
> - \`html\` — HTML export — requires internet to render Mermaid diagrams (good for sharing)
> - \`skip\` or *(no reply)* — done

**If html requested:** generate an HTML file at \`knowledge/product-[scope].html\` using the shared page scaffold below.

**Page scaffold** (CSS + wrapper are shared across all knowledge exports):

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Knowledge — [scope] | ${stackDisplay}</title>
  <!-- Mermaid loaded from CDN — requires internet to render diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
${KNOWLEDGE_HTML_CSS}
  </style>
</head>
<body>
  <h1>Product Knowledge — [scope] <span style="color:#6b7280;font-size:.9rem">| ${stackDisplay}</span></h1>
  <div class="meta">
    ⚠ Auto-generated [INFERRED]. Manual edits to [CONFIRMED] entries are preserved on re-run.<br>
    Generated: [today's date] (git: [GIT_HASH])
  </div>
\`\`\`

**Body sections** (specific to product-knowledge — populate with observed values):

\`\`\`html
  <!-- Only render if drift was detected -->
  <div class="drift">
    ⚠ <strong>Drift Detected</strong> — the following [CONFIRMED] entries conflict with current code. Human review required.<br>
    <ul>[drift items as list items]</ul>
  </div>

  <h2>User Flows</h2>

  <!-- Repeat block for each flow -->
  <h3>[Flow Name] <span class="tag-inferred">[INFERRED]</span></h3>
  <ol>
    <li>[step]</li>
  </ol>
  <p class="flow-entry">Entry point: <code>[file path]</code></p>
  <div class="mermaid">
flowchart TD
  A([Start]) --> B[Step 1]
  B --> C{Decision?}
  C -->|yes| D[Step 2a]
  C -->|no| E[Step 2b]
  D --> F([End])
  E --> F
  </div>

  <h2>Domain Objects</h2>

  <!-- Repeat block for each entity -->
  <h3>[Entity Name] <span class="tag-inferred">[INFERRED]</span></h3>
  <dl>
    <dt>Fields</dt><dd>[key fields and types]</dd>
    <dt>Business meaning</dt><dd>[what this represents]</dd>
    <dt>Relationships</dt><dd>[links to other objects]</dd>
    <dt>Source</dt><dd><code>[file path]</code></dd>
  </dl>

  <h2>Domain Relationships <span class="tag-inferred">[INFERRED]</span></h2>
  <div class="mermaid">
erDiagram
  ENTITY-A ||--o{ ENTITY-B : "has many"
  ENTITY-A }o--|| ENTITY-C : "belongs to"
  </div>

  <h2>Permissions &amp; Roles</h2>
  <table>
    <thead><tr><th>Role</th><th>Can do</th><th>Cannot do</th><th>Source</th><th>Confidence</th></tr></thead>
    <tbody>
      <!-- one row per role -->
    </tbody>
  </table>

  <h2>Business States</h2>

  <!-- Repeat block for each state machine -->
  <h3>[Enum/State Name] <span class="tag-inferred">[INFERRED]</span></h3>
  <dl>
    <dt>States</dt><dd>[list of values]</dd>
    <dt>Transitions</dt><dd>[observed changes]</dd>
    <dt>Source</dt><dd><code>[file path]</code></dd>
  </dl>
  <div class="mermaid">
stateDiagram-v2
  [*] --> State1
  State1 --> State2 : trigger / event
  State2 --> [*]
  </div>

  <h2>Needs Clarification</h2>
  <ul>
    <!-- one <li> per unknown -->
  </ul>
\`\`\`

**Footer** (shared):

\`\`\`html
  <footer>Generated by /product-knowledge · ${stackDisplay} · git: [GIT_HASH]</footer>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'neutral' });</script>
</body>
</html>
\`\`\`

Populate every placeholder with actual observed values before writing. HTML export is local only — do not commit it.

---

## STEP 6 — Confirm Output

After generating, report:

\`\`\`
━━━ PRODUCT KNOWLEDGE WRITTEN ━━━

  File:                     knowledge/product-[scope].md
  Git hash:                 [GIT_HASH]
  Scope:                    [what was mapped]
  User flows documented:    [N]
  Domain objects documented:[N]
  Business states documented:[N]
  Unknowns flagged:         [N]
  Drift detected:           [N entries — or "none"]
  Export:                   [html written to knowledge/product-[scope].html — or "none"]

  All new entries are [INFERRED]. Commit this file to git.
  Re-run /product-knowledge when significant code changes occur.
  "Needs Clarification" items are WHY questions — only humans can answer them.
\`\`\`

---

## RULES

- Output goes in \`knowledge/\` at project root — not inside \`.claude/\`
- Create the \`knowledge/\` directory if it doesn't exist
- Commit the \`.md\` file — it is the AI context source for all other commands
- Do NOT commit the \`.html\` export — it is a local sharing artifact only
- Derive user flows from actual route/navigation code — do not invent flows
- Domain objects come from actual model/entity/schema files — not from guessing
- If permissions are not observable in code, say so — do not assume "no permissions"
- "Needs Clarification" must contain at least one entry if ANY business logic lacks comments
- [CONFIRMED] entries are human-verified truth — never silently overwrite them
- Keep the file concise — this is a reference for onboarding, not exhaustive docs
`;
}
