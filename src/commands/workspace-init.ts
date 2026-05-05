import { existsSync, readdirSync, readFileSync, appendFileSync, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { join, basename } from 'path';
import type { Stack, GovernanceConfig, ConflictMode, Agent } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject, checkSpecFirstEnabled } from '../scanners/index.js';
import { computeContentBlocks, isJavaBackend as isJavaBackendCheck } from '../content-blocks.js';
import { runGovernance } from '../generators/index.js';
import { generateGitHooks } from '../generators/git-hooks/index.js';
import { generateWorkspaceFiles, type WorkspaceProject, type WorkspaceConfig } from '../generators/workspace/index.js';
import { generateWorkspacePreCommit } from '../generators/git-hooks/workspace-pre-commit.js';
import { log } from '../utils/logger.js';
import { HOOK_VERSION } from '../constants.js';

// Directories treated as group containers (Image 1 pattern)
const GROUP_DIRS = ['backend', 'frontend', 'mobile', 'services', 'apps', 'packages', 'libs'];

// Marker files that indicate a directory is a project root
const PROJECT_MARKERS = [
    'package.json',
    'pubspec.yaml',
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
    'pyproject.toml',
    'requirements.txt',
    'Package.swift',
    'settings.gradle',
    'settings.gradle.kts',
];

export interface WorkspaceInitOptions {
    dir: string;
    dryRun: boolean;
    overwrite: boolean;
    only?: string[];   // optional filter: only init these relative paths
    agent?: Agent;     // target agent — defaults to 'claude-code'
}

export function runWorkspaceInit(options: WorkspaceInitOptions): void {
    const { dir, dryRun, overwrite } = options;
    const agent = options.agent ?? 'claude-code';
    const workspaceName = basename(dir);

    log.header(`AI Governance — Workspace Init (${workspaceName})`);

    // 1. Discover all projects
    const allProjects = discoverProjects(dir);

    if (!allProjects.length) {
        log.error('No projects found in workspace. Each sub-directory must have a recognisable stack marker (package.json, pubspec.yaml, pom.xml, etc.).');
        process.exit(1);
    }

    const projects = options.only?.length
        ? allProjects.filter(p => options.only!.includes(p.relativePath))
        : allProjects;

    if (options.only?.length && !projects.length) {
        log.error(`No projects matched: ${options.only.join(', ')}`);
        log.info(`Available: ${allProjects.map(p => p.relativePath).join(', ')}`);
        process.exit(1);
    }

    log.section(`\nDiscovered ${projects.length} project(s):`);
    for (const p of projects) {
        log.detected(`${p.relativePath}  [${p.stack}]`);
    }
    console.log('');

    const conflictMode: ConflictMode = overwrite ? 'overwrite' : 'keep';

    // 2. Run governance per project
    let projectsWithOwnGit = 0;
    for (const project of projects) {
        const projectDir = join(dir, project.relativePath);
        log.header(`Project: ${project.relativePath}`);

        try {
            if (!isKnownStack(project.stack)) {
                log.warn(`Skipping ${project.relativePath}: stack "${project.stack}" not supported in this version`);
                continue;
            }
            const stack = project.stack as Stack;
            const profile = loadBaseProfile(stack);
            const scan = createDefaultScanResult();
            scanProject(stack, projectDir, profile, scan);
            const specFirstEnabled = checkSpecFirstEnabled(projectDir);
            const isBackend = stack === 'nodejs' || stack === 'python'
                || (stack === 'java' && isJavaBackendCheck(scan));
            const blocks = computeContentBlocks(stack, profile, scan);

            const projectInfo = collectProjectInfo(stack, projectDir);

            const config: GovernanceConfig = {
                agent,
                stack,
                profile,
                scan,
                project: projectInfo,
                blocks,
                isBackend,
                hookVersion: HOOK_VERSION,
                projectDir,
                specFirstEnabled,
                conflictMode,
                overwrite,
                dryRun,
                updateHooks: false,
            };

            runGovernance(config);
            generateGitHooks(config, projectDir);

            // Inject workspace reference into project steering/CLAUDE.md
            if (!dryRun) {
                injectWorkspaceReference(projectDir, project.relativePath, agent);
            }

            // Multi-repo: install per-project git hook if this project has its own .git/
            if (installProjectGitHook(projectDir, project.relativePath, dryRun, agent)) {
                projectsWithOwnGit++;
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn(`Skipped ${project.relativePath}: ${msg}`);
        }
    }

    // 3. Generate workspace-level files
    if (!dryRun) addToGitignore(dir);
    log.header(`Workspace: ${workspaceName}`);

    const wsOpts = {
        overwrite,
        dryRun,
        updateHooks: false,
        hookVersion: HOOK_VERSION,
        projectDir: dir,
        conflictMode,
    };

    const wsConfig: WorkspaceConfig = {
        workspaceName,
        workspaceDir: dir,
        projects,
        dryRun,
        overwrite,
        hookVersion: HOOK_VERSION,
        agent,
    };

    generateWorkspaceFiles(wsConfig, wsOpts);

    // 4. Workspace git hooks — mode-aware
    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
    const wsHookDir = join(dir, agentDir, 'git-hooks');
    log.header(`Workspace git hooks: ${workspaceName}`);

    // Always write the workspace-pre-commit.sh (useful even in multi-repo for CI / manual use)
    if (!dryRun) {
        mkdirSync(wsHookDir, { recursive: true });
        const hookFile = join(wsHookDir, 'workspace-pre-commit.sh');
        writeFileSync(hookFile, generateWorkspacePreCommit(agent));
        try { chmodSync(hookFile, 0o755); } catch { /* ignore on Windows */ }
        log.detected(`workspace-pre-commit.sh written → ${agentDir}/git-hooks/`);
    } else {
        log.info(`[dry-run] ${agentDir}/git-hooks/workspace-pre-commit.sh`);
    }

    if (projectsWithOwnGit > 0) {
        // Multi-repo: each project has its own .git/ — per-project hooks already installed above
        log.info(`Multi-repo detected — per-project git hooks installed in ${projectsWithOwnGit} project(s)`);
        log.info('Workspace .git/ hook not installed (not a monorepo)');
    } else {
        // Monorepo: single .git/ at workspace root — install workspace hook
        if (!dryRun) {
            installWorkspaceGitHook(dir, agent);
        } else {
            log.info('[dry-run] .git/hooks/pre-commit (workspace monorepo hook)');
        }
    }

    // 5. Summary
    const repoMode = projectsWithOwnGit > 0 ? 'Multi-repo' : 'Monorepo';
    console.log('');
    log.header(`Done! — ${workspaceName} workspace`);
    console.log(`  Repo mode:  ${repoMode}`);
    console.log(`  Projects:   ${projects.length} initialised`);
    for (const p of projects) {
        const hasGit = existsSync(join(dir, p.relativePath, '.git'));
        const hookIcon = hasGit ? '(git hooks ✓)' : '(monorepo — workspace hook)';
        console.log(`    ${p.relativePath}  [${p.stack}]  ${hookIcon}`);
    }
    console.log('');
    console.log('  Next steps:');
    if (projectsWithOwnGit > 0) {
        console.log('    1. Each project has its own git repo — git hooks installed per project');
        console.log(`    2. Review ${agentDir}/ steering in each project`);
        console.log(`    3. Fill in ${agentDir}/steering/project-registry.md at workspace root`);
        console.log(`    4. Document API contracts in ${agentDir}/steering/cross-project-rules.md`);
        console.log(`    5. Commit ${agentDir}/ in each project separately`);
    } else {
        console.log('    1. Monorepo — workspace git hook installed at .git/hooks/pre-commit');
        console.log(`    2. Review workspace ${agentDir}/ steering`);
        console.log(`    3. Fill in ${agentDir}/steering/project-registry.md`);
        console.log(`    4. Document API contracts in ${agentDir}/steering/cross-project-rules.md`);
        console.log(`    5. Commit ${agentDir}/ directories`);
    }
    console.log('');
}

// ---------------------------------------------------------------------------
// Project discovery
// ---------------------------------------------------------------------------

export function discoverProjects(workspaceDir: string): WorkspaceProject[] {
    const projects: WorkspaceProject[] = [];
    const entries = safeReadDir(workspaceDir);

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;

        // Skip hidden dirs and node_modules
        if (name.startsWith('.') || name === 'node_modules') continue;

        const fullPath = join(workspaceDir, name);

        if (GROUP_DIRS.includes(name)) {
            // Grouped layout: scan one level deeper
            const subEntries = safeReadDir(fullPath);
            for (const sub of subEntries) {
                if (!sub.isDirectory()) continue;
                if (sub.name.startsWith('.') || sub.name === 'node_modules') continue;
                const subPath = join(fullPath, sub.name);
                const stack = tryDetectStack(subPath);
                if (stack) {
                    projects.push({
                        name: sub.name,
                        relativePath: `${name}/${sub.name}`,
                        stack,
                        group: name,
                    });
                }
            }
        } else {
            // Flat layout: check if this dir itself is a project
            const stack = tryDetectStack(fullPath);
            if (stack) {
                projects.push({
                    name,
                    relativePath: name,
                    stack,
                    group: '',
                });
            }
        }
    }

    return projects;
}

// ---------------------------------------------------------------------------
// Stack detection (non-fatal version — returns null instead of process.exit)
// ---------------------------------------------------------------------------

export function tryDetectStack(dir: string): string | null {
    const hasMarker = PROJECT_MARKERS.some(m => existsSync(join(dir, m)));
    if (!hasMarker) return null;

    try {
        // Suppress detectStack logs for workspace scan by detecting manually
        if (existsSync(join(dir, 'pubspec.yaml'))) return 'flutter';
        if (existsSync(join(dir, 'Package.swift'))) return 'swiftui';
        if (existsSync(join(dir, 'build.gradle.kts')) || existsSync(join(dir, 'build.gradle'))) {
            const gradleFile = existsSync(join(dir, 'build.gradle.kts'))
                ? join(dir, 'build.gradle.kts')
                : join(dir, 'build.gradle');
            try {
                const content = readFileSync(gradleFile, 'utf-8');
                if (/kotlin\(|org\.jetbrains\.kotlin|kotlin-android|kotlin-stdlib/.test(content)) return 'kotlin';
            } catch { /* unreadable — fall through to java */ }
            return 'java';
        }
        if (existsSync(join(dir, 'pom.xml')) || existsSync(join(dir, 'settings.gradle')) || existsSync(join(dir, 'settings.gradle.kts'))) return 'java';
        if (existsSync(join(dir, 'pyproject.toml')) || existsSync(join(dir, 'requirements.txt'))) return 'python';

        // JS/TS ecosystem
        const pkgPath = existsSync(join(dir, 'package.json')) ? join(dir, 'package.json')
            : existsSync(join(dir, 'src', 'package.json')) ? join(dir, 'src', 'package.json')
                : null;

        if (pkgPath) {
            const content = readFileSync(pkgPath, 'utf-8');
            if (content.includes('"@angular/core"')) return 'angular';
            if (content.includes('"react"')) return 'react';
            if (/"express"|"@nestjs\/core"|"fastify"/.test(content)) return 'nodejs';
            return 'nodejs';
        }
    } catch {
        // unreadable — skip
    }

    return null;
}

// ---------------------------------------------------------------------------
// Inject workspace reference into project CLAUDE.md
// ---------------------------------------------------------------------------

function injectWorkspaceReference(projectDir: string, relPath: string, agent: Agent): void {
    if (agent === 'kiro') {
        // Kiro: inject into the first steering file (constitution.md)
        const constitutionMd = join(projectDir, '.kiro', 'steering', 'constitution.md');
        if (!existsSync(constitutionMd)) return;
        const content = readFileSync(constitutionMd, 'utf-8');
        if (content.includes('## Workspace Rules')) return;

        const depth = relPath.split('/').length;
        const upPath = '../'.repeat(depth + 1); // +1 for .kiro/ dir

        const injection = `
---

## Workspace Rules
> This project is part of a workspace. Workspace-level rules take precedence.
> Read \`${upPath}.kiro/steering/workspace-policy.md\` before starting any task.
> See \`${upPath}.kiro/steering/cross-project-rules.md\` for cross-project API contracts.
`;
        appendFileSync(constitutionMd, injection);
        log.detected(`Workspace reference injected → ${relPath}/.kiro/steering/constitution.md`);
    } else {
        // Claude Code: inject into CLAUDE.md
        const claudeMd = join(projectDir, '.claude', 'CLAUDE.md');
        if (!existsSync(claudeMd)) return;
        const content = readFileSync(claudeMd, 'utf-8');
        if (content.includes('## Workspace Rules')) return;

        const depth = relPath.split('/').length;
        const upPath = '../'.repeat(depth + 1);

        const injection = `
---

## Workspace Rules
> This project is part of a workspace. Workspace-level rules take precedence.
> Read \`${upPath}.claude/steering/workspace-policy.md\` before starting any task.
> See \`${upPath}.claude/steering/cross-project-rules.md\` for cross-project API contracts.
`;
        appendFileSync(claudeMd, injection);
        log.detected(`Workspace reference injected → ${relPath}/.claude/CLAUDE.md`);
    }
}

// ---------------------------------------------------------------------------
// Project info (name from manifest)
// ---------------------------------------------------------------------------

function collectProjectInfo(stack: Stack, projectDir: string) {
    const dn = basename(projectDir);
    let packageName = '';

    try {
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
                const pom = join(projectDir, 'pom.xml');
                if (existsSync(pom)) {
                    const content = readFileSync(pom, 'utf-8');
                    const nameMatch = content.match(/<name>([^<]+)<\/name>/);
                    const artifactMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
                    packageName = nameMatch?.[1]?.trim() || artifactMatch?.[1]?.trim() || '';
                }
                if (!packageName) {
                    const sf = existsSync(join(projectDir, 'settings.gradle.kts'))
                        ? join(projectDir, 'settings.gradle.kts')
                        : join(projectDir, 'settings.gradle');
                    if (existsSync(sf)) {
                        const m = readFileSync(sf, 'utf-8').match(/rootProject\.name\s*=\s*['"]([^'"]+)['"]/);
                        if (m) packageName = m[1];
                    }
                }
                break;
            }
            default: {
                const candidates = [join(projectDir, 'package.json'), join(projectDir, 'src', 'package.json')];
                for (const f of candidates) {
                    if (existsSync(f)) {
                        const m = readFileSync(f, 'utf-8').match(/"name"\s*:\s*"([^"]+)"/);
                        if (m) { packageName = m[1]; break; }
                    }
                }
            }
        }
    } catch { /* ignore */ }

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

const KNOWN_STACKS: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'angular', 'swiftui', 'python', 'java'];

function isKnownStack(s: string): s is Stack {
    return (KNOWN_STACKS as string[]).includes(s);
}

function safeReadDir(dir: string) {
    try {
        return readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Per-project git hook installation (multi-repo)
// ---------------------------------------------------------------------------

/**
 * Installs .git/hooks/pre-commit and commit-msg wrappers in a project that
 * has its own git repository. Returns true if the project has its own .git/.
 */
function installProjectGitHook(projectDir: string, relPath: string, dryRun: boolean, agent: Agent = 'claude-code'): boolean {
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gitDir)) return false;

    const agentHookDir = agent === 'kiro' ? '.kiro' : '.claude';

    // Detect existing hook system — show guide instead of overwriting
    const existing = detectExistingHookSystem(projectDir);
    if (existing) {
        log.warn(`  ${relPath}: existing ${existing} hook system detected — skipping auto-install`);
        log.info(`    Manually add to your ${existing} config: bash ${agentHookDir}/git-hooks/pre-commit.sh`);
        return true;
    }

    if (dryRun) {
        log.info(`[dry-run] ${relPath}/.git/hooks/pre-commit`);
        log.info(`[dry-run] ${relPath}/.git/hooks/commit-msg`);
        return true;
    }

    try {
        const gitHooksDir = join(gitDir, 'hooks');
        mkdirSync(gitHooksDir, { recursive: true });

        const preCommitWrapper = `#!/usr/bin/env bash
# Installed by ai-gov workspace-init — delegates to project governance pre-commit.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/${agentHookDir}/git-hooks/pre-commit.sh" "$@"
`;
        const commitMsgWrapper = `#!/usr/bin/env bash
# Installed by ai-gov workspace-init — delegates to project governance commit-msg.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/${agentHookDir}/git-hooks/commit-msg.sh" "$1"
`;

        writeFileSync(join(gitHooksDir, 'pre-commit'), preCommitWrapper);
        writeFileSync(join(gitHooksDir, 'commit-msg'), commitMsgWrapper);
        try {
            chmodSync(join(gitHooksDir, 'pre-commit'), 0o755);
            chmodSync(join(gitHooksDir, 'commit-msg'), 0o755);
        } catch { /* ignore on Windows */ }

        log.detected(`Git hooks installed → ${relPath}/.git/hooks/`);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn(`  Could not install git hooks for ${relPath}: ${msg}`);
    }

    return true;
}

function detectExistingHookSystem(projectDir: string): string | null {
    if (existsSync(join(projectDir, '.husky'))) return 'husky';
    if (existsSync(join(projectDir, '.pre-commit-config.yaml'))) return 'pre-commit';
    if (existsSync(join(projectDir, 'lefthook.yml')) || existsSync(join(projectDir, '.lefthook.yml'))) return 'lefthook';
    const hook = join(projectDir, '.git', 'hooks', 'pre-commit');
    if (existsSync(hook)) {
        try {
            const content = readFileSync(hook, 'utf-8');
            if (!content.includes('ai-gov')) return 'custom';
        } catch { /* unreadable — treat as no conflict */ }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Workspace-level git hook installation (monorepo)
// ---------------------------------------------------------------------------

function installWorkspaceGitHook(workspaceDir: string, agent: Agent = 'claude-code'): void {
    const gitDir = join(workspaceDir, '.git');
    if (!existsSync(gitDir)) return;
    const agentHookDir = agent === 'kiro' ? '.kiro' : '.claude';
    try {
        const gitHooksDir = join(gitDir, 'hooks');
        mkdirSync(gitHooksDir, { recursive: true });
        const wrapper = `#!/usr/bin/env bash
# Installed by ai-gov workspace — delegates to workspace pre-commit hook.
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/${agentHookDir}/git-hooks/workspace-pre-commit.sh"
`;
        const dest = join(gitHooksDir, 'pre-commit');
        writeFileSync(dest, wrapper);
        try { chmodSync(dest, 0o755); } catch { /* ignore on Windows */ }
        log.detected('Workspace hook installed → .git/hooks/pre-commit');
    } catch { /* ignore if .git is read-only or hook install fails */ }
}

function addToGitignore(workspaceDir: string): void {
    const gi = join(workspaceDir, '.gitignore');
    const gitDir = join(workspaceDir, '.git');
    if (!existsSync(gi) && !existsSync(gitDir)) return;
    try {
        const content = existsSync(gi) ? readFileSync(gi, 'utf-8') : '';
        if (!content.includes('ai-gov')) {
            appendFileSync(gi, '\n# AI governance CLI\nonboard.sh\n');
        }
    } catch { /* ignore */ }
}
