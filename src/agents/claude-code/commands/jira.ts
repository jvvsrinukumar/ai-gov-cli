import type { GovernanceConfig } from '../../../types.js';
import { buildJiraSyncPrompt } from '../../../generators/jira-sync-prompt.js';

export function generateJiraCommand(c: GovernanceConfig): string {
    return `# /jira\n\n${buildJiraSyncPrompt(c)}`;
}
