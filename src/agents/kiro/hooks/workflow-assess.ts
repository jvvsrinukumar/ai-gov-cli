import type { GovernanceConfig } from '../../../types.js';
import { generateAssessContent } from '../../../generators/assess-content.js';
import { generateKnowledgePreambleHook } from '../../../utils/knowledge-preamble.js';

export function generateWorkflowAssess(c: GovernanceConfig): string {
    const prompt = generateAssessContent({
        config: c,
        commandName: 'workflow-assess',
        agentLabel: 'Kiro',
        knowledgePreamble: generateKnowledgePreambleHook(),
        developerActionsPath: '.kiro/developer-actions.md',
    });

    return JSON.stringify({
        name: 'Assess',
        version: c.hookVersion,
        description: 'Refactor vs Rewrite decision framework: measures the codebase, scores 7 dimensions, recommends Rewrite / Refactor / Strangler Fig / Leave It, writes 11 docs to docs/assessment/',
        when: { type: 'userTriggered' },
        then: { type: 'askAgent', prompt },
    }, null, 2) + '\n';
}
