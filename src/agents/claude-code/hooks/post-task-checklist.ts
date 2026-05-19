import type { GovernanceConfig } from '../../../types.js';

export function generatePostTaskChecklist(c: GovernanceConfig): string {
  return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
JIRA_NUDGE=""
if [ -f ".jira" ] || find . -name ".jira" -maxdepth 4 -quit 2>/dev/null | grep -q .; then
  JIRA_NUDGE="\\n\\nJira: tasks.md updated? Run /jira to log worked hours for completed tasks ([x]) and update ticket status."
fi
echo "{\\"additionalContext\\":\\"BEFORE FINISHING — complete the post-task checklist from .claude/CLAUDE.md:\\n\\nNew Feature/Edit Feature/Refactor: 1) list files modified 2) update tasks.md 3) confirm arch compliance 4) summarise 3-5 bullets 5) flag risks 6) confirm tests\\n\\nBug Fix: 1) list files 2) summarise fix 3) flag high-risk\\n\\nHotfix: 1) what changed and why 2) flag for review\${JIRA_NUDGE}\\"}"
exit 0
`;
}
