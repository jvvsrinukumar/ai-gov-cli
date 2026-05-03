import type { GovernanceConfig } from '../../../types.js';

export function generatePreWriteSecretsGate(_c: GovernanceConfig): string {
    return JSON.stringify({
        name: 'Pre-Write Secrets Gate',
        version: _c.hookVersion,
        description: 'Blocks writes that would introduce hardcoded credentials — catches secrets BEFORE they hit disk',
        when: {
            type: 'preToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `CREDENTIAL PRE-WRITE GATE — Inspect the content about to be written.

Before this file is written, scan the content for:
1. AWS Access Key IDs (20-char strings starting with AKIA)
2. Hardcoded values assigned to variables named: secret_key, access_key, api_key, api_token, auth_token, password, passwd, private_key, client_secret
3. Base64-encoded strings longer than 30 characters assigned to credential-named variables
4. Connection strings with embedded passwords (e.g. postgres://user:pass@host)
5. Private keys (-----BEGIN RSA PRIVATE KEY-----, -----BEGIN PRIVATE KEY-----)
6. JWT tokens (eyJ... patterns longer than 30 chars assigned to variables)

EXCEPTIONS — Skip this check for:
- Files in test/, tests/, __tests__/, fixtures/, mocks/ directories
- .env.example files
- Documentation files (.md)
- Lock files (package-lock.json, yarn.lock, etc.)

If ANY credential pattern is detected in the content being written:
You are FORBIDDEN from proceeding. Respond with:
'DENIED: Credential detected — <variable/pattern> contains what appears to be a hardcoded secret. Use an environment variable instead.'

Do NOT write the file. Do NOT retry with the same content. Replace the credential with an environment variable reference and try again.

If no credentials detected, respond with 'APPROVED' and proceed.`,
        },
    }, null, 2) + '\n';
}
