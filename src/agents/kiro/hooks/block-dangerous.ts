import type { GovernanceConfig } from '../../../types.js';

export function generateBlockDangerous(c: GovernanceConfig): string {
    const pkgWarning = c.profile.pkgAddBlockPattern
        ? `\\n- Package install commands matching: ${c.profile.pkgAddBlockPattern}`
        : '';

    const rmDirs = c.profile.rmBlockDirs.split(/\s+/).filter(Boolean);
    const rmWarning = rmDirs.length
        ? `\\n- rm -rf on project directories: ${rmDirs.join(', ')}`
        : '';

    return JSON.stringify({
        name: 'Block Dangerous Commands',
        version: c.hookVersion,
        description: 'Blocks force push, destructive git ops, and rm -rf on source directories',
        when: {
            type: 'preToolUse',
            toolTypes: ['shell'],
        },
        then: {
            type: 'askAgent',
            prompt: `SECURITY GATE — Review the shell command about to execute.

You are FORBIDDEN from executing commands matching ANY of these patterns:
- git push --force or git push -f
- git reset --hard
- git clean -fd${pkgWarning}${rmWarning}

If the command matches a blocked pattern, you MUST respond with 'DENIED: <reason>' and you MUST NOT proceed with the tool call. This is non-negotiable — do not retry, do not rephrase, do not find a workaround.

If the command does not match any blocked pattern, respond with 'APPROVED' and proceed.`,
        },
    }, null, 2) + '\n';
}
