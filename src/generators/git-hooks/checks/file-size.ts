export function generateFileSizeCheck(): string {
    return `#!/usr/bin/env bash
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"

# Defaults (used when config cannot be read)
MAX=300
FRONTEND_ONLY=true
EXTS=".dart .tsx .jsx .ts .js .kt .py .java"
EXCLUDES=""

# Override from config.json if python3 or jq is available
if command -v python3 &>/dev/null && [[ -f "$CONFIG" ]]; then
    _read_cfg=$(python3 -c "
import json,sys
try:
    c=json.load(open(sys.argv[1]))
    ps=c.get('pre-commit',{}).get('file-size',{})
    print(ps.get('max-lines',300))
    print(str(ps.get('frontend-only',True)).lower())
    print(' '.join(ps.get('frontend-extensions',['.dart','.tsx','.jsx','.ts','.js','.kt','.py','.java'])))
    print('|'.join(ps.get('exclude-patterns',[])))
except:
    print('300\\ntrue\\n.dart .tsx .jsx .ts .js .kt .py .java\\n')
" "$CONFIG" 2>/dev/null)
    MAX=$(echo "$_read_cfg" | sed -n '1p')
    FRONTEND_ONLY=$(echo "$_read_cfg" | sed -n '2p')
    EXTS=$(echo "$_read_cfg" | sed -n '3p')
    EXCLUDES=$(echo "$_read_cfg" | sed -n '4p')
elif command -v jq &>/dev/null && [[ -f "$CONFIG" ]]; then
    MAX=$(jq -r '.["pre-commit"]["file-size"]["max-lines"] // 300' "$CONFIG" 2>/dev/null)
    FRONTEND_ONLY=$(jq -r '.["pre-commit"]["file-size"]["frontend-only"] // true' "$CONFIG" 2>/dev/null)
    EXTS=$(jq -r '.["pre-commit"]["file-size"]["frontend-extensions"] // [".dart",".tsx",".jsx",".ts",".js",".kt"] | join(" ")' "$CONFIG" 2>/dev/null)
    EXCLUDES=$(jq -r '.["pre-commit"]["file-size"]["exclude-patterns"] // [] | join("|")' "$CONFIG" 2>/dev/null)
fi

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
