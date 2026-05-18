import type { GovernanceConfig } from '../../../types.js';
import { generateBacklogContent } from '../../../generators/backlog-content.js';

export function generateWorkflowBacklog(c: GovernanceConfig): string {
    const prompt = generateBacklogContent({
        config: c,
        commandName: 'workflow-backlog',
        crossRefs: {
            assess: 'workflow-assess',
            audit: 'workflow-audit',
            newFeature: 'workflow-new-feature',
        },
        crossProjectRulesPath: '.kiro/steering/cross-project-rules.md',
        developerActionsPath: '.kiro/developer-actions.md',
    });

    return JSON.stringify({
        name: 'Backlog',
        version: c.hookVersion,
        description: 'Mines docs/assessment/ for rebuild-able units, orders by technical dependency, formats them as workflow-new-feature-ready story prompts',
        when: { type: 'userTriggered' },
        then: { type: 'askAgent', prompt },
    }, null, 2) + '\n';
}
