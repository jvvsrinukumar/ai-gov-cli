import type { WorkspaceConfig, WorkspaceProject } from '../types.js';
import { backendProjects } from '../commands/helpers.js';

function frontendProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
    return projects.filter(p =>
        p.group === 'frontend' ||
        p.stack === 'react' || p.stack === 'angular'
    );
}

function mobileProjects(projects: WorkspaceProject[]): WorkspaceProject[] {
    return projects.filter(p =>
        p.group === 'mobile' ||
        p.stack === 'flutter' || p.stack === 'kotlin' || p.stack === 'swiftui'
    );
}

export function generateCrossProjectSpecCheck(config: WorkspaceConfig): string {
    const { projects, hookVersion } = config;

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);
    const mobiles = mobileProjects(projects);

    // Build keyword lists for scope detection
    const backendKeywords = [
        'api', 'endpoint', 'route', 'controller', 'service', 'repository',
        'database', 'migration', 'schema', 'model', 'middleware', 'auth',
        'server', 'rest', 'graphql', 'grpc', 'backend', 'query', 'mutation',
        ...backends.map(p => p.name.toLowerCase()),
    ];

    const frontendKeywords = [
        'page', 'screen', 'component', 'widget', 'view', 'form', 'modal',
        'dialog', 'button', 'input', 'layout', 'navigation', 'route',
        'ui', 'ux', 'frontend', 'style', 'css', 'theme', 'responsive',
        ...frontends.map(p => p.name.toLowerCase()),
        ...mobiles.map(p => p.name.toLowerCase()),
    ];

    const backendPattern = backendKeywords.join('|');
    const frontendPattern = frontendKeywords.join('|');

    const backendPaths = backends.map(p => p.relativePath).join(', ');
    const frontendPaths = [...frontends, ...mobiles].map(p => p.relativePath).join(', ');

    return `#!/usr/bin/env bash
# cross-project-spec-check.sh
# HOOK_VERSION=${hookVersion}
#
# Fires on every prompt (promptSubmit). Reads the user's message,
# analyzes which projects are involved, and routes to the correct
# governance level:
#   - Backend only → backend project governance
#   - Frontend only → frontend project governance
#   - Both → workspace-level cross-project governance
#
# This hook reads .claude/steering/workspace-overview.md for project context.

INPUT=$(cat)

# Extract the user message
MSG=$(echo "$INPUT" | sed -n 's/.*"message"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' 2>/dev/null)
if [ -z "$MSG" ]; then
    MSG=$(echo "$INPUT" | sed -n 's/.*"prompt"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' 2>/dev/null)
fi
[ -z "$MSG" ] && exit 0

# Lowercase for matching
MSG_LOWER=$(echo "$MSG" | tr '[:upper:]' '[:lower:]')

# Skip short messages, continuations, and non-task prompts
WORD_COUNT=$(echo "$MSG" | wc -w | tr -d ' ')
[ "$WORD_COUNT" -lt 4 ] && exit 0

# Skip continuation words
echo "$MSG_LOWER" | grep -qiE '^(ok|okay|yes|no|go ahead|proceed|approved|looks good|lgtm|done|continue|all|develop|phase [0-9]|start phase|spec only|next|good|perfect|cancel|stop|thanks|resume|backend|frontend)$' && exit 0

# Skip if already using a slash command
echo "$MSG" | grep -qE '^/' && exit 0

# Detect backend scope
BACKEND=0
if echo "$MSG_LOWER" | grep -qiE '\\b(${backendPattern})\\b'; then
    BACKEND=1
fi

# Detect frontend scope
FRONTEND=0
if echo "$MSG_LOWER" | grep -qiE '\\b(${frontendPattern})\\b'; then
    FRONTEND=1
fi

# Route based on scope
if [ "$BACKEND" -eq 1 ] && [ "$FRONTEND" -eq 1 ]; then
    # Cross-project — both backend and frontend mentioned
    cat <<'CROSS_EOF'
{
  "additionalContext": "CROSS-PROJECT SCOPE DETECTED: This task spans multiple projects.\\n\\nProjects involved:\\n  Backend: ${backendPaths}\\n  Frontend: ${frontendPaths}\\n\\nUsing workspace-level cross-project governance:\\n  - Spec goes in: specs/<feature>/ at the workspace root\\n  - ONE unified spec covers both projects (not separate specs)\\n  - requirements.md has a unified requirements table tagged by project\\n  - design.md has per-project file lists + a shared API contract section\\n  - tasks.md is phased: Phase 1 (API contract) → Phase 2 (backend) → Phase 3 (frontend)\\n  - Implementation follows dependency order: finish backend first, then frontend\\n\\nUse the workspace-level /new-feature or /explore command.\\nRead .claude/steering/cross-project-rules.md for existing API contracts."
}
CROSS_EOF
    exit 0

elif [ "$BACKEND" -eq 1 ]; then
    # Backend only
    cat <<'BACK_EOF'
{
  "additionalContext": "SCOPE: This task involves backend only.\\nUsing backend-level governance.\\nProject(s): ${backendPaths}\\nSpec goes in: <backend-project>/specs/<feature>/\\nUse the backend project's own /new-feature or /explore command."
}
BACK_EOF
    exit 0

elif [ "$FRONTEND" -eq 1 ]; then
    # Frontend only
    cat <<'FRONT_EOF'
{
  "additionalContext": "SCOPE: This task involves frontend only.\\nUsing frontend-level governance.\\nProject(s): ${frontendPaths}\\nSpec goes in: <frontend-project>/specs/<feature>/\\nUse the frontend project's own /new-feature or /explore command."
}
FRONT_EOF
    exit 0
fi

# No clear scope detected — let it through without routing
exit 0
`;
}

export function generateWorkspaceOverview(config: WorkspaceConfig): string {
    const { workspaceName, projects } = config;

    const backends = backendProjects(projects);
    const frontends = frontendProjects(projects);
    const mobiles = mobileProjects(projects);

    let sections = '';

    if (backends.length) {
        sections += `\n## Backend Projects\n`;
        for (const p of backends) {
            sections += `- \`${p.relativePath}\` — ${p.stack} — _describe what this project does_\n`;
        }
    }

    if (frontends.length) {
        sections += `\n## Frontend Projects\n`;
        for (const p of frontends) {
            sections += `- \`${p.relativePath}\` — ${p.stack} — _describe what this project does_\n`;
        }
    }

    if (mobiles.length) {
        sections += `\n## Mobile Projects\n`;
        for (const p of mobiles) {
            sections += `- \`${p.relativePath}\` — ${p.stack} — _describe what this project does_\n`;
        }
    }

    const ungrouped = projects.filter(p =>
        !backends.includes(p) && !frontends.includes(p) && !mobiles.includes(p)
    );
    if (ungrouped.length) {
        sections += `\n## Other Projects\n`;
        for (const p of ungrouped) {
            sections += `- \`${p.relativePath}\` — ${p.stack} — _describe what this project does_\n`;
        }
    }

    return `# Workspace Overview — ${workspaceName}

> This file is read by the \`cross-project-spec-check\` hook to understand
> the workspace layout and route tasks to the correct governance level.
> Keep it accurate — it determines whether Claude Code uses project-level or
> workspace-level governance for each task.

**Total projects:** ${projects.length}
${sections}
## Cross-Project Features

> List features that span multiple projects. Each should have a unified spec
> at \`specs/<feature>/\` at the workspace root.

| Feature | Backend project | Frontend project | Spec exists? |
|---------|----------------|-----------------|:------------:|
| _e.g. user-auth_ | _backend/api_ | _frontend/web_ | ✓ / ✗ |

## Communication Patterns

> How do projects communicate? This helps Claude Code understand the API contract layer.

| From | To | Method | Base URL |
|------|----|--------|----------|
| _frontend_ | _backend_ | REST / GraphQL | _/api/v1_ |
`;
}
