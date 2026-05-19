import type { GovernanceConfig } from '../../../types.js';
import { generatePlanPhasesContent } from '../../../generators/plan-phases-content.js';

export function generatePlanPhasesCommand(c: GovernanceConfig): string {
    return generatePlanPhasesContent({
        config: c,
        commandName: '/plan-phases',
        crossRefs: {
            backlog: '/backlog',
            newFeature: '/new-feature',
            assess: '/assess',
        },
    });
}
