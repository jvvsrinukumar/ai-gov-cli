import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowAudit(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const sourceDir = c.profile.sourceDir || 'src/';
    const layerFlow = c.profile.layerFlow;

    return JSON.stringify({
        name: 'Audit',
        version: c.hookVersion,
        description: 'Run a full governance audit: observe codebase, identify drift, dead code, and coverage gaps',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `AUDIT — Full governance audit for this ${stackDisplay} project.

Stack: ${stackDisplay}
Layer flow: ${layerFlow}
Source: ${sourceDir}

Execute these steps in order:

1. OBSERVE — Read 15-25 source files across each major directory under ${sourceDir}. Record what you actually see: frameworks, patterns, data flow, naming conventions. Do not assume — only report observed facts.

2. COMPARE — Read .kiro/steering/architecture.md and .kiro/steering/coding-standards.md. Compare what the governance files say the project should look like vs what you observed. List every discrepancy as a drift item.

3. DEAD CODE — Scan for files with _old, _backup, _deprecated, _unused suffixes. Check for orphaned test files whose source no longer exists. Check for unused exports/services not imported anywhere.

4. TEST COVERAGE — For each feature directory, check if corresponding test files exist. Score: (features with tests / total features) × 100.

5. REPORT — Output a structured audit report:
   - Architecture drift items (governance says X, code does Y)
   - Dead code candidates (list files)
   - Test coverage score and gaps
   - Recommended actions (prioritized)

Be thorough but factual. Report what IS, not what should be.`,
        },
    }, null, 2) + '\n';
}
