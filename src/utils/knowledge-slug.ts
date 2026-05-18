/**
 * Canonical slug normalization for knowledge file names.
 * Single source of truth — referenced by all knowledge commands and capture utils.
 *
 * Rule: lowercase, spaces/punctuation → hyphens, collapse repeats, trim edges, max 40 chars.
 *
 * Examples:
 *   "User Auth"       → "user-auth"
 *   "payments!!!"     → "payments"
 *   "  state  "       → "state"
 *   "a--b--c"         → "a-b-c"
 *   "hello world 123" → "hello-world-123"
 */
export function normalizeSlug(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}
