import type { GovernanceConfig } from '../../../types.js';

export function generateLintCheck(config: GovernanceConfig): string {
    const analyzeCmd = config.profile.analyzeCmd || 'echo "No lint command configured"';
    return `#!/usr/bin/env bash
# lint-check.sh — disabled by default, enable in config.json
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"
command -v jq &>/dev/null || exit 0

enabled=$(jq -r '.["pre-commit"]["lint-check"]["enabled"] // false' "$CONFIG" 2>/dev/null)
[[ "$enabled" != "true" ]] && exit 0

# Run lint check
if ! ${analyzeCmd} 2>&1; then
    echo "  ⚠️  LINT: lint check failed — run '${analyzeCmd}' to fix"
fi

exit 0
`;
}
