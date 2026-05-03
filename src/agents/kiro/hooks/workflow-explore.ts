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

Layer flow: ${layerFlow}
Source: ${sourceDir}

Ask the user: "What do you want to understand?" (a feature, a data flow, a pattern, or the whole structure)

RULES:
- DO NOT write or modify any files
- DO NOT run any commands that change state
- Only read files and report findings

Then:
1. Read the relevant files based on what the user wants to understand
2. Trace data flows from entry point to data source
3. Map the dependency graph for the area of interest
4. Report findings as a structured summary:
   - Files involved (with their roles)
   - Data flow diagram (text-based)
   - Patterns observed
   - Potential concerns or inconsistencies

Keep the report factual — what IS, not what should be.`,
        },
    }, null, 2) + '\n';
}
