import type { GovernanceConfig } from '../../../types.js';

export function generateDetectConflictsCommand(c: GovernanceConfig): string {
    const stackDisplay = c.profile.stackDisplay;

    return `# /detect-conflicts — Cross-Feature Conflict Detection

**Stack:** ${stackDisplay}

> Reads all \`knowledge/product-*.md\` files and surfaces contradicting business rules across features.
> Output: \`knowledge/conflicts/\` — the team lead decision inbox.
> Resolved conflicts (marked \`[x]\`) are not re-raised on subsequent runs.

---

## EXECUTION RULES

1. **Read-only on source code** — only writes to \`knowledge/conflicts/\`.
2. **Conservative threshold** — only flag clear contradictions, not differences in detail level.
3. **No duplicates** — check existing conflict files before writing. Do not re-raise resolved entries.
4. **Product knowledge only** — only \`knowledge/product-*.md\` files are analyzed. Tech knowledge files are not compared.

---

## STEP 1 — Determine Scope

From \`$ARGUMENTS\`:

| Input | Scope |
|-------|-------|
| *(empty)* | Compare all \`knowledge/product-*.md\` files |
| \`auth payments\` | Compare only \`knowledge/product-auth.md\` and \`knowledge/product-payments.md\` |
| *(single feature)* | Stop: "Conflict detection requires at least two features." |

If \`knowledge/\` doesn't exist or fewer than 2 \`product-*.md\` files exist:
> "No cross-feature conflicts possible — fewer than 2 features documented in knowledge/."

Stop.

---

## STEP 2 — Read Knowledge Files

Read all in-scope \`knowledge/product-*.md\` files in full.

---

## STEP 3 — Detect Conflicts

For each pair of files, check four conflict types. Be conservative — only flag clear contradictions:

**Permission conflicts**
Same role in both files, contradicting access to the same resource.
- ✓ Flag: "Guest can view products" vs "Guests cannot view products without login"
- ✗ Skip: "Admin can delete users" vs "Admin can export reports" (different resources)

**Domain object conflicts**
Same entity named in both files with contradicting fields or business meaning.
- ✓ Flag: \`Order.status = [pending/shipped/delivered]\` vs \`Order.status = [draft/active/completed]\`
- ✗ Skip: Both reference Order but describe different sub-concerns (fields vs. lifecycle)

**Business state conflicts**
Same enum or state machine, different values or transitions.
- ✓ Flag: PaymentStatus includes REFUNDED in one file, does not exist in another
- ✗ Skip: Files reference different state machines entirely

**Flow assumption conflicts**
Flow A assumes a precondition that Flow B directly contradicts.
- ✓ Flag: Flow A: "User must verify email before checkout" / Flow B: "Guest checkout requires no email"
- ✗ Skip: Different flows for different user types with no overlap

---

## STEP 4 — Write Conflict Files

Create \`knowledge/conflicts/\` if it doesn't exist.

For each conflict pair, filename: \`knowledge/conflicts/[slug-a]-vs-[slug-b].md\` (alphabetical order).

**Before writing, check existing file:**
- If conflict entry already exists marked \`[x] Resolved\`: skip that entry
- If conflict entry exists unresolved: leave it (do not duplicate)
- If conflict is new: append to file (or create if file doesn't exist)

**Conflict entry format:**

\`\`\`markdown
---

## [Type] Conflict — [short description]

**[slug-a]** (\`knowledge/product-[slug-a].md\`):
> "[exact entry text from file]"

**[slug-b]** (\`knowledge/product-[slug-b].md\`):
> "[exact entry text from file]"

**Why this conflicts:** [one sentence]

**Decision needed:** [specific question for the team lead to answer]

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — [decision made] -->
\`\`\`

**Conflict file header (when creating a new file):**

\`\`\`markdown
# Conflict Report: [slug-a] vs [slug-b]

> Team lead decision inbox. Mark each conflict resolved once a decision is made.
> Do not add secrets, PII, or credentials.
\`\`\`

---

## STEP 5 — Confirm Output

\`\`\`
━━━ CONFLICT DETECTION COMPLETE ━━━

  Files compared:    [N]
  Pairs checked:     [N]
  Conflicts found:   [N]
  Already resolved:  [N] (skipped)

  Files written:     [N]
  [List each written file]

  Action required: Review knowledge/conflicts/ and resolve each open conflict.
  Conflicts marked [x] Resolved will not be re-raised on next run.
\`\`\`

If no conflicts found:
> "No contradictions detected across [N] feature knowledge files."

If all previously detected conflicts are resolved:
> "All [N] previously detected conflicts are resolved. No new contradictions found."

---

## RULES

- Output goes in \`knowledge/conflicts/\` — not in the main \`knowledge/\` root
- Create the directory if it doesn't exist
- Alphabetical slug order in filenames so the same pair always produces the same filename
- When in doubt, skip — only flag clear contradictions
- Two files covering different aspects of the same entity is NOT a conflict
- Different detail levels are NOT conflicts
- Do not modify \`knowledge/product-*.md\` files — only write to \`knowledge/conflicts/\`
`;
}
