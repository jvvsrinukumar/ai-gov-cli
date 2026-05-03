import './check-node-version.js';
import { Command } from 'commander';
import { existsSync, readFileSync, appendFileSync } from 'fs';
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
import { detectAgent } from './agents/detect-agent.js';

const VERSION = '17.0.0';
const HOOK_VERSION = '17.0.0';

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
            installGitHookWrappers(projectDir, options.force ?? false, options.dryRun ?? false);
        }
        if (options.ci) {
            generateCIConfig(config, options.ci);
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
            const agent = detectAgent(workspaceDir, options.agent);
            const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
            log.header(`Workspace Upgrade (${agent}) — ${projects.length} project(s)`);
            let upgraded = 0;
            let skipped = 0;
            for (const project of projects) {
                const projectDir = join(workspaceDir, project.relativePath);
                if (!existsSync(join(projectDir, agentDir))) {
                    log.warn(`  Skipping ${project.relativePath} — no ${agentDir}/ (run workspace init first)`);
                    skipped++;
                    continue;
                }
                console.log(`\n  Upgrading ${project.relativePath} [${project.stack}]...`);
                try {
                    runUpgrade({ dir: projectDir, force: options.force, dryRun: options.dryRun });
                    upgraded++;
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    log.warn(`  Failed: ${project.relativePath}: ${msg}`);
                }
            }
            console.log('');
            log.header('Workspace upgrade complete');
            console.log(`  Upgraded: ${upgraded}  Skipped: ${skipped}`);
            console.log('  Next: git add ' + agentDir + '/ && git commit -m "chore: upgrade ai-gov hooks"');
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
            appendFileSync(gi, '\n# AI governance CLI\nai_governance_v14*.sh\n');
        }
    } catch { /* ignore */ }
}
