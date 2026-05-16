import type { GovernanceConfig } from '../../../types.js';
import { generateKnowledgePreambleCommand } from '../../../utils/knowledge-preamble.js';
import { generateSilentCaptureInstructionEditFeature } from '../../../utils/knowledge-capture.js';

export function generateEditFeatureCommand(c: GovernanceConfig): string {
    const { profile } = c;
    const stackDisplay = profile.stackDisplay;
    const layerFlow = profile.layerFlow;
    const testCmd = profile.testCmd || 'run tests';

    return `# /edit-feature — Edit Existing Feature (Plan Mode · 3-Gate Spec Update)

**Stack:** ${stackDisplay}
**Layer flow:** ${layerFlow}

> Use this when adding to, changing, or extending a feature that already exists.
> Do NOT use for bug fixes (use \`/fix\`) or new features (use \`/new-feature\`).

---

## STEP 0 — Enter Plan Mode (IMMEDIATE)

**Call the \`EnterPlanMode\` tool immediately.**

You cannot write or edit any files during planning. File writes happen only after all 3 gates are approved and \`ExitPlanMode\` is called.

> Feature name from \`$ARGUMENTS\`: the existing feature to edit. If blank, ask: "Which feature are you editing?"
${generateKnowledgePreambleCommand()}
## STEP 1 — Read Existing Spec + Context

Read ALL of these before generating anything:

1. \`specs/$ARGUMENTS/requirements.md\` — existing requirements
2. \`specs/$ARGUMENTS/design.md\` — existing design
3. \`specs/$ARGUMENTS/tasks.md\` — existing tasks (note which are already checked ✓)

Architecture rules and naming are in \`.claude/CLAUDE.md\` — already loaded.
Only read \`.claude/steering/architecture.md\` if this project has legacy/dual-mode zones.

If any spec file is missing, note it and generate a draft from what exists in the code.

After reading, briefly summarise:
> "I've read the existing spec for **$ARGUMENTS**.
> Current state: [X tasks done, Y remaining]
> I understand the addition/change you're making. Proceeding to updated spec..."

---

## STEP 2 — GATE 1: Updated Requirements

Show the FULL updated \`requirements.md\` in the chat.
- Keep existing content intact
- Mark new additions clearly with: \`<!-- NEW -->\`
- Mark changed items with: \`<!-- CHANGED: was "..." -->\`
- Do NOT silently remove existing criteria

\`\`\`markdown
# Feature: $ARGUMENTS

## Overview
[existing overview] — updated: [what changed]

## Acceptance Criteria (existing)
- [x] [already done criteria — keep as-is]
- [ ] [remaining criteria — keep as-is]

## Acceptance Criteria (new — added by this edit)
- [ ] [new criterion 1]  <!-- NEW -->
- [ ] [new criterion 2]  <!-- NEW -->

## API Contracts
[existing contracts — keep]
| [new method] | [new endpoint] | [purpose] |  <!-- NEW -->
\`\`\`

**After showing:**
> "Here is the updated requirements for **$ARGUMENTS** — changes marked NEW/CHANGED.
> Does this capture what you're adding? Say **ok** to proceed or tell me what to adjust."

**DO NOT proceed until explicit approval.**
${generateSilentCaptureInstructionEditFeature()}
## STEP 3 — GATE 2: Updated Design

Show the FULL updated \`design.md\` in the chat.
- Mark new layers, components, or data flows with \`<!-- NEW -->\`
- Only add sections — do not remove existing design decisions

**After showing:**
> "Updated design ready. Does the layer structure still work with the additions?
> Say **ok** to proceed to tasks."

**DO NOT proceed until explicit approval.**

---

## STEP 4 — GATE 3: Updated Tasks

Show the FULL updated \`tasks.md\` in the chat.

**Critical rules:**
- Keep all already-checked tasks exactly as they are: \`[x] existing done task\`
- Keep all existing unchecked tasks: \`[ ] existing pending task\`
- Add new tasks at the bottom of the relevant phase, marked \`<!-- NEW -->\`
- Do NOT re-order or remove existing tasks

\`\`\`markdown
# Tasks: $ARGUMENTS

## Phase X Tasks (existing)
- [x] [done task — unchanged]
- [ ] [existing pending task — unchanged]
- [ ] [new task for this edit]  <!-- NEW -->

## Phase Y Tasks (new for this edit)  <!-- NEW PHASE -->
- [ ] [new task]
- [ ] [new task]
- [ ] Run: \`${testCmd}\`
\`\`\`

**After showing:**
> "Updated tasks ready. The new tasks are marked NEW — existing progress is preserved.
> Say **ok** to write the updated spec files."

**DO NOT write anything until explicit Gate 3 approval.**

---

## STEP 5 — Exit Plan Mode + Write Updated Spec Files

After Gate 3 approval:

1. **Call \`ExitPlanMode\` tool**
2. Write \`specs/$ARGUMENTS/requirements.md\` — full updated content
3. Write \`specs/$ARGUMENTS/design.md\` — full updated content
4. Write \`specs/$ARGUMENTS/tasks.md\` — full updated content (existing checked tasks preserved)

Then ask:

> "Spec updated. Which new tasks would you like to implement now?
> - **'all new'** — implement only the new tasks added by this edit
> - **'phase 3'** — implement all tasks in phase 3
> - **'spec only'** — stop here, implement later"

---

## STEP 6 — Phase-Selective Implementation

Implement ONLY the new tasks the developer requested.

**Rules:**
- Touch ONLY files related to the new tasks
- Do NOT refactor existing code unless the task explicitly requires it
- Do NOT modify files from already-completed phases unless necessary for integration
- After implementing: update \`tasks.md\` — mark newly completed tasks \`[x]\`
- Run \`${testCmd}\` after Phase 5 tasks if applicable

---

## RULES

- Plan mode: zero file writes from Step 0 through end of Step 4
- Existing spec content is never silently deleted — only additions and explicit changes
- Each gate requires explicit approval — do not auto-advance
- Only implement the new tasks requested — do not rebuild what's already done
`;
}
