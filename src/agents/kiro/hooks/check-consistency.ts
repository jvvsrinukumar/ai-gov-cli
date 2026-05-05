import type { GovernanceConfig } from '../../../types.js';

export function generateCheckConsistency(c: GovernanceConfig): string {
    const featuresDir = c.profile.featuresDir;

    return JSON.stringify({
        name: 'Check Spec Consistency',
        version: c.hookVersion,
        description: 'Checks for drift between spec and implementation after file writes',
        when: {
            type: 'postToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `CONSISTENCY CHECK — After writing a feature file, check for spec drift:

1. Identify the feature from the file path (directory under ${featuresDir}/)
2. If a spec exists at .kiro/specs/<feature>/:
   a. Check if the file just written is listed in design.md's File List
   b. If all tasks in tasks.md are marked [x] but README.md still says "In Progress", flag it
   c. If code files significantly outnumber files listed in design.md, suggest updating the spec
3. Report any drift found as: "CONSISTENCY: <issue>"

Skip for files not in a feature directory or in core/common/shared directories.
If no drift detected, proceed silently.`,
        },
    }, null, 2) + '\n';
}
