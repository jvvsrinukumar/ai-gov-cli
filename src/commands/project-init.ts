/**
 * Orchestrator for `ai-gov project init`.
 *
 * Coordinates the full flow: stack selection → adapter lookup → common prompts →
 * adapter prompts → confirmation → directory check → scaffold → postSetup →
 * governance → git hooks → CI config → success message.
 */
import fs from 'node:fs';
import path from 'node:path';
import { select, confirm } from '@inquirer/prompts';
import type { GovernanceConfig, Stack } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { loadBaseProfile } from '../profiles.js';
import { computeContentBlocks, isJavaBackend } from '../content-blocks.js';
import { HOOK_VERSION } from '../constants.js';
import { getAdapter, getAllAdapters } from '../stacks/registry.js';
import { collectCommonAnswers, collectGovernanceAnswers, toDisplayName } from '../stacks/common-prompts.js';
import type { ScaffoldContext, StackAdapter } from '../stacks/adapter.js';
import { runGovernance } from '../generators/index.js';
import { generateGitHooks } from '../generators/git-hooks/index.js';
import { installGitHookWrappers } from './init-git-hooks.js';
import { generateCIConfig } from './init-ci.js';

export interface ProjectInitOptions {
    type?: string;
    name?: string;
    yes?: boolean;
    dryRun?: boolean;
    dir?: string;
}

/**
 * Build a GovernanceConfig from scaffold context and adapter.
 * This is a pure function — no I/O, no filesystem access, no network calls.
 */
export function buildGovernanceConfig(
    ctx: ScaffoldContext,
    adapter: StackAdapter,
    options: { dryRun?: boolean; overwrite?: boolean; updateHooks?: boolean },
): GovernanceConfig {
    const stack = adapter.id;
    const profile = loadBaseProfile(stack);
    const scan = { ...createDefaultScanResult(), ...adapter.scanHints(ctx) };
    const project = {
        appName: ctx.displayName,
        packageName: ctx.appName,
        appDescription: '',
        ticketSystem: 'Jira',
        ticketPrefix: 'TICKET',
        legacyDescription: 'No legacy code',
    };
    const isBackendProject = stack === 'nodejs' || stack === 'python'
        || (stack === 'java' && isJavaBackend(scan));
    const blocks = computeContentBlocks(stack, profile, scan);

    return {
        agent: ctx.agent,
        stack,
        profile,
        scan,
        project,
        blocks,
        isBackend: isBackendProject,
        hookVersion: HOOK_VERSION,
        projectDir: ctx.projectDir,
        specFirstEnabled: true,
        conflictMode: 'keep',
        overwrite: options.overwrite ?? false,
        dryRun: options.dryRun ?? false,
        updateHooks: options.updateHooks ?? false,
    };
}

/**
 * Main orchestrator for `ai-gov project init`.
 */
export async function runProjectInit(options: ProjectInitOptions): Promise<void> {
    // ─── Step 1: Stack selection ────────────────────────────────────────────
    let adapter: StackAdapter;

    if (options.type) {
        adapter = getAdapter(options.type as Stack);
    } else {
        const adapters = getAllAdapters();
        const stackId = await select<Stack>({
            message: 'Select a stack:',
            choices: adapters.map((a) => ({
                name: a.displayName,
                value: a.id,
            })),
        });
        adapter = getAdapter(stackId);
    }

    // ─── Step 2: Common prompts ─────────────────────────────────────────────
    let appName: string;
    let displayName: string;
    let outputDir: string;

    if (options.name) {
        appName = options.name.trim();
        displayName = toDisplayName(appName);
    } else {
        // Will be collected via collectCommonAnswers below
        appName = '';
        displayName = '';
    }

    if (options.dir) {
        outputDir = path.resolve(options.dir);
    } else {
        outputDir = '';
    }

    let commonCtx: ScaffoldContext;

    if (options.name && options.dir) {
        // Both name and dir provided — only collect governance prompts (agent, gitHooks, ci)
        const governance = await collectGovernanceAnswers();
        commonCtx = {
            appName,
            displayName,
            outputDir,
            projectDir: path.join(outputDir, appName),
            agent: governance.agent,
            gitHooks: governance.gitHooks,
            ci: governance.ci,
        };
    } else if (options.name) {
        // Name provided, collect output dir + governance prompts (skip name/display prompts)
        const governance = await collectGovernanceAnswers();
        outputDir = outputDir || process.cwd();
        commonCtx = {
            appName,
            displayName,
            outputDir,
            projectDir: path.join(outputDir, appName),
            agent: governance.agent,
            gitHooks: governance.gitHooks,
            ci: governance.ci,
        };
    } else {
        // Collect everything via common prompts — use the adapter's name validator
        const answers = await collectCommonAnswers(
            adapter.nameHint,
            (name) => adapter.validateName(name),
        );
        appName = answers.appName;
        displayName = answers.displayName;
        outputDir = options.dir ? path.resolve(options.dir) : answers.outputDir;
        commonCtx = {
            appName,
            displayName,
            outputDir,
            projectDir: path.join(outputDir, appName),
            agent: answers.agent,
            gitHooks: answers.gitHooks,
            ci: answers.ci,
        };
    }

    // ─── Step 3: Adapter-specific prompts ───────────────────────────────────
    const ctx = await adapter.runPrompts(commonCtx);

    // ─── Step 4: Confirmation ───────────────────────────────────────────────
    if (!options.yes) {
        console.log('');
        console.log('  Project Summary:');
        console.log(`    Stack:       ${adapter.displayName}`);
        console.log(`    Name:        ${ctx.appName}`);
        console.log(`    Display:     ${ctx.displayName}`);
        console.log(`    Directory:   ${ctx.projectDir}`);
        console.log(`    Agent:       ${ctx.agent}`);
        console.log(`    Git Hooks:   ${ctx.gitHooks ? 'Yes' : 'No'}`);
        console.log(`    CI:          ${ctx.ci}`);
        console.log('');

        const proceed = await confirm({
            message: 'Proceed with project creation?',
            default: true,
        });

        if (!proceed) {
            console.log('  Aborted.');
            return;
        }
    }

    // ─── Step 5: Directory existence check ──────────────────────────────────
    if (fs.existsSync(ctx.projectDir)) {
        throw new Error(`Project directory already exists: ${ctx.projectDir}`);
    }

    // ─── Step 6: Scaffold ───────────────────────────────────────────────────
    try {
        await adapter.scaffold(ctx);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Scaffold failed: ${msg}`);
    }

    // ─── Step 7: Post-setup ─────────────────────────────────────────────────
    try {
        await adapter.postSetup(ctx);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Post-setup failed: ${msg}`);
    }

    // ─── Step 8: Governance (skipped in dry-run mode) ───────────────────────
    if (!options.dryRun) {
        const config = buildGovernanceConfig(ctx, adapter, {
            dryRun: false,
            overwrite: false,
            updateHooks: false,
        });

        try {
            runGovernance(config);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Governance application failed: ${msg}`);
        }

        // ─── Step 9: Git hooks ──────────────────────────────────────────────
        if (ctx.gitHooks) {
            generateGitHooks(config, ctx.projectDir);
            installGitHookWrappers(ctx.projectDir, false, false, ctx.agent);
        }

        // ─── Step 10: CI config ─────────────────────────────────────────────
        if (ctx.ci !== 'none') {
            generateCIConfig(config, ctx.ci);
        }
    }

    // ─── Step 11: Success message ───────────────────────────────────────────
    console.log('');
    console.log(`  ✓ Project created at ${ctx.projectDir}`);
    console.log('');
    console.log('  Next steps:');
    console.log(`    cd ${ctx.appName}`);
    if (adapter.id === 'flutter') {
        console.log('    fvm flutter run');
    } else if (adapter.id === 'react' || adapter.id === 'next') {
        console.log('    npm run dev');
    } else {
        console.log(`    ${loadBaseProfile(adapter.id).runCmd || 'npm start'}`);
    }
    console.log('');
}
