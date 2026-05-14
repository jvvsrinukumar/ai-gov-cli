import { existsSync } from 'fs';
import { join, resolve } from 'path';
import type { Stack, GovernanceConfig, ConflictMode } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { detectStack } from '../detect-stack.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject, checkSpecFirstEnabled } from '../scanners/index.js';
import { isInteractiveTTY, readTTYLine } from '../utils/tty.js';
import { computeContentBlocks, isJavaBackend as isJavaBackendCheck } from '../content-blocks.js';
import { runGovernance } from '../generators/index.js';
import { log } from '../utils/logger.js';
import { generateGitHooks } from '../generators/git-hooks/index.js';
import { installGitHookWrappers } from './init-git-hooks.js';
import { generateCIConfig } from './init-ci.js';
import { detectAgent } from '../agents/detect-agent.js';
import { collectProjectInfo } from '../utils/collect-project-info.js';
import { addToGitignore, addUsageLogsToGitignore } from '../utils/gitignore-manager.js';
import { displayTransparencyDisclosure } from '../utils/display-hub-disclosure.js';
import { HOOK_VERSION } from '../constants.js';

export interface InitCmdOptions {
    dir: string;
    stack?: string;
    agent?: string;
    overwrite: boolean;
    dryRun: boolean;
    updateHooks: boolean;
    gitHooks: boolean;
    ci?: string;
    force: boolean;
}

export async function runInitCmd(options: InitCmdOptions): Promise<void> {
    const projectDir = resolve(options.dir);
    if (!existsSync(projectDir)) {
        log.error(`Directory not found: ${projectDir}`);
        process.exit(1);
    }

    const { VERSION } = await import('../constants.js');
    log.header(`AI Governance v${VERSION} (Scan-Adaptive)`);

    const agent = detectAgent(projectDir, options.agent);
    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';

    if (!options.dryRun) {
        addToGitignore(projectDir);
    }

    const stack = detectStack(projectDir, options.stack) as Stack;
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();

    scanProject(stack, projectDir, profile, scan);
    const specFirstEnabled = checkSpecFirstEnabled(projectDir);

    const project = collectProjectInfo(stack, projectDir);
    const isBackend = stack === 'nodejs' || stack === 'python'
        || (stack === 'java' && isJavaBackendCheck(scan));
    const blocks = computeContentBlocks(stack, profile, scan);

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
            if (choice === '') choice = 'g';
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
            conflictMode = 'ask';
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

    if (!options.dryRun) {
        addUsageLogsToGitignore(projectDir);
        displayTransparencyDisclosure(projectDir);
    }

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
}
