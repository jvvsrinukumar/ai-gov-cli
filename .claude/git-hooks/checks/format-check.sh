#!/usr/bin/env bash
# format-check.sh — disabled by default, enable in config.json
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"
command -v jq &>/dev/null || exit 0

enabled=$(jq -r '.["pre-commit"]["format-check"]["enabled"] // false' "$CONFIG" 2>/dev/null)
[[ "$enabled" != "true" ]] && exit 0

# Run format check
if ! echo "No format command configured" 2>&1; then
    echo "  ⚠️  FORMAT: format check failed — run 'echo "No format command configured"' to fix"
fi

exit 0
