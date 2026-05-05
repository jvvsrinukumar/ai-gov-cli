import type { GovernanceConfig } from '../../../types.js';
import { JSON_HELPER, JSON_GUARD } from './shared.js';

export function generateProtectFiles(c: GovernanceConfig): string {
  const genChecks = (c.profile.generatedPatterns || '').split(' ').filter(Boolean)
    .map(p => `[[ "$FILE_PATH" == ${p} ]] && { echo "BLOCKED: '$FILE_PATH' is generated — edit source and regenerate." >&2; exit 2; }`)
    .join('\n');

  const hrEntries = c.scan.highRiskFiles.map(f => `"${f}"`).join(' ');

  return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
${JSON_GUARD}
${JSON_HELPER}
FILE_PATH=$(_json '.tool_input.file_path')
[[ -z "$FILE_PATH" ]] && exit 0
${genChecks}
HR=(${hrEntries})
FNAME=$(basename "$FILE_PATH")
for f in "\${HR[@]}"; do
  if [[ "$FNAME" == "$f" || "$FILE_PATH" == */"$f" ]]; then
    echo "{\\"additionalContext\\":\\"WARNING: '$f' is high-risk. Confirm this change is in scope.\\"}" && exit 0
  fi
done
exit 0
`;
}
