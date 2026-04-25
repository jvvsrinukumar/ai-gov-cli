#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0
([[ "$FILE_PATH" == *.ts ]] || [[ "$FILE_PATH" == *.js ]]) || exit 0

RESULT=$(npx eslint "$FILE_PATH" 2>&1); CODE=$?
[[ $CODE -ne 0 ]] && echo "{\"additionalContext\":\"Analyzer issues in $FILE_PATH:\n$RESULT\"}"
exit 0
