import type { GovernanceConfig } from '../../../types.js';
import { buildJiraSyncPrompt } from '../../../generators/jira-sync-prompt.js';

export function generateWorkflowJiraSync(c: GovernanceConfig): string {
    return JSON.stringify({
        name: 'Jira Sync',
        version: c.hookVersion,
        description: 'Sync spec tasks.md to Jira story sub-tasks',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: buildJiraSyncPrompt(c),
        },
    }, null, 2) + '\n';
}
