import type { GovernanceConfig } from '../../types.js';

export function generateBlockDangerous(c: GovernanceConfig): string {
    const pkgBlock = c.profile.pkgAddBlockPattern
        ? `echo "$CMD" | grep -qE "${c.profile.pkgAddBlockPattern}" && echo "BLOCKED: package installs require developer approval." >&2 && exit 2`
        : '';

    const rmBlocks = c.profile.rmBlockDirs.split(/\s+/).filter(Boolean)
        .map(d => {
            const escaped = d.replace(/[[\].*^$()+?{}|]/g, '\\$&');
            return `echo "$CMD" | grep -qE "rm\\s+-rf\\s+${escaped}" && echo "BLOCKED: removing project dirs not allowed." >&2 && exit 2`;
        }).join('\n');

    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
command -v jq &>/dev/null || exit 0
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
[[ -z "$CMD" ]] && exit 0
echo "$CMD" | grep -qE "git\\s+push\\s+.*--force|git\\s+push\\s+-f" && echo "BLOCKED: force push not allowed." >&2 && exit 2
echo "$CMD" | grep -qE "git\\s+reset\\s+--hard|git\\s+clean\\s+-fd" && echo "BLOCKED: destructive git op." >&2 && exit 2
${pkgBlock}
${rmBlocks}
exit 0
`;
}
