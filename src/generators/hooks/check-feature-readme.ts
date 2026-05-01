import type { GovernanceConfig } from '../../types.js';
import { JSON_HELPER, JSON_GUARD } from './shared.js';

export function generateCheckFeatureReadme(c: GovernanceConfig): string {
    const p = c.profile;
    const s = c.scan;
    const featuresDir = p.featuresDir;
    const sourceDir = p.sourceDir;

    // Build skip dirs list
    let skipDirs = 'config|util|utils|helpers|lib|core|common|shared|uploads|upload|logs|templates|logging|auth';

    if (s.detectedArchPattern === 'routes-models' || s.detectedArchPattern === 'routes-only') {
        skipDirs += '|routes|models|middleware';
    }

    if (['layered', 'nestjs-standard', 'nestjs-usecase'].includes(s.detectedArchPattern)) {
        skipDirs += '|controller|controllers|service|services|repo|repository|middleware';
    }

    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
${JSON_GUARD}
${JSON_HELPER}
FP=$(_json '.tool_input.file_path')
[[ -z "$FP" || "$(basename "$FP")" == "README.md" ]] && exit 0
FN=""
FD=""
# Try FEATURES_DIR first
if [[ "$FP" == *"/${featuresDir}"* ]]; then
  FN="\${FP#*${featuresDir}}"; FN="\${FN%%/*}"
  FD="\${FP%%/${featuresDir}*}/${featuresDir}\${FN}"
fi
# Fallback: try SOURCE_DIR
if [[ -z "$FN" && "$FP" == *"/${sourceDir}"* ]]; then
  _REL="\${FP#*${sourceDir}}"; _FIRST="\${_REL%%/*}"
  echo "$_FIRST" | grep -qiE '^(core|common|shared|config|util|utils|helpers|di|injection|navigation|theme|network|base|middleware|constants|types|models|schemas|dto|db|workers|integrations)$' && exit 0
  FN="$_FIRST"
  FD="\${FP%%/${sourceDir}*}/${sourceDir}\${FN}"
fi
# Skip route groups
[[ -z "$FN" || "$FN" == "("*")" ]] && exit 0
# Skip common non-feature directories
echo "$FN" | grep -qE "^(${skipDirs})$" && exit 0
RM="$FD/README.md"
BN=$(basename "$FP")
[[ ! -f "$RM" ]] && echo "{\\"additionalContext\\":\\"REMINDER: '$FN' missing README.md\\"}" && exit 0
grep -q "$BN" "$RM" || echo "{\\"additionalContext\\":\\"REMINDER: '$BN' not listed in $FN/README.md\\"}"
exit 0
`;
}
