#!/usr/bin/env bash
CONFIG_DIR="$1"
FOUND=0
while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    echo "$file" | grep -qE '(test|spec|__tests__|logger|logging)' && continue
    ADDED=$(git diff --cached -U0 --diff-filter=ACMR -- "$file" 2>/dev/null | grep '^+' | grep -v '^+++' || true)
    [[ -z "$ADDED" ]] && continue
    if echo "$ADDED" | grep -qE 'console\.log\('; then
        echo "  ⚠️  DEBUG: $file — debug statement in staged changes"
        FOUND=$((FOUND + 1))
    fi
done
exit 0
