export function generateFileSizeCheck(): string {
    return `#!/usr/bin/env bash
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"
command -v jq &>/dev/null || exit 0

MAX=$(jq -r '.["pre-commit"]["file-size"]["max-lines"] // 300' "$CONFIG" 2>/dev/null)
FRONTEND_ONLY=$(jq -r '.["pre-commit"]["file-size"]["frontend-only"] // true' "$CONFIG" 2>/dev/null)

# Read frontend extensions from config
EXTS=$(jq -r '.["pre-commit"]["file-size"]["frontend-extensions"] // [".dart",".tsx",".jsx",".ts",".kt"] | join(" ")' "$CONFIG" 2>/dev/null)

# Read exclude patterns
EXCLUDES=$(jq -r '.["pre-commit"]["file-size"]["exclude-patterns"] // [] | join("|")' "$CONFIG" 2>/dev/null)

FOUND=0
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    [[ ! -f "$file" ]] && continue

    # Check extension
    matched=false
    if [[ "$FRONTEND_ONLY" == "true" ]]; then
        for ext in $EXTS; do
            [[ "$file" == *"$ext" ]] && { matched=true; break; }
        done
        [[ "$matched" == false ]] && continue
    fi

    # Check excludes
    bn=$(basename "$file")
    [[ -n "$EXCLUDES" ]] && echo "$bn" | grep -qE "$EXCLUDES" && continue

    # Skip test files
    echo "$bn" | grep -qE '\\.test\\.|\\spec\\.|_test\\.|\\stories\\.' && continue

    # Count lines of staged version
    lines=$(git show ":0:$file" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$lines" -gt "$MAX" ]]; then
        echo "  ❌ FILE SIZE: $file has $lines lines (max $MAX)"
        echo "     → Split into smaller components before committing"
        FOUND=$((FOUND + 1))
    fi
done

[[ $FOUND -gt 0 ]] && exit 1
exit 0
`;
}
