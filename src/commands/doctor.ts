import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { detectAgent } from '../agents/detect-agent.js';
import { validateGitHooksConfig } from '../utils/validate-git-hooks-config.js';
import { log } from '../utils/logger.js';
import { runProductionReady } from './doctor-production-ready.js';

export async function runDoctor(options: { dir: string; agent?: string; productionReady?: boolean }): Promise<void> {
    const { dir } = options;
    if (options.productionReady) {
        await runProductionReady({ dir, agent: options.agent });
        return;
    }
    const agent = detectAgent(dir, options.agent);
    let issues = 0;
    const check = (label: string, ok: boolean) => {
        console.log(`  ${ok ? '✓' : '✗'} ${label}`);
        if (!ok) issues++;
    };

    log.header(`AI Governance Doctor (${agent})`);

    if (agent === 'kiro') {
        check('.kiro/steering/ exists', existsSync(join(dir, '.kiro', 'steering')));
        check('.kiro/hooks/ exists', existsSync(join(dir, '.kiro', 'hooks')));

        const steeringFiles = ['constitution.md', 'architecture.md', 'coding-standards.md',
            'ai-usage-policy.md', 'workflow.md', 'spec-first-workflow.md',
            'feature-readme.md', 'prompt-templates.md'];
        for (const f of steeringFiles) {
            check(`  steering/${f}`, existsSync(join(dir, '.kiro', 'steering', f)));
        }

        for (const f of steeringFiles) {
            const fp = join(dir, '.kiro', 'steering', f);
            if (existsSync(fp)) {
                const content = readFileSync(fp, 'utf-8');
                check(`  ${f} has front-matter`, content.startsWith('---\n'));
            }
        }

        const hooksDir = join(dir, '.kiro', 'hooks');
        if (existsSync(hooksDir)) {
            const hookFiles = ['block-dangerous-commands.json', 'protect-files.json',
                'check-secrets.json', 'check-file-size.json', 'check-feature-readme.json',
                'check-consistency.json', 'session-continuity.json', 'require-task-type.json',
                'post-task-checklist.json'];
            for (const h of hookFiles) {
                const hp = join(hooksDir, h);
                const exists = existsSync(hp);
                check(`  hooks/${h}`, exists);
                if (exists) {
                    try {
                        const json = JSON.parse(readFileSync(hp, 'utf-8'));
                        check(`  ${h} valid JSON schema`, !!(json.name && json.version && json.when && json.then));
                    } catch {
                        check(`  ${h} valid JSON`, false);
                    }
                }
            }
        }

        check('.kiro/specs/_template/requirements.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'requirements.md')));
        check('.kiro/specs/_template/design.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'design.md')));
        check('.kiro/specs/_template/tasks.md', existsSync(join(dir, '.kiro', 'specs', '_template', 'tasks.md')));
    } else {
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
    }

    const { execSync } = await import('child_process');
    let python3Ok = false;
    let jqOk = false;
    try { execSync('command -v python3', { stdio: 'pipe' }); python3Ok = true; } catch { /* not installed */ }
    try { execSync('command -v jq', { stdio: 'pipe' }); jqOk = true; } catch { /* not installed */ }
    check('python3 installed (required for hooks — preferred)', python3Ok);
    if (!python3Ok) check('jq installed (fallback if python3 missing)', jqOk);

    if (!python3Ok && !jqOk) {
        console.log('');
        console.log('  CRITICAL: Neither python3 nor jq is installed.');
        console.log('  All governance hooks will silently skip — nothing is enforced.');
        console.log('');
        console.log('  Fix:  brew install python3   (macOS)');
        console.log('        apt install python3    (Ubuntu/Debian)');
        console.log('        winget install Python  (Windows)');
        issues++;
    }

    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
    const configPath = join(dir, agentDir, 'git-hooks', 'config.json');
    if (existsSync(configPath)) {
        const configIssues = validateGitHooksConfig(configPath);
        if (configIssues.length === 0) {
            check(`${agentDir}/git-hooks/config.json valid`, true);
        } else {
            check(`${agentDir}/git-hooks/config.json valid`, false);
            for (const issue of configIssues) {
                console.log(`     ⚠  ${issue}`);
            }
            issues++;
        }
    }

    const gitHooksDir = join(dir, '.git', 'hooks');
    if (existsSync(join(dir, '.git'))) {
        check('.git/hooks/pre-commit wrapper installed', existsSync(join(gitHooksDir, 'pre-commit')));
        check('.git/hooks/commit-msg wrapper installed', existsSync(join(gitHooksDir, 'commit-msg')));
    }

    console.log('');
    if (issues === 0) log.success('All checks passed!');
    else log.warn(`${issues} issue(s) found. Run 'ai-gov init' to fix.`);
    if (!python3Ok && !jqOk) process.exit(1);
}
