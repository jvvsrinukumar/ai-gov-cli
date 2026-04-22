import type { GovernanceConfig } from '../../types.js';

export function generateFormatCode(c: GovernanceConfig): string {
    const p = c.profile;
    const s = c.scan;

    // Determine format command
    let fmtCmd = '';
    if (s.detectedFormatter) {
        switch (s.detectedFormatter) {
            case 'prettier': fmtCmd = 'npx prettier --write'; break;
            case 'biome': fmtCmd = 'npx biome format --write'; break;
            case 'ruff': fmtCmd = 'ruff format'; break;
            case 'black': fmtCmd = 'black'; break;
            default: fmtCmd = 'npx prettier --write'; break;
        }
    } else {
        switch (c.stack) {
            case 'flutter': fmtCmd = s.detectedFVM ? 'fvm dart format' : 'dart format'; break;
            case 'kotlin': fmtCmd = p.formatCmd; break;
            case 'swiftui': fmtCmd = 'swiftformat'; break;
            case 'python': fmtCmd = 'ruff format'; break;
            default: fmtCmd = ''; break;
        }
    }

    // No formatter → no-op
    if (!fmtCmd) {
        return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
# No formatter configured — skipping
exit 0
`;
    }

    // Build extension check
    const extCheck = (p.formatExtensions || '').split(/\s+/).filter(Boolean)
        .map(ext => `[[ "$FILE_PATH" == *${ext} ]]`)
        .join(' || ') || 'false';

    const fmtBase = fmtCmd.split(' ')[0];
    const needsFindTool = c.stack === 'python';

    const findToolHelper = needsFindTool
        ? `_find_tool() { local t="$1"; [[ -n "\${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/bin/$t" ]] && echo "$VIRTUAL_ENV/bin/$t" && return; [[ -n "\${VIRTUAL_ENV:-}" && -x "$VIRTUAL_ENV/Scripts/$t.exe" ]] && echo "$VIRTUAL_ENV/Scripts/$t.exe" && return; command -v "$t" 2>/dev/null; }
TOOL=$(_find_tool "${fmtBase}")
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
${fmtCmd} "$FILE_PATH" 2>/dev/null
exit 0
`;
}
