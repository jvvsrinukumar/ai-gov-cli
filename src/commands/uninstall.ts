import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import type { Agent } from '../types.js';
import { log } from '../utils/logger.js';

export interface UninstallOptions {
    projectDir: string;
    gitHooks?: boolean;
    ci?: string | true;  // true when --ci used without platform arg (Commander optional-value)
    prCheck?: boolean;
    all?: boolean;
    dryRun?: boolean;
    agent: Agent;
}

export function runUninstall(opts: UninstallOptions): void {
    const { projectDir, dryRun = false, agent } = opts;

    const hasAction = opts.gitHooks || opts.ci !== undefined || opts.prCheck || opts.all;
    if (!hasAction) {
        log.header('AI Governance Uninstall');
        log.warn('Nothing specified. Use one or more flags:');
        console.log('');
        console.log('  --git-hooks           Remove .git/hooks/pre-commit and commit-msg wrappers');
        console.log('  --ci [platform]       Remove CI governance workflow (github|gitlab|bitbucket)');
        console.log('  --pr-check            Remove pr-check job from CI (auto-detects platform)');
        console.log('  --all                 Remove git-hooks wrappers + all CI governance files');
        console.log('  --dry-run             Preview removals without writing');
        console.log('');
        console.log('  Examples:');
        console.log('    ai-gov uninstall --git-hooks');
        console.log('    ai-gov uninstall --ci github');
        console.log('    ai-gov uninstall --ci             # auto-detect platform');
        console.log('    ai-gov uninstall --pr-check');
        console.log('    ai-gov uninstall --all --dry-run');
        console.log('');
        return;
    }

    log.header('AI Governance Uninstall');
    if (dryRun) console.log('  Dry run: no files will be removed\n');

    if (opts.all) {
        uninstallGitHooks(projectDir, dryRun, agent);
        uninstallCI(projectDir, 'auto', dryRun);
        return;
    }

    if (opts.gitHooks) uninstallGitHooks(projectDir, dryRun, agent);

    if (opts.ci !== undefined) {
        const platform = (opts.ci === true || opts.ci === '') ? 'auto' : opts.ci;
        uninstallCI(projectDir, platform, dryRun);
    }

    if (opts.prCheck) uninstallPRCheck(projectDir, dryRun);
}

// ---------------------------------------------------------------------------
// Git hooks
// ---------------------------------------------------------------------------

function uninstallGitHooks(projectDir: string, dryRun: boolean, agent: Agent): void {
    log.section('  Git Hook Wrappers (.git/hooks/)');
    console.log('');

    const gitHooksDir = join(projectDir, '.git', 'hooks');
    if (!existsSync(gitHooksDir)) {
        log.warn('.git/hooks/ directory not found — not a git repo or hooks dir missing');
        console.log('');
        return;
    }

    let anyRemoved = false;
    for (const hook of ['pre-commit', 'commit-msg'] as const) {
        const hookPath = join(gitHooksDir, hook);
        if (!existsSync(hookPath)) {
            log.warn(`.git/hooks/${hook} — not found, skipping`);
            continue;
        }
        const content = readFileSync(hookPath, 'utf-8');
        if (!content.includes('ai-gov')) {
            log.warn(`.git/hooks/${hook} — not an ai-gov wrapper, skipping`);
            continue;
        }
        if (dryRun) {
            log.dryUpdate(`.git/hooks/${hook}`);
        } else {
            rmSync(hookPath);
            log.success(`  Removed: .git/hooks/${hook}`);
            anyRemoved = true;
        }
    }

    if (anyRemoved || dryRun) {
        const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
        console.log('');
        log.warn(`${agentDir}/git-hooks/ scripts (committed to repo) were not touched.`);
        log.info(`  To fully remove: git rm -r ${agentDir}/git-hooks/ && git commit`);
    }
    console.log('');
}

// ---------------------------------------------------------------------------
// CI workflow files
// ---------------------------------------------------------------------------

function uninstallCI(projectDir: string, platform: string, dryRun: boolean): void {
    log.section('  CI Governance Workflow');
    console.log('');

    if (platform === 'auto') {
        const detected = detectCIPlatforms(projectDir);
        if (detected.length === 0) {
            log.warn('No ai-gov CI files detected');
            console.log('');
            return;
        }
        for (const p of detected) {
            removeCIPlatform(projectDir, p, dryRun);
        }
    } else {
        removeCIPlatform(projectDir, platform, dryRun);
    }
    console.log('');
}

function removeCIPlatform(projectDir: string, platform: string, dryRun: boolean): void {
    switch (platform.toLowerCase()) {
        case 'github': {
            const path = join(projectDir, '.github', 'workflows', 'governance-check.yml');
            if (!existsSync(path)) {
                log.warn('.github/workflows/governance-check.yml — not found, skipping');
                return;
            }
            if (dryRun) {
                log.dryUpdate('.github/workflows/governance-check.yml');
            } else {
                rmSync(path);
                log.success('  Removed: .github/workflows/governance-check.yml');
            }
            break;
        }
        case 'gitlab': {
            const path = join(projectDir, '.gitlab-ci.yml');
            if (!existsSync(path)) {
                log.warn('.gitlab-ci.yml — not found, skipping');
                return;
            }
            const content = readFileSync(path, 'utf-8');
            if (!content.includes('governance-check:')) {
                log.warn('.gitlab-ci.yml — no governance-check job found, skipping');
                return;
            }
            const stripped = stripGitlabGovernanceJob(content);
            // Delete file when no actual jobs remain (only stages boilerplate or empty)
            if (!hasNonStagesTopLevelKeys(stripped)) {
                if (dryRun) {
                    log.dryUpdate('.gitlab-ci.yml (would be removed — no jobs remain after strip)');
                } else {
                    rmSync(path);
                    log.success('  Removed: .gitlab-ci.yml');
                }
            } else {
                if (dryRun) {
                    log.dryUpdate('.gitlab-ci.yml (would remove governance-check job section)');
                } else {
                    writeFileSync(path, stripped);
                    log.success('  Updated: .gitlab-ci.yml (removed governance-check job)');
                }
            }
            break;
        }
        case 'bitbucket': {
            const path = join(projectDir, 'bitbucket-pipelines.yml');
            if (!existsSync(path)) {
                log.warn('bitbucket-pipelines.yml — not found, skipping');
                return;
            }
            if (dryRun) {
                log.dryUpdate('bitbucket-pipelines.yml');
            } else {
                rmSync(path);
                log.success('  Removed: bitbucket-pipelines.yml');
            }
            break;
        }
        default:
            log.warn(`Unknown CI platform: ${platform}. Use github, gitlab, or bitbucket.`);
    }
}

// ---------------------------------------------------------------------------
// PR check — surgically remove governance job from detected CI files
// ---------------------------------------------------------------------------

function uninstallPRCheck(projectDir: string, dryRun: boolean): void {
    log.section('  PR Check CI Integration');
    console.log('');

    const detected = detectCIPlatforms(projectDir);
    if (detected.length === 0) {
        log.warn('No ai-gov CI files detected — nothing to remove');
        console.log('');
        return;
    }

    for (const p of detected) {
        removeCIPlatform(projectDir, p, dryRun);
    }
    console.log('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectCIPlatforms(projectDir: string): string[] {
    const platforms: string[] = [];

    if (existsSync(join(projectDir, '.github', 'workflows', 'governance-check.yml'))) {
        platforms.push('github');
    }

    const gitlabPath = join(projectDir, '.gitlab-ci.yml');
    if (existsSync(gitlabPath)) {
        const content = readFileSync(gitlabPath, 'utf-8');
        if (content.includes('governance-check:')) platforms.push('gitlab');
    }

    const bitbucketPath = join(projectDir, 'bitbucket-pipelines.yml');
    if (existsSync(bitbucketPath)) {
        const content = readFileSync(bitbucketPath, 'utf-8');
        if (content.includes('ai-gov')) platforms.push('bitbucket');
    }

    return platforms;
}

// Returns true if the YAML content has at least one top-level key that is not
// `stages:` — used to decide whether to delete or rewrite .gitlab-ci.yml.
function hasNonStagesTopLevelKeys(content: string): boolean {
    return content.split('\n').some(line =>
        line.length > 0 &&
        !line.startsWith(' ') &&
        !line.startsWith('\t') &&
        !line.startsWith('#') &&
        !line.startsWith('stages:')
    );
}

// Remove the `governance-check:` job block from GitLab CI YAML.
// Preserves all other top-level jobs and content in the file.
export function stripGitlabGovernanceJob(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inJob = false;

    for (const line of lines) {
        if (line.startsWith('governance-check:')) {
            inJob = true;
            continue;
        }
        if (inJob) {
            // Next top-level key (non-indented, non-blank, non-comment) ends the job block
            if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && !line.startsWith('#')) {
                inJob = false;
            } else {
                continue;
            }
        }
        result.push(line);
    }

    // Collapse excessive blank lines and normalise trailing newline
    return result.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
