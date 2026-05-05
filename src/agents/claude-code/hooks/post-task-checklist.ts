import type { GovernanceConfig } from '../../../types.js';

export function generatePostTaskChecklist(c: GovernanceConfig): string {
    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
echo '{"additionalContext":"BEFORE FINISHING — complete the post-task checklist from .claude/CLAUDE.md:\\n\\nNew Feature/Edit Feature/Refactor: 1) list files modified 2) update tasks.md 3) confirm arch compliance 4) summarise 3-5 bullets 5) flag risks 6) confirm tests\\n\\nBug Fix: 1) list files 2) summarise fix 3) flag high-risk\\n\\nHotfix: 1) what changed and why 2) flag for review"}'
exit 0
`;
}
