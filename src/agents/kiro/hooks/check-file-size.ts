import type { GovernanceConfig } from '../../../types.js';

export function generateCheckFileSize(c: GovernanceConfig): string {
    const fileExt = c.profile.fileExt;
    const genPatterns = (c.profile.generatedPatterns || '').split(' ').filter(Boolean);
    const skipPatterns = genPatterns.length
        ? `\n- Generated files matching: ${genPatterns.join(', ')}`
        : '';

    return JSON.stringify({
        name: 'Check File Size',
        version: c.hookVersion,
        description: 'Checks file size after write and prompts refactoring if over 200 lines',
        when: {
            type: 'postToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `FILE SIZE CHECK — After writing a ${fileExt} file, check its line count.

Rules:
- If the file exceeds 300 lines: STOP and refactor immediately. Split into smaller modules before proceeding.
- If the file exceeds 200 lines: add a warning and plan to refactor before moving to the next task.
- If under 200 lines: proceed normally.

Skip this check for:
- Test files (*.test.*, *.spec.*, *_test.*)
- Config/entry files (config, index, app, server, main)
- Type definition files (*.type.*, *.types.*, *.model.*, *.dto.*)${skipPatterns}

See .kiro/steering/coding-standards.md 'File Size' section for decomposition guidance.`,
        },
    }, null, 2) + '\n';
}
