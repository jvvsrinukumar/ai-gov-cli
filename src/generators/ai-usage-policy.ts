import type { GovernanceConfig } from '../types.js';

export function generateAIUsagePolicy(c: GovernanceConfig): string {
    const analyzeLine = c.profile.analyzeCmd
        ? `\n- Run analysis: \`${c.profile.analyzeCmd}\``
        : '';
    const agentName = c.agent === 'kiro' ? 'Kiro' : 'Claude Code';
    const specFolder = c.agent === 'kiro' ? '.kiro/specs/<feature>/' : 'specs/<feature>/';

    return `# AI Usage Policy — ${c.project.appName}

## Prerequisites
- A ${c.project.ticketSystem} ticket must exist
- For new features: spec folder \`${specFolder}\` must exist
- Read architecture.md and coding-standards.md before every task

## New Feature Rules
1. Spec must exist and be complete
2. State full plan — every file, layer, dependencies
3. Wait for developer confirmation
4. Follow \`${c.profile.layerFlow}\`
5. Tests required for ${c.blocks.testLayerList}

## Bug Fix Rules
1. Identify root cause before writing fix
2. **Minimal change** — fix only what is broken
3. Do not refactor surrounding code
4. Confirm fix does not break related functionality

## Forbidden Actions
1. **Never** add or remove packages without approval
2. **Never** modify high-risk files without understanding full impact:
${c.blocks.highRiskDisplay}
3. **Never** force-push or rewrite git history
4. **Never** delete/rename files without confirming they are unused
5. **Never** modify files outside task scope

## Testing Policy
- New features: tests for ${c.blocks.testLayerList} — no exceptions
- Bug fixes: regression test recommended; if skipped, flag as risk
- Run tests: \`${c.profile.testCmd}\`${analyzeLine}

## PR Checklist
- [ ] ${agentName} was used
- [ ] Change type: Feature / Edit Feature / Bug Fix / Refactor / Hotfix
- [ ] Files created/modified listed
- [ ] Architecture compliance confirmed
- [ ] Tests written (or reason explained)
- [ ] Developer reviewed all AI-generated code
`;
}
