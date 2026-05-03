import type { GovernanceConfig } from '../../../types.js';

export function generateAnalyzeCode(c: GovernanceConfig): string | null {
    const linter = c.scan.detectedLinter;
    const hasConfig = c.scan.detectedHasLinterConfig;
    const analyzeCmd = c.profile.analyzeCmd;

    // No linter detected — skip
    if (!analyzeCmd && !linter) return null;

    // Linter detected but no config — warn
    if (linter && !hasConfig) {
        return JSON.stringify({
            name: 'Analyze Code After Write',
            version: c.hookVersion,
            description: `${linter} detected but no config file found — add a config to enable auto-linting`,
            when: {
                type: 'postToolUse',
                toolTypes: ['write'],
            },
            then: {
                type: 'askAgent',
                prompt: `WARNING: ${linter} is installed but no configuration file was found. Auto-linting is disabled. Add a ${linter} config file to enable linting after writes.`,
            },
        }, null, 2) + '\n';
    }

    return JSON.stringify({
        name: 'Analyze Code After Write',
        version: c.hookVersion,
        description: `Runs ${linter || 'linter'} after every file write to catch issues early`,
        when: {
            type: 'postToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'runCommand',
            command: analyzeCmd,
        },
    }, null, 2) + '\n';
}
