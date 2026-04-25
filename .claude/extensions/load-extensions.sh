#!/usr/bin/env bash
command -v jq &>/dev/null || exit 0
DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat); EVENT="${1:-${CLAUDE_HOOK_EVENT:-unknown}}"
EXTS=$(jq -r --arg t "$EVENT" '.extensions[]|select(.enabled==true)|select(.trigger==$t)|.name' "$DIR/manifest.json" 2>/dev/null)
[[ -z "$EXTS" ]] && exit 0
OUT=""
for EX in $EXTS; do
  [[ -f "$DIR/$EX/run.sh" ]] && R=$(echo "$INPUT" | bash "$DIR/$EX/run.sh" 2>/dev/null) && OUT="$OUT[ext:$EX] $R "
done
[[ -n "$OUT" ]] && echo "{\"additionalContext\":\"$(echo "$OUT" | sed 's/"/\\"/g')\"}"
exit 0
