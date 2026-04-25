#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[[ -z "$CMD" ]] && exit 0
echo "$CMD" | grep -qE "git\s+push\s+.*--force|git\s+push\s+-f" && echo "BLOCKED: force push not allowed." >&2 && exit 2
echo "$CMD" | grep -qE "git\s+reset\s+--hard|git\s+clean\s+-fd" && echo "BLOCKED: destructive git op." >&2 && exit 2
echo "$CMD" | grep -qE "npm\s+install\s+[^-]|yarn\s+add|pnpm\s+add" && echo "BLOCKED: package installs require developer approval." >&2 && exit 2
echo "$CMD" | grep -qE "rm\s+-rf\s+src/" && echo "BLOCKED: removing project dirs not allowed." >&2 && exit 2
echo "$CMD" | grep -qE "rm\s+-rf\s+dist/" && echo "BLOCKED: removing project dirs not allowed." >&2 && exit 2
exit 0
