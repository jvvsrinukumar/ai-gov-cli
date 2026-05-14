import './check-node-version.js';
import { Command } from 'commander';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import type { Stack } from './types.js';
import { log } from './utils/logger.js';
import { runOnboard } from './commands/onboard.js';
import { runUpgrade } from './commands/upgrade.js';
import { runUninstall } from './commands/uninstall.js';
import { detectAgent } from './agents/detect-agent.js';
import { VERSION } from './constants.js';
import { getSupportedStackIds, getAdapter } from './stacks/registry.js';
import { runProjectInit } from './commands/project-init.js';
import { runMcpInit, runMcpOnboard, runMcpValidate, runMcpUpdateToken } from './commands/mcp.js';
import { runPRCheck } from './pr-check/index.js';
import { runInitCmd } from './commands/init-cmd.js';
import { runDoctor } from './commands/doctor.js';
import { runWorkspaceCmd } from './commands/workspace-cmd.js';

// Import adapter modules to trigger self-registration (Req 17.3, 17.4)
// Order is deterministic: Flutter, React (Vite SPA), Next.js
for (const mod of [
    './stacks/flutter/adapter.js',
    './stacks/react/adapter.js',
    './stacks/next/adapter.js',
] as const) {
    try {
        await import(mod);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`Failed to load adapter module ${mod}: ${msg}`);
    }
}

const program = new Command();

program
    .name('ai-gov')
    .version(VERSION)
    .description('AI Governance Framework for Claude Code & Kiro');

program
    .command('init')
    .description('Scan project and generate governance files')
    .option('-s, --stack <stack>', 'Specify stack (flutter|kotlin|nodejs|react|next|angular|swiftui|python|java)')
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview changes without writing', false)
    .option('--update-hooks', 'Update only stale hooks', false)
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('--git-hooks', 'Install git pre-commit + commit-msg hooks', false)
    .option('--ci <platform>', 'Generate CI governance check (github|gitlab|bitbucket)')
    .option('--force', 'Force overwrite existing hook system', false)
    .action(async (options) => {
        await runInitCmd({
            dir: options.dir,
            stack: options.stack,
            agent: options.agent,
            overwrite: options.overwrite,
            dryRun: options.dryRun,
            updateHooks: options.updateHooks,
            gitHooks: options.gitHooks,
            ci: options.ci,
            force: options.force,
        });
    });

program
    .command('doctor')
    .description('Diagnose governance setup issues')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .action(async (options) => {
        await runDoctor({ dir: resolve(options.dir), agent: options.agent });
    });

program
    .command('pr-check')
    .description('Run governance check on current branch diff')
    .option('--base <branch>', 'Base branch for diff', 'main')
    .option('--format <format>', 'Output format (terminal|github|gitlab|json)', 'terminal')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .action(async (options) => {
        const result = await runPRCheck(resolve(options.dir), options.base, options.format);
        process.exit(result.hasBlockers ? 1 : 0);
    });

program
    .command('workspace')
    .description('Scan workspace and generate governance for all projects')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .option('--dry-run', 'Preview changes without writing', false)
    .option('--overwrite', 'Overwrite existing governance files', false)
    .option('--only <projects>', 'Comma-separated list of project paths to init')
    .option('--upgrade', 'Upgrade hooks/commands in all existing projects (preserves steering files)', false)
    .option('--force', 'With --upgrade: also overwrite steering files', false)
    .action((options) => {
        const workspaceDir = resolve(options.dir);
        if (!existsSync(workspaceDir)) {
            log.error(`Directory not found: ${workspaceDir}`);
            process.exit(1);
        }
        const only = options.only
            ? (options.only as string).split(',').map((s: string) => s.trim()).filter(Boolean)
            : undefined;
        runWorkspaceCmd({
            dir: workspaceDir,
            agent: options.agent,
            dryRun: options.dryRun,
            overwrite: options.overwrite,
            only,
            upgrade: options.upgrade,
            force: options.force,
        });
    });

program
    .command('onboard')
    .description('New developer setup: installs local git hook wrappers and verifies governance is wired')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .option('--dry-run', 'Preview without writing', false)
    .action((options) => {
        runOnboard({ dir: resolve(options.dir), dryRun: options.dryRun });
    });

program
    .command('upgrade')
    .description('Upgrade hooks, commands, and steering to the current version (preserves steering files)')
    .option('-d, --dir <path>', 'Project directory to upgrade', process.cwd())
    .option('-s, --stack <stack>', 'Override stack detection')
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .option('--force', 'Also overwrite steering files (architecture.md, coding-standards.md, etc.)', false)
    .option('--dry-run', 'Preview what would be upgraded without writing', false)
    .action((options) => {
        runUpgrade({
            dir: resolve(options.dir),
            force: options.force,
            dryRun: options.dryRun,
            stack: options.stack,
            agent: options.agent,
        });
    });

program
    .command('uninstall')
    .description('Remove ai-gov git hooks, CI workflow, or pr-check integration')
    .option('--git-hooks', 'Remove .git/hooks/pre-commit and .git/hooks/commit-msg wrappers', false)
    .option('--ci [platform]', 'Remove CI governance workflow (github|gitlab|bitbucket; auto-detects if omitted)')
    .option('--pr-check', 'Remove pr-check job from CI (auto-detects platform)', false)
    .option('--all', 'Remove git-hooks wrappers + all CI governance files', false)
    .option('--dry-run', 'Preview what would be removed without making changes', false)
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .action((options) => {
        const projectDir = resolve(options.dir);
        if (!existsSync(projectDir)) {
            log.error(`Directory not found: ${projectDir}`);
            process.exit(1);
        }
        const agent = detectAgent(projectDir, options.agent);
        runUninstall({
            projectDir,
            gitHooks: options.gitHooks,
            ci: options.ci,
            prCheck: options.prCheck,
            all: options.all,
            dryRun: options.dryRun,
            agent,
        });
    });

// ─── project command group ───────────────────────────────────────────────────
const projectCmd = program
    .command('project')
    .description('Project scaffolding commands');

projectCmd
    .command('init')
    .description('Scaffold a new project with governance built-in')
    .option('-t, --type <stack>', 'Stack identifier (skip stack selection prompt)')
    .option('-n, --name <name>', 'App name (skip app name prompt, max 214 chars)')
    .option('-y, --yes', 'Skip confirmation summary', false)
    .option('--dry-run', 'Scaffold without applying governance', false)
    .option('-d, --dir <path>', 'Parent directory for the new project', process.cwd())
    .action(async (options) => {
        if (options.type) {
            const supportedIds = getSupportedStackIds();
            if (!supportedIds.includes(options.type as Stack)) {
                log.error(`Invalid stack: "${options.type}". Valid stacks: ${supportedIds.join(', ')}`);
                process.exit(1);
            }
        }

        if (options.name) {
            if (options.name.length > 214) {
                log.error('--name must be 214 characters or fewer.');
                process.exit(1);
            }
            if (options.type) {
                const adapter = getAdapter(options.type as Stack);
                let nameRegex: RegExp;
                if (adapter.id === 'flutter') {
                    nameRegex = /^[a-z][a-z0-9_]*$/;
                } else {
                    nameRegex = /^[a-z][a-z0-9-]*$/;
                }
                if (!nameRegex.test(options.name.trim())) {
                    log.error(`Invalid name "${options.name}" for stack "${adapter.id}". Expected: ${adapter.nameHint}`);
                    process.exit(1);
                }
            }
        }

        if (options.dir) {
            const dirPath = resolve(options.dir);
            if (!existsSync(dirPath)) {
                log.error(`Directory does not exist: ${dirPath}`);
                process.exit(1);
            }
            if (!statSync(dirPath).isDirectory()) {
                log.error(`Path is not a directory: ${dirPath}`);
                process.exit(1);
            }
        }

        try {
            await runProjectInit({
                type: options.type,
                name: options.name,
                yes: options.yes,
                dryRun: options.dryRun,
                dir: options.dir,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error(msg);
            process.exit(1);
        }
    });

// ---------------------------------------------------------------------------
// mcp command group
// ---------------------------------------------------------------------------

const mcp = program
    .command('mcp')
    .description('MCP server governance — configure team tools without committing tokens');

mcp
    .command('init')
    .description('Team lead: select tools, set org vars, write .mcp.json + .env.mcp.example + .envrc')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('--overwrite', 'Overwrite existing .mcp.json', false)
    .option('--dry-run', 'Preview without writing', false)
    .action(async (options) => {
        await runMcpInit({ dir: options.dir, overwrite: options.overwrite, dryRun: options.dryRun });
    });

mcp
    .command('onboard')
    .description('Developer: set personal tokens in global and project env files')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('--dry-run', 'Preview without writing', false)
    .action(async (options) => {
        await runMcpOnboard({ dir: options.dir, dryRun: options.dryRun });
    });

mcp
    .command('validate')
    .description('CI: verify all required tokens are present in the merged environment')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .action(async (options) => {
        await runMcpValidate({ dir: options.dir });
    });

mcp
    .command('update-token')
    .description('Rotate a single tool\'s personal token(s)')
    .requiredOption('--tool <id>', 'Tool identifier (e.g. jira, figma, postgres)')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .action(async (options) => {
        await runMcpUpdateToken({ dir: options.dir, tool: options.tool });
    });

program.parse();
