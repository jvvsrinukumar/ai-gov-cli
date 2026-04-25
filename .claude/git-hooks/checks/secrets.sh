#!/usr/bin/env bash
CONFIG_DIR="$1"
CONFIG="$CONFIG_DIR/config.json"
command -v jq &>/dev/null || exit 0

# Read skip dirs and extensions from config
SKIP_DIRS=$(jq -r '.["pre-commit"].secrets["skip-dirs"] // ["test","tests","__tests__","spec","fixtures","mocks","__mocks__","factories","seeds"] | join("|")' "$CONFIG" 2>/dev/null)
SKIP_EXTS=$(jq -r '.["pre-commit"].secrets["skip-extensions"] // [".md",".txt",".env.example",".env.template"] | join("|")' "$CONFIG" 2>/dev/null)

FOUND=0

while IFS= read -r file; do
    [[ -z "$file" ]] && continue

    # Skip by directory
    [[ -n "$SKIP_DIRS" ]] && echo "$file" | grep -qE "($SKIP_DIRS)/" && continue

    # Skip by extension
    for ext in $SKIP_EXTS; do
        [[ "$file" == *"$ext" ]] && continue 2
    done

    # Get added lines for this file directly (avoids sed delimiter issues with paths containing /)
    ADDED=$(git diff --cached -U0 --diff-filter=ACMR -- "$file" 2>/dev/null | grep '^+' | grep -v '^+++' || true)
    [[ -z "$ADDED" ]] && continue

    # Check: AWS AKIA key
    if echo "$ADDED" | grep -qE 'AKIA[0-9A-Z]{16}'; then
        # Allow nosecret comment
        if ! echo "$ADDED" | grep -E 'AKIA[0-9A-Z]{16}' | grep -qi 'nosecret\|no.secret\|ai-gov:ignore'; then
            echo "  ❌ SECRETS: $file — AWS Access Key ID detected (AKIA pattern)"
            echo "     → Use environment variables or AWS Secrets Manager"
            FOUND=$((FOUND + 1))
        fi
    fi

    # Check: credential-named variable with long value
    if echo "$ADDED" | grep -qiE '(secret_?key|access_?key|api_?key|api_?token|auth_?token|password|passwd|private_?key)[[:space:]]*[=:][[:space:]]*["'"'"'][A-Za-z0-9/+_\-]{20,}'; then
        if ! echo "$ADDED" | grep -iE '(secret_?key|api_?key|password)' | grep -qi 'nosecret\|no.secret\|ai-gov:ignore\|example\|placeholder\|changeme\|your.key\|xxxxx'; then
            echo "  ❌ SECRETS: $file — credential pattern detected"
            echo "     → Use environment variables or secrets manager"
            FOUND=$((FOUND + 1))
        fi
    fi

done

[[ $FOUND -gt 0 ]] && exit 1
exit 0
