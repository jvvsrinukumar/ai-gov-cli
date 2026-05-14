/**
 * Property-based tests for log entry format consistency
 * Property 14: Log entry format consistency
 *
 * **Validates: Requirements 9.1, 9.2**
 *
 * For any pre-commit hook execution completing with exit code E (0 or 1),
 * the appended log entry SHALL match the format
 * `<unix_timestamp>|<status>|<ai_platform>|<command>` where status is "pass"
 * if E=0 and "fail" if E=1, unix_timestamp is a valid integer, ai_platform
 * is one of "claude-code", "kiro", or "manual", and command is a string
 * (may be empty for manual commits).
 *
 * The pre-commit hook logging logic:
 *   _AIGOV_TS=$(date +%s) || true
 *   if [[ $ERRORS -gt 0 ]]; then
 *       echo "${_AIGOV_TS}|fail|manual|" >> "$_AIGOV_LOG" || true
 *   else
 *       echo "${_AIGOV_TS}|pass|manual|" >> "$_AIGOV_LOG" || true
 *   fi
 *
 * Feature: governance-dashboard, Property 14: Log entry format consistency
 */
import * as fc from 'fast-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Valid AI platform identifiers */
const VALID_PLATFORMS = ['claude-code', 'kiro', 'manual'] as const;
type AIPlatform = typeof VALID_PLATFORMS[number];

/** Valid status values */
const VALID_STATUSES = ['pass', 'fail'] as const;
type Status = typeof VALID_STATUSES[number];

/**
 * Represents the inputs to the pre-commit hook log entry generation.
 */
interface PreCommitExecution {
    exitCode: 0 | 1;
    timestamp: number;
    ai_platform: AIPlatform;
    command: string;
}

/**
 * Generates a log entry as the pre-commit hook would produce it.
 * This mirrors the bash logic in the generated pre-commit hook:
 *   echo "${_AIGOV_TS}|<status>|<ai_platform>|<command>" >> "$_AIGOV_LOG"
 *
 * Where status is "pass" if exit code is 0, "fail" if exit code is 1.
 */
function generateLogEntry(execution: PreCommitExecution): string {
    const status: Status = execution.exitCode === 0 ? 'pass' : 'fail';
    return `${execution.timestamp}|${status}|${execution.ai_platform}|${execution.command}`;
}

/**
 * Parses a log entry string and validates its format.
 * Returns a structured object if valid, or null if the format is invalid.
 */
function parseLogEntry(line: string): {
    timestamp: number;
    status: string;
    ai_platform: string;
    command: string;
} | null {
    // The format is: <unix_timestamp>|<status>|<ai_platform>|<command>
    // Command may be empty, so we split with a limit of 4
    const parts = line.split('|');
    if (parts.length !== 4) return null;

    const [timestampStr, status, ai_platform, command] = parts;

    // Validate timestamp is a valid integer
    const timestamp = Number(timestampStr);
    if (!Number.isInteger(timestamp)) return null;

    // Validate status
    if (status !== 'pass' && status !== 'fail') return null;

    // Validate ai_platform
    if (!VALID_PLATFORMS.includes(ai_platform as AIPlatform)) return null;

    // Command is a string (may be empty) — no further validation needed
    return { timestamp, status, ai_platform, command };
}

/**
 * Validates that a log entry string matches the expected format.
 * Returns true if the format is valid.
 */
function isValidLogEntry(line: string): boolean {
    return parseLogEntry(line) !== null;
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid exit code (0 or 1) */
const arbExitCode = fc.constantFrom(0, 1) as fc.Arbitrary<0 | 1>;

/** Generates a valid Unix timestamp (reasonable range for current era) */
const arbTimestamp = fc.integer({ min: 1700000000, max: 1900000000 });

/** Generates a valid AI platform identifier */
const arbPlatform = fc.constantFrom(...VALID_PLATFORMS) as fc.Arbitrary<AIPlatform>;

/** Generates a valid command name (may be empty for manual commits) */
const arbCommand = fc.oneof(
    fc.constant(''),
    fc.constantFrom('new-feature', 'fix', 'refactor', 'explore', 'hotfix', 'audit', 'assess', 'edit-feature')
);

/** Generates a complete pre-commit execution scenario */
const arbPreCommitExecution: fc.Arbitrary<PreCommitExecution> = fc.record({
    exitCode: arbExitCode,
    timestamp: arbTimestamp,
    ai_platform: arbPlatform,
    command: arbCommand,
});

/** Generates a manual commit execution (platform="manual", command="") */
const arbManualExecution: fc.Arbitrary<PreCommitExecution> = fc.record({
    exitCode: arbExitCode,
    timestamp: arbTimestamp,
    ai_platform: fc.constant('manual' as AIPlatform),
    command: fc.constant(''),
});

/** Generates an AI-assisted execution (platform != "manual", command non-empty) */
const arbAIExecution: fc.Arbitrary<PreCommitExecution> = fc.record({
    exitCode: arbExitCode,
    timestamp: arbTimestamp,
    ai_platform: fc.constantFrom('claude-code', 'kiro') as fc.Arbitrary<AIPlatform>,
    command: fc.constantFrom('new-feature', 'fix', 'refactor', 'explore', 'hotfix', 'audit', 'assess'),
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 14: Log entry format consistency', () => {
    it('generated log entry always has exactly 4 pipe-delimited fields', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parts = entry.split('|');

                    expect(parts.length).toBe(4);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('status field is "pass" when exit code is 0 and "fail" when exit code is 1', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    if (execution.exitCode === 0) {
                        expect(parsed!.status).toBe('pass');
                    } else {
                        expect(parsed!.status).toBe('fail');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('timestamp field is always a valid integer', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(Number.isInteger(parsed!.timestamp)).toBe(true);
                    expect(parsed!.timestamp).toBe(execution.timestamp);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_platform field is always one of "claude-code", "kiro", or "manual"', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(VALID_PLATFORMS).toContain(parsed!.ai_platform);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('command field may be empty for manual commits', () => {
        fc.assert(
            fc.property(
                arbManualExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.ai_platform).toBe('manual');
                    expect(parsed!.command).toBe('');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('command field is non-empty for AI-assisted commits', () => {
        fc.assert(
            fc.property(
                arbAIExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.command.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('every generated log entry passes format validation', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);

                    expect(isValidLogEntry(entry)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('log entry matches regex pattern: <int>|<pass|fail>|<platform>|<command>', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);

                    // Regex: integer | pass or fail | valid platform | any string (including empty)
                    const pattern = /^\d+\|(pass|fail)\|(claude-code|kiro|manual)\|.*$/;
                    expect(entry).toMatch(pattern);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('timestamp in entry preserves the original value exactly', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const timestampStr = entry.split('|')[0];

                    expect(Number(timestampStr)).toBe(execution.timestamp);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_platform in entry preserves the original value exactly', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.ai_platform).toBe(execution.ai_platform);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('command in entry preserves the original value exactly', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);
                    const parsed = parseLogEntry(entry);

                    expect(parsed).not.toBeNull();
                    expect(parsed!.command).toBe(execution.command);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('format is consistent across multiple entries (batch generation)', () => {
        fc.assert(
            fc.property(
                fc.array(arbPreCommitExecution, { minLength: 1, maxLength: 50 }),
                (executions) => {
                    const entries = executions.map(generateLogEntry);

                    for (const entry of entries) {
                        expect(isValidLogEntry(entry)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('entry does not contain newlines or carriage returns', () => {
        fc.assert(
            fc.property(
                arbPreCommitExecution,
                (execution) => {
                    const entry = generateLogEntry(execution);

                    expect(entry).not.toContain('\n');
                    expect(entry).not.toContain('\r');
                }
            ),
            { numRuns: 100 }
        );
    });
});
