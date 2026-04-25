#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" == *.generated.ts ]] && { echo "BLOCKED: '$FILE_PATH' is generated — edit source and regenerate." >&2; exit 2; }
[[ "$FILE_PATH" == *.generated.js ]] && { echo "BLOCKED: '$FILE_PATH' is generated — edit source and regenerate." >&2; exit 2; }
HR=("config.ts")
FNAME=$(basename "$FILE_PATH")
for f in "${HR[@]}"; do
  if [[ "$FNAME" == "$f" || "$FILE_PATH" == */"$f" ]]; then
    echo "{\"additionalContext\":\"WARNING: '$f' is high-risk. Confirm this change is in scope.\"}" && exit 0
  fi
done
exit 0
