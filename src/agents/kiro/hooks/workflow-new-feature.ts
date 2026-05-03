import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowNewFeature(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const layerFlow = c.profile.layerFlow;
    const featuresDir = c.profile.featuresDir;
    const testCmd = c.profile.testCmd || 'run tests';

    return JSON.stringify({
        name: 'New Feature',
        version: c.hookVersion,
        description: 'Start a new feature using the spec-first 3-gate workflow',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `NEW FEATURE — Spec-first 3-gate workflow for ${stackDisplay}.

Layer flow: ${layerFlow}
Features dir: ${featuresDir}
Test command: ${testCmd}

Ask the user: "What is the feature name?"

Then execute the 3-gate spec workflow:

GATE 1 — REQUIREMENTS
Draft and present for approval:
- Overview (1-2 sentences)
- Acceptance criteria (checkboxes)
- API contracts (if applicable)
- Out of scope
Wait for explicit approval before proceeding.

GATE 2 — DESIGN
Draft and present for approval:
- Architecture layer map (which files in which layers)
- Data flow (request path through layers)
- State shape (if applicable)
- Error handling strategy
- Dependencies on existing features
Wait for explicit approval before proceeding.

GATE 3 — TASKS
Draft and present for approval:
- Phase breakdown following layer flow: ${layerFlow}
- Specific file creation tasks per phase
- Definition of done (tests pass, no files exceed limit, feature README exists)
Wait for explicit approval before proceeding.

After all 3 gates approved:
1. Write spec files to .kiro/specs/<feature-name>/
2. Ask which phases to implement
3. Implement requested phases in order
4. Run ${testCmd} after implementation`,
        },
    }, null, 2) + '\n';
}
