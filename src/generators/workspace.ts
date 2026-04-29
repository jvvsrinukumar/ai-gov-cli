import { join } from 'path';
import type { WriteOptions } from '../utils/safe-write.js';
import { safeWrite } from '../utils/safe-write.js';
import { log } from '../utils/logger.js';

export interface WorkspaceProject {
    name: string;
    relativePath: string;   // e.g. "backend/corporate_node"
    stack: string;
    group: string;          // e.g. "backend", "frontend", "" for flat
}

export interface WorkspaceConfig {
    workspaceName: string;
    workspaceDir: string;
    projects: WorkspaceProject[];
    dryRun: boolean;
    overwrite: boolean;
}

export function generateWorkspaceFiles(config: WorkspaceConfig, opts: WriteOptions): void {
    const { workspaceDir, workspaceName, projects } = config;

    log.section('Workspace root:');
    safeWrite(join(workspaceDir, 'CLAUDE.md'), generateWorkspaceRootRedirect(), opts);
    safeWrite(join(workspaceDir, '.claude', 'CLAUDE.md'), generateWorkspaceMasterClaudeMd(config), opts);

    log.section('Workspace steering:');
    safeWrite(
        join(workspaceDir, '.claude', 'steering', 'workspace-policy.md'),
        generateWorkspacePolicy(workspaceName),
        opts,
    );
    safeWrite(
        join(workspaceDir, '.claude', 'steering', 'cross-project-rules.md'),
        generateCrossProjectRules(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, '.claude', 'steering', 'project-registry.md'),
        generateProjectRegistry(config),
        opts,
    );

    log.detected(`Workspace governance written for: ${workspaceName}`);
}

function generateWorkspaceRootRedirect(): string {
    return `# CLAUDE.md — Redirect

> **Workspace-level rules are in \`.claude/CLAUDE.md\`. Each project has its own \`.claude/CLAUDE.md\`.**
`;
}

function generateWorkspaceMasterClaudeMd(config: WorkspaceConfig): string {
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

function generateWorkspacePolicy(workspaceName: string): string {
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

function generateCrossProjectRules(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const projectRows = projects
        .map(p => `| \`${p.relativePath}\` | ${p.stack} | _describe_ | _list APIs_ |`)
        .join('\n');

    return `# Cross-Project Rules — ${workspaceName}

## Project Boundaries

Each project is an independent unit. Direct source-level imports between projects are forbidden.
Communication between projects must happen through defined interfaces only.

## Project API Contracts

| Project | Stack | Exposes | Consumes |
|---------|-------|---------|----------|
${projectRows}

> Fill in the "Exposes" and "Consumes" columns to document actual API contracts.

## Dependency Rules

1. **No cross-source imports** — never \`import\` from another project's \`src/\` directory
2. **API-only communication** — backend/frontend communication via REST, GraphQL, or message queue only
3. **Shared types** — if types are shared across projects, extract them to a dedicated shared lib
4. **Versioning** — breaking API changes must be versioned; do not silently break consumers

## Shared Resources

| Resource | Owner project | Consumers |
|----------|--------------|-----------|
| _e.g. Auth API_ | _backend/accushield-kiosk-apis_ | _frontend/corporate_angular_ |

> Document actual shared resources above.

## Change Impact Matrix

When modifying a project, check this table for downstream impact:

| If you change... | Also check... |
|-----------------|--------------|
| _API endpoint_ | _consuming frontend project_ |
| _Shared type/contract_ | _all consuming projects_ |
| _Auth flow_ | _all projects using auth_ |

> Fill in actual dependencies as the workspace evolves.
`;
}

function generateProjectRegistry(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const rows = projects
        .map(p => `| \`${p.relativePath}\` | ${p.stack} | ${p.group || 'root'} | _describe_ |`)
        .join('\n');

    const stackSummary = [...new Set(projects.map(p => p.stack))].join(', ');

    return `# Project Registry — ${workspaceName}

**Total projects:** ${projects.length}
**Stacks:** ${stackSummary}

## Registry

| Path | Stack | Group | Description |
|------|-------|-------|-------------|
${rows}

> Fill in the "Description" column for each project.

## Governance Status

| Path | .claude/ | specs/ | hooks | CI |
|------|:--------:|:------:|:-----:|:--:|
${projects.map(p => `| \`${p.relativePath}\` | ✓ | ✓ | ✓ | — |`).join('\n')}

> Update the CI column once CI governance checks are configured per project.
`;
}
