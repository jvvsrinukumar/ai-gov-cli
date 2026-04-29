import type { GovernanceConfig } from '../../../types.js';

export function generateNoDebug(config: GovernanceConfig): string {
    let patterns = '';
    switch (config.stack) {
        case 'flutter':
            patterns = 'print\\(|debugPrint\\(|debugger;';
            break;
        case 'react':
            patterns = 'console\\.log\\(|console\\.debug\\(|console\\.warn\\(|\\bdebugger\\b';
            break;
        case 'angular':
            patterns = 'console\\.log\\(|console\\.debug\\(|\\bdebugger\\b';
            break;
        case 'kotlin':
            patterns = 'println\\(|Log\\.d\\(|Log\\.v\\(';
            break;
        case 'nodejs':
            patterns = 'console\\.log\\(';
            break;
        case 'python':
            patterns = '\\bprint\\(|breakpoint\\(|pdb\\.set_trace\\(';
            break;
        case 'java':
            patterns = 'System\\.out\\.print|System\\.err\\.print|\\.printStackTrace\\(';
            break;
        default:
            patterns = 'console\\.log\\(|\\bdebugger\\b';
    }

    return `#!/usr/bin/env bash
CONFIG_DIR="$1"
FOUND=0
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    echo "$file" | grep -qE '(test|spec|__tests__|logger|logging)' && continue
    ADDED=$(git diff --cached -U0 --diff-filter=ACMR -- "$file" 2>/dev/null | grep '^+' | grep -v '^+++' || true)
    [[ -z "$ADDED" ]] && continue
    if echo "$ADDED" | grep -qE '${patterns}'; then
        echo "  ⚠️  DEBUG: $file — debug statement in staged changes"
        FOUND=$((FOUND + 1))
    fi
done
exit 0
`;
}
