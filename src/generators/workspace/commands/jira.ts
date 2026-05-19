/**
 * Workspace-level /jira command.
 *
 * Scans Jira-syncable specs across:
 *   - the workspace root spec dir (cross-project specs)
 *   - every registered project's spec dir
 *
 * Reuses `buildJiraSyncPrompt` with workspace-aware `specPaths`. A single
 * Jira story can then map to sub-tasks created from multiple specs (one
 * cross-project + N per-project) without the developer running `/jira`
 * separately in each project.
 */
import type { WorkspaceConfig } from '../types.js';

import { buildJiraSyncPrompt } from '../../jira-sync-prompt.js';

export function generateWorkspaceJiraCommand(config: WorkspaceConfig): string {
    const { workspaceName, projects, agent } = config;
    const isKiro = agent === 'kiro';

    // Workspace-level specs (cross-project) live at the workspace root.
    const workspaceSpecRoot = isKiro ? '.kiro/specs/' : 'specs/';

    // Each project carries its own specs. Both spec roots are scanned regardless
    // of project agent so a Claude workspace over Kiro projects still works.
    const perProjectSpecs = projects.flatMap(p => [
        `${p.relativePath}/specs/`,
        `${p.relativePath}/.kiro/specs/`,
    ]);

    const specPaths = [workspaceSpecRoot, ...perProjectSpecs];

    const scopeLabel = `workspace \`${workspaceName}\` — ${projects.length} project(s) + workspace-root specs`;

    const intro = `# /jira — Workspace Jira Sync

> **Workspace:** ${workspaceName}
> **Projects:** ${projects.length} (${projects.map(p => `\`${p.relativePath}\``).join(', ')})
> **Spec roots scanned:** workspace root + every project

This command syncs **any** spec in the workspace — cross-project specs that
live at the workspace root *and* per-project specs in each registered project
— to a single Jira story (with one set of sub-tasks per spec).

If a cross-project feature has both a workspace-level spec and per-project
specs, run this command once: it discovers them all and lets you select which
ones to sync to which story ticket.

`;

    return intro + buildJiraSyncPrompt({ specPaths, scopeLabel });
}
