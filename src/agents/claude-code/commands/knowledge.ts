import type { GovernanceConfig } from '../../../types.js';

export function generateKnowledgeCommand(c: GovernanceConfig): string {
    const { profile } = c;
    const stackDisplay = profile.stackDisplay;

    return `# /knowledge — View Knowledge Base (Read-Only)

**Stack:** ${stackDisplay}

> Reads and displays committed knowledge files for this project.
> Zero writes. Zero code scanning. Fast — reads small committed files only.
> Available to everyone: team lead and developers.

---

## WHAT THIS COMMAND DOES

Reads \`knowledge/tech-[slug].md\` and \`knowledge/product-[slug].md\` files
that have been committed to git by the team lead.

Does NOT:
- Scan source code
- Create or update any files
- Run any shell commands (except \`ls\` to list files)

---

## STEP 1 — Determine Scope

Scope comes from \`$ARGUMENTS\`:

| Input | What is shown |
|-------|--------------|
| *(empty)* | List all available knowledge files, then show overview files |
| \`auth\` | Show \`knowledge/tech-auth.md\` + \`knowledge/product-auth.md\` |
| \`tech\` | Show all \`knowledge/tech-*.md\` files |
| \`product\` | Show all \`knowledge/product-*.md\` files |
| \`all\` | Show every file in \`knowledge/\` |

**Slugification:** lowercase, spaces → hyphens. "user auth" → look for \`tech-user-auth.md\`.

---

## STEP 2 — Check for Knowledge Files

Check if the \`knowledge/\` directory exists at the project root.

**If it does not exist:**

\`\`\`
━━━ NO KNOWLEDGE BASE FOUND ━━━

  The knowledge/ directory does not exist in this project.

  This means the team lead has not yet generated knowledge files.

  Team lead: run /tech-knowledge and /product-knowledge, then commit and push.
  Developer: ask your team lead to generate and push knowledge files.
\`\`\`

Stop here. Do not create any files.

**If it exists but no .md files match the scope:**

\`\`\`
━━━ NO FILES FOUND FOR SCOPE: [scope] ━━━

  Available knowledge files:
    [list all .md files in knowledge/]

  Try /knowledge [different-slug] or /knowledge all to see everything.
\`\`\`

---

## STEP 3 — Display Knowledge

For each matching file, read and display its full contents exactly as stored.

Format each file as:

\`\`\`
━━━ [filename] ━━━

[file contents — verbatim]

\`\`\`

Show files in this order: tech files first, then product files.

---

## STEP 4 — Summary Line

After displaying all files, output one summary line:

\`\`\`
━━━ CONTEXT LOADED ━━━
  Files shown: [N] ([list of filenames])
  [CONFIRMED] entries are human-verified. [INFERRED] entries are AI-extracted — verify before relying on them.
  Stale? Team lead re-runs /tech-knowledge or /product-knowledge when code changes significantly.
\`\`\`

---

## RULES

- Read-only — never write or modify any file
- Never scan source code — only read files in \`knowledge/\`
- Never create knowledge files — that is \`/tech-knowledge\` and \`/product-knowledge\`
- If knowledge/ does not exist: tell the developer to ask the team lead
- [CONFIRMED] entries are human-verified truth — state them with confidence
- [INFERRED] entries are AI-extracted — flag them as unverified when acting on them
`;
}
