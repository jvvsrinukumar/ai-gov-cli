import { existsSync, readdirSync, readFileSync, appendFileSync } from 'fs';
import { join, basename, relative } from 'path';
import type { Stack, GovernanceConfig, ConflictMode } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject, checkSpecFirstEnabled } from '../scanners/index.js';
import { computeContentBlocks } from '../content-blocks.js';
import { runGovernance } from '../generators/index.js';
import { generateWorkspaceFiles, type WorkspaceProject, type WorkspaceConfig } from '../generators/workspace.js';
import { log } from '../utils/logger.js';

const HOOK_VERSION = '16.0.0';

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
}

export function runWorkspaceInit(options: WorkspaceInitOptions): void {
    const { dir, dryRun, overwrite } = options;
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

    log.section(`\nDiscovered ${projects.length} project(s):`);
    for (const p of projects) {
        log.detected(`${p.relativePath}  [${p.stack}]`);
    }
    console.log('');

    const conflictMode: ConflictMode = overwrite ? 'overwrite' : 'keep';

    // 2. Run governance per project
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
            const isBackend = stack === 'nodejs' || stack === 'python';
            const blocks = computeContentBlocks(stack, profile, scan);

            const projectInfo = collectProjectInfo(stack, projectDir);

            const config: GovernanceConfig = {
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

            // Inject workspace reference into project CLAUDE.md
            if (!dryRun) {
                injectWorkspaceReference(projectDir, dir, project.relativePath);
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn(`Skipped ${project.relativePath}: ${msg}`);
        }
    }

    // 3. Generate workspace-level files
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
    };

    generateWorkspaceFiles(wsConfig, wsOpts);

    // 4. Summary
    console.log('');
    log.header(`Done! — ${workspaceName} workspace`);
    console.log(`  Projects initialised: ${projects.length}`);
    for (const p of projects) {
        console.log(`    ${p.relativePath}  [${p.stack}]`);
    }
    console.log('');
    console.log('  Next steps:');
    console.log('    1. Review workspace .claude/CLAUDE.md');
    console.log('    2. Fill in project descriptions in .claude/steering/project-registry.md');
    console.log('    3. Document API contracts in .claude/steering/cross-project-rules.md');
    console.log('    4. Commit .claude/ and specs/ directories in each project');
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

function tryDetectStack(dir: string): string | null {
    const hasMarker = PROJECT_MARKERS.some(m => existsSync(join(dir, m)));
    if (!hasMarker) return null;

    try {
        // Suppress detectStack logs for workspace scan by detecting manually
        if (existsSync(join(dir, 'pubspec.yaml'))) return 'flutter';
        if (existsSync(join(dir, 'Package.swift'))) return 'swiftui';
        if (existsSync(join(dir, 'build.gradle.kts')) || existsSync(join(dir, 'build.gradle'))) return 'kotlin';
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

function injectWorkspaceReference(projectDir: string, workspaceDir: string, relPath: string): void {
    const claudeMd = join(projectDir, '.claude', 'CLAUDE.md');
    if (!existsSync(claudeMd)) return;

    const content = readFileSync(claudeMd, 'utf-8');
    if (content.includes('## Workspace Rules')) return; // already injected

    const depth = relPath.split('/').length; // 1 for flat, 2 for grouped
    const upPath = '../'.repeat(depth + 1);  // +1 for .claude/ dir

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
            case 'python': {
                const pyp = join(projectDir, 'pyproject.toml');
                if (existsSync(pyp)) {
                    const m = readFileSync(pyp, 'utf-8').match(/^name\s*=\s*"([^"]+)"/m);
                    if (m) packageName = m[1];
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

const KNOWN_STACKS: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'angular', 'swiftui', 'python'];

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
