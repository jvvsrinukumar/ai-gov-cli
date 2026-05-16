import type { GovernanceConfig } from '../../../types.js';

export function generateTechKnowledgeCommand(c: GovernanceConfig): string {
    const { profile, scan } = c;
    const stackDisplay = profile.stackDisplay;
    const sourceDir = profile.sourceDir || 'src/';
    const featuresDir = profile.featuresDir || sourceDir;
    const layerFlow = profile.layerFlow;

    const detectedState = scan.detectedState || profile.stateFramework || 'not detected';
    const detectedDI = scan.detectedDI || profile.diFramework || 'not detected';
    const detectedHTTPClient = scan.detectedHTTPClient || 'not detected';
    const detectedORM = scan.detectedORM || 'not detected';

    return `# /tech-knowledge — Extract Technical Knowledge (Read-Only)

**Stack:** ${stackDisplay}

> Reads the codebase and writes a persistent technical knowledge document.
> Output: \`knowledge/tech-[scope].md\` — committed to git as project reference.
> All entries tagged [INFERRED] until a human promotes them to [CONFIRMED].

---

## EXECUTION RULES

1. **Read-only** — no source files modified. Only output is the knowledge file.
2. **Tag everything [INFERRED]** — nothing is confirmed until a human verifies.
3. **Never invent patterns** — only extract what is observable in code.
4. **"Needs Clarification" is mandatory** — always include, never empty if there are unknowns.
5. **Do not judge** — observe and record. No recommendations, no quality scores.

---

## STEP 1 — Determine Scope

Scope comes from \`$ARGUMENTS\`:

| Input | Scope | Output file |
|-------|-------|-------------|
| *(empty)* | Whole-project overview | \`knowledge/tech-overview.md\` |
| \`auth\` | One feature, all layers | \`knowledge/tech-auth.md\` |
| \`services\` | One layer across features | \`knowledge/tech-services.md\` |
| \`state\` | One pattern/concern | \`knowledge/tech-state.md\` |

**Slugification:** lowercase, spaces → hyphens. "user auth" → \`knowledge/tech-user-auth.md\`.

If scope is empty: read entry points + one representative feature to map the whole project.
If scope names a feature: read all layers of that feature.
If scope names a layer or pattern: read that concern across the codebase.

---

## STEP 2 — Read Files

**Project context:**
- Source root: \`${sourceDir}\`
- Features directory: \`${featuresDir}\`
- Layer flow: \`${layerFlow}\`
- Init-detected state: ${detectedState}
- Init-detected DI: ${detectedDI}
- Init-detected HTTP client: ${detectedHTTPClient}
- Init-detected ORM: ${detectedORM}

Read files relevant to the scope. Start at entry points, trace through layers.
Do NOT read the entire codebase — read enough to map the scope accurately.

---

## STEP 3 — Write Knowledge File

Create the \`knowledge/\` directory if it doesn't exist.

Write the output file with this exact structure:

\`\`\`markdown
# Tech Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: [today's date]

---

## Layer Map

[layer] → [file/dir] — [role] [INFERRED]
[layer] → [file/dir] — [role] [INFERRED]
...

---

## Patterns in Use

| Pattern | Value | Confidence |
|---------|-------|------------|
| HTTP client | [observed or "not found"] | [INFERRED] |
| State management | [observed or "N/A"] | [INFERRED] |
| Data access | [ORM/driver/raw] | [INFERRED] |
| DI | [framework or "none"] | [INFERRED] |
| Naming (files) | [convention observed] | [INFERRED] |
| Naming (classes) | [convention observed] | [INFERRED] |
| Error handling | [pattern observed] | [INFERRED] |

---

## File Inventory

| File | Layer | Lines | Notes |
|------|-------|-------|-------|
| [path] | [layer] | [N] | [brief note] |
...

---

## Conventions

- [naming convention observed] [INFERRED]
- [import style observed] [INFERRED]
- [folder structure pattern] [INFERRED]
- [test file placement] [INFERRED]
...

---

## Needs Clarification

- [thing observed but not understood] [UNKNOWN]
- [architecture decision with no comments explaining why] [UNKNOWN]
- [pattern that seems inconsistent but might be intentional] [UNKNOWN]
...
\`\`\`

---

## STEP 4 — Confirm Output

After writing the file, report:

\`\`\`
━━━ TECH KNOWLEDGE WRITTEN ━━━

  File: knowledge/tech-[scope].md
  Scope: [what was mapped]
  Layers mapped: [N]
  Files inventoried: [N]
  Unknowns flagged: [N]

  All entries are [INFERRED]. Review and promote to [CONFIRMED] as needed.
  "Needs Clarification" items require human input — code cannot answer them.
\`\`\`

---

## RULES

- Output goes in \`knowledge/\` at project root — not inside \`.claude/\`
- Create the \`knowledge/\` directory if it doesn't exist
- If the output file already exists, overwrite it (knowledge is regenerated, not appended)
- Do not read \`.claude/steering/\` as a source of truth — read actual code
- Do not copy from steering files — independently observe and record
- If a pattern was detected at init time but is not observable in code now, note the discrepancy
- Keep the file concise — this is a reference document, not a novel
`;
}
