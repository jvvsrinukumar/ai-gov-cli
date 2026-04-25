#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FP=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FP" || "$(basename "$FP")" == "README.md" ]] && exit 0
FN=""
FD=""
# Try FEATURES_DIR first
if [[ "$FP" == *"/src/"* ]]; then
  FN="${FP#*src/}"; FN="${FN%%/*}"
  FD="${FP%%/src/*}/src/${FN}"
fi
# Fallback: try SOURCE_DIR
if [[ -z "$FN" && "$FP" == *"/src/"* ]]; then
  _REL="${FP#*src/}"; _FIRST="${_REL%%/*}"
  echo "$_FIRST" | grep -qiE '^(core|common|shared|config|util|utils|helpers|di|injection|navigation|theme|network|base|middleware|constants|types|models|schemas|dto|db|workers|integrations)$' && exit 0
  FN="$_FIRST"
  FD="${FP%%/src/*}/src/${FN}"
fi
# Skip route groups
[[ -z "$FN" || "$FN" == "("*")" ]] && exit 0
# Skip common non-feature directories
echo "$FN" | grep -qE "^(config|util|utils|helpers|lib|core|common|shared|uploads|upload|logs|templates|logging|auth)$" && exit 0
RM="$FD/README.md"
BN=$(basename "$FP")
[[ ! -f "$RM" ]] && echo "{\"additionalContext\":\"REMINDER: '$FN' missing README.md\"}" && exit 0
grep -q "$BN" "$RM" || echo "{\"additionalContext\":\"REMINDER: '$BN' not listed in $FN/README.md\"}"
exit 0
