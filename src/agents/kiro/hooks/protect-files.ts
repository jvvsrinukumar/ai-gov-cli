import type { GovernanceConfig } from '../../../types.js';

export function generateProtectFiles(c: GovernanceConfig): string {
    const hrFiles = c.scan.highRiskFiles;
    const hrList = hrFiles.length
        ? hrFiles.map(f => `  - ${f}`).join('\n')
        : '  (none detected)';

    const genPatterns = (c.profile.generatedPatterns || '').split(' ').filter(Boolean);
    const genWarning = genPatterns.length
        ? `\n\nGenerated file patterns (always DENY edits — edit source and regenerate):\n${genPatterns.map(p => `  - ${p}`).join('\n')}`
        : '';

    return JSON.stringify({
        name: 'Protect High-Risk Files',
        version: c.hookVersion,
        description: 'Warns on edits to high-risk files and blocks edits to generated files',
        when: {
            type: 'preToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `FILE PROTECTION GATE — Check the file about to be written.

High-risk files (WARN — confirm the change is explicitly in scope before proceeding):
${hrList}

If the file matches a high-risk file, add a warning to your response: "⚠️ HIGH-RISK: <filename> — confirming this change is in scope." Then proceed only if the change is directly related to the current task.${genWarning}

GENERATED FILES — You are FORBIDDEN from editing generated files directly. If the file matches a generated file pattern, you MUST respond with 'DENIED: <filename> is generated — edit the source and regenerate instead.' Do NOT proceed with the write. Do NOT retry. Do NOT find a workaround.

Otherwise proceed normally.`,
        },
    }, null, 2) + '\n';
}
