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

> This is a new session — you have no conversation history. Speed matters but safety matters more.

## STEP 0 — Ask ONE question immediately

Do not read any files yet. Ask:

"What is breaking in production?
 — Error message or symptom (paste it)
 — File or feature area (if known)
 — Is this blocking all users, or only some? (helps assess urgency)"

Do not ask anything else. Use whatever the user gives you to proceed.

---

## STEP 1 — IDENTIFY

Read the file(s) in the area the user described.
Find the exact line(s) causing the production issue.
Do not read more than necessary — this is a hotfix, not an audit.

Present:
- Affected file: [path:line]
- What it does now: [one sentence]
- Why it breaks: [one sentence]

---

## STEP 2 — FIX (minimal)

Apply the smallest possible change that resolves the issue.

Hard rules:
- No refactoring
- No feature additions
- No dependency updates
- No changes outside the root cause
- If the fix requires changing more than 3 files: STOP and ask the user — it may not be a hotfix

Show: file name, line range, what changed (before → after).

---

## STEP 3 — TEST

Run: ${testCmd}
If tests pass: continue.
If tests fail: diagnose before deploying.

Write a regression test if one does not exist for this failure path.
Run: ${testCmd} again. New test must pass.

---

## STEP 4 — SUMMARY

Output:
\`\`\`
HOTFIX SUMMARY
  What broke:    [one sentence]
  Root cause:    [one sentence]
  Fix applied:   [file:line — what changed]
  Test added:    yes — <test name> / no — <reason>
  Tests passing: yes / no
  Safe to deploy: yes / needs review — <reason>
\`\`\``,
        },
    }, null, 2) + '\n';
}
