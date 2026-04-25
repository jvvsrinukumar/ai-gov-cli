#!/usr/bin/env bash
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"
command -v jq &>/dev/null || exit 0

ALLOW_TICKET=$(jq -r '.["pre-commit"]["no-todos"]["allow-with-ticket"] // true' "$CONFIG" 2>/dev/null)
TICKET_PAT=$(jq -r '.["pre-commit"]["no-todos"]["ticket-pattern"] // "[A-Z]+-[0-9]+"' "$CONFIG" 2>/dev/null)

FOUND=0

while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    # Skip test files
    echo "$file" | grep -qE '(test|spec|__tests__)/' && continue

    ADDED=$(git diff --cached -U0 --diff-filter=ACMR -- "$file" 2>/dev/null | grep '^+' | grep -v '^+++' || true)
    [[ -z "$ADDED" ]] && continue

    while IFS= read -r line; do
        if echo "$line" | grep -qiE '\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b'; then
            # Allow if ticket reference present
            if [[ "$ALLOW_TICKET" == "true" ]] && echo "$line" | grep -qE "$TICKET_PAT"; then
                continue
            fi
            echo "  ⚠️  TODO: $file — $(echo "$line" | sed 's/^+//' | xargs | head -c 80)"
            FOUND=$((FOUND + 1))
        fi
    done <<< "$ADDED"
done

exit 0
