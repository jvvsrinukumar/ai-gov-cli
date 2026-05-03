import type { GovernanceConfig } from '../../../types.js';

export function generateCheckSecrets(c: GovernanceConfig): string {
    const fileExt = c.profile.fileExt;
    // Build file patterns from the stack's source extension
    const patterns = [`*${fileExt}`];
    // Add common secondary extensions for JS/TS stacks
    if (fileExt === '.ts' || fileExt === '.js') {
        patterns.push('*.tsx', '*.jsx', '*.ts', '*.js');
    }
    // Deduplicate
    const uniquePatterns = [...new Set(patterns)];

    return JSON.stringify({
        name: 'Secrets Scan',
        version: c.hookVersion,
        description: 'Scans edited files for hardcoded credentials and API keys',
        when: {
            type: 'fileEdited',
            patterns: uniquePatterns,
        },
        then: {
            type: 'askAgent',
            prompt: `CREDENTIAL SCAN — A source file was just modified. Scan it for:

1. AWS Access Key IDs (AKIA pattern — always 20 chars starting with AKIA)
2. Hardcoded values assigned to variables named: secret_key, access_key, api_key, api_token, auth_token, password, passwd, private_key
3. Base64-encoded strings longer than 30 characters assigned to credential-named variables
4. Connection strings with embedded passwords

Skip this check for:
- Files in test/tests/__tests__/fixtures/mocks directories
- Markdown files (.md)
- Example files (.env.example)

If ANY credential is found:
1. Immediately replace it with an environment variable reference
2. Add a comment explaining the replacement
3. Report what was found and fixed

If no credentials found, proceed silently.`,
        },
    }, null, 2) + '\n';
}
