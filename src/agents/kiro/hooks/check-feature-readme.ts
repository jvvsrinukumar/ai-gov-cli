import type { GovernanceConfig } from '../../../types.js';

export function generateCheckFeatureReadme(c: GovernanceConfig): string {
    const featuresDir = c.profile.featuresDir;

    return JSON.stringify({
        name: 'Check Feature README',
        version: c.hookVersion,
        description: 'Reminds to update feature README when feature files are modified',
        when: {
            type: 'postToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `FEATURE README CHECK — After writing a file, check if it belongs to a feature directory under ${featuresDir}/.

If it does:
1. Check if the feature directory has a README.md
2. If README.md is missing, remind: "Feature '<name>' is missing README.md — create one documenting the feature's purpose, files, and status."
3. If README.md exists, check if the file just written is listed in it. If not, remind: "File '<filename>' not listed in <feature>/README.md — update the Files table."

Skip this check for:
- Files not in a feature directory
- Files in core/common/shared/utils/config directories
- README.md files themselves`,
        },
    }, null, 2) + '\n';
}
