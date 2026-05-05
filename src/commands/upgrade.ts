/**
 * ai-gov upgrade — re-generates hooks, commands, and CLAUDE.md for an existing project.
 *
 * Designed for teams upgrading from an older ai-gov version. It:
 *   - Always overwrites: hooks, git-hooks, commands (agent-specific)
 *   - By default keeps: steering files (they have team-specific content)
 *   - Reads the project's existing CLAUDE.md to preserve app name / stack info
 *   - Runs a full re-scan so new detections (e.g. new ORM) are picked up
 *   - Reports exactly what was updated vs kept
 *
 * Architecture: delegates agent-specific upgrade logic to the agent registry
 * (src/agents/types.ts). Adding a third agent requires no changes here.
 *
 * Usage:
 *   ai-gov upgrade                          # upgrade current dir
 *   ai-gov upgrade --dir ./my-project       # upgrade specific project
 *   ai-gov upgrade --force                  # also overwrite steering files
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename, resolve } from 'path';
import type { Stack, GovernanceConfig, Agent } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { detectStack } from '../detect-stack.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject, checkSpecFirstEnabled } from '../scanners/index.js';
import { computeContentBlocks, isJavaBackend as isJavaBackendCheck } from '../content-blocks.js';
import { generateGitHooks } from '../generators/git-hooks/index.js';
import { log } from '../utils/logger.js';
import { agentRegistry } from '../agents/types.js';
import { HOOK_VERSION } from '../constants.js';

export interface UpgradeOptions {
    dir: string;
    force: boolean;   // true = also overwrite steering files
    dryRun: boolean;
    stack?: string;   // optional override
    agent?: string;   // optional agent override
}

export function runUpgrade(options: UpgradeOptions): void {
    const projectDir = resolve(options.dir);
    const { force, dryRun } = options;

    if (!existsSync(projectDir)) {
        log.error(`Directory not found: ${projectDir}`);
        process.exit(1);
    }

    const kiroDir = join(projectDir, '.kiro');
    const agent: Agent = (options.agent as Agent) ?? (existsSync(kiroDir) ? 'kiro' : 'claude-code');
    const agentDirName = agent === 'kiro' ? '.kiro' : '.claude';
    const agentDir = join(projectDir, agentDirName);

    if (!existsSync(agentDir)) {
        log.error(`${agentDirName}/ not found in ${projectDir}`);
        log.info("Run 'ai-gov init' first to set up governance.");
        process.exit(1);
    }

    // Validate agent is registered
    const adapter = agentRegistry[agent];
    if (!adapter) {
        log.error(`Unknown agent: ${agent}. Registered agents: ${Object.keys(agentRegistry).join(', ')}`);
        process.exit(1);
    }

    log.header(`AI Governance Upgrade (${agent}) — ${basename(projectDir)}`);
    console.log(`  Project: ${projectDir}`);
    console.log(`  Mode:    ${force ? 'full (hooks + commands + steering)' : 'standard (hooks + commands only)'}`);
    if (dryRun) console.log('  Dry run: no files will be written');
    console.log('');

    // Detect stack
    const stack = detectStack(projectDir, options.stack) as Stack;
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    scanProject(stack, projectDir, profile, scan);

    const specFirstEnabled = checkSpecFirstEnabled(projectDir);
    const isBackend = stack === 'nodejs' || stack === 'python'
        || (stack === 'java' && isJavaBackendCheck(scan));
    const blocks = computeContentBlocks(stack, profile, scan);
    const project = readExistingProjectInfo(projectDir, stack, agent);

    const config: GovernanceConfig = {
        agent,
        stack, profile, scan, project, blocks, isBackend,
        hookVersion: HOOK_VERSION,
        projectDir,
        specFirstEnabled,
        conflictMode: 'overwrite',
        overwrite: true,
        dryRun,
        updateHooks: false,
    };

    const opts = {
        overwrite: true,
        dryRun,
        updateHooks: false,
        hookVersion: HOOK_VERSION,
        projectDir,
        conflictMode: 'overwrite' as const,
    };

    // ── Delegate to agent adapter ───────────────────────────────────────
    adapter.upgrade(config, opts, force);

    // ── Git hooks (shared across agents) ────────────────────────────────
    log.section(`Upgrading git hooks (${agentDirName}/git-hooks/):`);
    generateGitHooks(config, projectDir);

    // ── Summary ─────────────────────────────────────────────────────────
    console.log('');
    log.header(`Upgrade complete — ${basename(projectDir)}`);
    console.log(`  Agent:       ${agent}`);
    console.log(`  Stack:       ${profile.stackDisplay}`);
    console.log(`  Hook ver:    ${HOOK_VERSION}`);
    console.log('');
    console.log('  Always upgraded:');
    console.log(`    ${agentDirName}/hooks/`);
    console.log(`    ${agentDirName}/git-hooks/`);
    if (agent === 'claude-code') {
        console.log(`    ${agentDirName}/commands/`);
        console.log(`    ${agentDirName}/CLAUDE.md`);
    }
    if (force) {
        console.log(`    ${agentDirName}/steering/       (force mode)`);
    } else {
        console.log('');
        console.log('  Kept (team-specific content preserved):');
        console.log(`    ${agentDirName}/steering/       (run with --force to upgrade)`);
        if (agent === 'kiro') {
            console.log(`    ${agentDirName}/specs/          (your feature specs — never touched)`);
        } else {
            console.log('    specs/                  (your feature specs — never touched)');
        }
    }
    console.log('');
    console.log(`  Next: commit ${agentDirName}/ to git so all teammates get the upgrade.`);
    console.log('');
}

// ---------------------------------------------------------------------------
// Read existing project info from CLAUDE.md / package manifest
// Preserves app name, description set during init rather than re-prompting.
// ---------------------------------------------------------------------------

function readExistingProjectInfo(projectDir: string, stack: Stack, agent: Agent) {
    const dn = basename(projectDir);
    let appName = dn;
    let appDescription = '';

    // Try to read from existing CLAUDE.md (Claude Code stores project info here)
    if (agent === 'claude-code') {
        const claudeMd = join(projectDir, '.claude', 'CLAUDE.md');
        if (existsSync(claudeMd)) {
            const content = readFileSync(claudeMd, 'utf-8');
            const nameMatch = content.match(/\*\*App:\*\*\s+([^\n—]+)/);
            if (nameMatch) appName = nameMatch[1].trim();
            const descMatch = content.match(/\*\*App:\*\*[^\n]+—\s*([^\n]+)/);
            if (descMatch) appDescription = descMatch[1].trim();
        }
    }

    // Fall back to package manifests
    if (appName === dn) {
        try {
            switch (stack) {
                case 'flutter': {
                    const pub = join(projectDir, 'pubspec.yaml');
                    if (existsSync(pub)) {
                        const m = readFileSync(pub, 'utf-8').match(/^name:\s*(.+)/m);
                        if (m) appName = m[1].trim();
                    }
                    break;
                }
                case 'swiftui': {
                    const pkg = join(projectDir, 'Package.swift');
                    if (existsSync(pkg)) {
                        const m = readFileSync(pkg, 'utf-8').match(/name:\s*"([^"]+)"/);
                        if (m) appName = m[1];
                    }
                    break;
                }
                case 'python': {
                    const pyp = join(projectDir, 'pyproject.toml');
                    if (existsSync(pyp)) {
                        const m = readFileSync(pyp, 'utf-8').match(/^name\s*=\s*"([^"]+)"/m);
                        if (m) appName = m[1];
                    }
                    break;
                }
                default: {
                    const pkgPath = join(projectDir, 'package.json');
                    if (existsSync(pkgPath)) {
                        const m = readFileSync(pkgPath, 'utf-8').match(/"name"\s*:\s*"([^"]+)"/);
                        if (m) appName = m[1];
                    }
                }
            }
        } catch { /* ignore */ }
    }

    return {
        packageName: appName,
        appName,
        appDescription,
        ticketSystem: 'Jira',
        ticketPrefix: 'TICKET',
        legacyDescription: 'No legacy code',
    };
}
