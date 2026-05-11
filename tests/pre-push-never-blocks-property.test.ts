/**
 * Property-based tests for pre-push hook never blocking
 * Property 15: Pre-push script never blocks push
 *
 * **Validates: Requirements 8.2**
 *
 * For any execution of the generated pre-push script — regardless of network
 * failures, missing config files, invalid hub URLs, or any other error
 * condition — the script SHALL exit with code 0.
 *
 * This test performs static analysis of the generated bash script text to verify
 * that all code paths terminate with exit 0 and that error-prone operations are
 * properly guarded.
 *
 * Feature: governance-dashboard, Property 15: Pre-push script never blocks push
 */
import * as fc from 'fast-check';
import { generatePrePush } from '../src/generators/git-hooks/pre-push.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts all exit statements from a bash script.
 * Matches patterns like: exit 0, exit 1, exit $?, etc.
 */
function extractExitStatements(script: string): string[] {
    const exitPattern = /^\s*exit\s+(\S+)/gm;
    const exits: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = exitPattern.exec(script)) !== null) {
        exits.push(match[1]);
    }
    return exits;
}

/**
 * Extracts all curl commands from a bash script.
 */
function extractCurlCommands(script: string): string[] {
    const lines = script.split('\n');
    const curlLines: string[] = [];
    for (const line of lines) {
        if (line.includes('curl')) {
            curlLines.push(line.trim());
        }
    }
    return curlLines;
}

/**
 * Checks if a curl command is backgrounded (ends with &) and wrapped with || true.
 * The pre-push hook wraps curl in a subshell: (curl ... || true) &
 */
function isCurlSafelyWrapped(script: string): boolean {
    // The curl should be inside a subshell that is backgrounded
    // Pattern: (curl ... || true) &
    const curlBlockPattern = /\(curl[^)]*\|\|\s*true\)\s*&/s;
    // Also check for the broader pattern where the subshell contains curl and ends with || true) &
    const subshellPattern = /\([^)]*curl[^)]*\|\|\s*true\)\s*&/s;
    return curlBlockPattern.test(script) || subshellPattern.test(script);
}

/**
 * Gets the final statement of the script (last non-empty, non-comment line).
 */
function getFinalStatement(script: string): string {
    const lines = script.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const trimmed = lines[i].trim();
        if (trimmed && !trimmed.startsWith('#')) {
            return trimmed;
        }
    }
    return '';
}

/**
 * Extracts all code paths that lead to an exit statement.
 * Returns the exit codes found at each early-exit point.
 */
function extractEarlyExitCodes(script: string): string[] {
    const lines = script.split('\n');
    const exitCodes: string[] = [];
    for (const line of lines) {
        const trimmed = line.trim();
        const exitMatch = trimmed.match(/^exit\s+(\d+)/);
        if (exitMatch) {
            exitCodes.push(exitMatch[1]);
        }
    }
    return exitCodes;
}

/**
 * Checks that all conditional branches that exit do so with code 0.
 * Looks for patterns like:
 *   if ...; then exit X; fi
 *   [[ ... ]] && exit X
 */
function allConditionalExitsAreZero(script: string): boolean {
    const exitCodes = extractEarlyExitCodes(script);
    return exitCodes.every(code => code === '0');
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

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 15: Pre-push script never blocks push', () => {
    it('generated script always ends with exit 0 as the final statement', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const finalStatement = getFinalStatement(script);
                    expect(finalStatement).toBe('exit 0');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('every exit statement in the script uses exit code 0', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const exitStatements = extractExitStatements(script);

                    // There must be at least one exit statement
                    expect(exitStatements.length).toBeGreaterThan(0);

                    // All exit statements must be exit 0
                    for (const exitCode of exitStatements) {
                        expect(exitCode).toBe('0');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('script never contains exit 1 or any non-zero exit code', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // Check for explicit non-zero exit codes
                    const nonZeroExitPattern = /^\s*exit\s+[1-9]\d*/gm;
                    const matches = script.match(nonZeroExitPattern);
                    expect(matches).toBeNull();

                    // Also check for exit $? which could propagate a non-zero code
                    const exitVarPattern = /^\s*exit\s+\$/gm;
                    const varMatches = script.match(exitVarPattern);
                    expect(varMatches).toBeNull();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('all curl commands are backgrounded and wrapped with || true', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const curlLines = extractCurlCommands(script);

                    // If there are curl commands, they must be safely wrapped
                    if (curlLines.length > 0) {
                        expect(isCurlSafelyWrapped(script)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('every code path (telemetry off, missing config, empty hub URL, non-HTTPS URL, no commits, normal flow) ends with exit 0', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // Verify all conditional exits are exit 0
                    expect(allConditionalExitsAreZero(script)).toBe(true);

                    // Verify specific code paths exist and exit 0:

                    // 1. Telemetry off path
                    expect(script).toContain('AI_GOV_TELEMETRY');
                    expect(script).toMatch(/AI_GOV_TELEMETRY.*off/);

                    // 2. Missing config path (read_config failure)
                    expect(script).toMatch(/if\s*!\s*read_config/);

                    // 3. Empty hub URL path
                    expect(script).toMatch(/if\s*\[\[\s*-z\s*"\$HUB_URL"\s*\]\]/);

                    // 4. Non-HTTPS URL path
                    expect(script).toMatch(/HUB_URL.*!=.*https:\/\/\*/);

                    // 5. No commits path
                    expect(script).toMatch(/TOTAL_COMMITS.*-eq\s*0/);

                    // 6. Normal flow ends with exit 0
                    const finalStatement = getFinalStatement(script);
                    expect(finalStatement).toBe('exit 0');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('error-prone operations use || true or conditional logic that falls through to exit 0', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The read_config function uses || return 1 internally,
                    // but the caller handles it with: if ! read_config; then exit 0; fi
                    expect(script).toMatch(/if\s*!\s*read_config;\s*then\s*\n\s*exit\s*0/);

                    // git commands use || echo fallbacks
                    expect(script).toMatch(/git\s+rev-list[^|]*\|\|\s*echo\s*"1"/);

                    // curl is wrapped with || true in a background subshell
                    expect(isCurlSafelyWrapped(script)).toBe(true);

                    // tail command uses || echo fallback
                    expect(script).toMatch(/tail\s+-20[^|]*\|\|\s*echo\s*""/);

                    // git config uses || echo fallback
                    expect(script).toMatch(/git\s+config\s+user\.email[^|]*\|\|\s*echo\s*""/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('script starts with proper shebang line', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    expect(script.startsWith('#!/usr/bin/env bash')).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the hookVersion parameter is embedded in the script without affecting exit behavior', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The hook version should appear in the script
                    expect(script).toContain(hookVersion);

                    // But it should not introduce any non-zero exit
                    const exitStatements = extractExitStatements(script);
                    for (const exitCode of exitStatements) {
                        expect(exitCode).toBe('0');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('script contains a comment explicitly stating it never blocks push', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // The script should contain documentation about never blocking
                    const neverBlocksPattern = /never\s+block/i;
                    expect(script).toMatch(neverBlocksPattern);
                }
            ),
            { numRuns: 100 }
        );
    });
});
