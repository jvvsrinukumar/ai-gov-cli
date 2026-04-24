import { Command } from 'commander';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join, resolve, basename } from 'path';
import type { Stack, GovernanceConfig, ConflictMode } from './types.js';
import { createDefaultScanResult } from './types.js';
import { detectStack } from './detect-stack.js';
import { loadBaseProfile } from './profiles.js';
import { scanProject, checkSpecFirstEnabled } from './scanners/index.js';
import { isInteractiveTTY, readTTYLine } from './utils/tty.js';
import { computeContentBlocks } from './content-blocks.js';
import { runGovernance } from './generators/index.js';
import { log } from './utils/logger.js';

const VERSION = '14.3.0';
const HOOK_VERSION = '14.3.0';

const program = new Command();

program
    .name('ai-gov')
    .version(VERSION)
    .description('AI Governance Framework for Claude Code');

program
    .command('init')
    .description('Scan project and generate governance files')
    .option('-s, --stack <stack>', 'Specify stack (flutter|kotlin|nodejs|react|angular|swiftui|python)')
    .option('--overwrite', 'Overwrite existing files', false)
    .option('--dry-run', 'Preview changes without writing', false)
    .option('--update-hooks', 'Update only stale hooks', false)
    .option('-d, --dir <path>', 'Target directory', process.cwd())
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
        const isBackend = stack === 'nodejs' || stack === 'python';
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

        runGovernance(config);

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
        try { execSync('command -v jq', { stdio: 'pipe' }); jqOk = true; } catch { }
        check('jq installed (required by hooks)', jqOk);

        console.log('');
        if (issues === 0) log.success('All checks passed!');
        else log.warn(`${issues} issue(s) found. Run 'ai-gov init' to fix.`);
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
