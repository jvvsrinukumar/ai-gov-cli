import type { GovernanceConfig } from '../../types.js';

export function generateRequireTaskType(c: GovernanceConfig): string {
    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
# Fires on UserPromptSubmit — warns when a development task is submitted
# without using a governance slash command or ## Task Type header.
# Mode: WARN (default). To block: change exit 0 to exit 1 at the bottom.

command -v jq &>/dev/null || exit 0

INPUT=$(cat)

# Extract the user message
MSG=$(echo "$INPUT" | jq -r '.message // .prompt // ""' 2>/dev/null)
[[ -z "$MSG" ]] && exit 0

# Already classified — has a slash command
if echo "$MSG" | grep -qE '^/(new-feature|edit-feature|fix|refactor|hotfix|audit)'; then
    exit 0
fi

# Already classified — has ## Task Type header
if echo "$MSG" | grep -qE '^##\\s*Task Type:'; then
    exit 0
fi

# Continuation messages — never flag these
if echo "$MSG" | grep -qiE '^(ok|okay|yes|no|go ahead|proceed|approved|looks good|lgtm|done|continue|all|develop|phase [0-9]|start phase|spec only|next|good|perfect|cancel|stop|thanks|thank you|resume)'; then
    exit 0
fi

# Short messages (< 6 words) are unlikely to be task requests
WORD_COUNT=$(echo "$MSG" | wc -w | tr -d ' ')
if [ "$WORD_COUNT" -lt 6 ]; then
    exit 0
fi

# Development task keywords that signal a new task request
if echo "$MSG" | grep -qiE '\\b(build|implement|create|add|make|develop|write|generate|scaffold)\\b.*\\b(feature|screen|page|component|service|endpoint|api|module|function|class|widget|hook|route|controller|cubit|bloc|provider|store|reducer|model|schema|view|viewmodel)\\b'; then
    WARN=1
elif echo "$MSG" | grep -qiE '^(build|implement|create|add|make|develop|write|generate|scaffold) '; then
    WARN=1
elif echo "$MSG" | grep -qiE '\\b(fix|debug|resolve|investigate) .*\\b(bug|error|issue|crash|broken|failing|exception|undefined|null|500|404)\\b'; then
    WARN=1
elif echo "$MSG" | grep -qiE '^(fix|debug|resolve) '; then
    WARN=1
elif echo "$MSG" | grep -qiE '\\b(refactor|restructure|reorganise|reorganize|clean up|extract|move) '; then
    WARN=1
else
    WARN=0
fi

if [ "$WARN" -eq 1 ]; then
    cat <<'EOF'
{
  "additionalContext": "GOVERNANCE: This looks like a development task but has no task type classification.\\n\\nUse a governance command instead:\\n  /new-feature [name]    — build something new (plan mode + 3-gate spec)\\n  /fix [description]     — bug fix (fast path)\\n  /refactor [scope]      — structural improvement\\n  /hotfix [issue]        — production issue (immediate fix)\\n  /edit-feature [name]   — update existing feature\\n\\nOr prefix with: ## Task Type: New Feature / Bug Fix / Refactor / Hotfix / Edit Feature\\n\\nWhy: unclassified tasks skip governance workflow, spec enforcement, and plan mode."
}
EOF
    # WARN mode: exit 0 to let the message through with the advisory
    # To BLOCK instead (team enforcement), change to: exit 1
    exit 0
fi

exit 0
`;
}
