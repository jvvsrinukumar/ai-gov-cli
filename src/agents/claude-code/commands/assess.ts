import type { GovernanceConfig } from '../../../types.js';
import { generateAssessContent } from '../../../generators/assess-content.js';
import { generateKnowledgePreambleCommand } from '../../../utils/knowledge-preamble.js';

export function generateAssessCommand(c: GovernanceConfig): string {
    return generateAssessContent({
        config: c,
        commandName: '/assess',
        agentLabel: 'Claude Code',
        knowledgePreamble: generateKnowledgePreambleCommand(),
        developerActionsPath: '.claude/developer-actions.md',
    });
}
