import type { WorkspaceConfig } from './types.js';

export function generateProjectRegistry(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;
    const agentDir = config.agent === 'kiro' ? '.kiro/' : '.claude/';

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

| Path | ${agentDir} | specs/ | hooks | CI |
|------|:--------:|:------:|:-----:|:--:|
${projects.map(p => `| \`${p.relativePath}\` | ✓ | ✓ | ✓ | — |`).join('\n')}

> Update the CI column once CI governance checks are configured per project.
`;
}
