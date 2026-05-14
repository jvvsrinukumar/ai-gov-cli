/**
 * Property-based tests for log rotation
 * Property 13: Log rotation preserves most recent 500 entries
 *
 * **Validates: Requirements 9.3**
 *
 * For any precommit.log file with more than 500 entries after appending,
 * after rotation the file SHALL contain exactly 500 entries, and those
 * entries SHALL be the 500 most recent (by position) from the pre-rotation file.
 *
 * The rotation logic in the generated pre-commit hook is:
 *   _AIGOV_LINES=$(wc -l < "$_AIGOV_LOG" 2>/dev/null) || true
 *   _AIGOV_LINES=${_AIGOV_LINES// /}
 *   if [ "${_AIGOV_LINES:-0}" -gt 500 ] 2>/dev/null; then
 *       tail -500 "$_AIGOV_LOG" > "$_AIGOV_LOG.tmp" && mv "$_AIGOV_LOG.tmp" "$_AIGOV_LOG" || true
 *   fi
 *
 * Feature: governance-dashboard, Property 13: Log rotation preserves most recent 500 entries
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
 * Simulates the log rotation logic from the generated pre-commit hook.
 *
 * The bash logic is:
 *   if line_count > 500:
 *       tail -500 log > log.tmp && mv log.tmp log
 *
 * This keeps the most recent 500 entries (last 500 lines by position).
 */
function rotateLog(lines: string[]): string[] {
    if (lines.length > 500) {
        // tail -500 keeps the last 500 lines
        return lines.slice(-500);
    }
    return lines;
}

/**
 * Simulates appending a new entry and then rotating.
 * This mirrors the full pre-commit hook behavior:
 * 1. Append new entry to log
 * 2. Check if line count > 500
 * 3. If so, keep only last 500 lines
 */
function appendAndRotate(existingLines: string[], newEntry: string): string[] {
    const allLines = [...existingLines, newEntry];
    return rotateLog(allLines);
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

/** Generates a log file with more than 500 entries (501 to 1000) */
const arbLargeLogEntries = fc.array(arbLogEntry, { minLength: 501, maxLength: 1000 });

/** Generates a log file with exactly 500 entries or fewer */
const arbSmallLogEntries = fc.array(arbLogEntry, { minLength: 1, maxLength: 500 });

/** Generates a log file with entries just above the threshold (501 to 600) */
const arbBorderlineLogEntries = fc.array(arbLogEntry, { minLength: 501, maxLength: 600 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 13: Log rotation preserves most recent 500 entries', () => {
    it('after rotation, file contains exactly 500 entries when input exceeds 500', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    expect(rotated.length).toBe(500);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('rotated entries are the 500 most recent (by position) from the pre-rotation file', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    // The rotated entries should be the last 500 lines of the original
                    const expectedLines = lines.slice(-500);
                    expect(rotated).toEqual(expectedLines);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('rotation preserves entry order (no reordering)', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    // Each entry in rotated should appear in the same relative order
                    // as in the original file
                    for (let i = 0; i < rotated.length - 1; i++) {
                        const idxA = lines.indexOf(rotated[i]);
                        const idxB = lines.indexOf(rotated[i + 1]);
                        // If entries are unique, order is preserved
                        // For duplicates, we verify positional order via slice
                        expect(rotated[i]).toBe(lines[lines.length - 500 + i]);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('no rotation occurs when file has 500 or fewer entries', () => {
        fc.assert(
            fc.property(
                arbSmallLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    // File should remain unchanged
                    expect(rotated.length).toBe(lines.length);
                    expect(rotated).toEqual(lines);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('rotation discards the oldest entries (first N-500 lines)', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    // The discarded entries are the first (N - 500) lines
                    const discardedCount = lines.length - 500;
                    const discardedLines = lines.slice(0, discardedCount);

                    // None of the discarded lines should appear at the start of rotated
                    // (they may appear later if duplicates exist, but the first entry
                    // of rotated should be lines[discardedCount])
                    expect(rotated[0]).toBe(lines[discardedCount]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('append-then-rotate keeps exactly 500 when starting from 500 entries', () => {
        fc.assert(
            fc.property(
                // Generate exactly 500 existing entries
                fc.array(arbLogEntry, { minLength: 500, maxLength: 500 }),
                arbLogEntry,
                (existingEntries, newEntry) => {
                    const existingLines = existingEntries.map(formatLogEntry);
                    const newLine = formatLogEntry(newEntry);

                    // After appending, we have 501 entries → rotation triggers
                    const result = appendAndRotate(existingLines, newLine);

                    expect(result.length).toBe(500);
                    // The new entry should be the last line
                    expect(result[result.length - 1]).toBe(newLine);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('the newest appended entry is always preserved after rotation', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                arbLogEntry,
                (existingEntries, newEntry) => {
                    const existingLines = existingEntries.map(formatLogEntry);
                    const newLine = formatLogEntry(newEntry);

                    const result = appendAndRotate(existingLines, newLine);

                    // The most recently appended entry should always be the last line
                    expect(result[result.length - 1]).toBe(newLine);
                    expect(result.length).toBe(500);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('rotation at boundary: exactly 501 entries results in exactly 500', () => {
        fc.assert(
            fc.property(
                fc.array(arbLogEntry, { minLength: 501, maxLength: 501 }),
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    expect(rotated.length).toBe(500);
                    // Should discard only the first entry
                    expect(rotated[0]).toBe(lines[1]);
                    expect(rotated[499]).toBe(lines[500]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('rotation is idempotent: rotating an already-rotated file produces the same result', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotatedOnce = rotateLog(lines);
                    const rotatedTwice = rotateLog(rotatedOnce);

                    // After first rotation we have 500 entries, second rotation
                    // should not change anything (500 <= 500)
                    expect(rotatedTwice).toEqual(rotatedOnce);
                    expect(rotatedTwice.length).toBe(500);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('content integrity: no entries are modified during rotation', () => {
        fc.assert(
            fc.property(
                arbLargeLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const rotated = rotateLog(lines);

                    // Every line in the rotated output must exist verbatim in the original
                    for (const line of rotated) {
                        expect(lines).toContain(line);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
