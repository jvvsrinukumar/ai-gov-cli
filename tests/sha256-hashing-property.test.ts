/**
 * Property-based tests for SHA-256 hashing
 * Property 11: SHA-256 hashing produces consistent 64-character lowercase hex
 *
 * **Validates: Requirements 8.4, 13.3**
 *
 * For any email string, applying SHA-256 hashing SHALL produce a deterministic
 * 64-character string consisting only of lowercase hexadecimal characters (0-9, a-f).
 *
 * Feature: governance-dashboard, Property 11: SHA-256 hashing produces consistent 64-character lowercase hex
 */
import * as fc from 'fast-check';
import { createHash } from 'crypto';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * SHA-256 hash function matching the pre-push hook logic:
 * printf '%s' "$DEV_EMAIL" | sha256sum | cut -d' ' -f1
 *
 * This is the Node.js equivalent of the shell hashing used in the generated
 * pre-push hook script.
 */
function hashEmail(email: string): string {
    return createHash('sha256').update(email).digest('hex');
}

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates arbitrary email-like strings */
const arbEmail = fc.oneof(
    // Realistic email addresses
    fc.tuple(
        fc.stringMatching(/^[a-z0-9._+\-]{1,30}$/),
        fc.constantFrom('gmail.com', 'company.org', 'dev.io', 'example.com', 'test.co.uk')
    ).map(([local, domain]) => `${local}@${domain}`),
    // Arbitrary strings (any input should still produce valid hash)
    fc.string({ minLength: 0, maxLength: 200 }),
    // Edge case strings
    fc.constantFrom(
        '',
        ' ',
        'a@b.c',
        'user+tag@domain.com',
        'very.long.email.address.with.many.parts@subdomain.domain.tld',
        '🎉@emoji.dev',
        'null\x00byte@test.com'
    )
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 11: SHA-256 hashing produces consistent 64-character lowercase hex', () => {
    it('output is always exactly 64 characters', () => {
        fc.assert(
            fc.property(
                arbEmail,
                (email) => {
                    const hash = hashEmail(email);
                    expect(hash).toHaveLength(64);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('output contains only lowercase hexadecimal characters (0-9, a-f)', () => {
        fc.assert(
            fc.property(
                arbEmail,
                (email) => {
                    const hash = hashEmail(email);
                    expect(hash).toMatch(/^[0-9a-f]{64}$/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('output is deterministic — same input always produces same output', () => {
        fc.assert(
            fc.property(
                arbEmail,
                (email) => {
                    const hash1 = hashEmail(email);
                    const hash2 = hashEmail(email);
                    const hash3 = hashEmail(email);
                    expect(hash1).toBe(hash2);
                    expect(hash2).toBe(hash3);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('different inputs produce different outputs (collision resistance)', () => {
        fc.assert(
            fc.property(
                arbEmail,
                arbEmail,
                (email1, email2) => {
                    // Only check when inputs are actually different
                    fc.pre(email1 !== email2);
                    const hash1 = hashEmail(email1);
                    const hash2 = hashEmail(email2);
                    expect(hash1).not.toBe(hash2);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('output never contains uppercase characters', () => {
        fc.assert(
            fc.property(
                arbEmail,
                (email) => {
                    const hash = hashEmail(email);
                    expect(hash).toBe(hash.toLowerCase());
                }
            ),
            { numRuns: 100 }
        );
    });
});
