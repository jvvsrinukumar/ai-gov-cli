import type { GovernanceConfig } from '../../types.js';

export function generateCheckFileSize(c: GovernanceConfig): string {
  const p = c.profile;
  const activeStacks = ['flutter', 'kotlin', 'react', 'angular', 'nodejs', 'python', 'java'];

  // Stacks without meaningful per-file size limits → no-op
  if (!activeStacks.includes(c.stack)) {
    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
# Stack ${c.stack} — file size check not applicable
exit 0
`;
  }

  // Backend stacks skip fewer file types (routes ARE worth checking for size)
  const isBackend = c.stack === 'nodejs' || c.stack === 'python' || c.isBackend;
  const skipNamePattern = isBackend
    ? '^(config|index|app|server|main)'
    : '^(theme|config|routes|route|di|injection|module|index|barrel|main|app)';

  // Build generated file skip lines
  const genSkips = (p.generatedPatterns || '').split(/\s+/).filter(Boolean)
    .map(pat => `echo "$BN" | grep -qF '${pat.replace(/\*/g, '')}' && exit 0`)
    .join('\n');

  return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0

# Only check files with the project's source extension
[[ "$FILE_PATH" != *"${p.fileExt}" ]] && exit 0

# Skip test files
BN=$(basename "$FILE_PATH")
echo "$BN" | grep -qE '\\.test\\.|\\. spec\\.|_test\\.|\\. stories\\.' && exit 0

# Skip generated files
${genSkips}

# Skip config/entry files
echo "$BN" | grep -qiE '${skipNamePattern}' && exit 0

# Skip type definition files (interfaces, models, types)
echo "$BN" | grep -qiE '(\\.type\\.|\\. types\\.|\\. model\\.|\\. models\\.|\\. interface\\.|\\. dto\\.)' && exit 0

# Count lines
[[ ! -f "$FILE_PATH" ]] && exit 0
LINES=$(wc -l < "$FILE_PATH" | tr -d ' ')
if [[ "$LINES" -gt 300 ]]; then
  echo "BLOCKED: '$BN' has $LINES lines (HARD LIMIT: 200). This file is far too large." >&2
  echo "You MUST split this file into smaller components NOW before continuing." >&2
  echo "See .claude/steering/coding-standards.md 'File Size' section for how to decompose." >&2
  exit 2
elif [[ "$LINES" -gt 200 ]]; then
  echo "{\\"additionalContext\\":\\"⚠️ FILE SIZE VIOLATION: '$BN' has $LINES lines (max 200). You MUST refactor this file into smaller components BEFORE moving to the next task. Do not ignore this — split the file now. See coding-standards.md File Size section.\\"}"
fi
exit 0
`;
}
