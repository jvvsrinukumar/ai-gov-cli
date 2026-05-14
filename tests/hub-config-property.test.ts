/**
 * Property-based tests for src/utils/hub-config.ts
 * Property 9: Hub config parsing applies correct defaults for missing fields
 *
 * **Validates: Requirements 11.1, 11.2**
 *
 * For any valid JSON object in `.ai-gov/config.json` with an arbitrary subset
 * of fields present, `readHubConfig()` SHALL return a HubConfig where missing
 * `team` defaults to "ungrouped", missing `project` defaults to the directory
 * basename, missing `platform` defaults to "unknown", and missing `hub` defaults
 * to empty string.
 */
import * as fc from 'fast-check';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';

import { readHubConfig } from '../src/utils/hub-config.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'hub-config-pbt-'));
}

function writeConfig(projectDir: string, content: string): void {
    const configDir = join(projectDir, '.ai-gov');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), content, 'utf-8');
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-empty string suitable for config field values */
const arbConfigString = fc.string({ minLength: 1, maxLength: 100 })
    .filter(s => s.trim().length > 0 && !s.includes('\0'));

/** Generates an arbitrary subset of HubConfig fields as a plain object */
const arbPartialConfig = fc.record(
    {
        hub: arbConfigString,
        project: arbConfigString,
        team: arbConfigString,
        platform: arbConfigString,
    },
    { requiredKeys: [] } // All fields are optional
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 9: Hub config parsing applies correct defaults for missing fields', () => {
    it('missing team defaults to "ungrouped"', () => {
        fc.assert(
            fc.property(
                arbPartialConfig.filter(obj => !('team' in obj)),
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();
                        expect(result!.team).toBe('ungrouped');
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('missing project defaults to basename(projectDir)', () => {
        fc.assert(
            fc.property(
                arbPartialConfig.filter(obj => !('project' in obj)),
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();
                        expect(result!.project).toBe(basename(tempDir));
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('missing platform defaults to "unknown"', () => {
        fc.assert(
            fc.property(
                arbPartialConfig.filter(obj => !('platform' in obj)),
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();
                        expect(result!.platform).toBe('unknown');
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('missing hub defaults to empty string', () => {
        fc.assert(
            fc.property(
                arbPartialConfig.filter(obj => !('hub' in obj)),
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();
                        expect(result!.hub).toBe('');
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('present fields are used as-is, missing fields get defaults', () => {
        fc.assert(
            fc.property(
                arbPartialConfig,
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();

                        // Check each field: if present in input, should match; if missing, should be default
                        if ('hub' in partialConfig) {
                            expect(result!.hub).toBe(partialConfig.hub);
                        } else {
                            expect(result!.hub).toBe('');
                        }

                        if ('project' in partialConfig) {
                            expect(result!.project).toBe(partialConfig.project);
                        } else {
                            expect(result!.project).toBe(basename(tempDir));
                        }

                        if ('team' in partialConfig) {
                            expect(result!.team).toBe(partialConfig.team);
                        } else {
                            expect(result!.team).toBe('ungrouped');
                        }

                        if ('platform' in partialConfig) {
                            expect(result!.platform).toBe(partialConfig.platform);
                        } else {
                            expect(result!.platform).toBe('unknown');
                        }
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('non-string field values are treated as missing and get defaults', () => {
        // Generate objects where fields may be non-string values (numbers, booleans, arrays, null)
        const arbNonStringValue = fc.oneof(
            fc.integer(),
            fc.boolean(),
            fc.constant(null),
            fc.array(fc.string(), { maxLength: 3 }),
            fc.object()
        );

        const arbConfigWithNonStrings = fc.record(
            {
                hub: arbNonStringValue,
                project: arbNonStringValue,
                team: arbNonStringValue,
                platform: arbNonStringValue,
            },
            { requiredKeys: [] }
        );

        fc.assert(
            fc.property(
                arbConfigWithNonStrings,
                (partialConfig) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, JSON.stringify(partialConfig));
                        const result = readHubConfig(tempDir);
                        expect(result).not.toBeNull();

                        // Non-string values should be treated as missing → defaults applied
                        if (!('hub' in partialConfig) || typeof partialConfig.hub !== 'string') {
                            expect(result!.hub).toBe('');
                        }
                        if (!('project' in partialConfig) || typeof partialConfig.project !== 'string') {
                            expect(result!.project).toBe(basename(tempDir));
                        }
                        if (!('team' in partialConfig) || typeof partialConfig.team !== 'string') {
                            expect(result!.team).toBe('ungrouped');
                        }
                        if (!('platform' in partialConfig) || typeof partialConfig.platform !== 'string') {
                            expect(result!.platform).toBe('unknown');
                        }
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 10 Tests ───────────────────────────────────────────────────────

/**
 * Property 10: Invalid or missing config returns null without throwing
 *
 * **Validates: Requirements 11.3**
 *
 * For any file path where the file does not exist, contains unparseable JSON,
 * or parses to a non-object value (array, string, number, null),
 * `readHubConfig()` SHALL return `null` without throwing an exception.
 */
describe('Property 10: Invalid or missing config returns null without throwing', () => {
    it('non-existent config file returns null without throwing', () => {
        fc.assert(
            fc.property(
                // Generate random directory name suffixes to ensure unique non-existent paths
                fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0 && !s.includes('\0') && !s.includes('/')),
                (suffix) => {
                    const tempDir = makeTempDir();
                    try {
                        // Do NOT create .ai-gov/config.json — directory exists but config does not
                        const result = readHubConfig(tempDir);
                        expect(result).toBeNull();
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('unparseable JSON content returns null without throwing', () => {
        // Generate arbitrary strings that are NOT valid JSON objects
        const arbInvalidJson = fc.oneof(
            // Random strings that are unlikely to be valid JSON
            fc.string({ minLength: 1, maxLength: 200 }).filter(s => {
                try {
                    const parsed = JSON.parse(s);
                    // Exclude strings that parse to plain objects (those are valid configs)
                    return parsed === null || typeof parsed !== 'object' || Array.isArray(parsed);
                } catch {
                    return true; // Parse failure = invalid JSON, which is what we want
                }
            }),
            // Explicitly malformed JSON patterns
            fc.constantFrom(
                '{missing-quotes: true}',
                '{"unclosed": ',
                '{key: value}',
                '{"trailing": "comma",}',
                "{'single': 'quotes'}",
                '',
                '   ',
                'undefined',
                'NaN',
                'Infinity'
            )
        );

        fc.assert(
            fc.property(
                arbInvalidJson,
                (content) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, content);
                        const result = readHubConfig(tempDir);
                        expect(result).toBeNull();
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('JSON that parses to non-object values returns null without throwing', () => {
        // Generate valid JSON that parses to non-object types
        const arbNonObjectJson = fc.oneof(
            // Arrays (including arrays of objects)
            fc.array(fc.anything(), { maxLength: 5 }).map(arr => JSON.stringify(arr)),
            // Strings
            fc.string().map(s => JSON.stringify(s)),
            // Numbers
            fc.oneof(fc.integer(), fc.float()).map(n => JSON.stringify(n)),
            // null
            fc.constant('null'),
            // Booleans
            fc.boolean().map(b => JSON.stringify(b))
        );

        fc.assert(
            fc.property(
                arbNonObjectJson,
                (jsonContent) => {
                    const tempDir = makeTempDir();
                    try {
                        writeConfig(tempDir, jsonContent);
                        const result = readHubConfig(tempDir);
                        expect(result).toBeNull();
                    } finally {
                        rmSync(tempDir, { recursive: true, force: true });
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
