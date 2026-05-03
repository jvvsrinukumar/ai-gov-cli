import type { GovernanceConfig } from '../../../types.js';
import { JSON_HELPER, JSON_GUARD } from './shared.js';

export function generateFormatCode(c: GovernanceConfig): string {
    const p = c.profile;
    const s = c.scan;

    // Determine format command
    // p.formatCmd is set by the scanner only when the formatter is usable (has config or needs none)
    let fmtCmd = '';
    if (s.detectedFormatter) {
        fmtCmd = p.formatCmd || '';  // Empty when formatter detected but config missing (e.g. prettier with no .prettierrc)
    } else {
        switch (c.stack) {
            case 'flutter': fmtCmd = s.detectedFVM ? 'fvm dart format' : 'dart format'; break;
            case 'kotlin': fmtCmd = p.formatCmd; break;
            case 'swiftui': fmtCmd = 'swiftformat'; break;
            case 'python': fmtCmd = 'ruff format'; break;
            case 'java': fmtCmd = p.formatCmd; break;
            default: fmtCmd = ''; break;
        }
    }

    // No formatter → no-op (or warn if tool detected but config missing)
    if (!fmtCmd) {
        if (c.scan.detectedFormatter && !c.scan.detectedHasFormatterConfig) {
            return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
${JSON_GUARD}
${JSON_HELPER}
FILE_PATH=$(_json '.tool_input.file_path')
[[ -z "$FILE_PATH" ]] && exit 0
echo "{\\"additionalContext\\":\\"WARNING: ${c.scan.detectedFormatter} is in dependencies but has no config file. Auto-formatting is disabled. Create a config (e.g. .prettierrc) to enable it.\\"}"
exit 0
`;
        }
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
${JSON_GUARD}
${JSON_HELPER}
FILE_PATH=$(_json '.tool_input.file_path')
[[ -z "$FILE_PATH" ]] && exit 0
(${extCheck}) || exit 0
${findToolHelper}
${fmtCmd} "$FILE_PATH" 2>/dev/null
exit 0
`;
}
