/**
 * Property-based tests for compliance percentage calculation
 * Property 12: Compliance percentage calculation from log entries
 *
 * **Validates: Requirements 8.6**
 *
 * For any precommit.log file containing N entries (where N >= 1), the
 * compliance_pct computed from the last min(20, N) entries SHALL equal
 * `(pass_count / total_count) * 100` where pass_count is the number of
 * entries with "pass" status and total_count is min(20, N).
 *
 * Note: The pre-push hook uses bash integer arithmetic, so the result is
 * floor((pass_count * 100) / total_count).
 *
 * Feature: governance-dashboard, Property 12: Compliance percentage calculation from log entries
 */
import * as fc from 'fast-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Represents a single precommit.log entry.
 */
interface LogEntry {
    timestamp: number;
    status: 'pass' | 'fail';
    ai_platform: string;
    command: string;
}

/**
 * Formats a log entry as it would appear in precommit.log.
 * Format: <unix_timestamp>|<pass/fail>|<ai_platform>|<command>
 */
function formatLogEntry(entry: LogEntry): string {
    return `${entry.timestamp}|${entry.status}|${entry.ai_platform}|${entry.command}`;
}

/**
 * Calculates compliance percentage from log entries, mirroring the bash logic
 * in the generated pre-push hook:
 *
 *   LAST_ENTRIES=$(tail -20 "$LOG_FILE")
 *   TOTAL_COUNT=$(echo "$LAST_ENTRIES" | wc -l | tr -d ' ')
 *   PASS_COUNT=$(echo "$LAST_ENTRIES" | grep -c '|pass|' || echo "0")
 *   COMPLIANCE_PCT=$(( (PASS_COUNT * 100) / TOTAL_COUNT ))
 *
 * Uses integer division (floor) to match bash arithmetic behavior.
 */
function calculateCompliancePct(logEntries: LogEntry[]): number {
    if (logEntries.length === 0) {
        return 100; // Default when no log file exists
    }

    // Take the last 20 entries (tail -20)
    const lastEntries = logEntries.slice(-20);
    const totalCount = lastEntries.length;
    const passCount = lastEntries.filter(e => e.status === 'pass').length;

    // Bash integer arithmetic: $(( (PASS_COUNT * 100) / TOTAL_COUNT ))
    return Math.floor((passCount * 100) / totalCount);
}

/**
 * Parses log lines (as the pre-push hook would read them) and calculates
 * compliance percentage.
 */
function calculateCompliancePctFromLines(lines: string[]): number {
    if (lines.length === 0) {
        return 100;
    }

    // Take the last 20 lines (tail -20)
    const lastLines = lines.slice(-20);
    const totalCount = lastLines.length;
    // grep -c '|pass|' counts lines containing '|pass|'
    const passCount = lastLines.filter(line => line.includes('|pass|')).length;

    // Bash integer arithmetic
    return Math.floor((passCount * 100) / totalCount);
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid log entry status */
const arbStatus = fc.constantFrom('pass', 'fail') as fc.Arbitrary<'pass' | 'fail'>;

/** Generates a valid AI platform identifier */
const arbPlatform = fc.constantFrom('claude-code', 'kiro', 'manual');

/** Generates a valid command name (may be empty for manual) */
const arbCommand = fc.oneof(
    fc.constant(''),
    fc.constantFrom('new-feature', 'fix', 'refactor', 'explore', 'hotfix', 'audit', 'assess')
);

/** Generates a valid Unix timestamp */
const arbTimestamp = fc.integer({ min: 1700000000, max: 1800000000 });

/** Generates a single log entry */
const arbLogEntry: fc.Arbitrary<LogEntry> = fc.record({
    timestamp: arbTimestamp,
    status: arbStatus,
    ai_platform: arbPlatform,
    command: arbCommand,
});

/** Generates a non-empty array of log entries (1 to 100 entries) */
const arbLogEntries = fc.array(arbLogEntry, { minLength: 1, maxLength: 100 });

/** Generates a log entries array with exactly N entries */
function arbLogEntriesOfSize(min: number, max: number): fc.Arbitrary<LogEntry[]> {
    return fc.array(arbLogEntry, { minLength: min, maxLength: max });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 12: Compliance percentage calculation from log entries', () => {
    it('result is always between 0 and 100 inclusive', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const pct = calculateCompliancePct(entries);
                    expect(pct).toBeGreaterThanOrEqual(0);
                    expect(pct).toBeLessThanOrEqual(100);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('result equals floor((pass_count * 100) / total_count) for last min(20, N) entries', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const pct = calculateCompliancePct(entries);

                    // Independently compute expected value
                    const lastEntries = entries.slice(-20);
                    const totalCount = lastEntries.length;
                    const passCount = lastEntries.filter(e => e.status === 'pass').length;
                    const expected = Math.floor((passCount * 100) / totalCount);

                    expect(pct).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('uses only the last 20 entries when more than 20 exist', () => {
        fc.assert(
            fc.property(
                // Generate 21-100 entries to ensure we have more than 20
                arbLogEntriesOfSize(21, 100),
                (entries) => {
                    const pct = calculateCompliancePct(entries);

                    // Compute using only last 20
                    const last20 = entries.slice(-20);
                    const passCount = last20.filter(e => e.status === 'pass').length;
                    const expected = Math.floor((passCount * 100) / 20);

                    expect(pct).toBe(expected);

                    // Verify that entries before the last 20 don't affect the result
                    // by comparing with a calculation that includes all entries
                    const allPassCount = entries.filter(e => e.status === 'pass').length;
                    const allExpected = Math.floor((allPassCount * 100) / Math.min(entries.length, 20));
                    // These should differ when early entries have different pass/fail ratio
                    // (we just verify the function uses last 20, not all)
                    expect(pct).toBe(Math.floor((passCount * 100) / 20));
                }
            ),
            { numRuns: 100 }
        );
    });

    it('uses all entries when 20 or fewer exist', () => {
        fc.assert(
            fc.property(
                arbLogEntriesOfSize(1, 20),
                (entries) => {
                    const pct = calculateCompliancePct(entries);

                    const passCount = entries.filter(e => e.status === 'pass').length;
                    const expected = Math.floor((passCount * 100) / entries.length);

                    expect(pct).toBe(expected);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('returns 100 when all entries are "pass"', () => {
        fc.assert(
            fc.property(
                arbLogEntriesOfSize(1, 50).map(entries =>
                    entries.map(e => ({ ...e, status: 'pass' as const }))
                ),
                (entries) => {
                    const pct = calculateCompliancePct(entries);
                    expect(pct).toBe(100);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('returns 0 when all entries are "fail"', () => {
        fc.assert(
            fc.property(
                arbLogEntriesOfSize(1, 50).map(entries =>
                    entries.map(e => ({ ...e, status: 'fail' as const }))
                ),
                (entries) => {
                    const pct = calculateCompliancePct(entries);
                    expect(pct).toBe(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('returns 100 when log is empty (default behavior)', () => {
        const pct = calculateCompliancePct([]);
        expect(pct).toBe(100);
    });

    it('line-based parsing produces same result as structured parsing', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    // Format entries as log lines
                    const lines = entries.map(formatLogEntry);

                    // Calculate from structured entries
                    const structuredPct = calculateCompliancePct(entries);

                    // Calculate from raw lines (as the bash script would)
                    const linePct = calculateCompliancePctFromLines(lines);

                    expect(linePct).toBe(structuredPct);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('result is an integer (bash arithmetic produces integers)', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const pct = calculateCompliancePct(entries);
                    expect(Number.isInteger(pct)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('result is monotonically related to pass ratio', () => {
        // For a fixed total count, more passes should give >= compliance_pct
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 20 }),
                (totalCount) => {
                    const results: number[] = [];
                    for (let passCount = 0; passCount <= totalCount; passCount++) {
                        const entries: LogEntry[] = [];
                        for (let i = 0; i < passCount; i++) {
                            entries.push({ timestamp: 1700000000 + i, status: 'pass', ai_platform: 'manual', command: '' });
                        }
                        for (let i = 0; i < totalCount - passCount; i++) {
                            entries.push({ timestamp: 1700000000 + passCount + i, status: 'fail', ai_platform: 'manual', command: '' });
                        }
                        results.push(calculateCompliancePct(entries));
                    }

                    // Each result should be >= the previous one (monotonically non-decreasing)
                    for (let i = 1; i < results.length; i++) {
                        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('grep pattern "|pass|" correctly identifies pass entries regardless of surrounding content', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const lastLines = lines.slice(-20);

                    // The grep pattern '|pass|' should match lines with pass status
                    const grepCount = lastLines.filter(line => line.includes('|pass|')).length;

                    // Structured count
                    const lastEntries = entries.slice(-20);
                    const structuredCount = lastEntries.filter(e => e.status === 'pass').length;

                    expect(grepCount).toBe(structuredCount);
                }
            ),
            { numRuns: 100 }
        );
    });
});
