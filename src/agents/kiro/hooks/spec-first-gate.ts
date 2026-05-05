import type { GovernanceConfig } from '../../../types.js';

export function generateSpecFirstGate(c: GovernanceConfig): string | null {
    if (!c.specFirstEnabled) return null;

    const featuresDir = c.profile.featuresDir;
    const fileExt = c.profile.fileExt;

    return JSON.stringify({
        name: 'Spec-First Gate',
        version: c.hookVersion,
        description: 'Blocks feature code writes until a complete spec exists in .kiro/specs/',
        when: {
            type: 'preToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `SPEC-FIRST GATE — Before writing feature code (${fileExt} files in ${featuresDir}), verify:

1. Identify the feature name from the file path (the directory under ${featuresDir}/)
2. Check if .kiro/specs/<feature-name>/ exists
3. If the spec directory does NOT exist, respond with:
   DENIED: No spec at .kiro/specs/<feature-name>/. Before writing any feature code:
   1. Create .kiro/specs/<feature-name>/requirements.md (fill ALL placeholders)
   2. Create .kiro/specs/<feature-name>/design.md (layer mapping, file list)
   3. Create .kiro/specs/<feature-name>/tasks.md (phased task breakdown)
   4. Present the plan and WAIT for user confirmation

4. If the spec exists, verify it is complete:
   - requirements.md exists and has no _replace_ placeholders
   - design.md exists and has no _replace_ or _describe_ placeholders
   - tasks.md exists and has at least one task item (- [ ])
   If incomplete, respond with DENIED and list what needs to be filled.

5. Skip this check for: test files (*${fileExt.replace('.', '.test.')}), config files, files in core/common/shared/utils directories.

If the spec is complete, respond with 'APPROVED' and proceed.`,
        },
    }, null, 2) + '\n';
}
