import type { GovernanceConfig } from '../types.js';

export function generateSpecFirstWorkflow(c: GovernanceConfig): string {
    const scaffoldNote = c.scan.scaffoldTool
        ? ` (generate scaffold with ${c.scan.scaffoldTool} first)`
        : '';

    const hookRef = c.agent === 'kiro' ? 'spec-first-gate.kiro.hook' : 'check-spec-exists.sh';
    const registrationRef = c.agent === 'kiro'
        ? 'the spec-first-gate.kiro.hook is present in .kiro/hooks/'
        : 'the check-spec-exists.sh hook is registered in settings.json';
    const specsRoot = c.agent === 'kiro' ? '.kiro/specs' : 'specs';

    const enforcementNote = c.specFirstEnabled
        ? `> **ABSOLUTE RULE: No feature code may be generated until a spec exists AND is complete.**
> **This is enforced by the ${hookRef}. Do not attempt to work around it.**`
        : `> **Spec-first workflow is available but not yet enforced for this project.**
> **No spec history was found — ${registrationRef}.**
> **To activate: create your first feature spec (\`cp -r ${specsRoot}/_template ${specsRoot}/<feature>\`) and re-run the governance script.**`;

    return `# Spec-First Workflow

${enforcementNote}

## Flow
\`\`\`
1. "create feature <n>"
2. Check: ${specsRoot}/<n>/ exists?
   NO  → cp -r ${specsRoot}/_template ${specsRoot}/<n>
   YES → read existing spec
3. Fill requirements.md — replace ALL placeholders, write user stories, select data source
4. Fill design.md — hard rules compliance, layer mapping, file list
5. Fill tasks.md — phased tasks with size estimates [S/M/L]
6. ── STOP GATE ── Present plan to user, WAIT for explicit confirmation
7. User confirms → begin implementation${scaffoldNote}
8. Implement following tasks.md phase order ONLY
9. Update tasks.md checkboxes as each task completes
\`\`\`

## STOP Gates (you MUST pause at these points)
1. **After spec creation** — show the filled spec to the user and WAIT
2. **After plan presentation** — do NOT start coding until user says "go ahead" or equivalent
3. **After each phase** — report what was completed before moving to next phase

## Spec Complete Enough to Start (ALL must be true)
- [ ] No \`_replace_\` placeholders in requirements.md
- [ ] At least one user story written with Given/When/Then
- [ ] Data source selected (Remote API / Local DB / In-Memory)
- [ ] design.md exists with file list populated
- [ ] design.md hard rules compliance table filled (no empty Yes/No cells)
- [ ] tasks.md exists with at least one task item per phase

## What "Complete" Means
- requirements.md: Every \`_replace_\` is gone. At least one user story has real content (not template text).
- design.md: The file list has actual filenames (not \`<feature>\` placeholders). Compliance table has Yes or No in every cell.
- tasks.md: At least Phase 1 (Setup) and one other phase have task items. Size estimates [S/M/L] are present.

## Common Mistakes
- **Creating spec directory but leaving templates unfilled** — the hook WILL block you
- **Filling requirements.md but skipping design.md** — the hook WILL block you
- **Filling design.md but skipping tasks.md** — the hook WILL block you
- **Writing code in a different directory to avoid the hook** — this violates architecture rules

## Session Continuity
When resuming: read requirements → design → tasks → feature README → first unchecked task.
`;
}
