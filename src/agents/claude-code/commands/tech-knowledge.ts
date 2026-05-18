import type { GovernanceConfig } from '../../../types.js';
import { KNOWLEDGE_HTML_CSS } from '../../../utils/knowledge-html-template.js';

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

> Reads the live codebase and writes a committed technical knowledge file.
> Output: \`knowledge/tech-[scope].md\` — committed to git as persistent AI context.
> Cheap to read (small file), expensive to regenerate (full code scan) — regenerate only when code changes significantly.
> All entries tagged [INFERRED] until a human promotes them to [CONFIRMED].

---

## EXECUTION RULES

1. **Read-only on source** — no source files modified. Only the knowledge file is written.
2. **Tag everything [INFERRED]** — nothing is confirmed until a human verifies.
3. **Never invent patterns** — only extract what is observable in code.
4. **Preserve [CONFIRMED] entries** — on re-run, never downgrade or overwrite a [CONFIRMED] entry. Flag drift instead.
5. **"Needs Clarification" is mandatory** — always include, never empty if there are unknowns.
6. **Do not judge** — observe and record. No recommendations, no quality scores.

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

## STEP 2 — Check for Existing File

Before reading any source code, check if \`knowledge/tech-[scope].md\` already exists.

**If it exists:**
- Read the file and extract all entries tagged \`[CONFIRMED]\` — these must be preserved exactly.
- Note the \`Generated:\` line — extract the git hash (the \`[OLD_HASH]\` value after "git:").
- Run: \`git diff --stat [OLD_HASH]..HEAD -- [source paths covered by this scope]\`
- If > 10 files changed OR > 200 lines added/removed in the diff stat → mark "significant drift likely — [N] files changed, [N] lines delta since last generation" in the output.
- If ≤ 10 files changed AND ≤ 200 lines delta → proceed as an incremental update.
- If the hash is the same as HEAD → file is current, proceed as incremental update.

**If it does not exist:** proceed as a first-time extraction.

---

## STEP 3 — Read Source Files

**Project context:**
- Source root: \`${sourceDir}\`
- Features directory: \`${featuresDir}\`
- Layer flow: \`${layerFlow}\`
- Init-detected state: ${detectedState}
- Init-detected DI: ${detectedDI}
- Init-detected HTTP client: ${detectedHTTPClient}
- Init-detected ORM: ${detectedORM}

Run: \`git rev-parse --short HEAD\` to get the current git hash. Store as **[GIT_HASH]**.

Read files relevant to the scope. Start at entry points, trace through layers.
Do NOT read the entire codebase — read enough to map the scope accurately.

---

## STEP 4 — Write Knowledge File

Create the \`knowledge/\` directory if it doesn't exist.

Write \`knowledge/tech-[scope].md\` with this exact structure:

\`\`\`markdown
# Tech Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits to [CONFIRMED] entries are preserved on re-run.

Generated: [today's date] (git: [GIT_HASH])

---

## Layer Map

[layer] → [file/dir] — [role] [INFERRED]
[layer] → [file/dir] — [role] [INFERRED]
...

---

## Layer Flow Diagram

\`\`\`mermaid
graph LR
  A[Entry / Controller] --> B[Service / Use Case]
  B --> C[Repository / Data Access]
  C --> D[(Database / External API)]
\`\`\`
(Replace node labels with actual layer names observed. Add edges for every import or call dependency. Label edges when the relationship type is notable, e.g. "calls", "injects", "reads".)

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

## Drift Detected

*(Only present on re-run when existing [CONFIRMED] entries conflict with current code.)*

- [CONFIRMED entry text] — code now shows [what code shows instead] → REVIEW REQUIRED
...

*(If no drift: omit this section entirely.)*

---

## Needs Clarification

- [thing observed but not understood] [UNKNOWN]
- [architecture decision with no comments explaining why] [UNKNOWN]
- [pattern that seems inconsistent but might be intentional] [UNKNOWN]
...
\`\`\`

**Preservation rule:** If the file previously contained [CONFIRMED] entries, copy them verbatim into the new file. If code now contradicts a [CONFIRMED] entry, add it to "Drift Detected" — do NOT remove or overwrite the [CONFIRMED] entry itself. A human must resolve drift.

---

## STEP 5 — Optional Export

After writing the committed file, ask:

> The knowledge file has been written to \`knowledge/tech-[scope].md\` and is ready to commit.
> Want an additional export? Reply with a format or skip:
>
> - \`html\` — HTML export — requires internet to render Mermaid diagrams (good for sharing)
> - \`skip\` or *(no reply)* — done

**If html requested:** generate an HTML file at \`knowledge/tech-[scope].html\` using the shared page scaffold below.

**Page scaffold** (CSS + wrapper are shared across all knowledge exports):

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tech Knowledge — [scope] | ${stackDisplay}</title>
  <!-- Mermaid loaded from CDN — requires internet to render diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
${KNOWLEDGE_HTML_CSS}
  </style>
</head>
<body>
  <h1>Tech Knowledge — [scope] <span style="color:#6b7280;font-size:.9rem">| ${stackDisplay}</span></h1>
  <div class="meta">
    ⚠ Auto-generated [INFERRED]. Manual edits to [CONFIRMED] entries are preserved on re-run.<br>
    Generated: [today's date] (git: [GIT_HASH])
  </div>
\`\`\`

**Body sections** (specific to tech-knowledge — populate with observed values):

\`\`\`html
  <!-- If drift exists -->
  <div class="drift">
    ⚠ <strong>Drift Detected</strong> — the following [CONFIRMED] entries conflict with current code. Human review required before promoting or removing.<br>
    [drift items]
  </div>

  <h2>Layer Map</h2>
  <div class="layer-map">
    [layer] → [file/dir] — [role] <span class="tag-inferred">[INFERRED]</span><br>
    ...
  </div>

  <h2>Layer Flow Diagram</h2>
  <div class="mermaid">
graph LR
  A[Entry / Controller] --> B[Service / Use Case]
  B --> C[Repository / Data Access]
  C --> D[(Database / External API)]
  </div>

  <h2>Patterns in Use</h2>
  <table>
    <thead><tr><th>Pattern</th><th>Value</th><th>Confidence</th></tr></thead>
    <tbody>
      <!-- one row per pattern -->
    </tbody>
  </table>

  <h2>File Inventory</h2>
  <table>
    <thead><tr><th>File</th><th>Layer</th><th>Lines</th><th>Notes</th></tr></thead>
    <tbody>
      <!-- one row per file -->
    </tbody>
  </table>

  <h2>Conventions</h2>
  <ul>
    <!-- one <li> per convention -->
  </ul>

  <h2>Needs Clarification</h2>
  <ul>
    <!-- one <li> per unknown -->
  </ul>
\`\`\`

**Footer** (shared):

\`\`\`html
  <footer>Generated by /tech-knowledge · ${stackDisplay} · git: [GIT_HASH]</footer>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'neutral' });</script>
</body>
</html>
\`\`\`

Populate every placeholder with actual observed values before writing. HTML export is local only — do not commit it.

---

## STEP 6 — Confirm Output

After writing, report:

\`\`\`
━━━ TECH KNOWLEDGE WRITTEN ━━━

  File:            knowledge/tech-[scope].md
  Git hash:        [GIT_HASH]
  Scope:           [what was mapped]
  Layers mapped:   [N]
  Files read:      [N]
  Unknowns flagged:[N]
  Drift detected:  [N entries — or "none"]
  Export:          [html written to knowledge/tech-[scope].html — or "none"]

  All new entries are [INFERRED]. Commit this file to git.
  Re-run /tech-knowledge when significant code changes occur.
  "Needs Clarification" items require human input — code cannot answer them.
\`\`\`

---

## RULES

- Output goes in \`knowledge/\` at project root — not inside \`.claude/\`
- Create the \`knowledge/\` directory if it doesn't exist
- Commit the \`.md\` file — it is the AI context source for all other commands
- Do NOT commit the \`.html\` export — it is a local sharing artifact only
- Do not read \`.claude/steering/\` as a source of truth — read actual code
- Do not copy from steering files — independently observe and record
- If a pattern was detected at init time but is not observable in code now, note the discrepancy
- Keep the file concise — this is a reference document, not a novel
- [CONFIRMED] entries are human-verified truth — never silently overwrite them
`;
}
