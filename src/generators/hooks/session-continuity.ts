import type { GovernanceConfig } from '../../types.js';

export function generateSessionContinuity(c: GovernanceConfig): string {
    const featuresDir = c.profile.featuresDir;

    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FP=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FP" || "$(basename "$FP")" == "README.md" ]] && exit 0
PD="\${CLAUDE_PROJECT_DIR:-.}"
if [[ "$FP" == *"/${featuresDir}"* ]]; then
  FN="\${FP#*${featuresDir}}"; FN="\${FN%%/*}"
  [[ "$FN" == "("*")" ]] && exit 0
  TF="$PD/specs/$FN/tasks.md"
  [[ ! -f "$TF" ]] && exit 0
  U=$(grep -c '^\\- \\[ \\]' "$TF" 2>/dev/null || echo 0)
  C=$(grep -c '^\\- \\[x\\]' "$TF" 2>/dev/null || echo 0)
  [[ "$C" -gt 0 && "$U" -gt 0 ]] && NEXT=$(grep -m1 '^\\- \\[ \\]' "$TF" | sed 's/^- \\[ \\] //') && \\
    echo "{\\"additionalContext\\":\\"SESSION: feature '$FN' has $C done / $U remaining. Next: $NEXT\\"}"
fi
exit 0
`;
}
