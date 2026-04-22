import type { GovernanceConfig } from '../../types.js';

export function generateAnalyzeCode(c: GovernanceConfig): string {
    const p = c.profile;

    // No analyzer → no-op
    if (!p.analyzeCmd) {
        return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
exit 0
`;
    }

    // Build extension check
    const extCheck = (p.formatExtensions || '').split(/\s+/).filter(Boolean)
        .map(ext => `[[ "$FILE_PATH" == *${ext} ]]`)
        .join(' || ') || 'false';

    const analyzeTool = p.analyzeCmdFile || p.analyzeCmd;
    const analyzeBase = analyzeTool.split(' ')[0];
    const needsFindTool = c.stack === 'python';

    const findToolHelper = needsFindTool
        ? `_find_tool() { local t="$1"; [[ -n "\${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/bin/$t" ]] && echo "$VIRTUAL_ENV/bin/$t" && return; [[ -n "\${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/Scripts/$t.exe" ]] && echo "$VIRTUAL_ENV/Scripts/$t.exe" && return; command -v "$t" 2>/dev/null; }
TOOL=$(_find_tool "${analyzeBase}")
[[ -z "$TOOL" ]] && exit 0`
        : '';

    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
[[ -z "$FILE_PATH" ]] && exit 0
(${extCheck}) || exit 0
${findToolHelper}
RESULT=$(${analyzeTool} "$FILE_PATH" 2>&1); CODE=$?
[[ $CODE -ne 0 ]] && echo "{\\"additionalContext\\":\\"Analyzer issues in $FILE_PATH:\\n$RESULT\\"}"
exit 0
`;
}
