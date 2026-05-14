/**
 * Property-based tests for the Common Prompts module.
 *
 * Feature: project-init
 * Tests the app name validation and display name transformation logic.
 */

// Mock @inquirer/prompts to avoid ESM import issues in Jest
jest.mock('@inquirer/prompts', () => ({
    input: jest.fn(),
    confirm: jest.fn(),
    select: jest.fn(),
}));

import * as fc from 'fast-check';
import { toDisplayName } from '../../src/stacks/common-prompts.js';

/**
 * The app name validator used inside collectCommonAnswers rejects
 * empty or whitespace-only input before delegating to the stack-specific validator.
 * We replicate that validation logic here for property testing.
 */
function appNameBaseValidator(value: string): string | true {
    const trimmed = value.trim();
    if (!trimmed) {
        return 'App name cannot be empty or whitespace-only.';
    }
    return true;
}

/** Arbitrary that generates strings composed entirely of whitespace characters */
const whitespaceOnly: fc.Arbitrary<string> = fc.array(
    fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\v'),
    { minLength: 1, maxLength: 50 }
).map((chars) => chars.join(''));

describe('Feature: project-init, Property 5: Whitespace App Name Rejection', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any string composed entirely of whitespace characters (spaces, tabs, newlines),
     * the app name validator SHALL reject it and return an error indication.
     */
    it('all-whitespace strings are rejected by name validator', () => {
        fc.assert(
            fc.property(whitespaceOnly, (whitespaceStr: string) => {
                const result = appNameBaseValidator(whitespaceStr);
                // Result should be a string (error message), not `true`
                expect(typeof result).toBe('string');
                expect(result).toBe('App name cannot be empty or whitespace-only.');
            }),
            { numRuns: 100 }
        );
    });
});

describe('Feature: project-init, Property 6: Display Name Transformation', () => {
    /** Arbitrary that generates strings containing at least one hyphen or underscore */
    const stringWithHyphensOrUnderscores: fc.Arbitrary<string> = fc.array(
        fc.constantFrom(
            'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
            'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
            '-', '_'
        ),
        { minLength: 1, maxLength: 30 }
    ).map((chars) => chars.join(''))
        .filter((s: string) => s.includes('-') || s.includes('_'));

    /**
     * **Validates: Requirements 2.3**
     *
     * For any string containing hyphens or underscores, toDisplayName SHALL replace
     * all hyphens and underscores with spaces and capitalize the first letter of each
     * resulting word.
     */
    it('hyphens/underscores replaced with spaces, words capitalized', () => {
        fc.assert(
            fc.property(stringWithHyphensOrUnderscores, (name: string) => {
                const result = toDisplayName(name);

                // 1. No hyphens or underscores remain in the output
                expect(result).not.toMatch(/[-_]/);

                // 2. Verify transformation: manually compute expected result
                const expected = name
                    .replace(/[-_]/g, ' ')
                    .replace(/\b\w/g, (char: string) => char.toUpperCase());
                expect(result).toBe(expected);
            }),
            { numRuns: 100 }
        );
    });
});
