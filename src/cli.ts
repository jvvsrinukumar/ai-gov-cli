import './check-node-version.js';
import { Command } from 'commander';
import { existsSync, readFileSync, appendFileSync, statSync } from 'fs';
import { join, resolve, basename } from 'path';
import type { Stack, GovernanceConfig, ConflictMode } from './types.js';
import { createDefaultScanResult } from './types.js';
import { detectStack } from './detect-stack.js';
import { loadBaseProfile } from './profiles.js';
import { scanProject, checkSpecFirstEnabled } from './scanners/index.js';
import { isInteractiveTTY, readTTYLine } from './utils/tty.js';
import { computeContentBlocks, isJavaBackend as isJavaBackendCheck } from './content-blocks.js';
import { runGovernance } from './generators/index.js';
import { log } from './utils/logger.js';
import { generateGitHooks } from './generators/git-hooks/index.js';
import { installGitHookWrappers } from './commands/init-git-hooks.js';
import { generateCIConfig } from './commands/init-ci.js';
import { runPRCheck } from './pr-check/index.js';
import { runWorkspaceInit, discoverProjects } from './commands/workspace-init.js';
import { runUpgrade } from './commands/upgrade.js';
import { runOnboard } from './commands/onboard.js';
import { runUninstall } from './commands/uninstall.js';
import { detectAgent } from './agents/detect-agent.js';
import { readHubConfig } from './utils/hub-config.js';
import { VERSION, HOOK_VERSION } from './constants.js';
import { getSupportedStackIds, getAdapter } from './stacks/registry.js';
import { runProjectInit } from './commands/project-init.js';
import { runMcpInit, runMcpOnboard, runMcpValidate, runMcpUpdateToken } from './commands/mcp.js';

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
    .option('-s, --stack <stack>', 'Specify stack (flutter|kotlin|nodejs|react|angular|swiftui|python|java)')
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview changes without writing', false)
    .option('--update-hooks', 'Update only stale hooks', false)
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('--git-hooks', 'Install git pre-commit + commit-msg hooks', false)
    .option('--ci <platform>', 'Generate CI governance check (github|gitlab|bitbucket)')
    .option('--force', 'Force overwrite existing hook system', false)
    .action(async (options) => {
        const projectDir = resolve(options.dir);
        if (!existsSync(projectDir)) {
            log.error(`Directory not found: ${projectDir}`);
            process.exit(1);
        }

        log.header(`AI Governance v${VERSION} (Scan-Adaptive)`);

        const agent = detectAgent(projectDir, options.agent);
        const agentDir = agent === 'kiro' ? '.kiro' : '.claude';

        // Add script to .gitignore
        if (!options.dryRun) {
            addToGitignore(projectDir);
        }

        const stack = detectStack(projectDir, options.stack);
        const profile = loadBaseProfile(stack);
        const scan = createDefaultScanResult();

        scanProject(stack, projectDir, profile, scan);
        const specFirstEnabled = checkSpecFirstEnabled(projectDir);

        const project = collectProjectInfo(stack, projectDir);
        const isBackend = stack === 'nodejs' || stack === 'python'
            || (stack === 'java' && isJavaBackendCheck(scan));
        const blocks = computeContentBlocks(stack, profile, scan);

        // Conflict resolution: prompt g/k/o when agent dir already exists
        let conflictMode: ConflictMode = 'keep';
        const existingDir = join(projectDir, agentDir);
        if (!options.overwrite && !options.dryRun && !options.updateHooks && existsSync(existingDir) && isInteractiveTTY()) {
            console.log('');
            console.log(`  ${agentDir}/ already exists. How should ai-gov handle existing files?`);
            console.log('');
            console.log('  g  Generate — create new files, ask permission for each changed file  [default]');
            console.log('  k  Keep    — create new files only, leave all existing untouched');
            console.log('  o  Overwrite — replace all files with the latest generated version');
            console.log('');
            let choice = '';
            while (!['g', 'k', 'o'].includes(choice)) {
                process.stdout.write('  Choice [G/k/o] (Enter = g): ');
                choice = readTTYLine().toLowerCase();
                if (choice === '') choice = 'g';  // bare Enter = default
                if (!['g', 'k', 'o'].includes(choice)) {
                    console.log('  Please enter g, k, or o.');
                }
            }
            if (choice === 'o') {
                conflictMode = 'overwrite';
                options.overwrite = true;
            } else if (choice === 'k') {
                conflictMode = 'keep';
            } else {
                conflictMode = 'ask';  // 'g' or default
            }
            console.log('');
        }

        const config: GovernanceConfig = {
            agent,
            stack, profile, scan, project, blocks, isBackend,
            hookVersion: HOOK_VERSION, projectDir, specFirstEnabled,
            conflictMode,
            overwrite: options.overwrite, dryRun: options.dryRun,
            updateHooks: options.updateHooks,
        };

        try {
            runGovernance(config);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`\n  Error: ${msg}`);
            console.error('  Run with DEBUG=1 for stack trace.');
            if (process.env.DEBUG) console.error(err);
            process.exit(1);
        }

        if (options.gitHooks) {
            generateGitHooks(config, projectDir);
            installGitHookWrappers(projectDir, options.force ?? false, options.dryRun ?? false, agent);
        }
        if (options.ci) {
            generateCIConfig(config, options.ci);
        }

        // Transparency disclosure and gitignore management
        if (!options.dryRun) {
            addUsageLogsToGitignore(projectDir);
            displayTransparencyDisclosure(projectDir);
        }

        // Summary
        console.log('');
        log.header(`Done! — ${project.appName} (${profile.stackDisplay})`);
        console.log(`  Stack:      ${profile.stackDisplay}`);
        console.log(`  Flow:       ${profile.layerFlow}`);
        console.log(`  State:      ${profile.stateFramework}`);
        console.log(`  DI:         ${profile.diFramework}`);
        if (scan.detectedORM) console.log(`  ORM:        ${scan.detectedORM}`);
        if (scan.detectedRouter) console.log(`  Router:     ${scan.detectedRouter}`);
        if (scan.detectedTestFramework) console.log(`  Tests:      ${scan.detectedTestFramework}`);
        if (scan.detectedSubtype) console.log(`  Framework:  ${scan.detectedSubtype}`);
        if (scan.detectedAuth) console.log(`  Auth:       ${scan.detectedAuth}`);
        if (scan.detectedCSSApproach) console.log(`  CSS:        ${scan.detectedCSSApproach}`);
        if (scan.detectedMonorepo) console.log(`  Monorepo:   ${scan.detectedMonorepo}`);
        if (scan.detectedJavaVersion) console.log(`  Java:       ${scan.detectedJavaVersion}${scan.detectedPreviewFeatures ? ' (preview features)' : ''}`);
        if (scan.detectedBuildSystem) console.log(`  Build:      ${scan.detectedBuildSystem}`);
        if (scan.detectedOSGi) console.log(`  OSGi:       detected`);
        if (scan.detectedLombok) console.log(`  Lombok:     detected`);
        console.log('');
        console.log('  Next steps:');
        if (agent === 'kiro') {
            console.log('    1. Review .kiro/steering/  2. Commit .kiro/ and .kiro/specs/');
        } else {
            console.log('    1. Review .claude/CLAUDE.md  2. Commit .claude/ and specs/');
        }
        if (options.updateHooks) console.log('    (hooks-only update — steering files untouched)');
        console.log('');
    });

program
    .command('doctor')
    .description('Diagnose governance setup issues')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .option('-a, --agent <agent>', 'Target agent (claude-code|kiro)')
    .action(async (options) => {
        const dir = resolve(options.dir);
        const agent = detectAgent(dir, options.agent);
        let issues = 0;
        const check = (label: string, ok: boolean) => {
            console.log(`  ${ok ? '✓' : '✗'} ${label}`);
            if (!ok) issues++;
        };

        log.header(`AI Governance Doctor (${agent})`);

        if (agent === 'kiro') {
            // Kiro-specific checks
            check('.kiro/steering/ exists', existsSync(join(dir, '.kiro', 'steering')));
            check('.kiro/hooks/ exists', existsSync(join(dir, '.kiro', 'hooks')));

            const steeringFiles = ['constitution.md', 'architecture.md', 'coding-standards.md',
                'ai-usage-policy.md', 'workflow.md', 'spec-first-workflow.md',
                'feature-readme.md', 'prompt-templates.md'];
            for (const f of steeringFiles) {
                check(`  steering/${f}`, existsSync(join(dir, '.kiro', 'steering', f)));
            }

            // Validate steering files have front-matter
            for (const f of steeringFiles) {
                const fp = join(dir, '.kiro', 'steering', f);
                if (existsSync(fp)) {
                    const content = readFileSync(fp, 'utf-8');
                    check(`  ${f} has front-matter`, content.startsWith('---\n'));
                }
            }

            const hooksDir = join(dir, '.kiro', 'hooks');
            if (existsSync(hooksDir)) {
                const hookFiles = ['block-dangerous-commands.json', 'protect-files.json',
                    'check-secrets.json', 'check-file-size.json', 'check-feature-readme.json',
                    'check-consistency.json', 'session-continuity.json', 'require-task-type.json',
                    'post-task-checklist.json'];
                for (const h of hookFiles) {
                    const hp = join(hooksDir, h);
                    const exists = existsSync(hp);
                    check(`  hooks/${h}`, exists);
                    if (exists) {
                        try {
                            const json = JSON.parse(readFileSync(hp, 'utf-8'));
                            check(`  ${h} valid JSON schema`, !!(json.name && json.version && json.when && json.then));
                        } catch {
                            check(`  ${h} valid JSON`, false);
                        }
                    }
                }
            }

            // Kiro spec templates
            check('.kiro/specs/_template/requirements.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'requirements.md')));
            check('.kiro/specs/_template/design.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'design.md')));
            check('.kiro/specs/_template/tasks.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'tasks.md')));
        } else {
            // Claude Code checks (existing behavior)
            check('CLAUDE.md exists', existsSync(join(dir, 'CLAUDE.md')));
            check('.claude/CLAUDE.md exists', existsSync(join(dir, '.claude', 'CLAUDE.md')));
            check('.claude/settings.json exists', existsSync(join(dir, '.claude', 'settings.json')));
            check('specs/_template/ exists', existsSync(join(dir, 'specs', '_template')));
            check('.claude/hooks/ exists', existsSync(join(dir, '.claude', 'hooks')));

            const hooksDir = join(dir, '.claude', 'hooks');
            if (existsSync(hooksDir)) {
                const hooks = ['protect-files.sh', 'check-secrets.sh', 'block-dangerous-commands.sh', 'check-spec-exists.sh',
                    'session-continuity.sh', 'format-code.sh', 'analyze-code.sh',
                    'check-feature-readme.sh', 'check-consistency.sh', 'check-file-size.sh', 'post-task-checklist.sh'];
                for (const h of hooks) {
                    check(`  ${h}`, existsSync(join(hooksDir, h)));
                }
            }
        }

        // Check JSON runtime — hooks need jq OR python3 (python3 preferred)
        const { execSync } = await import('child_process');
        let python3Ok = false;
        let jqOk = false;
        try { execSync('command -v python3', { stdio: 'pipe' }); python3Ok = true; } catch { /* not installed */ }
        try { execSync('command -v jq', { stdio: 'pipe' }); jqOk = true; } catch { /* not installed */ }
        check('python3 installed (required for hooks — preferred)', python3Ok);
        if (!python3Ok) check('jq installed (fallback if python3 missing)', jqOk);

        if (!python3Ok && !jqOk) {
            console.log('');
            console.log('  CRITICAL: Neither python3 nor jq is installed.');
            console.log('  All governance hooks will silently skip — nothing is enforced.');
            console.log('');
            console.log('  Fix:  brew install python3   (macOS)');
            console.log('        apt install python3    (Ubuntu/Debian)');
            console.log('        winget install Python  (Windows)');
            issues++;
        }

        // Validate git-hooks config.json schema (agent-aware path)
        const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
        const configPath = join(dir, agentDir, 'git-hooks', 'config.json');
        if (existsSync(configPath)) {
            const configIssues = validateGitHooksConfig(configPath);
            if (configIssues.length === 0) {
                check(`${agentDir}/git-hooks/config.json valid`, true);
            } else {
                check(`${agentDir}/git-hooks/config.json valid`, false);
                for (const issue of configIssues) {
                    console.log(`     ⚠  ${issue}`);
                }
                issues++;
            }
        }

        // Check git hook wrappers
        const gitHooksDir = join(dir, '.git', 'hooks');
        if (existsSync(join(dir, '.git'))) {
            check('.git/hooks/pre-commit wrapper installed', existsSync(join(gitHooksDir, 'pre-commit')));
            check('.git/hooks/commit-msg wrapper installed', existsSync(join(gitHooksDir, 'commit-msg')));
        }

        console.log('');
        if (issues === 0) log.success('All checks passed!');
        else log.warn(`${issues} issue(s) found. Run 'ai-gov init' to fix.`);
        if (!python3Ok && !jqOk) process.exit(1);
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
    .option('--only <projects>', 'Comma-separated list of project paths to init (e.g. backend/corporate_node,frontend/corporate_angular)')
    .option('--upgrade', 'Upgrade hooks/commands in all existing projects (preserves steering files)', false)
    .option('--force', 'With --upgrade: also overwrite steering files', false)
    .action((options) => {
        const workspaceDir = resolve(options.dir);
        if (!existsSync(workspaceDir)) {
            log.error(`Directory not found: ${workspaceDir}`);
            process.exit(1);
        }

        if (options.upgrade) {
            // Upgrade mode: run ai-gov upgrade on every project that has governance
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
                // Detect agent per-project so mixed-agent workspaces work correctly
                const hasKiro = existsSync(join(projectDir, '.kiro'));
                const hasClaude = existsSync(join(projectDir, '.claude'));
                const projectAgent = options.agent
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
                    runUpgrade({ dir: projectDir, force: options.force, dryRun: options.dryRun, agent: projectAgent });
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

        const only = options.only
            ? (options.only as string).split(',').map((s: string) => s.trim()).filter(Boolean)
            : undefined;
        runWorkspaceInit({
            dir: workspaceDir,
            dryRun: options.dryRun,
            overwrite: options.overwrite,
            only,
            agent: detectAgent(workspaceDir, options.agent),
        });
    });

program
    .command('onboard')
    .description('New developer setup: installs local git hook wrappers and verifies governance is wired')
    .option('-d, --dir <path>', 'Project directory', process.cwd())
    .action((options) => {
        runOnboard({ dir: resolve(options.dir) });
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
        // Validate --type against registered stack identifiers (Req 15.7)
        if (options.type) {
            const supportedIds = getSupportedStackIds();
            if (!supportedIds.includes(options.type as Stack)) {
                log.error(`Invalid stack: "${options.type}". Valid stacks: ${supportedIds.join(', ')}`);
                process.exit(1);
            }
        }

        // Validate --name max length and naming convention (Req 15.3, 15.8)
        if (options.name) {
            if (options.name.length > 214) {
                log.error('--name must be 214 characters or fewer.');
                process.exit(1);
            }

            // If --type is provided, validate name against adapter's naming convention
            if (options.type) {
                const adapter = getAdapter(options.type as Stack);
                // Determine naming regex based on adapter id
                let nameRegex: RegExp;
                if (adapter.id === 'flutter') {
                    nameRegex = /^[a-z][a-z0-9_]*$/;
                } else {
                    // react, next, and default: kebab-case
                    nameRegex = /^[a-z][a-z0-9-]*$/;
                }
                if (!nameRegex.test(options.name.trim())) {
                    log.error(`Invalid name "${options.name}" for stack "${adapter.id}". Expected: ${adapter.nameHint}`);
                    process.exit(1);
                }
            }
        }

        // Validate --dir exists and is a directory (Req 15.9)
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
    .action(async (options) => {
        await runMcpInit({ dir: options.dir, overwrite: options.overwrite });
    });

mcp
    .command('onboard')
    .description('Developer: set personal tokens in global and project env files')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .action(async (options) => {
        await runMcpOnboard({ dir: options.dir });
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

function collectProjectInfo(stack: Stack, projectDir: string) {
    const dn = basename(projectDir);
    let packageName = '';
    switch (stack) {
        case 'flutter': {
            const pub = join(projectDir, 'pubspec.yaml');
            if (existsSync(pub)) {
                const m = readFileSync(pub, 'utf-8').match(/^name:\s*(.+)/m);
                if (m) packageName = m[1].trim();
            }
            break;
        }
        case 'swiftui': {
            const pkg = join(projectDir, 'Package.swift');
            if (existsSync(pkg)) {
                const m = readFileSync(pkg, 'utf-8').match(/name:\s*"([^"]+)"/);
                if (m) packageName = m[1];
            }
            break;
        }
        case 'python': {
            const pyp = join(projectDir, 'pyproject.toml');
            if (existsSync(pyp)) {
                const m = readFileSync(pyp, 'utf-8').match(/^name\s*=\s*"([^"]+)"/m);
                if (m) packageName = m[1];
            }
            break;
        }
        case 'java': {
            // Maven: read <artifactId> or <name> from pom.xml
            const pom = join(projectDir, 'pom.xml');
            if (existsSync(pom)) {
                const content = readFileSync(pom, 'utf-8');
                const nameMatch = content.match(/<name>([^<]+)<\/name>/);
                const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
                packageName = nameMatch?.[1]?.trim() || artifactMatch?.[1]?.trim() || '';
            }
            // Gradle fallback: read settings.gradle
            if (!packageName) {
                const settingsFile = existsSync(join(projectDir, 'settings.gradle.kts'))
                    ? join(projectDir, 'settings.gradle.kts')
                    : join(projectDir, 'settings.gradle');
                if (existsSync(settingsFile)) {
                    const m = readFileSync(settingsFile, 'utf-8').match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
                    if (m) packageName = m[1];
                }
            }
            break;
        }
        default: {
            packageName = pkgNameSync(projectDir);
            break;
        }
    }
    packageName = packageName || dn;
    return {
        packageName,
        appName: packageName,
        appDescription: '',
        ticketSystem: 'Jira',
        ticketPrefix: 'TICKET',
        legacyDescription: 'No legacy code',
    };
}

function pkgNameSync(projectDir: string): string {
    const candidates = [join(projectDir, 'package.json'), join(projectDir, 'src', 'package.json')];
    for (const f of candidates) {
        if (existsSync(f)) {
            const m = readFileSync(f, 'utf-8').match(/"name"\s*:\s*"([^"]+)"/);
            if (m) return m[1];
        }
    }
    return '';
}

// ---------------------------------------------------------------------------
// config.json schema validator (used by doctor)
// ---------------------------------------------------------------------------

function validateGitHooksConfig(configPath: string): string[] {
    const issues: string[] = [];
    let cfg: Record<string, unknown>;
    try {
        cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    } catch {
        return ['config.json is not valid JSON — fix syntax errors'];
    }

    const preCommit = cfg['pre-commit'];
    if (preCommit !== undefined && typeof preCommit !== 'object') {
        issues.push('"pre-commit" must be an object');
        return issues;
    }
    const pc = (preCommit ?? {}) as Record<string, unknown>;

    const checks = ['file-size', 'secrets', 'no-todos', 'no-debug', 'format-check', 'lint-check'];
    for (const name of checks) {
        const section = pc[name];
        if (section === undefined) continue;
        if (typeof section !== 'object' || section === null) {
            issues.push(`pre-commit.${name} must be an object`);
            continue;
        }
        const s = section as Record<string, unknown>;
        if ('enabled' in s && typeof s.enabled !== 'boolean') {
            issues.push(`pre-commit.${name}.enabled must be true or false (got ${JSON.stringify(s.enabled)})`);
        }
        if (name === 'file-size' && 'max-lines' in s && typeof s['max-lines'] !== 'number') {
            issues.push(`pre-commit.file-size.max-lines must be a number (got ${JSON.stringify(s['max-lines'])})`);
        }
    }

    const commitMsg = cfg['commit-msg'];
    if (commitMsg !== undefined) {
        if (typeof commitMsg !== 'object' || commitMsg === null) {
            issues.push('"commit-msg" must be an object');
        } else {
            const cm = commitMsg as Record<string, unknown>;
            if ('conventional-commits' in cm && typeof cm['conventional-commits'] !== 'boolean') {
                issues.push('commit-msg.conventional-commits must be true or false');
            }
            if ('require-ticket-ref' in cm && typeof cm['require-ticket-ref'] !== 'boolean') {
                issues.push('commit-msg.require-ticket-ref must be true or false');
            }
            if ('min-description-length' in cm && typeof cm['min-description-length'] !== 'number') {
                issues.push('commit-msg.min-description-length must be a number');
            }
        }
    }

    return issues;
}

function addToGitignore(projectDir: string): void {
    const gi = join(projectDir, '.gitignore');
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gi) && !existsSync(gitDir)) return;
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('ai-gov')) {
            appendFileSync(gi, '\n# AI governance CLI\nonboard.sh\n');
        }
    } catch { /* ignore */ }
}

function addUsageLogsToGitignore(projectDir: string): void {
    const gi = join(projectDir, '.gitignore');
    const gitDir = join(projectDir, '.git');
    // Skip if no .gitignore and no .git directory
    if (!existsSync(gi) && !existsSync(gitDir)) return;
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('.ai-gov/usage-logs/')) {
            appendFileSync(gi, '\n# AI governance usage logs (local telemetry)\n.ai-gov/usage-logs/\n');
        }
    } catch { /* ignore */ }
}

function displayTransparencyDisclosure(projectDir: string): void {
    const hubConfig = readHubConfig(projectDir);
    if (!hubConfig || !hubConfig.hub) return;

    console.log('');
    log.section('  Hub Telemetry Disclosure');
    console.log('');
    console.log(`  Hub URL: ${hubConfig.hub}`);
    console.log('');
    console.log('  Data reported on git push:');
    console.log('    • Commit count');
    console.log('    • Compliance percentage');
    console.log('    • Violation counts');
    console.log('');
    console.log('  Privacy:');
    console.log('    • No source code or commit messages are sent');
    console.log('    • Developer emails are hashed (SHA-256) before transmission');
    console.log('');
    console.log('  To disable telemetry:');
    console.log('    export AI_GOV_TELEMETRY=off');
    console.log('');
}
