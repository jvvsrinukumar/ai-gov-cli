/**
 * ai-gov upgrade — re-generates hooks, commands, and CLAUDE.md for an existing project.
 *
 * Designed for teams upgrading from an older ai-gov version. It:
 *   - Always overwrites: hooks (.claude/hooks/), git-hooks (.claude/git-hooks/), commands (.claude/commands/)
 *   - By default keeps: steering files (they have team-specific content)
 *   - Reads the project's existing CLAUDE.md to preserve app name / stack info
 *   - Runs a full re-scan so new detections (e.g. new ORM) are picked up
 *   - Reports exactly what was updated vs kept
 *
 * Usage:
 *   ai-gov upgrade                          # upgrade current dir
 *   ai-gov upgrade --dir ./my-project       # upgrade specific project
 *   ai-gov upgrade --force                  # also overwrite steering files
 */

import { existsSync, readFileSync } from 'fs';
import { join, basename, resolve } from 'path';
import { chmodSync, readdirSync } from 'fs';
import type { Stack, GovernanceConfig } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { detectStack } from '../detect-stack.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject, checkSpecFirstEnabled } from '../scanners/index.js';
import { computeContentBlocks, isJavaBackend as isJavaBackendCheck } from '../content-blocks.js';
import { generateAllHooks } from '../generators/hooks/index.js';
import { generateGitHooks } from '../generators/git-hooks/index.js';
import { safeWrite } from '../utils/safe-write.js';
import { log } from '../utils/logger.js';
import {
    generateMasterClaudeMd,
} from '../generators/claude-md.js';
import {
    generateAuditCommand,
} from '../generators/commands/audit.js';
import {
    generateNewFeatureCommand,
} from '../generators/commands/new-feature.js';
import {
    generateEditFeatureCommand,
} from '../generators/commands/edit-feature.js';
import {
    generateFixCommand,
} from '../generators/commands/fix.js';
import {
    generateRefactorCommand,
} from '../generators/commands/refactor.js';
import {
    generateHotfixCommand,
} from '../generators/commands/hotfix.js';
import {
    generateExploreCommand,
} from '../generators/commands/explore.js';
import { generateArchitecture } from '../generators/architecture.js';
import { generateCodingStandards } from '../generators/coding-standards.js';
import { generateWorkflow } from '../generators/workflow.js';
import { generateConstitution } from '../generators/constitution.js';

const HOOK_VERSION = '16.0.0';

export interface UpgradeOptions {
    dir: string;
    force: boolean;   // true = also overwrite steering files
    dryRun: boolean;
    stack?: string;   // optional override
}

export function runUpgrade(options: UpgradeOptions): void {
    const projectDir = resolve(options.dir);
    const { force, dryRun } = options;

    if (!existsSync(projectDir)) {
        log.error(`Directory not found: ${projectDir}`);
        process.exit(1);
    }

    const claudeDir = join(projectDir, '.claude');
    if (!existsSync(claudeDir)) {
        log.error(`.claude/ not found in ${projectDir}`);
        log.info("Run 'ai-gov init' first to set up governance.");
        process.exit(1);
    }

    log.header(`AI Governance Upgrade — ${basename(projectDir)}`);
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
    const project = readExistingProjectInfo(projectDir, stack);

    const config: GovernanceConfig = {
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

    // ── Always upgrade: hooks ──────────────────────────────────────────────
    log.section('Upgrading hooks (.claude/hooks/):');
    generateAllHooks(config, opts);
    makeHooksExecutable(projectDir, dryRun);

    // ── Always upgrade: git hooks ──────────────────────────────────────────
    log.section('Upgrading git hooks (.claude/git-hooks/):');
    generateGitHooks(config, projectDir);

    // ── Always upgrade: commands ───────────────────────────────────────────
    log.section('Upgrading commands (.claude/commands/):');
    const cmdDir = join(projectDir, '.claude', 'commands');
    safeWrite(join(cmdDir, 'audit.md'),       generateAuditCommand(config),      opts);
    safeWrite(join(cmdDir, 'new-feature.md'), generateNewFeatureCommand(config), opts);
    safeWrite(join(cmdDir, 'edit-feature.md'),generateEditFeatureCommand(config),opts);
    safeWrite(join(cmdDir, 'fix.md'),         generateFixCommand(config),         opts);
    safeWrite(join(cmdDir, 'refactor.md'),    generateRefactorCommand(config),    opts);
    safeWrite(join(cmdDir, 'hotfix.md'),      generateHotfixCommand(config),      opts);
    safeWrite(join(cmdDir, 'explore.md'),     generateExploreCommand(config),     opts);

    // ── Always upgrade: CLAUDE.md (rules are embedded here, must stay current) ─
    log.section('Upgrading .claude/CLAUDE.md:');
    safeWrite(join(claudeDir, 'CLAUDE.md'), generateMasterClaudeMd(config), opts);

    // ── Optional: steering files ───────────────────────────────────────────
    if (force) {
        log.section('Upgrading steering files (--force):');
        const steeringDir = join(claudeDir, 'steering');
        safeWrite(join(steeringDir, 'architecture.md'),    generateArchitecture(config),   opts);
        safeWrite(join(steeringDir, 'coding-standards.md'),generateCodingStandards(config),opts);
        safeWrite(join(steeringDir, 'workflow.md'),        generateWorkflow(config),        opts);
        safeWrite(join(steeringDir, 'constitution.md'),    generateConstitution(config),    opts);
    } else {
        log.info('Steering files kept (use --force to also upgrade them)');
    }

    // ── Summary ───────────────────────────────────────────────────────────
    console.log('');
    log.header(`Upgrade complete — ${basename(projectDir)}`);
    console.log(`  Stack:       ${profile.stackDisplay}`);
    console.log(`  Hook ver:    ${HOOK_VERSION}`);
    console.log('');
    console.log('  Always upgraded:');
    console.log('    .claude/hooks/          (11 Claude Code hooks)');
    console.log('    .claude/git-hooks/      (pre-commit.sh + 6 checks)');
    console.log('    .claude/commands/       (7 slash commands)');
    console.log('    .claude/CLAUDE.md       (embedded rules — always current)');
    if (force) {
        console.log('    .claude/steering/       (4 steering files — force mode)');
    } else {
        console.log('');
        console.log('  Kept (team-specific content preserved):');
        console.log('    .claude/steering/       (run with --force to upgrade)');
        console.log('    specs/                  (your feature specs — never touched)');
    }
    console.log('');
    console.log('  Next: commit .claude/ to git so all teammates get the upgrade.');
    console.log('');
}

// ---------------------------------------------------------------------------
// Read existing project info from CLAUDE.md / package manifest
// Preserves app name, description set during init rather than re-prompting.
// ---------------------------------------------------------------------------

function readExistingProjectInfo(projectDir: string, stack: Stack) {
    const dn = basename(projectDir);
    let appName = dn;
    let appDescription = '';

    // Try to read from existing CLAUDE.md
    const claudeMd = join(projectDir, '.claude', 'CLAUDE.md');
    if (existsSync(claudeMd)) {
        const content = readFileSync(claudeMd, 'utf-8');
        const nameMatch = content.match(/\*\*App:\*\*\s+([^\n—]+)/);
        if (nameMatch) appName = nameMatch[1].trim();
        const descMatch = content.match(/\*\*App:\*\*[^\n]+—\s*([^\n]+)/);
        if (descMatch) appDescription = descMatch[1].trim();
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

function makeHooksExecutable(projectDir: string, dryRun: boolean): void {
    if (dryRun) return;
    const hooksDir = join(projectDir, '.claude', 'hooks');
    try {
        if (existsSync(hooksDir)) {
            for (const f of readdirSync(hooksDir)) {
                if (f.endsWith('.sh')) chmodSync(join(hooksDir, f), 0o755);
            }
        }
    } catch { /* ignore chmod errors on Windows */ }
}
