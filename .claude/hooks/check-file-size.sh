#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only check files with the project's source extension
[[ "$FILE_PATH" != *".ts" ]] && exit 0

# Skip test files
BN=$(basename "$FILE_PATH")
echo "$BN" | grep -qE '\.test\.|\. spec\.|_test\.|\. stories\.' && exit 0

# Skip generated files
echo "$BN" | grep -qF '.generated.ts' && exit 0
echo "$BN" | grep -qF '.generated.js' && exit 0

# Skip config/entry files
echo "$BN" | grep -qiE '^(config|index|app|server|main)' && exit 0

# Skip type definition files (interfaces, models, types)
echo "$BN" | grep -qiE '(\.type\.|\. types\.|\. model\.|\. models\.|\. interface\.|\. dto\.)' && exit 0

# Count lines
[[ ! -f "$FILE_PATH" ]] && exit 0
LINES=$(wc -l < "$FILE_PATH" | tr -d ' ')
if [[ "$LINES" -gt 300 ]]; then
  echo "BLOCKED: '$BN' has $LINES lines (HARD LIMIT: 200). This file is far too large." >&2
  echo "You MUST split this file into smaller components NOW before continuing." >&2
  echo "See .claude/steering/coding-standards.md 'File Size' section for how to decompose." >&2
  exit 2
elif [[ "$LINES" -gt 200 ]]; then
  echo "{\"additionalContext\":\"⚠️ FILE SIZE VIOLATION: '$BN' has $LINES lines (max 200). You MUST refactor this file into smaller components BEFORE moving to the next task. Do not ignore this — split the file now. See coding-standards.md File Size section.\"}"
fi
exit 0
