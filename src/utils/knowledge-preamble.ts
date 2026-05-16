export function generateKnowledgePreambleCommand(): string {
    return `
---

## KNOWLEDGE CONTEXT — Read Before Acting

If \`knowledge/\` exists at the project root:

1. Derive a slug from \`$ARGUMENTS\`: lowercase, spaces → hyphens, empty → \`overview\`
2. Read in this priority order — skip files that don't exist:
   - \`knowledge/tech-[slug].md\` — HOW this area is built
   - \`knowledge/product-[slug].md\` — WHAT this area does
   - \`knowledge/tech-overview.md\` — fallback if no slug match
   - \`knowledge/product-overview.md\` — fallback if no slug match
3. If \`knowledge/\` is absent or no files match: skip silently. Proceed as normal.

**Using knowledge:**
- \`[CONFIRMED]\` entries — human-verified. Trust them.
- \`[INFERRED]\` entries — AI-extracted. Use as starting point; verify against actual code.
- If code contradicts an \`[INFERRED]\` entry, note the discrepancy in your response.

Do not edit the knowledge file — drift detection is a separate concern.

---
`;
}

export function generateKnowledgePreambleHook(): string {
    return `

---

## KNOWLEDGE CONTEXT — Read Before Acting

After getting scope from the user, check knowledge/:
- Slug: lowercase scope, spaces → hyphens. Empty → "overview".
- Read if they exist: knowledge/tech-[slug].md, knowledge/product-[slug].md
- Fallbacks: knowledge/tech-overview.md, knowledge/product-overview.md
- [CONFIRMED]: trust. [INFERRED]: use as starting point, verify against code.
- If knowledge/ doesn't exist: skip silently, proceed with workflow.

---`;
}
