import type { GovernanceConfig } from '../../../types.js';

export function generateFormatCode(c: GovernanceConfig): string | null {
    const formatter = c.scan.detectedFormatter;
    const hasConfig = c.scan.detectedHasFormatterConfig;
    const formatCmd = c.profile.formatCmd;

    // No formatter detected — skip
    if (!formatCmd && !formatter) return null;

    // Formatter detected but no config — warn instead of running
    if (formatter && !hasConfig && formatter !== 'biome') {
        return JSON.stringify({
            name: 'Format Code After Write',
            version: c.hookVersion,
            description: `${formatter} detected but no config file found — add a config to enable auto-formatting`,
            when: {
                type: 'postToolUse',
                toolTypes: ['write'],
            },
            then: {
                type: 'askAgent',
                prompt: `WARNING: ${formatter} is installed but no configuration file was found. Auto-formatting is disabled. Add a ${formatter} config file to enable formatting on save.`,
            },
        }, null, 2) + '\n';
    }

    return JSON.stringify({
        name: 'Format Code After Write',
        version: c.hookVersion,
        description: `Auto-formats source files after every write using ${formatter || 'the project formatter'}`,
        when: {
            type: 'postToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'runCommand',
            command: formatCmd,
        },
    }, null, 2) + '\n';
}
