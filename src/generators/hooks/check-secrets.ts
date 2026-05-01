import type { GovernanceConfig } from '../../types.js';
import { JSON_HELPER, JSON_GUARD } from './shared.js';

export function generateCheckSecrets(c: GovernanceConfig): string {
    return `#!/usr/bin/env bash
# HOOK_VERSION=${c.hookVersion}
# Blocks writes that embed credentials, tokens, or cloud keys in source code.
# Fires on Edit (new_string), Write (content), and Bash (command containing sensitive strings).
${JSON_GUARD}
${JSON_HELPER}
TOOL=$(_json '.tool_name')

# Extract the text being written depending on tool
case "$TOOL" in
  Edit)  CONTENT=$(_json '.tool_input.new_string') ;;
  Write) CONTENT=$(_json '.tool_input.content') ;;
  Bash)  CONTENT=$(_json '.tool_input.command') ;;
  *)     exit 0 ;;
esac
[[ -z "$CONTENT" ]] && exit 0

# AWS Access Key ID — always 20 chars, starts with AKIA
if echo "$CONTENT" | grep -qE 'AKIA[0-9A-Z]{16}'; then
  echo "BLOCKED: AWS Access Key ID detected (AKIA...). Never embed credentials in source." >&2
  echo "Use environment variables, AWS Secrets Manager, or .env (git-ignored)." >&2
  exit 2
fi

# High-entropy secret values assigned to credential-named keys
if echo "$CONTENT" | grep -qiE '(secret_?key|access_?key|api_?key|api_?token|auth_?token|password|passwd|private_?key)[[:space:]]*[=:][[:space:]]*["'"'"']?[A-Za-z0-9/+_-]{20,}'; then
  echo "BLOCKED: Credential pattern detected (secret/key/token assigned a value)." >&2
  echo "Use environment variables or a secrets manager — never hardcode credentials." >&2
  exit 2
fi

# Common secret manager / vault bypass: base64-encoded keys > 30 chars in value position
if echo "$CONTENT" | grep -qE '"value"[[:space:]]*:[[:space:]]*"[A-Za-z0-9/+=]{30,}"' ; then
  # Only block if a nearby key looks credential-related (avoid false positives on image data etc.)
  if echo "$CONTENT" | grep -qiE '"variable"[[:space:]]*:[[:space:]]*"[^"]*(_KEY|_SECRET|_TOKEN|_PASSWORD)[^"]*"'; then
    echo "BLOCKED: Credential value detected inside a config object." >&2
    echo "Store secrets in environment variables or AWS Secrets Manager, not in source." >&2
    exit 2
  fi
fi

exit 0
`;
}
