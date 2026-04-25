#!/usr/bin/env bash
# HOOK_VERSION=15.2.0
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name // empty')
validate_spec() {
  local DIR="$1" W=""
  [[ ! -f "$DIR/requirements.md" ]] && W="$W\n- requirements.md missing"
  grep -q "_replace_" "$DIR/requirements.md" 2>/dev/null && W="$W\n- unfilled placeholders in requirements.md"
  grep -q "As a \[role\]" "$DIR/requirements.md" 2>/dev/null && W="$W\n- user story not written (still template text)"
  [[ ! -f "$DIR/design.md" ]] && W="$W\n- design.md missing"
  grep -q "_replace_\|_describe_\|_e\.g\." "$DIR/design.md" 2>/dev/null && W="$W\n- unfilled placeholders in design.md"
  [[ ! -f "$DIR/tasks.md" ]] && W="$W\n- tasks.md missing"
  echo "$W"
}
check_spec_freshness() {
  local SPEC_DIR="$1" FEAT_DIR="$2" W=""
  [[ ! -d "$SPEC_DIR" || ! -d "$FEAT_DIR" ]] && return
  local newest_spec=0 newest_code=0
  for sf in "$SPEC_DIR"/*.md; do
    [[ -f "$sf" ]] || continue
    local mt; mt=$(stat -c %Y "$sf" 2>/dev/null || stat -f %m "$sf" 2>/dev/null) || continue
    [[ "$mt" -gt "$newest_spec" ]] && newest_spec="$mt"
  done
  for cf in $(find "$FEAT_DIR" -maxdepth 3 -name "*.ts" -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null); do
    local mt; mt=$(stat -c %Y "$cf" 2>/dev/null || stat -f %m "$cf" 2>/dev/null) || continue
    [[ "$mt" -gt "$newest_code" ]] && newest_code="$mt"
  done
  local drift=$((newest_code - newest_spec))
  [[ "$drift" -gt 86400 ]] && W="Spec may be stale — code modified $((drift / 3600))h after last spec update."
  if [[ -f "$SPEC_DIR/tasks.md" && -f "$SPEC_DIR/design.md" ]]; then
    local code_files; code_files=$(find "$FEAT_DIR" -maxdepth 3 -name "*.ts" -not -name "*.test.*" -not -name "*.spec.*" 2>/dev/null | wc -l | tr -d ' ')
    local design_files; design_files=$(grep -cE "^\|.*\|.*\|.*\|" "$SPEC_DIR/design.md" 2>/dev/null || echo 0)
    design_files=$((design_files > 2 ? design_files - 2 : 0))
    [[ "$code_files" -gt 0 && "$design_files" -gt 0 && "$code_files" -gt "$((design_files + 3))" ]] && \
      W="${W:+$W }design.md lists ~$design_files files but feature has $code_files — spec may need updating."
  fi
  [[ -n "$W" ]] && echo "{\"additionalContext\":\"SPEC FRESHNESS: $W\"}"
}
if [[ "$TOOL" == "Bash" ]]; then
  CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
  [[ -z "$CMD" ]] && exit 0
  FN=""

  if [[ -z "$FN" ]]; then
    FN=$(echo "$CMD" | sed -n 's|.*mkdir[[:space:]].*src/\([a-z_][a-z_-]*\).*|\1|p' | head -1)
    [[ -z "$FN" ]] && FN=$(echo "$CMD" | sed -n 's|.*touch[[:space:]].*src/\([a-z_][a-z_-]*\).*|\1|p' | head -1)
  fi
  if [[ -n "$FN" ]]; then
    SPEC="${CLAUDE_PROJECT_DIR:-.}/specs/$FN"
    if [[ ! -d "$SPEC" ]]; then
      echo "BLOCKED: No spec at specs/$FN/. Run: cp -r specs/_template specs/$FN" >&2
      exit 2
    fi
    W=$(validate_spec "$SPEC")
    if [[ -n "$W" ]]; then
      echo "BLOCKED: Spec at specs/$FN/ is incomplete:$W" >&2
      exit 2
    fi
  fi
fi
if [[ "$TOOL" == "Write" || "$TOOL" == "Edit" ]]; then
  FP=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
  [[ -z "$FP" ]] && exit 0
  [[ "$FP" != *".ts" ]] && exit 0
  BN=$(basename "$FP")
  echo "$BN" | grep -qE '\.test\.|\. spec\.|_test\.' && exit 0
  echo "$BN" | grep -qF '.generated.ts' && exit 0
  echo "$BN" | grep -qF '.generated.js' && exit 0
  PD="${CLAUDE_PROJECT_DIR:-.}"
  FN=""
  if [[ "$FP" == *"/src/"* ]]; then
    FN="${FP#*src/}"; FN="${FN%%/*}"
    [[ "$FN" == "("*")" ]] && FN=""
  fi
  if [[ -z "$FN" && "$FP" == *"/src/"* ]]; then
    _REL="${FP#*src/}"
    _FIRST_DIR="${_REL%%/*}"
    echo "$_FIRST_DIR" | grep -qiE '^(core|common|shared|config|util|utils|helpers|di|injection|navigation|theme|network|base|middleware|interceptor|guard|pipe|filter|constants|types|models|schemas|dto|db|workers|integrations)$' || FN="$_FIRST_DIR"
  fi
  if [[ -n "$FN" ]]; then
    SPEC="$PD/specs/$FN"
    if [[ ! -d "$SPEC" ]]; then
      echo "BLOCKED: No spec at specs/$FN/. Before writing any feature code:" >&2
      echo "  1. Run: cp -r specs/_template specs/$FN" >&2
      echo "  2. Fill specs/$FN/requirements.md (replace ALL placeholders)" >&2
      echo "  3. Fill specs/$FN/design.md (layer mapping, file list)" >&2
      echo "  4. Fill specs/$FN/tasks.md (phased task breakdown)" >&2
      echo "  5. Present the plan and WAIT for user confirmation" >&2
      exit 2
    fi
    W=$(validate_spec "$SPEC")
    if [[ -n "$W" ]]; then
      echo "BLOCKED: Spec at specs/$FN/ is incomplete:$W" >&2
      echo "Fix the spec FIRST, then resume coding." >&2
      exit 2
    fi
    if [[ ! -f "$SPEC/tasks.md" ]] || ! grep -qE '^\s*- \[' "$SPEC/tasks.md" 2>/dev/null; then
      echo "BLOCKED: specs/$FN/tasks.md is missing or has no task items." >&2
      exit 2
    fi
    if [[ "$FP" == *"/src/"* ]]; then
      FD="${FP%%/src/*}/src/${FN}"
    else
      FD="${FP%%/src/*}/src/${FN}"
    fi
    [[ -d "$FD" ]] && check_spec_freshness "$SPEC" "$FD"
  fi
fi
exit 0
