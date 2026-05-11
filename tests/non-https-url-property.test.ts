/**
 * Property-based tests for non-HTTPS URL handling
 * Property 18: Non-HTTPS hub URLs skip transmission
 *
 * **Validates: Requirements 13.7**
 *
 * For any hub URL in `.ai-gov/config.json` that does not use the `https://`
 * scheme (including `http://`, empty string, or other protocols), the pre-push
 * script SHALL skip the curl transmission entirely and log a warning to stderr.
 *
 * Feature: governance-dashboard, Property 18: Non-HTTPS hub URLs skip transmission
 */
import * as fc from 'fast-check';
import { generatePrePush } from '../src/generators/git-hooks/pre-push.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the HTTPS validation block from the generated script.
 * This is the section that checks whether HUB_URL starts with https://.
 */
function extractHttpsValidationBlock(script: string): string | null {
    // The HTTPS validation block checks if HUB_URL != https://*
    const pattern = /if \[\[ "\$HUB_URL" != https:\/\/\* \]\];[\s\S]*?fi/;
    const match = script.match(pattern);
    return match ? match[0] : null;
}

/**
 * Checks if the script contains a stderr warning for non-HTTPS URLs.
 * The warning should be output via >&2 (redirect to stderr).
 */
function hasStderrWarningForNonHttps(script: string): boolean {
    // Look for echo/printf to stderr in the non-HTTPS block
    const stderrPattern = /echo\s+.*>&2/;
    const httpsBlock = extractHttpsValidationBlock(script);
    if (!httpsBlock) return false;
    return stderrPattern.test(httpsBlock);
}

/**
 * Checks if the script skips curl transmission when URL is non-HTTPS.
 * The non-HTTPS path should exit 0 before reaching the curl command.
 */
function skipsTransmissionForNonHttps(script: string): boolean {
    const lines = script.split('\n');
    let inNonHttpsBlock = false;
    let curlLineIndex = -1;
    let nonHttpsExitLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Find the non-HTTPS check
        if (line.includes('$HUB_URL" != https://*')) {
            inNonHttpsBlock = true;
        }

        // In the non-HTTPS block, look for exit 0
        if (inNonHttpsBlock && line.trim().startsWith('exit 0')) {
            nonHttpsExitLineIndex = i;
            inNonHttpsBlock = false;
        }

        // Find the curl command (may be on a line by itself or with other content)
        if (line.includes('curl') && (line.includes('-X POST') || line.includes('POST'))) {
            curlLineIndex = i;
        }
    }

    // The non-HTTPS exit must come before the curl command
    if (nonHttpsExitLineIndex >= 0 && curlLineIndex >= 0) {
        return nonHttpsExitLineIndex < curlLineIndex;
    }

    return false;
}

/**
 * Checks that the HTTPS validation uses a glob pattern matching https://*
 * to properly validate the URL scheme.
 */
function hasProperHttpsGlobCheck(script: string): boolean {
    // The script should use bash glob pattern: [[ "$HUB_URL" != https://* ]]
    return /\[\[\s*"\$HUB_URL"\s*!=\s*https:\/\/\*\s*\]\]/.test(script);
}

/**
 * Checks that the empty URL case is handled separately (exits before HTTPS check).
 */
function hasEmptyUrlCheck(script: string): boolean {
    return /\[\[\s*-z\s*"\$HUB_URL"\s*\]\]/.test(script);
}

/**
 * Extracts the warning message text from the non-HTTPS block.
 */
function extractWarningMessage(script: string): string | null {
    const httpsBlock = extractHttpsValidationBlock(script);
    if (!httpsBlock) return null;
    const msgPattern = /echo\s+"([^"]*)".*>&2/;
    const match = httpsBlock.match(msgPattern);
    if (match) return match[1];
    // Try single-quoted variant
    const singleQuotePattern = /echo\s+'([^']*)'.*>&2/;
    const singleMatch = httpsBlock.match(singleQuotePattern);
    return singleMatch ? singleMatch[1] : null;
}

/**
 * Verifies that the non-HTTPS path does NOT contain any curl invocation.
 * The curl should only appear after the HTTPS validation passes.
 */
function nonHttpsPathHasNoCurl(script: string): boolean {
    const httpsBlock = extractHttpsValidationBlock(script);
    if (!httpsBlock) return false;
    // The HTTPS validation block should not contain curl
    return !httpsBlock.includes('curl');
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates arbitrary hook version strings */
const arbHookVersion = fc.oneof(
    // Semantic versions
    fc.tuple(
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 }),
        fc.integer({ min: 0, max: 99 })
    ).map(([major, minor, patch]) => `${major}.${minor}.${patch}`),
    // Arbitrary version-like strings
    fc.stringMatching(/^[a-zA-Z0-9._-]{1,50}$/),
    // Edge case versions
    fc.constantFrom(
        '0.0.0',
        '1.0.0',
        '99.99.99',
        'v1.0.0',
        '1.0.0-beta.1',
        '1.0.0-rc.1',
        'latest',
        'dev',
        ''
    )
);

/** Generates arbitrary non-HTTPS URLs (http://, ftp://, empty, other protocols) */
const arbNonHttpsUrl = fc.oneof(
    // http:// URLs
    fc.webUrl({ withFragments: false, withQueryParameters: false })
        .map(url => url.replace(/^https:\/\//, 'http://')),
    // ftp:// URLs
    fc.domain().map(domain => `ftp://${domain}/path`),
    // Empty string
    fc.constant(''),
    // Other protocols
    fc.constantFrom(
        'http://example.com',
        'http://hub.company.internal',
        'ftp://files.example.com',
        'ws://realtime.example.com',
        'wss://secure-ws.example.com',
        'file:///etc/passwd',
        'ssh://git@github.com',
        'tcp://localhost:3000',
        'custom://my-hub.local',
        'HTTP://EXAMPLE.COM',
        'Http://Mixed.Case.Com',
        'hTTps://almost-https.com',
        'httpx://not-https.com',
        'https//missing-colon.com',
        'ttp://missing-h.com',
        'localhost:3000',
        '192.168.1.1:3000',
        '/api/events',
        'just-a-string'
    )
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 18: Non-HTTPS hub URLs skip transmission', () => {
    it('generated script contains HTTPS validation logic that checks URL scheme', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // Script must contain the HTTPS validation check
                    expect(hasProperHttpsGlobCheck(script)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('non-HTTPS URLs cause the script to skip curl transmission (exit before curl)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The non-HTTPS path must exit before reaching curl
                    expect(skipsTransmissionForNonHttps(script)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('non-HTTPS URL path logs a warning to stderr', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The non-HTTPS block must output a warning to stderr
                    expect(hasStderrWarningForNonHttps(script)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the warning message mentions HTTPS or non-HTTPS to inform the user', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    const warningMsg = extractWarningMessage(script);
                    expect(warningMsg).not.toBeNull();

                    // Warning should mention HTTPS to explain why transmission is skipped
                    const mentionsHttps = /https/i.test(warningMsg!);
                    expect(mentionsHttps).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the non-HTTPS validation block does not contain any curl command', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The HTTPS validation block itself should not invoke curl
                    expect(nonHttpsPathHasNoCurl(script)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('empty hub URL is handled (exits before HTTPS check)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // Empty URL check must exist
                    expect(hasEmptyUrlCheck(script)).toBe(true);

                    // The empty URL check should come before the HTTPS check
                    const emptyCheckIndex = script.indexOf('-z "$HUB_URL"');
                    const httpsCheckIndex = script.indexOf('$HUB_URL" != https://*');
                    expect(emptyCheckIndex).toBeLessThan(httpsCheckIndex);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('non-HTTPS URL path exits with code 0 (never blocks push)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    const httpsBlock = extractHttpsValidationBlock(script);
                    expect(httpsBlock).not.toBeNull();

                    // The block must contain exit 0
                    expect(httpsBlock).toContain('exit 0');

                    // It must NOT contain any non-zero exit
                    expect(httpsBlock).not.toMatch(/exit\s+[1-9]/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('HTTPS validation uses glob pattern that correctly distinguishes https:// from other schemes', () => {
        fc.assert(
            fc.property(
                arbNonHttpsUrl,
                arbHookVersion,
                (nonHttpsUrl, hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The bash glob pattern [[ "$HUB_URL" != https://* ]] should match
                    // for any non-HTTPS URL. We verify the pattern is correct by checking
                    // that the generated script uses the proper glob syntax.
                    const globPattern = /\[\[\s*"\$HUB_URL"\s*!=\s*https:\/\/\*\s*\]\]/;
                    expect(script).toMatch(globPattern);

                    // Verify that none of our non-HTTPS URLs would pass the check
                    // (i.e., none start with exactly "https://")
                    if (nonHttpsUrl !== '') {
                        expect(nonHttpsUrl.startsWith('https://')).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the script structure ensures non-HTTPS URLs never reach the curl command', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const lines = script.split('\n');

                    // Find the line numbers of key elements
                    let httpsCheckLine = -1;
                    let httpsExitLine = -1;
                    let curlLine = -1;

                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].includes('$HUB_URL" != https://*')) {
                            httpsCheckLine = i;
                        }
                        // Find exit 0 after the HTTPS check (within the if block)
                        if (httpsCheckLine >= 0 && httpsExitLine < 0 &&
                            i > httpsCheckLine && lines[i].trim() === 'exit 0') {
                            httpsExitLine = i;
                        }
                        if (lines[i].includes('curl') && lines[i].includes('POST')) {
                            curlLine = i;
                        }
                    }

                    // All three elements must exist
                    expect(httpsCheckLine).toBeGreaterThanOrEqual(0);
                    expect(httpsExitLine).toBeGreaterThan(httpsCheckLine);
                    expect(curlLine).toBeGreaterThan(httpsExitLine);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the warning is output using echo to stderr (>&2 redirect)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const httpsBlock = extractHttpsValidationBlock(script);

                    expect(httpsBlock).not.toBeNull();

                    // Must use >&2 to redirect to stderr
                    expect(httpsBlock).toMatch(/>&2/);

                    // Must use echo for the warning
                    expect(httpsBlock).toMatch(/echo/);
                }
            ),
            { numRuns: 100 }
        );
    });
});
