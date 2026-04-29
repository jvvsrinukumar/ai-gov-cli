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
import { runWorkspaceInit } from './commands/workspace-init.js';

const VERSION = '16.0.0';
const HOOK_VERSION = '16.0.0';

const program = new Command();

program
    .name('ai-gov')
    .version(VERSION)
    .description('AI Governance Framework for Claude Code');

program
    .command('init')
    .description('Scan project and generate governance files')
    .option('-s, --stack <stack>', 'Specify stack (flutter|kotlin|nodejs|react|angular|swiftui|python|java)')
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

        log.header(`AI Governance v${VERSION} (Scan-Adaptive · Claude Code)`);

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

        // Conflict resolution: prompt g/k/o when .claude/ already exists
        let conflictMode: ConflictMode = 'keep';
        const claudeDir = join(projectDir, '.claude');
        if (!options.overwrite && !options.dryRun && !options.updateHooks && existsSync(claudeDir) && isInteractiveTTY()) {
            console.log('');
            console.log('  .claude/ already exists. How should ai-gov handle existing files?');
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
        console.log('    1. Review .claude/CLAUDE.md  2. Commit .claude/ and specs/');
        if (options.updateHooks) console.log('    (hooks-only update — steering files untouched)');
        console.log('');
    });

program
    .command('doctor')
    .description('Diagnose governance setup issues')
    .option('-d, --dir <path>', 'Target directory', process.cwd())
    .action(async (options) => {
        const dir = resolve(options.dir);
        let issues = 0;
        const check = (label: string, ok: boolean) => {
            console.log(`  ${ok ? '✓' : '✗'} ${label}`);
            if (!ok) issues++;
        };

        log.header('AI Governance Doctor');
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

        // Check jq
        const { execSync } = await import('child_process');
        let jqOk = false;
        try { execSync('command -v jq', { stdio: 'pipe' }); jqOk = true; } catch { /* not installed */ }
        check('jq installed (required by hooks)', jqOk);

        console.log('');
        if (issues === 0) log.success('All checks passed!');
        else log.warn(`${issues} issue(s) found. Run 'ai-gov init' to fix.`);
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
    .option('--dry-run', 'Preview changes without writing', false)
    .option('--overwrite', 'Overwrite existing governance files', false)
    .option('--only <projects>', 'Comma-separated list of project paths to init (e.g. backend/corporate_node,frontend/corporate_angular)')
    .action((options) => {
        const workspaceDir = resolve(options.dir);
        if (!existsSync(workspaceDir)) {
            log.error(`Directory not found: ${workspaceDir}`);
            process.exit(1);
        }
        const only = options.only
            ? (options.only as string).split(',').map((s: string) => s.trim()).filter(Boolean)
            : undefined;
        runWorkspaceInit({
            dir: workspaceDir,
            dryRun: options.dryRun,
            overwrite: options.overwrite,
            only,
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
