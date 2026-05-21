import type { GovernanceConfig } from '../../../types.js';

export function generateHooksReadme(c: GovernanceConfig): string {
    const s = c.scan;

    let fmtStatus = 'Auto-format after edits';
    let analyzeStatus = 'Run linter/analyzer';
    if (!s.detectedFormatter) fmtStatus = 'No-op (no formatter configured)';
    if (!c.profile.analyzeCmd) analyzeStatus = 'No-op (no linter configured)';

    const totalCount = c.specFirstEnabled
        ? '8 scripts / 8 registrations (all use `bash` prefix for Windows compatibility)'
        : '8 scripts / 7 registrations (check-spec-exists.sh generated but not registered — spec-first opt-in)';

    const specRow = c.specFirstEnabled
        ? `| \`check-spec-exists.sh\` | PreToolUse Edit\\|Write\\|Bash | Yes | Block without spec + tasks.md + spec freshness |`
        : `| \`check-spec-exists.sh\` | — (not registered) | — | Spec-first not active: no spec history found. To enable: create \`specs/<feature>/\` and re-run governance script |`;

    return `# Hooks — ${c.project.appName}

**Hook Version:** ${c.hookVersion}
Total: ${totalCount}

| Hook | Trigger | Blocks? | Purpose |
|------|---------|:-------:|---------|
| \`protect-files.sh\` | PreToolUse Edit\\|Write\\|Bash | Warn only | Warn on high-risk file edits |
| \`check-secrets.sh\` | PreToolUse Edit\\|Write\\|Bash | Yes | Block AWS keys, API tokens, passwords in source |
| \`session-continuity.sh\` | PreToolUse Edit\\|Write\\|Bash | No | Remind to resume from last task |
| \`block-dangerous-commands.sh\` | PreToolUse Edit\\|Write\\|Bash | Yes | Block force push, rm -rf, pkg install |
${specRow}
| \`format-code.sh\` | PostToolUse Edit\\|Write | No | ${fmtStatus} |
| \`analyze-code.sh\` | Stop | No | ${analyzeStatus} |
| \`post-task-checklist.sh\` | Stop | No | End-of-task reminder |

## Windows Compatibility
All hook commands in settings.json use \`bash "script.sh"\` prefix instead of direct \`.sh\` execution.
This works on macOS, Linux, Windows Git Bash, and WSL2. No \`chmod +x\` required.

## v13/v14 Enhancements
- **Spec freshness** — \`check-spec-exists.sh\` warns when code >24h newer than spec or file count drifts from design.md
- **Hook versioning** — Each hook has \`# HOOK_VERSION=X.Y.Z\`. Run \`--update-hooks\` to update stale hooks only
- **Custom hooks** — Add to \`.claude/custom-hooks.json\` (never overwritten). Merged into \`settings.json\` on each run
- **Governance commands** — 5 slash commands generated in \`.claude/commands/\`: \`/new-feature\` (plan mode + 3-gate spec), \`/edit-feature\`, \`/fix\`, \`/refactor\`, \`/hotfix\`

## Exit Codes
- \`exit 0\` — allow
- \`exit 2\` — block (PreToolUse only)
- JSON \`additionalContext\` — pass but feed warning to Claude

## Adding a Custom Hook
1. Create \`.claude/hooks/<n>.sh\` and \`chmod +x\`
2. Add entry to \`.claude/custom-hooks.json\` (survives re-runs)
3. Re-run governance script to merge into settings.json

## Updating Hooks
\`\`\`bash
./ai_governance_v14.sh --update-hooks   # only stale hooks (version mismatch)
./ai_governance_v14.sh --overwrite       # overwrites everything
./ai_governance_v14.sh --dry-run         # shows diff of what would change
\`\`\`
`;
}
