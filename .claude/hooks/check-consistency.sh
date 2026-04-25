#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FP=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FP" ]] && exit 0
FN=""; PR=""
# Try FEATURES_DIR first
if [[ "$FP" == *"/src/"* ]]; then
  FN="${FP#*src/}"; FN="${FN%%/*}"
  PR="${FP%%/src/*}"
fi
# Fallback: try SOURCE_DIR
if [[ -z "$FN" && "$FP" == *"/src/"* ]]; then
  _REL="${FP#*src/}"; _FIRST="${_REL%%/*}"
  echo "$_FIRST" | grep -qiE '^(core|common|shared|config|util|utils|helpers|di|injection|navigation|theme|network|base|middleware|constants|types|models|schemas|dto|db|workers|integrations)$' && exit 0
  FN="$_FIRST"
  PR="${FP%%/src/*}"
fi
[[ -z "$FN" ]] && exit 0
[[ "$FN" == "("*")" ]] && exit 0
# Try to find the feature directory under either path
FD=""
[[ -d "$PR/src/${FN}" ]] && FD="$PR/src/${FN}"
[[ -z "$FD" && -d "$PR/src/${FN}" ]] && FD="$PR/src/${FN}"
SPEC="$PR/specs/$FN"
W=""; DS=0

[[ -n "$FD" && -f "$FD/README.md" ]] && ! grep -q "$(basename "$FP")" "$FD/README.md" && \
  W="$W[README] $(basename "$FP") not in Files table. " && DS=$((DS+1))

[[ -f "$SPEC/tasks.md" && -n "$FD" && -f "$FD/README.md" ]] && \
  T=$(grep -cE '^\s*- \[' "$SPEC/tasks.md" 2>/dev/null||echo 0) && \
  D=$(grep -cE '^\s*- \[x\]' "$SPEC/tasks.md" 2>/dev/null||echo 0) && \
  [[ "$T" -gt 0 && "$T" -eq "$D" ]] && grep -qi 'In Progress' "$FD/README.md" && \
  W="$W[Stale README] All tasks done but README says In Progress. " && DS=$((DS+1))

[[ -n "$W" ]] && echo "{\"additionalContext\":\"CONSISTENCY [drift=$DS]: $W\"}"
exit 0
