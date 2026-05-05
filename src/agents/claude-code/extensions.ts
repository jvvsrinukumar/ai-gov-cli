import { join } from 'path';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';

export function generateExtensions(c: GovernanceConfig, opts: WriteOptions): void {
    const dir = c.projectDir;
    const extDir = join(dir, '.claude', 'extensions');

    safeWrite(join(extDir, 'manifest.json'), JSON.stringify({
        version: 1,
        extensions: [
            { name: 'jira-sync', trigger: 'Stop', matcher: '', enabled: true },
            { name: 'retrospective', trigger: 'Stop', matcher: '', enabled: false },
            { name: 'verify', trigger: 'PostToolUse', matcher: 'Edit|Write', enabled: true },
        ],
    }, null, 2) + '\n', opts);

    // v14.1: reads $1 argument, uses bash for sub-extensions, -f instead of -x
    safeWrite(join(extDir, 'load-extensions.sh'), `#!/usr/bin/env bash
command -v jq &>/dev/null || exit 0
DIR="$(cd "$(dirname "$0")" && pwd)"
INPUT=$(cat); EVENT="\${1:-\${CLAUDE_HOOK_EVENT:-unknown}}"
EXTS=$(jq -r --arg t "$EVENT" '.extensions[]|select(.enabled==true)|select(.trigger==$t)|.name' "$DIR/manifest.json" 2>/dev/null)
[[ -z "$EXTS" ]] && exit 0
OUT=""
for EX in $EXTS; do
  [[ -f "$DIR/$EX/run.sh" ]] && R=$(echo "$INPUT" | bash "$DIR/$EX/run.sh" 2>/dev/null) && OUT="$OUT[ext:$EX] $R "
done
[[ -n "$OUT" ]] && echo "{\\"additionalContext\\":\\"$(echo "$OUT" | sed 's/"/\\\\"/g')\\"}"
exit 0
`, opts);

    safeWrite(join(extDir, 'jira-sync', 'run.sh'),
        '#!/usr/bin/env bash\necho "Remember to update your Jira/ticket status."\n', opts);

    safeWrite(join(extDir, 'retrospective', 'run.sh'),
        '#!/usr/bin/env bash\necho "Session retro: what went well? what to improve?"\n', opts);

    // v14.1: verify guard — check if analyzer binary exists
    const analyzeCmd = c.profile.analyzeCmd;
    if (analyzeCmd) {
        const analyzeBin = analyzeCmd.split(' ')[0];
        safeWrite(join(extDir, 'verify', 'run.sh'), `#!/usr/bin/env bash
PD="$(cd "$(dirname "$0")"/../../.. && pwd)"
cd "$PD" || exit 0
command -v "${analyzeBin}" &>/dev/null || exit 0
O=$(${analyzeCmd} 2>&1); RC=$?
[[ $RC -ne 0 ]] && echo "Analyze failed: $O"
exit 0
`, opts);
    } else {
        safeWrite(join(extDir, 'verify', 'run.sh'),
            '#!/usr/bin/env bash\n# No analyzer configured — skipping\nexit 0\n', opts);
    }
}
