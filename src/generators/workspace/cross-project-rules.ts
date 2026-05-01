import type { WorkspaceConfig } from './types.js';

export function generateCrossProjectRules(config: WorkspaceConfig): string {
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
