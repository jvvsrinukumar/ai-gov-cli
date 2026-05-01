/**
 * Shared bash snippet embedded in every Claude Code hook script.
 * Reads stdin into $INPUT and defines _json() for field extraction.
 * Uses jq if installed, falls back to python3 (available on all platforms).
 */
export const JSON_HELPER = `INPUT=$(cat)
# JSON field extractor — uses jq if available, falls back to python3
_json() {
    local key="$1"
    if command -v jq &>/dev/null; then
        printf '%s' "$INPUT" | jq -r "\${key} // empty" 2>/dev/null || true
    elif command -v python3 &>/dev/null; then
        printf '%s' "$INPUT" | python3 -c "
import sys,json
key=sys.argv[1].lstrip('.')
try:
    d=json.load(sys.stdin)
    for p in key.split('.'):
        d=d.get(p) if isinstance(d,dict) else ''
    print(d or '')
except: print('')
" "$key" 2>/dev/null || true
    else
        echo "  ⚠️  ai-gov hook skipped: install jq or python3 to enable governance checks" >&2
    fi
}`;

/**
 * Guard that exits 0 (with a visible warning) when neither jq nor python3 is available.
 * Use at the top of non-blocking hooks.
 */
export const JSON_GUARD = `command -v jq &>/dev/null || command -v python3 &>/dev/null || { echo "  ⚠️  ai-gov hook skipped: install jq or python3" >&2; exit 0; }`;
