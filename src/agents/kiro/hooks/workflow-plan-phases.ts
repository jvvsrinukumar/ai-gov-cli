import type { GovernanceConfig } from '../../../types.js';
import { generatePlanPhasesContent } from '../../../generators/plan-phases-content.js';

export function generateWorkflowPlanPhases(c: GovernanceConfig): string {
    const prompt = generatePlanPhasesContent({
        config: c,
        commandName: 'workflow-plan-phases',
        crossRefs: {
            backlog: 'workflow-backlog',
            newFeature: 'workflow-new-feature',
            assess: 'workflow-assess',
        },
    });

    return JSON.stringify({
        name: 'Plan Phases',
        version: c.hookVersion,
        description: 'Accepts uploaded documents (PRDs, user stories, epics) and generates phased implementation plan in docs/phases/ with one folder per phase',
        when: { type: 'userTriggered' },
        then: { type: 'askAgent', prompt },
    }, null, 2) + '\n';
}
