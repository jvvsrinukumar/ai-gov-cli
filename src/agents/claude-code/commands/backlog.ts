import type { GovernanceConfig } from '../../../types.js';
import { generateBacklogContent } from '../../../generators/backlog-content.js';

export function generateBacklogCommand(c: GovernanceConfig): string {
    return generateBacklogContent({
        config: c,
        commandName: '/backlog',
        crossRefs: {
            assess: '/assess',
            audit: '/audit',
            newFeature: '/new-feature',
        },
        crossProjectRulesPath: '.claude/steering/cross-project-rules.md',
        developerActionsPath: '.claude/developer-actions.md',
    });
}
