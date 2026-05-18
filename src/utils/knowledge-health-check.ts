export function generateKnowledgeHealthCheck(): string {
  return `
---

## KNOWLEDGE HEALTH CHECK

If \`knowledge/\` exists at the project root:

1. List all files in \`knowledge/\`
2. For each knowledge file, read its \`Generated:\` line and extract the git hash (\`[OLD_HASH]\`).
   Run: \`git diff --stat [OLD_HASH]..HEAD -- [source paths the file covers]\`
   If > 10 files changed or > 200 lines added/removed → flag the file as "significant drift likely."
3. For each entry tagged \`[CONFIRMED]\` or \`[INFERRED]\`:
   - Identify the claim (a flow, object, pattern, permission, state, or convention)
   - Use the file's slug to narrow which code to read (e.g. \`knowledge/tech-auth.md\` → read auth-related code)
   - Find the corresponding code and compare
4. Classify each entry:
   - **Current** — code matches the entry. No action needed.
   - **[STALE]** — code contradicts the entry (the thing changed or was removed)
   - **[UNVERIFIABLE]** — no code found to verify the entry (may have been deleted or moved)

Report this section:

\`\`\`
━━━ KNOWLEDGE HEALTH ━━━

  Files checked:    [N]
  Entries checked:  [N]
  Drift summary:    [N] file(s) with significant drift (>10 files or >200 lines changed since generation)

  ✓ Current:        [N]
  ⚠ Stale:          [N]
  ? Unverifiable:   [N]

  Stale entries (require action):
    [file] → "[entry summary]" — [reason: what in the code contradicts it]
    [file] → "[entry summary]" — [reason]

  Unverifiable entries (require human review):
    [file] → "[entry summary]" — [reason: no traceable code found]

  Recommended action:
    Run /tech-knowledge or /product-knowledge to regenerate stale files from current code.
    Or manually update the knowledge file and promote accurate entries to [CONFIRMED].
\`\`\`

If all entries are current:
\`\`\`
━━━ KNOWLEDGE HEALTH ━━━

  Files checked: [N] · Entries checked: [N]
  ✓ All [N] knowledge entries verified against current code.
\`\`\`

If \`knowledge/\` doesn't exist or is empty:
\`\`\`
━━━ KNOWLEDGE HEALTH ━━━

  No knowledge/ directory found — skipping health check.
  Run /tech-knowledge or /product-knowledge to initialize.
\`\`\`

**Rules:**
- Do NOT write to or modify any knowledge file. Report only.
- [STALE] is higher urgency than [UNVERIFIABLE] — stale entries are actively wrong.
- [UNVERIFIABLE] may still be correct — it just can't be traced to current code. Requires human judgment.
- Use the file slug to scope code reading — do not read the entire codebase for every entry.
- Use \`git diff --stat\` with the file's generation hash for numeric drift assessment — do not guess.

---
`;
}
