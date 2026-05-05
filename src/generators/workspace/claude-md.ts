import type { WorkspaceConfig } from './types.js';

export function generateWorkspaceRootRedirect(): string {
    return `# CLAUDE.md — Redirect

> **Workspace-level rules are in \`.claude/CLAUDE.md\`. Each project has its own \`.claude/CLAUDE.md\`.**
`;
}

export function generateWorkspaceMasterClaudeMd(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const groups = [...new Set(projects.map(p => p.group).filter(Boolean))];
    const flat = projects.filter(p => !p.group);

    let projectList = '';
    if (groups.length) {
        for (const group of groups) {
            const inGroup = projects.filter(p => p.group === group);
            projectList += `\n### ${group}/\n`;
            for (const p of inGroup) {
                projectList += `- \`${p.relativePath}\` — ${p.stack}\n`;
            }
        }
    }
    if (flat.length) {
        projectList += `\n### Projects\n`;
        for (const p of flat) {
            projectList += `- \`${p.relativePath}\` — ${p.stack}\n`;
        }
    }

    return `# CLAUDE.md — Workspace Rules

> **You are Claude Code working in the ${workspaceName} workspace.**
> **These rules apply to ALL projects. Each project also has its own \`.claude/CLAUDE.md\`.**
> **Always read the project-level \`.claude/CLAUDE.md\` before working in a project.**

## Workspace: ${workspaceName}

## Projects in this workspace
${projectList}
---

## When Working in This Workspace

### 1. Identify which project you are in
Before any task, state: "I am working in \`<project-path>\`."

### 2. Read the project-level rules first
Each project has its own \`.claude/CLAUDE.md\` with stack-specific rules, commands, and architecture.
Do NOT apply one project's rules to another.

### 3. Read workspace steering files
| File | When to read |
|------|-------------|
| \`steering/workspace-policy.md\` | Before every task |
| \`steering/cross-project-rules.md\` | When a task touches multiple projects |
| \`steering/project-registry.md\` | When you need to understand project relationships |

---

## Cross-Project Rules (summary)

- **Never** import directly from another project's source files
- **Never** copy code between projects — extract to a shared lib if reuse is needed
- **API contracts** between projects must be documented in \`steering/cross-project-rules.md\`
- **Dependency changes** in one project must not silently break another
- **Secrets** — each project manages its own \`.env\`; never share secrets across projects

---

## Forbidden Across All Projects

1. Never force-push or rewrite shared git history
2. Never delete files without confirming they are unused
3. Never modify files outside the current task scope
4. Never add packages without developer approval
`;
}
