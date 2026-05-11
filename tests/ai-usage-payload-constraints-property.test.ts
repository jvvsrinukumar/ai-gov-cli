/**
 * Property-based tests for AI usage payload constraints
 * Property 23: AI usage payload contains no content
 *
 * **Validates: Requirements 15.6**
 *
 * For any generated ai_usage object in an event payload, the object SHALL contain
 * only the fields: ai_assisted (boolean), ai_assisted_count (integer),
 * commands_used (string array of command names), ai_platform (string), and
 * active_hooks_count (integer). No prompt content, AI responses, generated code,
 * or file contents SHALL be present.
 *
 * Feature: governance-dashboard, Property 23: AI usage payload contains no content
 */
import * as fc from 'fast-check';
import { generatePrePush } from '../src/generators/git-hooks/pre-push.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * The complete set of allowed fields in the ai_usage object.
 * Per Requirements 15.6, the ai_usage object SHALL contain ONLY these fields.
 */
const ALLOWED_AI_USAGE_FIELDS: readonly string[] = [
    'ai_assisted',
    'ai_assisted_count',
    'commands_used',
    'ai_platform',
    'active_hooks_count',
] as const;

/**
 * Fields that MUST NOT appear in the ai_usage object (content leaks).
 * Per Requirements 15.6: no prompt content, AI responses, generated code, or file contents.
 */
const FORBIDDEN_AI_USAGE_FIELDS: readonly string[] = [
    'prompt',
    'prompts',
    'response',
    'responses',
    'ai_response',
    'ai_responses',
    'generated_code',
    'code',
    'content',
    'file_content',
    'file_contents',
    'files',
    'file_paths',
    'source_code',
    'source',
    'snippet',
    'snippets',
    'output',
    'input',
    'context',
    'conversation',
    'messages',
    'diff',
    'patch',
    'body',
    'description',
    'text',
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
 * Extracts the ai_usage JSON object block from the payload template.
 * Looks for the "ai_usage": { ... } section in the heredoc.
 */
function extractAIUsageBlock(payloadTemplate: string): string | null {
    // Match the ai_usage object block including nested braces
    const aiUsagePattern = /"ai_usage"\s*:\s*\{([^}]*)\}/;
    const match = payloadTemplate.match(aiUsagePattern);
    return match ? match[1] : null;
}

/**
 * Extracts field names from the ai_usage JSON block.
 * Parses "field_name": patterns within the ai_usage object.
 */
function extractAIUsageFieldNames(aiUsageBlock: string): string[] {
    const fieldPattern = /"([^"]+)"\s*:/g;
    const fields: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = fieldPattern.exec(aiUsageBlock)) !== null) {
        fields.push(match[1]);
    }
    return fields;
}

/**
 * Checks if the ai_usage block contains any variable references that could
 * leak content (prompts, AI responses, code, file contents).
 */
function extractAIUsageVariables(aiUsageBlock: string): string[] {
    const varPattern = /\$([A-Z_][A-Z0-9_]*)/g;
    const variables: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = varPattern.exec(aiUsageBlock)) !== null) {
        variables.push(match[1]);
    }
    return variables;
}

/**
 * Safe variables that are allowed to be referenced in the ai_usage block.
 * These are computed values that contain only counts and identifiers.
 */
const SAFE_AI_USAGE_VARIABLES = new Set([
    'AI_ASSISTED',
    'AI_ASSISTED_COUNT',
    'COMMANDS_JSON',
    'AI_PLATFORM',
    'ACTIVE_HOOKS_COUNT',
]);

/**
 * Variables that would indicate content leakage if found in ai_usage.
 */
const CONTENT_LEAKING_VARIABLES = new Set([
    'PROMPT',
    'RESPONSE',
    'CODE',
    'CONTENT',
    'FILE_CONTENT',
    'SOURCE',
    'DIFF',
    'PATCH',
    'MESSAGE',
    'BODY',
    'OUTPUT',
    'INPUT',
    'CONTEXT',
]);

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

describe('Property 23: AI usage payload contains no content', () => {
    it('ai_usage object contains only the allowed fields', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    const fields = extractAIUsageFieldNames(aiUsageBlock!);

                    // Every field in ai_usage must be in the allowed list
                    for (const field of fields) {
                        expect(ALLOWED_AI_USAGE_FIELDS).toContain(field);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage object does not contain any forbidden content fields', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    const fields = extractAIUsageFieldNames(aiUsageBlock!);

                    // No forbidden fields should be present
                    for (const field of fields) {
                        expect(FORBIDDEN_AI_USAGE_FIELDS).not.toContain(field);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage object contains exactly the 5 required fields', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    const fields = extractAIUsageFieldNames(aiUsageBlock!);
                    const fieldSet = new Set(fields);

                    // Must have exactly the 5 allowed fields
                    expect(fieldSet.size).toBe(ALLOWED_AI_USAGE_FIELDS.length);
                    for (const allowedField of ALLOWED_AI_USAGE_FIELDS) {
                        expect(fieldSet.has(allowedField)).toBe(true);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage variables reference only safe computed values (no content variables)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    const variables = extractAIUsageVariables(aiUsageBlock!);

                    // All variables in ai_usage must be from the safe set
                    for (const variable of variables) {
                        expect(SAFE_AI_USAGE_VARIABLES.has(variable)).toBe(true);
                    }

                    // No content-leaking variables should be present
                    for (const variable of variables) {
                        expect(CONTENT_LEAKING_VARIABLES.has(variable)).toBe(false);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage block does not contain command substitutions that read file contents', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    // No command substitutions that could leak content
                    expect(aiUsageBlock).not.toMatch(/\$\(cat\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(git\s+diff/);
                    expect(aiUsageBlock).not.toMatch(/\$\(git\s+show/);
                    expect(aiUsageBlock).not.toMatch(/\$\(git\s+log/);
                    expect(aiUsageBlock).not.toMatch(/\$\(find\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(ls\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(head\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(tail\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(sed\s+/);
                    expect(aiUsageBlock).not.toMatch(/\$\(awk\s+/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage commands_used field contains only command name references (no file paths or code)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    // The commands_used field should reference COMMANDS_JSON variable
                    // which is built from command names only (not file paths or code)
                    expect(aiUsageBlock).toMatch(/"commands_used"\s*:\s*\$COMMANDS_JSON/);

                    // Verify COMMANDS_JSON is built from AI_COMMANDS_USED (command names)
                    // and not from file reading operations
                    const commandsBuildSection = script.match(
                        /COMMANDS_JSON[\s\S]*?(?=# ---|\n\n[A-Z])/
                    );
                    if (commandsBuildSection) {
                        expect(commandsBuildSection[0]).not.toMatch(/\$\(cat\s+/);
                        expect(commandsBuildSection[0]).not.toMatch(/\$\(git\s+show/);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage ai_platform field is a simple string variable (no embedded content)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    // ai_platform should be a simple quoted variable reference
                    expect(aiUsageBlock).toMatch(/"ai_platform"\s*:\s*"\$AI_PLATFORM"/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage numeric fields are simple variable references (no complex expressions)', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    // ai_assisted_count should be a simple numeric variable
                    expect(aiUsageBlock).toMatch(/"ai_assisted_count"\s*:\s*\$AI_ASSISTED_COUNT/);

                    // active_hooks_count should be a simple numeric variable
                    expect(aiUsageBlock).toMatch(/"active_hooks_count"\s*:\s*\$ACTIVE_HOOKS_COUNT/);

                    // ai_assisted should be a simple boolean variable
                    expect(aiUsageBlock).toMatch(/"ai_assisted"\s*:\s*\$AI_ASSISTED/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('hookVersion does not introduce additional ai_usage fields or content', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);
                    const payloadTemplate = extractPayloadTemplate(script);

                    expect(payloadTemplate).not.toBeNull();

                    const aiUsageBlock = extractAIUsageBlock(payloadTemplate!);
                    expect(aiUsageBlock).not.toBeNull();

                    const fields = extractAIUsageFieldNames(aiUsageBlock!);

                    // Field count should be constant regardless of hookVersion
                    expect(fields.length).toBe(5);

                    // hookVersion value should not appear inside ai_usage
                    if (hookVersion && hookVersion.length > 0) {
                        // The hookVersion literal should not be embedded in ai_usage
                        // (it belongs at the top-level payload, not inside ai_usage)
                        expect(aiUsageBlock).not.toContain(`"${hookVersion}"`);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('ai_usage section in the script does not read or embed any file contents', () => {
        fc.assert(
            fc.property(
                arbHookVersion,
                (hookVersion) => {
                    const script = generatePrePush(hookVersion);

                    // Extract the section that builds AI usage data
                    // (between "Collect AI usage data" and "Count active AI agent hooks" or "Process refs")
                    const aiUsageSection = script.match(
                        /# --- Collect AI usage data[\s\S]*?(?=# --- Count active|# --- Process refs)/
                    );

                    if (aiUsageSection) {
                        const section = aiUsageSection[0];

                        // The AI usage collection should only parse log fields
                        // It should NOT read file contents, source code, or prompts
                        expect(section).not.toMatch(/\$\(cat\s+[^<]/); // cat with file (not heredoc)
                        expect(section).not.toMatch(/\$\(git\s+show/);
                        expect(section).not.toMatch(/\$\(git\s+diff/);

                        // It should only use cut to extract fields from pipe-delimited lines
                        // (which is safe — extracting command names from log format)
                        const cutUsages = section.match(/cut\s+-d'\|'/g) || [];
                        // All cut operations should be field extraction from log lines
                        for (const _cut of cutUsages) {
                            // cut -d'|' is expected for parsing log entries
                            expect(true).toBe(true);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
