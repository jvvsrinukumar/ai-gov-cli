import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowHotfix(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;
    const testCmd = c.profile.testCmd || 'run tests';

    return JSON.stringify({
        name: 'Hotfix',
        version: c.hookVersion,
        description: 'Emergency production fix — minimal change, maximum safety',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `HOTFIX — Emergency production fix for ${stackDisplay}.

Test command: ${testCmd}

Ask the user: "What is breaking in production?"

RULES — This is a hotfix. Speed matters but safety matters more:
- Smallest possible change
- No refactoring
- No feature additions
- No dependency updates
- Must have a test

STEP 1 — IDENTIFY
Read the affected file(s). Find the exact line(s) causing the production issue.

STEP 2 — FIX (minimal)
Apply the smallest change that resolves the issue.
Present what you changed and why.

STEP 3 — TEST
Run: ${testCmd}
Write a regression test if one doesn't exist.

STEP 4 — SUMMARY
Output:
- What broke: [one sentence]
- Root cause: [one sentence]
- Fix applied: [file:line — what changed]
- Test added: [yes/no — test name]
- Safe to deploy: [yes, with confidence level]`,
        },
    }, null, 2) + '\n';
}
