import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowTechKnowledge(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const sourceDir = c.profile.sourceDir || 'src/';
    const featuresDir = c.profile.featuresDir || sourceDir;
    const layerFlow = c.profile.layerFlow;
    const isBackend = c.isBackend;

    const detectedState = c.scan.detectedState || c.profile.stateFramework || 'not detected';
    const detectedDI = c.scan.detectedDI || c.profile.diFramework || 'not detected';
    const detectedHTTPClient = c.scan.detectedHTTPClient || 'not detected';
    const detectedORM = c.scan.detectedORM || 'not detected';
    const detectedDBDriver = c.scan.detectedDBDriver || '';
    const detectedAuth = c.scan.detectedAuth || '';
    const detectedSwagger = c.scan.detectedSwagger;
    const hasDB = !!(c.scan.detectedORM && c.scan.detectedORM !== 'not detected') || !!detectedDBDriver;

    const backendScanNote = !isBackend ? '' : `

---

## STEP 1.5 — Scan Developer Environment (backend only)

Before writing the knowledge file, also read:
1. Package manifest scripts (package.json/pyproject.toml/Makefile) → for Quickstart + Daily Commands
2. .env.example / .env.template / .env (names + comments only, never values) → for Environment Variables
3. ORM config / datasource / application.yml + migration dir → for Database section

---
`;

    const backendSections = !isBackend ? '' : `

---

## Stack Primer
[3-5 lines explaining what ${stackDisplay} is in plain English — framework, DI mechanism, request flow. See Claude Code tech-knowledge command for exact per-stack wording.]

---

## First-Run Guide [INFERRED]
[Numbered steps from zero to running server: runtime install, deps install (with venv for Python), cp .env.example .env, run migrations, seed, start dev server, verify]

---

## Environment Variables [INFERRED]
[Table: Variable | Example Value | Required | Purpose — scanned from .env.example or source. Note how env vars are loaded (dotenv/BaseSettings/@nestjs/config/Spring).]

---

## Developer Daily Commands [INFERRED]
[Table: Task | Command — install, start, test, build, format, lint, create migration, apply migrations, rollback]

---

## Database [INFERRED]
[Table: Engine | ORM/driver | Connection var | Migrations dir | run + rollback commands. Connection string format. Verify connection SQL. Migration workflow steps.]${hasDB ? `
Init-detected ORM: ${detectedORM} · Driver: ${detectedDBDriver}` : ''}

---

## Stack-Specific Notes [INFERRED]
[Bullet list of gotchas a beginner would hit — framework-specific, not obvious from code. E.g. NestJS: module registration required; FastAPI: venv activation first; Spring: ./mvnw wrapper.]

---

## API Access [INFERRED]
Base URL: http://localhost:[PORT]
Auth: ${detectedAuth || 'No auth detected — endpoints appear to be open'}
API docs: ${detectedSwagger ? (c.scan.detectedSubtype === 'fastapi' ? '/docs (auto-generated)' : c.scan.detectedSubtype === 'nestjs' ? '/api (via @nestjs/swagger)' : '[check app setup]') : 'No Swagger/OpenAPI detected'}
[If auth detected: include copy-paste curl to get token + example authenticated request]

---

## Logging & Debugging [INFERRED]
[Log location + log level env var. Debug attach commands for this stack.]
`;

    const sqlExportNote = (isBackend && hasDB) ? `
  - sql: generates knowledge/db-schema-discovery.sql with 15 discovery queries for ${detectedORM !== 'not detected' ? detectedORM : detectedDBDriver || 'the detected DB'} (committed to git)` : '';

    return JSON.stringify({
        name: 'Tech Knowledge',
        version: c.hookVersion,
        description: 'Extract technical knowledge from codebase — patterns, layers, conventions, dev setup',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `TECH KNOWLEDGE — Extract technical knowledge for ${stackDisplay}.

Stack: ${stackDisplay}${isBackend ? ' (backend)' : ''}
Layer flow: ${layerFlow}
Source: ${sourceDir}
Features: ${featuresDir}
Init-detected — State: ${detectedState} · DI: ${detectedDI} · HTTP: ${detectedHTTPClient} · ORM: ${detectedORM}${isBackend ? ` · DBDriver: ${detectedDBDriver} · Auth: ${detectedAuth}` : ''}

> This is a new session — you have no conversation history.

## EXECUTION RULES

1. Read-only — no source files modified. Only output is the knowledge file.
2. Tag everything [INFERRED] — nothing is confirmed until a human verifies.
3. Never invent patterns — only extract what is observable in code.
4. "Needs Clarification" is mandatory — always include if there are unknowns.
5. Do not judge — observe and record. No recommendations.

---

## STEP 0 — Ask scope

Ask: "What scope should I map?
 — Leave empty for a whole-project overview
 — Name a feature (e.g. 'auth', 'payments')
 — Name a layer (e.g. 'services', 'data')
 — Name a pattern (e.g. 'state', 'error handling')"

Use the answer to determine scope and output filename.
Slugify: lowercase, spaces → hyphens. Empty → "overview".
Output file: knowledge/tech-[slug].md

---

## STEP 1 — Read source files

Read files relevant to the scope. Start at entry points, trace through layers.
Do NOT read the entire codebase — read enough to map the scope accurately.
Do NOT read .claude/steering/ or .kiro/steering/ as source of truth — read actual code.
${backendScanNote}

---

## STEP 2 — Write knowledge file

Create knowledge/ directory if it doesn't exist.
Write knowledge/tech-[slug].md with this structure (follow the full Claude Code /tech-knowledge output template for exact section formatting):

# Tech Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: [today's date]

---
${backendSections}
## Layer Map

[layer] → [file/dir] — [role] [INFERRED]

---

## Patterns in Use

| Pattern | Value | Confidence |
|---------|-------|------------|
| HTTP client | [observed] | [INFERRED] |
| State management | [observed] | [INFERRED] |
| Data access | [observed] | [INFERRED] |
| DI | [observed] | [INFERRED] |
| Naming (files) | [observed] | [INFERRED] |
| Naming (classes) | [observed] | [INFERRED] |
| Error handling | [observed] | [INFERRED] |

---

## File Inventory

| File | Layer | Lines | Notes |
|------|-------|-------|-------|

---

## Conventions

- [observed conventions] [INFERRED]

---

## Needs Clarification

- [unknowns] [UNKNOWN]

---

## STEP 3 — Optional export + report

Ask once:
 - html: generates knowledge/tech-[slug].html (requires internet for Mermaid diagrams — local only, do not commit)${sqlExportNote}
 - skip: done

After writing, output:
  File: knowledge/tech-[slug].md
  Layers mapped: [N]
  Files inventoried: [N]
  Unknowns flagged: [N]${isBackend ? `
  Dev quickstart: yes (First-Run, Env Vars, Daily Commands, Database included)` : ''}
  All entries [INFERRED] — review and promote to [CONFIRMED] as needed.`,
        },
    }, null, 2) + '\n';
}
