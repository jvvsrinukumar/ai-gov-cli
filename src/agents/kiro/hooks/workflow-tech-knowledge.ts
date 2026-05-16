import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowTechKnowledge(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const sourceDir = c.profile.sourceDir || 'src/';
    const featuresDir = c.profile.featuresDir || sourceDir;
    const layerFlow = c.profile.layerFlow;

    const detectedState = c.scan.detectedState || c.profile.stateFramework || 'not detected';
    const detectedDI = c.scan.detectedDI || c.profile.diFramework || 'not detected';
    const detectedHTTPClient = c.scan.detectedHTTPClient || 'not detected';
    const detectedORM = c.scan.detectedORM || 'not detected';

    return JSON.stringify({
        name: 'Tech Knowledge',
        version: c.hookVersion,
        description: 'Extract technical knowledge from codebase — patterns, layers, conventions',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `TECH KNOWLEDGE — Extract technical knowledge for ${stackDisplay}.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Source: ${sourceDir}
Features: ${featuresDir}
Init-detected — State: ${detectedState} · DI: ${detectedDI} · HTTP: ${detectedHTTPClient} · ORM: ${detectedORM}

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

## STEP 1 — Read files

Read files relevant to the scope. Start at entry points, trace through layers.
Do NOT read the entire codebase — read enough to map the scope accurately.
Do NOT read .claude/steering/ or .kiro/steering/ as source of truth — read actual code.

---

## STEP 2 — Write knowledge file

Create knowledge/ directory if it doesn't exist.
Write knowledge/tech-[slug].md with this structure:

# Tech Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: [today's date]

---

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

## STEP 3 — Report

After writing, output:
  File: knowledge/tech-[slug].md
  Layers mapped: [N]
  Files inventoried: [N]
  Unknowns flagged: [N]
  All entries [INFERRED] — review and promote to [CONFIRMED] as needed.`,
        },
    }, null, 2) + '\n';
}
