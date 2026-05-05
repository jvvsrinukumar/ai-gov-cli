import { join } from 'path';
import { chmodSync, mkdirSync } from 'fs';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { log } from '../../utils/logger.js';
import { generateGitHooksConfig } from './config.js';
import { generatePreCommit } from './pre-commit.js';
import { generateCommitMsg } from './commit-msg.js';
import { generateFileSizeCheck } from './checks/file-size.js';
import { generateSecretsCheck } from './checks/secrets.js';
import { generateNoTodosCheck } from './checks/no-todos.js';
import { generateNoDebug } from './checks/no-debug.js';
import { generateFormatCheck } from './checks/format-check.js';
import { generateLintCheck } from './checks/lint-check.js';

export function generateGitHooks(config: GovernanceConfig, projectDir: string): void {
    const agentDir = config.agent === 'kiro' ? '.kiro' : '.claude';
    const hooksDir = join(projectDir, agentDir, 'git-hooks');
    const checksDir = join(hooksDir, 'checks');

    mkdirSync(checksDir, { recursive: true });

    const opts: WriteOptions = {
        overwrite: true,
        dryRun: config.dryRun,
        updateHooks: false,
        hookVersion: config.hookVersion,
        projectDir,
        conflictMode: 'overwrite',
    };

    log.section('Git Hooks:');

    safeWrite(join(hooksDir, 'config.json'), generateGitHooksConfig(), opts);
    safeWrite(join(hooksDir, 'pre-commit.sh'), generatePreCommit(), opts);
    safeWrite(join(hooksDir, 'commit-msg.sh'), generateCommitMsg(), opts);
    safeWrite(join(checksDir, 'file-size.sh'), generateFileSizeCheck(), opts);
    safeWrite(join(checksDir, 'secrets.sh'), generateSecretsCheck(), opts);
    safeWrite(join(checksDir, 'no-todos.sh'), generateNoTodosCheck(), opts);
    safeWrite(join(checksDir, 'no-debug.sh'), generateNoDebug(config), opts);
    safeWrite(join(checksDir, 'format-check.sh'), generateFormatCheck(config), opts);
    safeWrite(join(checksDir, 'lint-check.sh'), generateLintCheck(config), opts);

    if (!config.dryRun) {
        const shFiles = [
            join(hooksDir, 'pre-commit.sh'),
            join(hooksDir, 'commit-msg.sh'),
            join(checksDir, 'file-size.sh'),
            join(checksDir, 'secrets.sh'),
            join(checksDir, 'no-todos.sh'),
            join(checksDir, 'no-debug.sh'),
            join(checksDir, 'format-check.sh'),
            join(checksDir, 'lint-check.sh'),
        ];
        for (const f of shFiles) {
            try { chmodSync(f, 0o755); } catch { /* ignore on Windows */ }
        }
        log.detected('Git hook scripts made executable');
    }
}
