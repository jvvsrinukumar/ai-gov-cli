#!/usr/bin/env bash
PD="$(cd "$(dirname "$0")"/../../.. && pwd)"
cd "$PD" || exit 0
command -v "npx" &>/dev/null || exit 0
O=$(npx eslint src/ 2>&1); RC=$?
[[ $RC -ne 0 ]] && echo "Analyze failed: $O"
exit 0
