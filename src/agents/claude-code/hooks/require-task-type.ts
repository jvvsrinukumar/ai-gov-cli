import type { GovernanceConfig } from '../../../types.js';
import { JSON_GUARD } from './shared.js';

export function generateRequireTaskType(c: GovernanceConfig): string {
    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
# Fires on UserPromptSubmit — blocks development tasks submitted
# without a governance slash command or ## Task Type header.
# Mode: BLOCK. To allow unclassified tasks: change exit 1 to exit 0 at the bottom.

${JSON_GUARD}

INPUT=$(cat)

# Extract the user message — tries jq first, falls back to python3
if command -v jq &>/dev/null; then
    MSG=$(printf '%s' "$INPUT" | jq -r '.message // .prompt // ""' 2>/dev/null)
else
    MSG=$(printf '%s' "$INPUT" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('message') or d.get('prompt') or '')
except: print('')
" 2>/dev/null)
fi
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
    echo "GOVERNANCE: Use a slash command to classify this task before proceeding.

  /new-feature [name]    — build something new (plan mode + 3-gate spec)
  /fix [description]     — bug fix (root cause first, minimal change)
  /refactor [scope]      — structural change (impact analysis + test gate)
  /hotfix [issue]        — production issue (immediate fix path)
  /edit-feature [name]   — extend an existing feature

Or prefix your message with:  ## Task Type: New Feature / Bug Fix / Refactor / Hotfix / Edit Feature

Unclassified tasks skip governance workflow, spec enforcement, and plan mode." >&2
    exit 1
fi

exit 0
`;
}
