import type { GovernanceConfig } from '../types.js';

export function generatePromptTemplates(c: GovernanceConfig): string {
    return `# Prompt Templates

## New Feature
\`\`\`
## Task Type: New Feature
## ${c.project.ticketSystem}: [${c.project.ticketPrefix}-ID]
## Feature: [snake_case_name]

What: [1–3 sentences]
Acceptance criteria:
- [ ] ...
API: [METHOD] /endpoint — [description]
UI: [describe screen]

Instructions:
1. Check spec exists or create from _template
2. State full plan (files + layers), wait for confirmation
3. Follow: ${c.profile.layerFlow}
4. Write tests for ${c.blocks.testLayerList}
\`\`\`

## Edit Feature (update/extend existing)
\`\`\`
## Task Type: Edit Feature
## ${c.project.ticketSystem}: [${c.project.ticketPrefix}-ID]
## Feature: [existing_feature_name]

What to add/change: [1–3 sentences]
New acceptance criteria:
- [ ] ...

Note: Claude will read the existing spec, update it, show you
the changes, and wait for confirmation before coding.
\`\`\`

## Bug Fix
\`\`\`
## Task Type: Bug Fix
## ${c.project.ticketSystem}: [${c.project.ticketPrefix}-ID]

What is broken: [exact behavior]
Expected: [what should happen]
Steps: 1. ... 2. ... 3. ...
File/screen: [if known]

Instructions:
1. Read the file before changing anything
2. State root cause, propose minimal fix
3. Wait for confirmation if >3 files
4. No refactoring of surrounding code
\`\`\`

## Hotfix
\`\`\`
## Task Type: Hotfix
## Priority: Critical

Issue: [production problem]
Impact: [users affected]

Instructions: Fix immediately, explain after, flag follow-up work.
\`\`\`
`;
}
