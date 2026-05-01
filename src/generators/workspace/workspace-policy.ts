export function generateWorkspacePolicy(workspaceName: string): string {
    return `# Workspace AI Usage Policy — ${workspaceName}

## Scope
This policy applies to ALL projects in this workspace.
Each project may extend it with project-specific rules in their own \`steering/ai-usage-policy.md\`.

## General Rules

### Before Starting Any Task
1. Identify the project you are working in
2. Read the project's \`.claude/CLAUDE.md\`
3. Read the project's \`steering/architecture.md\`
4. Confirm a ticket/issue exists for the work

### New Feature Rules
1. Spec must exist: \`specs/<feature>/\` with \`requirements.md\`, \`design.md\`, \`tasks.md\`
2. State full implementation plan — every file, layer, dependencies
3. Wait for developer confirmation before writing code
4. Do not touch files in other projects unless the task explicitly requires it

### Bug Fix Rules
1. Identify root cause before writing any fix
2. Minimal change — fix only what is broken
3. Do not refactor surrounding code
4. If fix requires changes in more than one project — STOP and confirm with developer

### Cross-Project Changes
- Any change that modifies an API contract between projects requires explicit developer approval
- Document the contract change in \`steering/cross-project-rules.md\`
- Both affected projects must be updated in the same task

## Forbidden Actions (all projects)
1. Never add or remove packages without approval
2. Never force-push or rewrite git history
3. Never delete or rename files without confirming they are unused
4. Never commit secrets, credentials, or \`.env\` files
5. Never make changes that span projects without explicit instruction

## PR Checklist (per project)
- [ ] Claude Code was used
- [ ] Change type: Feature / Edit Feature / Bug Fix / Refactor / Hotfix
- [ ] Only files within the target project were modified (or cross-project change was approved)
- [ ] Tests written or reason for skipping documented
- [ ] Developer reviewed all AI-generated code
`;
}
