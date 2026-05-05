import { join } from 'path';
import type { WriteOptions } from '../utils/safe-write.js';
import { safeWrite } from '../utils/safe-write.js';
import { log } from '../utils/logger.js';
import { generateWorkspaceRootRedirect, generateWorkspaceMasterClaudeMd } from './workspace/claude-md.js';
import { generateWorkspacePolicy } from './workspace/workspace-policy.js';
import { generateCrossProjectRules } from './workspace/cross-project-rules.js';
import { generateProjectRegistry } from './workspace/project-registry.js';
import { generateWorkspaceAuditCommand } from './workspace/commands/audit.js';
import { generateWorkspaceNewFeatureCommand } from './workspace/commands/new-feature.js';
import { generateWorkspaceExploreCommand } from './workspace/commands/explore.js';
import { generateWorkspaceFixCommand } from './workspace/commands/fix.js';
import { generateWorkspaceRefactorCommand } from './workspace/commands/refactor.js';
import { generateWorkspaceHotfixCommand } from './workspace/commands/hotfix.js';
import { generateWorkspaceEditFeatureCommand } from './workspace/commands/edit-feature.js';
import { generateCrossProjectSpecCheck, generateWorkspaceOverview } from './workspace/hooks/cross-project-spec-check.js';
import { generateWorkspaceSpecTemplates } from './workspace/spec-templates.js';

import type { WorkspaceConfig } from './workspace/types.js';
export type { WorkspaceProject, WorkspaceConfig } from './workspace/types.js';

export function generateWorkspaceFiles(config: WorkspaceConfig, opts: WriteOptions): void {
    const { workspaceDir, workspaceName } = config;
    const agent = config.agent ?? 'claude-code';
    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';

    if (agent === 'kiro') {
        // Kiro workspace: steering files only (no CLAUDE.md, no commands, no bash hooks)
        log.section('Workspace steering:');
        safeWrite(
            join(workspaceDir, agentDir, 'steering', 'workspace-policy.md'),
            generateWorkspacePolicy(workspaceName, agent),
            opts,
        );
        safeWrite(
            join(workspaceDir, agentDir, 'steering', 'cross-project-rules.md'),
            generateCrossProjectRules(config),
            opts,
        );
        safeWrite(
            join(workspaceDir, agentDir, 'steering', 'project-registry.md'),
            generateProjectRegistry(config),
            opts,
        );

        log.section('Workspace overview:');
        safeWrite(
            join(workspaceDir, agentDir, 'steering', 'workspace-overview.md'),
            generateWorkspaceOverview(config),
            opts,
        );

        log.section('Workspace spec templates:');
        generateWorkspaceSpecTemplates(config, opts);

        log.detected(`Workspace governance written for: ${workspaceName}`);
        return;
    }

    // Claude Code workspace: full output
    log.section('Workspace root:');
    safeWrite(join(workspaceDir, 'CLAUDE.md'), generateWorkspaceRootRedirect(), opts);
    safeWrite(join(workspaceDir, agentDir, 'CLAUDE.md'), generateWorkspaceMasterClaudeMd(config), opts);

    log.section('Workspace steering:');
    safeWrite(
        join(workspaceDir, agentDir, 'steering', 'workspace-policy.md'),
        generateWorkspacePolicy(workspaceName, agent),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'steering', 'cross-project-rules.md'),
        generateCrossProjectRules(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'steering', 'project-registry.md'),
        generateProjectRegistry(config),
        opts,
    );

    log.section('Workspace commands:');
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'audit.md'),
        generateWorkspaceAuditCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'new-feature.md'),
        generateWorkspaceNewFeatureCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'edit-feature.md'),
        generateWorkspaceEditFeatureCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'explore.md'),
        generateWorkspaceExploreCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'fix.md'),
        generateWorkspaceFixCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'refactor.md'),
        generateWorkspaceRefactorCommand(config),
        opts,
    );
    safeWrite(
        join(workspaceDir, agentDir, 'commands', 'hotfix.md'),
        generateWorkspaceHotfixCommand(config),
        opts,
    );

    log.section('Workspace hooks:');
    safeWrite(
        join(workspaceDir, agentDir, 'hooks', 'cross-project-spec-check.sh'),
        generateCrossProjectSpecCheck(config),
        opts,
    );

    log.section('Workspace overview:');
    safeWrite(
        join(workspaceDir, agentDir, 'steering', 'workspace-overview.md'),
        generateWorkspaceOverview(config),
        opts,
    );

    log.section('Workspace spec templates:');
    generateWorkspaceSpecTemplates(config, opts);

    log.detected(`Workspace governance written for: ${workspaceName}`);
}

