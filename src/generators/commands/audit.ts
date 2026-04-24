import type { GovernanceConfig } from '../../types.js';

export function generateAuditCommand(c: GovernanceConfig): string {
    const { profile, scan, project } = c;
    const hookVer = c.hookVersion;

    const expectedHooks = [
        'protect-files.sh', 'block-dangerous.sh', 'check-spec-exists.sh',
        'session-continuity.sh', 'format-code.sh', 'analyze-code.sh',
        'check-feature-readme.sh', 'check-consistency.sh', 'check-file-size.sh',
        'post-task-checklist.sh', 'check-secrets.sh',
    ].join(', ');

    const highRisk = scan.highRiskFiles.length
        ? scan.highRiskFiles.slice(0, 8).join(', ')
        : 'none detected';

    const detectedTools = [
        profile.stateFramework && `state: ${profile.stateFramework}`,
        profile.diFramework && profile.diFramework !== 'N/A' && `DI: ${profile.diFramework}`,
        scan.detectedORM && `ORM: ${scan.detectedORM}`,
        scan.detectedTestFramework && `tests: ${scan.detectedTestFramework}`,
        scan.detectedLinter && `linter: ${scan.detectedLinter}`,
        scan.detectedFormatter && `formatter: ${scan.detectedFormatter}`,
        scan.detectedRouter && `router: ${scan.detectedRouter}`,
        scan.detectedAuth && `auth: ${scan.detectedAuth}`,
    ].filter(Boolean).join(' · ') || 'standard';

    return `# /audit — Governance Health Check

> **Project:** ${project.appName}
> **Stack:** ${profile.stackDisplay}
> **Arch:** ${profile.layerFlow}
> **Detected tools:** ${detectedTools}
> **Hook version:** v${hookVer}
> **High-risk files:** ${highRisk}

---

You are performing a governance health audit for this project. Do NOT scan source files deeply. Focus only on the \`.claude/\` directory and the items listed below.

## Step 1 — Read governance files

Read these files and confirm they exist and are non-empty:

- \`.claude/CLAUDE.md\`
- \`.claude/settings.json\`
- \`.claude/steering/constitution.md\`
- \`.claude/steering/architecture.md\`
- \`.claude/steering/coding-standards.md\`
- \`.claude/steering/workflow.md\`

## Step 2 — Check hooks

Verify that \`.claude/hooks/\` contains all expected hooks:

\`\`\`
${expectedHooks}
\`\`\`

For each hook, check:
1. File exists
2. First line contains \`HOOK_VERSION=${hookVer}\` — if not, report it as STALE (needs \`ai-gov init --update-hooks\`)
3. File is not empty (0 bytes)

## Step 3 — Check architecture alignment

The detected architecture is: **${profile.layerFlow}**
Pattern: \`${scan.detectedArchPattern || 'standard'}\`

Read \`.claude/steering/architecture.md\` and confirm:
- The "Layer flow" section matches \`${profile.layerFlow}\`
- The directory structure shown matches the pattern above
- High-risk files listed include: \`${highRisk}\`

If any of these are wrong, flag them as **STALE** — re-run \`ai-gov init --overwrite\` to regenerate.

## Step 4 — Check settings.json hooks registration

Read \`.claude/settings.json\` and confirm all 11 hooks are registered under \`hooks.PreToolUse\`, \`hooks.PostToolUse\`, or \`hooks.Stop\`:

\`\`\`
${expectedHooks}
\`\`\`

If any are missing from the JSON, flag as **MISSING REGISTRATION**.

## Step 5 — Spot-check steering freshness

Read \`.claude/steering/coding-standards.md\` and confirm it mentions:
${scan.detectedORM ? `- **${scan.detectedORM}** (detected ORM)` : '- The data access patterns for this stack'}
${scan.detectedTestFramework ? `- **${scan.detectedTestFramework}** (detected test framework)` : '- Testing patterns'}
${scan.detectedLinter ? `- **${scan.detectedLinter}** (detected linter)` : '- Linting approach'}

If these are missing or wrong, flag as **STALE** — re-run \`ai-gov init --overwrite\`.

## Step 6 — Output audit report

Produce a report in this format:

\`\`\`
GOVERNANCE AUDIT — ${project.appName}
Stack: ${profile.stackDisplay} | Hook version: v${hookVer}
Date: <today>

FILES
  ✓/✗  .claude/CLAUDE.md
  ✓/✗  .claude/settings.json
  ✓/✗  .claude/steering/constitution.md
  ✓/✗  .claude/steering/architecture.md
  ✓/✗  .claude/steering/coding-standards.md
  ✓/✗  .claude/steering/workflow.md

HOOKS  (expected version: v${hookVer})
  ✓/✗/STALE  <hook-name>.sh  [version found or "missing"]
  ... (one line per hook)

ARCHITECTURE
  ✓/✗  Layer flow matches: ${profile.layerFlow}
  ✓/✗  High-risk files present

SETTINGS.JSON
  ✓/✗  All 11 hooks registered

STEERING FRESHNESS
  ✓/✗  coding-standards.md mentions detected tools

VERDICT
  [PASS — governance is current]
  OR
  [ACTION NEEDED — list issues]
    • <issue 1>
    • <issue 2>
  Run: ai-gov init --update-hooks   (for stale hooks only)
  Run: ai-gov init --overwrite      (for stale steering files)
\`\`\`
`;
}
