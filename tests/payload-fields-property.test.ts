/**
 * Property-based tests for event payload field constraints
 * Property 17: Event payloads contain only allowed fields
 *
 * **Validates: Requirements 13.1, 13.2, 13.4**
 *
 * For any generated event payload, the payload SHALL contain only the fields:
 * project, team, platform, developer_hash, hook_version, commit_count,
 * compliance_pct, bypass, violations, branch, push_ts, dedup_key, and ai_usage.
 * No source code, file paths, commit messages, or diff content SHALL be present.
 *
 * Feature: governance-dashboard, Property 17: Event payloads contain only allowed fields
 */
import * as fc from 'fast-check';
import { generatePrePush } from '../src/generators/git-hooks/pre-push.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * The complete set of allowed top-level fields in the event payload.
 * Per Requirements 13.4, the payload SHALL contain ONLY these fields.
 */
const ALLOWED_FIELDS: readonly string[] = [
    'project',
    'team',
    'platform',
    'developer_hash',
    'hook_version',
    'commit_count',
    'compliance_pct',
    'bypass',
    'violations',
    'branch',
    'push_ts',
    'dedup_key',
    'ai_usage',
] as const;

/**
 * Fields that MUST NOT appear in the payload (privacy violations).
 * Per Requirements 13.1 and 13.2.
 */
const FORBIDDEN_PAYLOAD_PATTERNS: readonly string[] = [
    'source_code',
    'file_path',
    'file_paths',
    'files',
    'diff',
    'patch',
    'commit_message',
    'commit_messages',
    'message',
    'code',
    'content',
    'snippet',
    'body',
    'description',
    'file_content',
    'source',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extracts the JSON payload template from the generated pre-push script.
 * The payload is constructed using a heredoc between EOJSON markers.
 */
function extractPayloadTemplate(script: string): string | null {
    const heredocPattern = /PAYLOAD=\$\(cat <<EOJSON\n([\s\S]*?)\nEOJSON\n\)/;
    const match = script.match(heredocPattern);
    return match ? match[1] : null;
}

/**
 * Extracts the top-level field names from the JSON payload template.
 * Parses the heredoc JSON template to find all "field_name": patterns.
 */
function extractPayloadFieldNames(payloadTemplate: string): string[] {
    // Match JSON keys at the top level: "field_name":
    // We look for keys that are at the first indentation level (2 spaces)
    const fieldPattern = /^\s{2}"([^"]+)":/gm;
    const fields: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(payloadTemplate)) !== null) {
        fields.push(match[1]);
    }
    return fields;
}

/**
 * Checks if the payload template contains any reference to source code,
 * file paths, commit messages, or diff content as field names.
 */
function containsForbiddenFields(payloadTemplate: string): string[] {
    const fields = extractPayloadFieldNames(payloadTemplate);
    return fields.filter(field => FORBIDDEN_PAYLOAD_PATTERNS.includes(field));
}

/**
 * Checks if the script contains any variable assignment that could leak
 * source code, file contents, or commit messages into the payload.
 * Excludes heredoc constructions (cat <<) which are used for string building.
 */
function containsContentLeakingVariables(script: string): string[] {
    const leakingPatterns = [
        // Reading file contents into variables (cat with a file path, NOT heredoc)
        /\b\w+\s*=\s*\$\(cat\s+(?!<<)[^)]*\)/g,
        // Reading git diff output
        /\b\w+\s*=\s*\$\(git\s+diff[^)]*\)/g,
        // Reading git log messages (format with message specifiers)
        /\b\w+\s*=\s*\$\(git\s+log\s+--format[^)]*\)/g,
        // Reading git show (file contents)
        /\b\w+\s*=\s*\$\(git\s+show[^)]*\)/g,
    ];

    const found: string[] = [];
    for (const pattern of leakingPatterns) {
        const matches = script.match(pattern);
        if (matches) {
            found.push(...matches);
        }
    }
    return found;
}

/**
 * Verifies that the payload does not include any git log --format patterns
 * that would capture commit messages (e.g., %s, %B, %b).
 */
function containsCommitMessageCapture(script: string): boolean {
    // Check for git log with format specifiers that capture messages
    const messageFormatPattern = /git\s+log[^|]*--format[^|]*(%[sBb])/;
    return messageFormatPattern.test(script);
}

/**
 * Checks that curl command only sends the PAYLOAD variable and nothing else.
 */
function curlSendsOnlyPayload(script: string): boolean {
    // The curl -d flag should reference only $PAYLOAD
    const curlDataPattern = /-d\s+"?\$PAYLOAD"?/;
    return curlDataPattern.test(script);
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

describe('Property 17: Event payloads contain only allowed fields', () => {
    it('payload template contains only allowed top-level fields', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    // Payload template must exist
                    expect(payloadTemplate).not.toBeNull();

                    const fields = extractPayloadFieldNames(payloadTemplate!);

                    // Every field in the payload must be in the allowed list
                    for (const field of fields) {
                        expect(ALLOWED_FIELDS).toContain(field);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('payload template does not contain any forbidden fields (no source code, file paths, commit messages, diffs)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const forbidden = containsForbiddenFields(payloadTemplate!);
                    expect(forbidden).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('script does not capture source code or file contents into variables used in payload', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const leaks = containsContentLeakingVariables(script);
                    expect(leaks).toEqual([]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('script does not capture commit messages via git log format specifiers', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    expect(containsCommitMessageCapture(script)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('curl command sends only the PAYLOAD variable (no additional data flags)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    expect(curlSendsOnlyPayload(script)).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('payload field set is a subset of the allowed fields for all hook versions', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const fields = extractPayloadFieldNames(payloadTemplate!);
                    const allowedSet = new Set(ALLOWED_FIELDS);
                    const fieldSet = new Set(fields);

                    // Every payload field must be in the allowed set
                    for (const field of fieldSet) {
                        expect(allowedSet.has(field)).toBe(true);
                    }

                    // Payload must have at least the required fields
                    expect(fieldSet.has('project')).toBe(true);
                    expect(fieldSet.has('developer_hash')).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('payload does not contain git diff, patch, or file listing commands in variable interpolation', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    // The payload template should not contain command substitutions
                    // that read file contents or diffs
                    expect(payloadTemplate).not.toMatch(/\$\(git\s+diff/);
                    expect(payloadTemplate).not.toMatch(/\$\(git\s+show/);
                    expect(payloadTemplate).not.toMatch(/\$\(git\s+log\s+--format/);
                    expect(payloadTemplate).not.toMatch(/\$\(cat\s+/);
                    expect(payloadTemplate).not.toMatch(/\$\(find\s+/);
                    expect(payloadTemplate).not.toMatch(/\$\(ls\s+/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('payload values reference only safe computed variables (no raw content)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    // Extract all variable references in the payload template
                    const varPattern = /\$([A-Z_][A-Z0-9_]*)/g;
                    const variables: string[] = [];
                    let match: RegExpExecArray | null;
                    while ((match = varPattern.exec(payloadTemplate!)) !== null) {
                        variables.push(match[1]);
                    }

                    // All variables used in the payload should be from the safe set
                    const safeVariables = new Set([
                        'PROJECT',
                        'TEAM',
                        'PLATFORM',
                        'DEVELOPER_HASH',
                        'HOOK_VERSION',
                        'TOTAL_COMMITS',
                        'COMPLIANCE_PCT',
                        'VIOLATIONS',
                        'BRANCH',
                        'PUSH_TS',
                        'DEDUP_KEY',
                        'AI_USAGE',
                        'AI_ASSISTED',
                        'AI_ASSISTED_COUNT',
                        'COMMANDS_JSON',
                        'AI_PLATFORM',
                        'ACTIVE_HOOKS_COUNT',
                    ]);

                    for (const variable of variables) {
                        expect(safeVariables.has(variable)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('hookVersion does not introduce additional payload fields', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const fields = extractPayloadFieldNames(payloadTemplate!);

                    // The number of fields should be consistent regardless of hookVersion
                    // (hookVersion is embedded as a value, not as additional fields)
                    expect(fields.length).toBeLessThanOrEqual(ALLOWED_FIELDS.length);
                    expect(fields.length).toBeGreaterThan(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('no field in the payload contains raw email addresses (only hashed)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    // The payload should reference DEVELOPER_HASH, not DEV_EMAIL
                    expect(payloadTemplate).not.toContain('$DEV_EMAIL');
                    expect(payloadTemplate).not.toContain('${DEV_EMAIL');
                    expect(payloadTemplate).toContain('$DEVELOPER_HASH');
                }
            ),
            { numRuns: 100 }
        );
    });
});
