import { existsSync } from 'fs';
import { join } from 'path';
import type { Agent } from '../types.js';
import { detectAgent } from '../agents/detect-agent.js';
import { runWorkspaceInit, discoverProjects } from './workspace-init.js';
import { runUpgrade } from './upgrade.js';
import { log } from '../utils/logger.js';

export interface WorkspaceCmdOptions {
    dir: string;
    agent?: string;
    dryRun: boolean;
    overwrite: boolean;
    only?: string[];
    upgrade: boolean;
    force: boolean;
}

export function runWorkspaceCmd(options: WorkspaceCmdOptions): void {
    const { dir: workspaceDir, dryRun, overwrite, upgrade, force } = options;

    if (upgrade) {
        const projects = discoverProjects(workspaceDir);
        if (!projects.length) {
            log.error('No projects found in workspace.');
            process.exit(1);
        }
        const wsAgent = detectAgent(workspaceDir, options.agent);
        log.header(`Workspace Upgrade — ${projects.length} project(s)`);
        let upgraded = 0;
        let skipped = 0;
        for (const project of projects) {
            const projectDir = join(workspaceDir, project.relativePath);
            const hasKiro = existsSync(join(projectDir, '.kiro'));
            const hasClaude = existsSync(join(projectDir, '.claude'));
            const projectAgent: Agent | null = options.agent
                ? wsAgent
                : hasKiro ? 'kiro' : hasClaude ? 'claude-code' : null;
            if (!projectAgent) {
                log.warn(`  Skipping ${project.relativePath} — no .kiro/ or .claude/ (run workspace init first)`);
                skipped++;
                continue;
            }
            const agentDir = projectAgent === 'kiro' ? '.kiro' : '.claude';
            console.log(`\n  Upgrading ${project.relativePath} [${project.stack}] (${agentDir})...`);
            try {
                runUpgrade({ dir: projectDir, force, dryRun, agent: projectAgent });
                upgraded++;
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                log.warn(`  Failed: ${project.relativePath}: ${msg}`);
            }
        }
        console.log('');
        log.header('Workspace upgrade complete');
        console.log(`  Upgraded: ${upgraded}  Skipped: ${skipped}`);
        console.log('  Next: git add -A && git commit -m "chore: upgrade ai-gov hooks"');
        console.log('');
        return;
    }

    runWorkspaceInit({
        dir: workspaceDir,
        dryRun,
        overwrite,
        only: options.only,
        agent: detectAgent(workspaceDir, options.agent),
    });
}
