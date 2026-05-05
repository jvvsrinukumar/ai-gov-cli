/**
 * ai-gov onboard — new developer setup.
 *
 * Run this once after cloning a repo that already has ai-gov governance.
 * It installs the local .git/hooks/ wrappers and verifies the setup is complete.
 * Does NOT regenerate any governance files — those come from git.
 *
 * Usage:
 *   npx ai-gov onboard           # set up current directory
 *   npx ai-gov onboard --dir ./my-project
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';
import { log } from '../utils/logger.js';
import { installGitHookWrappers } from './init-git-hooks.js';

export interface OnboardOptions {
    dir: string;
}

export function runOnboard(options: OnboardOptions): void {
    const projectDir = resolve(options.dir);

    log.header('AI Governance — Developer Onboard');
    console.log(`  Project: ${projectDir}`);
    console.log('');

    let issues = 0;
    const ok = (msg: string) => console.log(`  ✓ ${msg}`);
    const fail = (msg: string, fix?: string) => {
        console.log(`  ✗ ${msg}`);
        if (fix) console.log(`    Fix: ${fix}`);
        issues++;
    };
    const warn = (msg: string) => console.log(`  ⚠  ${msg}`);

    // 1. Detect agent from existing directory
    const hasKiro = existsSync(join(projectDir, '.kiro'));
    const hasClaude = existsSync(join(projectDir, '.claude'));
    const agent = hasKiro ? 'kiro' : hasClaude ? 'claude-code' : null;
    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';

    if (!agent) {
        fail('Neither .kiro/ nor .claude/ found', 'Team lead must run: npx ai-gov init first');
        console.log('');
        console.log('  This project has not been initialised with ai-gov yet.');
        console.log("  Ask your team lead to run 'npx ai-gov init' and commit governance files.");
        console.log('');
        process.exit(1);
    }
    ok(`${agentDir}/ governance files present (agent: ${agent})`);

    // 2. Verify git repo
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gitDir)) {
        fail('Not a git repository', 'Run: git init');
        console.log('');
        process.exit(1);
    }
    ok('.git/ repository present');

    // 3. Check runtime availability (needed for git hook bash scripts)
    let python3Ok = false;
    let jqOk = false;
    try { execSync('command -v python3', { stdio: 'pipe' }); python3Ok = true; } catch { /* not installed */ }
    try { execSync('command -v jq', { stdio: 'pipe' }); jqOk = true; } catch { /* not installed */ }

    if (python3Ok) {
        ok('python3 available — git hooks will run');
    } else if (jqOk) {
        ok('jq available — git hooks will run (install python3 for best experience)');
    } else {
        fail('Neither python3 nor jq is installed — git hooks will not run',
            process.platform === 'darwin' ? 'brew install python3' :
                process.platform === 'win32' ? 'winget install Python.Python.3' :
                    'apt install python3');
    }

    // 4. Check git hook wrappers — install if missing
    const preCommitWrapper = join(gitDir, 'hooks', 'pre-commit');
    const commitMsgWrapper = join(gitDir, 'hooks', 'commit-msg');

    const preCommitMissing = !existsSync(preCommitWrapper);
    const commitMsgMissing = !existsSync(commitMsgWrapper);

    if (!preCommitMissing && !commitMsgMissing) {
        const preContent = readFileSync(preCommitWrapper, 'utf-8');
        const msgContent = readFileSync(commitMsgWrapper, 'utf-8');
        if (preContent.includes('ai-gov') && msgContent.includes('ai-gov')) {
            ok('.git/hooks/pre-commit wrapper installed');
            ok('.git/hooks/commit-msg wrapper installed');
        } else {
            warn('.git/hooks/pre-commit exists but is not an ai-gov wrapper');
            warn(`  Run 'npx ai-gov init --git-hooks --force' to replace it, or add manually:`);
            warn(`  bash ${agentDir}/git-hooks/pre-commit.sh`);
        }
    } else {
        console.log('  Installing git hook wrappers...');
        installGitHookWrappers(projectDir, false, false, agent);

        if (existsSync(preCommitWrapper)) {
            ok('.git/hooks/pre-commit wrapper installed');
            ok('.git/hooks/commit-msg wrapper installed');
        } else {
            fail('Could not install git hook wrappers',
                'Run: npx ai-gov init --git-hooks');
        }
    }

    // 5. Validate config.json if present (git hooks config is agent-agnostic in location)
    const configPath = join(projectDir, agentDir, 'git-hooks', 'config.json');
    if (existsSync(configPath)) {
        ok(`${agentDir}/git-hooks/config.json present`);
    } else {
        warn(`${agentDir}/git-hooks/config.json not found — run: npx ai-gov init --git-hooks`);
    }

    // 6. Summary
    console.log('');
    if (issues === 0) {
        log.header('Onboard complete — governance is active');
        console.log('  Every git commit will now be checked for:');
        console.log('    • File size (> 300 lines blocked)');
        console.log('    • Hardcoded secrets (AWS keys, tokens)');
        console.log('    • Commit message format (conventional commits)');
        console.log('    • TODOs and debug statements (warnings)');
        console.log('');
        if (agent === 'kiro') {
            console.log('  Kiro hooks are active (from .kiro/hooks/ JSON files in git).');
        } else {
            console.log('  Claude Code hooks are active (from .claude/hooks/ in git).');
        }
        console.log('');
        console.log('  To bypass a specific commit (use sparingly):');
        console.log('    git commit --no-verify -m "your message"');
    } else {
        log.header(`Onboard: ${issues} issue(s) — fix above before committing`);
        console.log("  Re-run 'npx ai-gov onboard' after fixing.");
    }
    console.log('');
}
