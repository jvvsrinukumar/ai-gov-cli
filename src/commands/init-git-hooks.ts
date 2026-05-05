import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { chmodSync } from 'fs';
import type { Agent } from '../types.js';
import { log } from '../utils/logger.js';

export function detectExistingHookSystem(projectDir: string): string | null {
    if (existsSync(join(projectDir, '.husky'))) return 'husky';
    if (existsSync(join(projectDir, '.pre-commit-config.yaml'))) return 'pre-commit';
    if (existsSync(join(projectDir, 'lefthook.yml'))) return 'lefthook';
    if (existsSync(join(projectDir, '.lefthook.yml'))) return 'lefthook';

    // Check if .git/hooks/pre-commit exists and is NOT our wrapper
    const hook = join(projectDir, '.git', 'hooks', 'pre-commit');
    if (existsSync(hook)) {
        const content = readFileSync(hook, 'utf-8');
        if (!content.includes('ai-gov')) return 'custom';
    }
    return null;
}

export function installGitHookWrappers(projectDir: string, force: boolean, dryRun = false, agent: Agent = 'claude-code'): void {
    const agentHookDir = agent === 'kiro' ? '.kiro' : '.claude';
    const existing = detectExistingHookSystem(projectDir);

    if (existing && !force) {
        console.log('');
        console.log(`  Existing hook system detected: ${existing}`);
        console.log('');
        console.log(`  ai-gov scripts are generated in ${agentHookDir}/git-hooks/ (committed to repo).`);

        const integrationGuide: Record<string, string[]> = {
            husky: [
                `  To integrate with husky, add to .husky/pre-commit:`,
                '',
                `    bash ${agentHookDir}/git-hooks/pre-commit.sh`,
                '',
                '  And add to .husky/commit-msg:',
                '',
                `    bash ${agentHookDir}/git-hooks/commit-msg.sh "$1"`,
            ],
            lefthook: [
                '  To integrate with lefthook, add to lefthook.yml:',
                '',
                '    pre-commit:',
                '      commands:',
                '        ai-gov:',
                `          run: bash ${agentHookDir}/git-hooks/pre-commit.sh`,
                '    commit-msg:',
                '      commands:',
                '        ai-gov:',
                `          run: bash ${agentHookDir}/git-hooks/commit-msg.sh {1}`,
            ],
            'pre-commit': [
                '  To integrate with pre-commit, add to .pre-commit-config.yaml:',
                '',
                '    - repo: local',
                '      hooks:',
                '        - id: ai-gov-pre-commit',
                '          name: ai-gov governance',
                `          entry: bash ${agentHookDir}/git-hooks/pre-commit.sh`,
                '          language: system',
                '          pass_filenames: false',
            ],
            custom: [
                '  To integrate, add to your existing .git/hooks/pre-commit:',
                '',
                `    bash ${agentHookDir}/git-hooks/pre-commit.sh`,
                '',
                '  And add to .git/hooks/commit-msg:',
                '',
                `    bash ${agentHookDir}/git-hooks/commit-msg.sh "$1"`,
            ],
        };

        const guide = integrationGuide[existing] || integrationGuide['custom'];
        for (const line of guide) console.log(line);

        console.log('');
        console.log('  Or to replace entirely:');
        console.log(`    ai-gov init --git-hooks --force${agent === 'kiro' ? ' --agent kiro' : ''}`);
        console.log('');
        return;
    }

    if (dryRun) {
        log.dryNew('.git/hooks/pre-commit', 3);
        log.dryNew('.git/hooks/commit-msg', 3);
        return;
    }

    const gitHooksDir = join(projectDir, '.git', 'hooks');
    if (!existsSync(gitHooksDir)) {
        mkdirSync(gitHooksDir, { recursive: true });
    }

    // Use dirname-relative path: .git/hooks/ is always two levels below repo root.
    // Avoids $(git rev-parse --show-toplevel) which returns Windows paths (C:\...)
    // on native Git Bash and breaks the exec call.
    const preCommitWrapper = `#!/usr/bin/env bash
# Installed by ai-gov — calls ${agentHookDir}/git-hooks/pre-commit.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/${agentHookDir}/git-hooks/pre-commit.sh" "$@"
`;

    const commitMsgWrapper = `#!/usr/bin/env bash
# Installed by ai-gov — calls ${agentHookDir}/git-hooks/commit-msg.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/${agentHookDir}/git-hooks/commit-msg.sh" "$1"
`;

    writeFileSync(join(gitHooksDir, 'pre-commit'), preCommitWrapper);
    writeFileSync(join(gitHooksDir, 'commit-msg'), commitMsgWrapper);

    try {
        chmodSync(join(gitHooksDir, 'pre-commit'), 0o755);
        chmodSync(join(gitHooksDir, 'commit-msg'), 0o755);
    } catch { /* ignore on Windows */ }

    log.created('.git/hooks/pre-commit');
    log.created('.git/hooks/commit-msg');
}
