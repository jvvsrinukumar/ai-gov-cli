import type { GovernanceConfig } from '../../../types.js';

export function generateWorkflowDetectConflicts(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;

    return JSON.stringify({
        name: 'Detect Conflicts',
        version: c.hookVersion,
        description: 'Cross-feature conflict detection — surfaces contradicting business rules across knowledge files',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `DETECT CONFLICTS — Cross-feature conflict detection for ${stackDisplay}.

> This is a new session — you have no conversation history.
> Only reads knowledge/product-*.md files. Only writes to knowledge/conflicts/.

## EXECUTION RULES

1. Read-only on source code — only writes to knowledge/conflicts/.
2. Conservative threshold — only flag clear contradictions, not differences in detail level.
3. No duplicates — check existing conflict files before writing. Do not re-raise resolved entries.
4. Product knowledge only — only knowledge/product-*.md files are analyzed.

---

## STEP 0 — Ask scope

Ask: "Which features should I compare for conflicts?
 — Leave empty to compare ALL knowledge/product-*.md files
 — Name two or more features (e.g. 'auth payments') to compare only those"

If user names a single feature: "Conflict detection requires at least two features."
If knowledge/ doesn't exist or fewer than 2 product-*.md files: "No cross-feature conflicts possible — fewer than 2 features documented in knowledge/." Stop.

---

## STEP 1 — Read knowledge files

Read all in-scope knowledge/product-*.md files in full.

---

## STEP 2 — Detect conflicts

For each pair of files, check four conflict types. Be conservative:

**Permission conflicts** — Same role, contradicting access to the same resource.
- ✓ Flag: "Guest can view products" vs "Guests cannot view products without login"
- ✗ Skip: Different resources

**Domain object conflicts** — Same entity, contradicting fields or business meaning.
- ✓ Flag: Order.status = [pending/shipped/delivered] vs Order.status = [draft/active/completed]
- ✗ Skip: Different sub-concerns of the same entity

**Business state conflicts** — Same enum/state machine, different values or transitions.
- ✓ Flag: PaymentStatus includes REFUNDED in one file, absent in another
- ✗ Skip: Different state machines entirely

**Flow assumption conflicts** — Flow A assumes a precondition that Flow B contradicts.
- ✓ Flag: "Must verify email before checkout" vs "Guest checkout requires no email"
- ✗ Skip: Different user types with no overlap

When in doubt: skip. Only flag clear contradictions.

---

## STEP 3 — Write conflict files

Create knowledge/conflicts/ if it doesn't exist.

Filename: knowledge/conflicts/[slug-a]-vs-[slug-b].md (alphabetical order).

Before writing, check existing file:
- [x] Resolved entries: skip
- Existing unresolved entries: leave (no duplicate)
- New conflicts: append (or create file)

Conflict entry format:

---
## [Type] Conflict — [short description]

**[slug-a]** (\`knowledge/product-[slug-a].md\`):
> "[exact entry text]"

**[slug-b]** (\`knowledge/product-[slug-b].md\`):
> "[exact entry text]"

**Why this conflicts:** [one sentence]
**Decision needed:** [specific question for team lead]

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — [decision] -->

---

File header (new files only):

# Conflict Report: [slug-a] vs [slug-b]
> Team lead decision inbox. Mark each conflict resolved once a decision is made.
> Do not add secrets, PII, or credentials.

---

## STEP 4 — Report

After writing, output:
  Files compared: [N]
  Pairs checked: [N]
  Conflicts found: [N]
  Already resolved: [N] (skipped)
  Files written: [N]

If no conflicts: "No contradictions detected across [N] feature knowledge files."
If all resolved: "All [N] previously detected conflicts are resolved. No new contradictions found."`,
        },
    }, null, 2) + '\n';
}
