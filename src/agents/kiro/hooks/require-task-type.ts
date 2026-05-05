import type { GovernanceConfig } from '../../../types.js';

export function generateRequireTaskType(c: GovernanceConfig): string {
    return JSON.stringify({
        name: 'Require Task Type Classification',
        version: c.hookVersion,
        description: 'Prompts developers to classify tasks before starting development work',
        when: {
            type: 'promptSubmit',
        },
        then: {
            type: 'askAgent',
            prompt: `TASK CLASSIFICATION — Before starting development work, check if the user's message indicates a new task.

If the message is a development request (build, implement, create, fix, debug, refactor, etc.) that hasn't been classified, suggest:

"Please classify this task:
  - New Feature [name] — build something new (spec-first workflow)
  - Edit Feature [name] — extend an existing feature
  - Bug Fix [description] — reproduce, diagnose, fix, verify
  - Refactor [scope] — structural change with impact analysis
  - Hotfix [issue] — minimal urgent production fix

Or prefix your message with: ## Task Type: New Feature / Bug Fix / Refactor / Hotfix / Edit Feature"

Skip classification for:
- Short messages (< 6 words)
- Continuation messages (ok, yes, proceed, continue, next, done, approved, looks good)
- Questions or exploration requests
- Messages that already contain "## Task Type:"`,
        },
    }, null, 2) + '\n';
}
