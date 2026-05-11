/**
 * Property-based tests for AI usage detection from log entries
 * Property 22: AI usage detection from log entries
 *
 * **Validates: Requirements 15.4**
 *
 * For any precommit.log file containing entries in the extended format
 * `<timestamp>|<status>|<platform>|<command>`, the ai_usage computation SHALL
 * correctly count entries where platform is not "manual" as AI-assisted,
 * identify distinct command names, and determine the primary platform
 * ("claude-code", "kiro", or "mixed" if both are present).
 *
 * Feature: governance-dashboard, Property 22: AI usage detection from log entries
 */
import * as fc from 'fast-check';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Represents a single precommit.log entry in the extended 4-field format.
 */
interface LogEntry {
    timestamp: number;
    status: 'pass' | 'fail';
    ai_platform: string;
    command: string;
}

/**
 * Represents the computed ai_usage object from log entries.
 */
interface AIUsage {
    ai_assisted: boolean;
    ai_assisted_count: number;
    commands_used: string[];
    ai_platform: string; // "claude-code" | "kiro" | "mixed" | "manual"
}

/**
 * Formats a log entry as it would appear in precommit.log.
 * Format: <unix_timestamp>|<pass/fail>|<ai_platform>|<command>
 */
function formatLogEntry(entry: LogEntry): string {
    return `${entry.timestamp}|${entry.status}|${entry.ai_platform}|${entry.command}`;
}

/**
 * Formats a log entry in the old 2-field format (backward compatibility).
 * Format: <unix_timestamp>|<pass/fail>
 */
function formatOldLogEntry(entry: { timestamp: number; status: 'pass' | 'fail' }): string {
    return `${entry.timestamp}|${entry.status}`;
}

/**
 * Computes AI usage data from log lines, mirroring the bash logic in the
 * generated pre-push hook:
 *
 * - Parse pipe-delimited fields: timestamp|status|ai_platform|command
 * - Treat missing/empty ai_platform (field index 2) as "manual" (backward compat)
 * - Count entries where platform != "manual" as AI-assisted
 * - Collect distinct non-empty command names
 * - Determine primary platform: "claude-code", "kiro", or "mixed" if both present
 *
 * This mirrors the bash logic from the pre-push hook:
 *   AI_PLAT=$(echo "$line" | cut -d'|' -f3)
 *   AI_CMD=$(echo "$line" | cut -d'|' -f4)
 *   if [[ -z "$AI_PLAT" ]]; then AI_PLAT="manual"; fi
 *   if [[ "$AI_PLAT" != "manual" ]]; then AI_ASSISTED_COUNT++; ...
 */
function computeAIUsageFromLines(lines: string[]): AIUsage {
    let aiAssistedCount = 0;
    const commandsSet = new Set<string>();
    let hasClaude = false;
    let hasKiro = false;

    // Process last 20 entries (matching pre-push hook behavior: tail -20)
    const lastLines = lines.slice(-20);

    for (const line of lastLines) {
        if (!line.trim()) continue;

        const fields = line.split('|');

        // Field index 2 is ai_platform (0-indexed: timestamp=0, status=1, platform=2, command=3)
        // Backward compatibility: treat missing or empty platform as "manual"
        const aiPlat = (fields.length > 2 && fields[2] !== '') ? fields[2] : 'manual';
        // Field index 3 is command; treat missing as empty string
        const aiCmd = (fields.length > 3) ? fields[3] : '';

        // Count AI-assisted entries (platform != "manual")
        if (aiPlat !== 'manual') {
            aiAssistedCount++;

            // Track which platforms are present
            if (aiPlat === 'claude-code') {
                hasClaude = true;
            } else if (aiPlat === 'kiro') {
                hasKiro = true;
            }

            // Collect distinct non-empty command names
            if (aiCmd !== '') {
                commandsSet.add(aiCmd);
            }
        }
    }

    // Determine primary AI platform
    let aiPlatform: string;
    if (hasClaude && hasKiro) {
        aiPlatform = 'mixed';
    } else if (hasClaude) {
        aiPlatform = 'claude-code';
    } else if (hasKiro) {
        aiPlatform = 'kiro';
    } else {
        aiPlatform = 'manual';
    }

    return {
        ai_assisted: aiAssistedCount > 0,
        ai_assisted_count: aiAssistedCount,
        commands_used: Array.from(commandsSet),
        ai_platform: aiPlatform,
    };
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a valid log entry status */
const arbStatus = fc.constantFrom('pass', 'fail') as fc.Arbitrary<'pass' | 'fail'>;

/** Generates a valid AI platform identifier */
const arbAIPlatform = fc.constantFrom('claude-code', 'kiro', 'manual');

/** Generates a valid command name (may be empty for manual) */
const arbCommand = fc.oneof(
    fc.constant(''),
    fc.constantFrom('new-feature', 'fix', 'refactor', 'explore', 'hotfix', 'audit', 'assess')
);

/** Generates a valid Unix timestamp */
const arbTimestamp = fc.integer({ min: 1700000000, max: 1800000000 });

/** Generates a single log entry in the extended 4-field format */
const arbLogEntry: fc.Arbitrary<LogEntry> = fc.record({
    timestamp: arbTimestamp,
    status: arbStatus,
    ai_platform: arbAIPlatform,
    command: arbCommand,
});

/** Generates a non-empty array of log entries (1 to 50 entries) */
const arbLogEntries = fc.array(arbLogEntry, { minLength: 1, maxLength: 50 });

/** Generates log entries with at least one AI-assisted entry */
const arbLogEntriesWithAI = fc.tuple(
    fc.array(arbLogEntry, { minLength: 0, maxLength: 20 }),
    fc.record({
        timestamp: arbTimestamp,
        status: arbStatus,
        ai_platform: fc.constantFrom('claude-code', 'kiro') as fc.Arbitrary<string>,
        command: arbCommand,
    }),
    fc.array(arbLogEntry, { minLength: 0, maxLength: 20 }),
).map(([before, aiEntry, after]) => [...before, aiEntry, ...after]);

/** Generates log entries with both claude-code and kiro platforms */
const arbMixedPlatformEntries = fc.tuple(
    fc.array(arbLogEntry, { minLength: 0, maxLength: 10 }),
    fc.record({
        timestamp: arbTimestamp,
        status: arbStatus,
        ai_platform: fc.constant('claude-code') as fc.Arbitrary<string>,
        command: arbCommand,
    }),
    fc.array(arbLogEntry, { minLength: 0, maxLength: 10 }),
    fc.record({
        timestamp: arbTimestamp,
        status: arbStatus,
        ai_platform: fc.constant('kiro') as fc.Arbitrary<string>,
        command: arbCommand,
    }),
    fc.array(arbLogEntry, { minLength: 0, maxLength: 10 }),
).map(([a, claude, b, kiro, c]) => [...a, claude, ...b, kiro, ...c]);

/** Generates log entries in old 2-field format (backward compatibility) */
const arbOldFormatEntry = fc.record({
    timestamp: arbTimestamp,
    status: arbStatus,
});

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 22: AI usage detection from log entries', () => {
    it('correctly counts AI-assisted entries (platform != "manual")', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // Independently compute expected count from last 20 entries
                    const last20 = entries.slice(-20);
                    const expectedCount = last20.filter(e => e.ai_platform !== 'manual').length;

                    expect(result.ai_assisted_count).toBe(expectedCount);
                    expect(result.ai_assisted).toBe(expectedCount > 0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('correctly identifies distinct command names from AI-assisted entries', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // Independently compute expected distinct commands from last 20 entries
                    const last20 = entries.slice(-20);
                    const expectedCommands = new Set<string>();
                    for (const entry of last20) {
                        if (entry.ai_platform !== 'manual' && entry.command !== '') {
                            expectedCommands.add(entry.command);
                        }
                    }

                    // Result should contain exactly the expected distinct commands
                    expect(new Set(result.commands_used)).toEqual(expectedCommands);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('determines primary platform as "claude-code" when only claude-code entries exist', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        timestamp: arbTimestamp,
                        status: arbStatus,
                        ai_platform: fc.constantFrom('claude-code', 'manual') as fc.Arbitrary<string>,
                        command: arbCommand,
                    }),
                    { minLength: 1, maxLength: 20 }
                ).filter(entries => entries.some(e => e.ai_platform === 'claude-code')),
                (entries) => {
                    const lines = entries.map(e => formatLogEntry(e as LogEntry));
                    const result = computeAIUsageFromLines(lines);

                    expect(result.ai_platform).toBe('claude-code');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('determines primary platform as "kiro" when only kiro entries exist', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        timestamp: arbTimestamp,
                        status: arbStatus,
                        ai_platform: fc.constantFrom('kiro', 'manual') as fc.Arbitrary<string>,
                        command: arbCommand,
                    }),
                    { minLength: 1, maxLength: 20 }
                ).filter(entries => entries.some(e => e.ai_platform === 'kiro')),
                (entries) => {
                    const lines = entries.map(e => formatLogEntry(e as LogEntry));
                    const result = computeAIUsageFromLines(lines);

                    expect(result.ai_platform).toBe('kiro');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('determines primary platform as "mixed" when both claude-code and kiro are present', () => {
        fc.assert(
            fc.property(
                arbMixedPlatformEntries.filter(entries => {
                    // Ensure both platforms appear in the last 20 entries
                    const last20 = entries.slice(-20);
                    return last20.some(e => e.ai_platform === 'claude-code') &&
                        last20.some(e => e.ai_platform === 'kiro');
                }),
                (entries) => {
                    const lines = entries.map(e => formatLogEntry(e as LogEntry));
                    const result = computeAIUsageFromLines(lines);

                    expect(result.ai_platform).toBe('mixed');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('determines primary platform as "manual" when all entries are manual', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        timestamp: arbTimestamp,
                        status: arbStatus,
                        ai_platform: fc.constant('manual') as fc.Arbitrary<string>,
                        command: fc.constant(''),
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (entries) => {
                    const lines = entries.map(e => formatLogEntry(e as LogEntry));
                    const result = computeAIUsageFromLines(lines);

                    expect(result.ai_platform).toBe('manual');
                    expect(result.ai_assisted).toBe(false);
                    expect(result.ai_assisted_count).toBe(0);
                    expect(result.commands_used).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('treats old 2-field format entries (without platform/command) as "manual"', () => {
        fc.assert(
            fc.property(
                fc.array(arbOldFormatEntry, { minLength: 1, maxLength: 20 }),
                (oldEntries) => {
                    // Format in old 2-field format: timestamp|status
                    const lines = oldEntries.map(formatOldLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // All old-format entries should be treated as manual
                    expect(result.ai_assisted).toBe(false);
                    expect(result.ai_assisted_count).toBe(0);
                    expect(result.ai_platform).toBe('manual');
                    expect(result.commands_used).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('handles mixed old-format and new-format entries correctly', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.array(arbOldFormatEntry, { minLength: 1, maxLength: 10 }),
                    fc.array(arbLogEntry, { minLength: 1, maxLength: 10 })
                ),
                ([oldEntries, newEntries]) => {
                    // Mix old and new format entries
                    const oldLines = oldEntries.map(formatOldLogEntry);
                    const newLines = newEntries.map(formatLogEntry);
                    const allLines = [...oldLines, ...newLines];

                    const result = computeAIUsageFromLines(allLines);

                    // Only new-format entries with non-manual platform should count
                    const last20 = allLines.slice(-20);
                    let expectedCount = 0;
                    for (const line of last20) {
                        const fields = line.split('|');
                        const plat = (fields.length > 2 && fields[2] !== '') ? fields[2] : 'manual';
                        if (plat !== 'manual') {
                            expectedCount++;
                        }
                    }

                    expect(result.ai_assisted_count).toBe(expectedCount);
                    expect(result.ai_assisted).toBe(expectedCount > 0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('commands_used contains no empty strings', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // No empty strings in commands_used
                    for (const cmd of result.commands_used) {
                        expect(cmd.length).toBeGreaterThan(0);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('commands_used contains only distinct values (no duplicates)', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // All commands should be unique
                    const uniqueCommands = new Set(result.commands_used);
                    expect(result.commands_used.length).toBe(uniqueCommands.size);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_assisted is true if and only if ai_assisted_count > 0', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    expect(result.ai_assisted).toBe(result.ai_assisted_count > 0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_platform is one of the valid values', () => {
        fc.assert(
            fc.property(
                arbLogEntries,
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    expect(['claude-code', 'kiro', 'mixed', 'manual']).toContain(result.ai_platform);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('processes only the last 20 entries (matching pre-push hook tail -20 behavior)', () => {
        fc.assert(
            fc.property(
                // Generate more than 20 entries to test windowing
                fc.array(arbLogEntry, { minLength: 21, maxLength: 50 }),
                (entries) => {
                    const lines = entries.map(formatLogEntry);
                    const result = computeAIUsageFromLines(lines);

                    // Compute expected from only the last 20
                    const last20 = entries.slice(-20);
                    const expectedCount = last20.filter(e => e.ai_platform !== 'manual').length;

                    expect(result.ai_assisted_count).toBe(expectedCount);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('entries with empty platform field are treated as manual (backward compat)', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        timestamp: arbTimestamp,
                        status: arbStatus,
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (entries) => {
                    // Format with empty platform field: timestamp|status||
                    const lines = entries.map(e => `${e.timestamp}|${e.status}||`);
                    const result = computeAIUsageFromLines(lines);

                    // Empty platform should be treated as "manual"
                    expect(result.ai_assisted).toBe(false);
                    expect(result.ai_assisted_count).toBe(0);
                    expect(result.ai_platform).toBe('manual');
                }
            ),
            { numRuns: 100 }
        );
    });
});
