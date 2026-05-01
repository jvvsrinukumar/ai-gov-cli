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
    const ok  = (msg: string) => console.log(`  ✓ ${msg}`);
    const fail = (msg: string, fix?: string) => {
        console.log(`  ✗ ${msg}`);
        if (fix) console.log(`    Fix: ${fix}`);
        issues++;
    };
    const warn = (msg: string) => console.log(`  ⚠  ${msg}`);

    // 1. Verify this project has been initialised by the team lead
    const claudeDir = join(projectDir, '.claude');
    if (!existsSync(claudeDir)) {
        fail('.claude/ not found', 'Team lead must run: npx ai-gov init first');
        console.log('');
        console.log('  This project has not been initialised with ai-gov yet.');
        console.log("  Ask your team lead to run 'npx ai-gov init' and commit .claude/");
        console.log('');
        process.exit(1);
    }
    ok('.claude/ governance files present');

    // 2. Verify git repo
    const gitDir = join(projectDir, '.git');
    if (!existsSync(gitDir)) {
        fail('Not a git repository', 'Run: git init');
        console.log('');
        process.exit(1);
    }
    ok('.git/ repository present');

    // 3. Check runtime availability
    let python3Ok = false;
    let jqOk = false;
    try { execSync('command -v python3', { stdio: 'pipe' }); python3Ok = true; } catch { /* not installed */ }
    try { execSync('command -v jq',      { stdio: 'pipe' }); jqOk = true; }      catch { /* not installed */ }

    if (python3Ok) {
        ok('python3 available — hooks will run');
    } else if (jqOk) {
        ok('jq available — hooks will run (install python3 for best experience)');
    } else {
        fail('Neither python3 nor jq is installed — governance hooks will not run',
            process.platform === 'darwin' ? 'brew install python3' :
            process.platform === 'win32'  ? 'winget install Python.Python.3' :
            'apt install python3');
    }

    // 4. Check git hook wrappers — install if missing
    const preCommitWrapper = join(gitDir, 'hooks', 'pre-commit');
    const commitMsgWrapper  = join(gitDir, 'hooks', 'commit-msg');

    const preCommitMissing = !existsSync(preCommitWrapper);
    const commitMsgMissing = !existsSync(commitMsgWrapper);

    if (!preCommitMissing && !commitMsgMissing) {
        // Check they point to ai-gov (not some other hook)
        const preContent = readFileSync(preCommitWrapper, 'utf-8');
        if (preContent.includes('ai-gov')) {
            ok('.git/hooks/pre-commit wrapper installed');
            ok('.git/hooks/commit-msg wrapper installed');
        } else {
            warn('.git/hooks/pre-commit exists but is not an ai-gov wrapper');
            warn("  Run 'npx ai-gov init --git-hooks --force' to replace it, or add manually:");
            warn('  bash .claude/git-hooks/pre-commit.sh');
        }
    } else {
        // Install the wrappers
        console.log('  Installing git hook wrappers...');
        installGitHookWrappers(projectDir, false, false);

        if (existsSync(preCommitWrapper)) {
            ok('.git/hooks/pre-commit wrapper installed');
            ok('.git/hooks/commit-msg wrapper installed');
        } else {
            fail('Could not install git hook wrappers',
                'Run: npx ai-gov init --git-hooks');
        }
    }

    // 5. Validate config.json if present
    const configPath = join(projectDir, '.claude', 'git-hooks', 'config.json');
    if (existsSync(configPath)) {
        ok('.claude/git-hooks/config.json present');
    } else {
        warn('.claude/git-hooks/config.json not found — run: npx ai-gov init --git-hooks');
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
        console.log('  Claude Code hooks are already active (from .claude/hooks/ in git).');
        console.log('');
        console.log('  To bypass a specific commit (use sparingly):');
        console.log('    git commit --no-verify -m "your message"');
    } else {
        log.header(`Onboard: ${issues} issue(s) — fix above before committing`);
        console.log("  Re-run 'npx ai-gov onboard' after fixing.");
    }
    console.log('');
}
