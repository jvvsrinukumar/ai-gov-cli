import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowExplore(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const sourceDir = c.profile.sourceDir || 'src/';
    const layerFlow = c.profile.layerFlow;

    return JSON.stringify({
        name: 'Explore',
        version: c.hookVersion,
        description: 'Read-only codebase exploration — understand structure without changing anything',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `EXPLORE — Read-only codebase exploration for ${stackDisplay}.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Source: ${sourceDir}

> This is a new session — you have no conversation history.
> RULES: Do NOT write or modify any files. Do NOT run commands that change state.

## STEP 0 — Ask ONE question immediately

Do not read any files yet. Ask:

"What do you want to understand?
 — A specific feature (name it)
 — A data flow (e.g. 'how does login work end to end')
 — A pattern (e.g. 'how is state managed', 'how are API calls structured')
 — The overall architecture (map the whole codebase)
 — A dependency (e.g. 'what uses the payment service')"

Use the user's answer to scope exactly what to read. Do not read files unrelated to the question.

---

## STEP 1 — READ RELEVANT FILES

Based on the user's question, read the files that answer it.
Start narrow — read the entry point for the area of interest first.
Expand only if the question requires tracing through multiple layers.

Layer flow for this project: ${layerFlow}
Source root: ${sourceDir}

---

## STEP 2 — TRACE AND MAP

Trace the data flow or structure the user asked about:
- Entry point → each hop → final destination (for data flows)
- Dependency graph (for "what uses X" questions)
- File inventory with roles (for architecture questions)

---

## STEP 3 — REPORT

Produce a structured summary:

\`\`\`
EXPLORATION REPORT

Question: [what the user asked]

Files read:
  <path> — [role in the answer]
  ...

${layerFlow.includes('→') ? `Data flow:
  ${layerFlow.split(' → ').join('\n  → ')}
  (mapped to real files below)
  <layer>: <file path>
  ...

` : ''}Findings:
  [key observations — what IS, not what should be]

Patterns observed:
  [naming conventions, structural patterns, consistency notes]

Potential concerns:
  [inconsistencies, missing pieces, or things that might surprise a new developer]
  [or "none found"]
\`\`\`

Keep the report factual. Do not recommend changes — that is a Refactor or Fix workflow.`,
        },
    }, null, 2) + '\n';
}
