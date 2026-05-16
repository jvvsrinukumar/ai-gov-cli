import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleHook } from '../../../utils/knowledge-preamble.js';
import { generateSilentCaptureInstructionEditFeature } from '../../../utils/knowledge-capture.js';

export function generateWorkflowEditFeature(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const layerFlow = c.profile.layerFlow;
    const testCmd = c.profile.testCmd || 'run tests';

    return JSON.stringify({
        name: 'Edit Feature',
        version: c.hookVersion,
        description: 'Add to or change an existing feature — spec-update 3-gate workflow',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `EDIT FEATURE — Spec-update 3-gate workflow for ${stackDisplay}.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Test command: ${testCmd}

> This is a new session — you have no conversation history. Get context from disk first.
> Use this when ADDING TO or CHANGING an existing feature. Not for new features (use New Feature) or bug fixes (use Fix).

## STEP 0 — Orient from disk before asking anything

Read .kiro/specs/ and list every feature folder that has a requirements.md.
Present the list:
  "Found features with existing specs:
   [list each: <name> — X tasks done, Y remaining]"

Then ask exactly ONE question:

  "Which feature are you editing?
   — Feature name (from the list above, or type a new one if the spec is missing)
   — What you want to add or change (1-3 sentences)
   — Any constraints (e.g. 'keep the API contract unchanged', 'no new dependencies')"

Do not ask follow-up questions. Use the user's answer for all three gates.
${generateKnowledgePreambleHook()}

## STEP 1 — Read Existing Spec

Read ALL spec files for the feature the user named:
- .kiro/specs/<name>/requirements.md
- .kiro/specs/<name>/design.md
- .kiro/specs/<name>/tasks.md

Note which tasks are already checked [x] — these are DONE and must not be disturbed.

If a spec file is missing: note it and generate a draft from what exists in the code.

After reading, confirm:
> "I've read the existing spec for **<name>**.
> Current state: [X tasks done, Y remaining]
> Proceeding to updated spec..."

---

## GATE 1 — Updated Requirements

Show the FULL updated requirements.md IN CHAT — do NOT write any file yet.

Rules:
- Keep all existing content intact
- Mark additions with: \`<!-- NEW -->\`
- Mark changed items with: \`<!-- CHANGED: was "..." -->\`
- Do NOT silently remove existing criteria

\`\`\`markdown
# Feature: <name>

## Overview
[existing overview — updated: what changed]

## Acceptance Criteria (existing)
- [x] [already done — unchanged]
- [ ] [remaining — unchanged]

## Acceptance Criteria (new — added by this edit)
- [ ] [new criterion]  <!-- NEW -->

## API Contracts
[existing contracts — unchanged]
| [new method] | [new endpoint] | [purpose] |  <!-- NEW -->

## Out of Scope
[existing entries — unchanged]
[new exclusion if any]  <!-- NEW -->
\`\`\`

Ask: "Does this capture what you're adding? Say **ok** to proceed to design, or tell me what to adjust."
Do NOT proceed until user says ok / approved / yes / lgtm / proceed.
${generateSilentCaptureInstructionEditFeature()}

## GATE 2 — Updated Design

After Gate 1 approval, show the FULL updated design.md IN CHAT — do NOT write any file yet.

Rules:
- Mark new layers, components, or data flows with \`<!-- NEW -->\`
- Only add sections — do not remove existing design decisions
- Keep layer flow: ${layerFlow}

Ask: "Does the layer structure still work with the additions? Say **ok** to proceed to tasks, or tell me what to adjust."
Do NOT proceed until user says ok.

---

## GATE 3 — Updated Tasks

After Gate 2 approval, show the FULL updated tasks.md IN CHAT — do NOT write any file yet.

Critical rules:
- Keep all already-checked tasks exactly as they are: \`[x] existing done task\`
- Keep all existing unchecked tasks: \`[ ] existing pending task\`
- Add new tasks at the bottom of the relevant phase, marked \`<!-- NEW -->\`
- Do NOT re-order or remove existing tasks

\`\`\`markdown
# Tasks: <name>

## Phase X Tasks (existing)
- [x] [done task — unchanged]
- [ ] [existing pending — unchanged]
- [ ] [new task for this edit]  <!-- NEW -->

## Phase Y Tasks (new for this edit)  <!-- NEW PHASE -->
- [ ] [new task]
- [ ] Run: ${testCmd}
\`\`\`

Ask: "Tasks look right? Say **ok** to write the updated spec files, or adjust the tasks."
Do NOT write anything until user says ok.

---

## STEP 5 — Write Updated Spec Files

After Gate 3 approval, write:
- .kiro/specs/<name>/requirements.md — full updated content
- .kiro/specs/<name>/design.md — full updated content
- .kiro/specs/<name>/tasks.md — full updated content (existing checked tasks preserved)

Then ask:
> "Spec updated. Which new tasks would you like to implement now?
> - **all new** — implement only the tasks added by this edit
> - **phase 3** — implement all tasks in phase 3 (or whichever phase)
> - **spec only** — stop here, implement later"

---

## STEP 6 — Implement New Tasks Only

Implement ONLY the new tasks the user requested. In order.

Rules:
- Touch ONLY files related to the new tasks
- Do NOT refactor existing code unless the task explicitly requires it
- Do NOT modify files from already-completed phases unless necessary for integration
- After implementing: mark newly completed tasks [x] in .kiro/specs/<name>/tasks.md
- Run ${testCmd} after the last phase if tests are included in scope`,
        },
    }, null, 2) + '\n';
}
