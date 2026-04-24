import { join } from 'path';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { generateProtectFiles } from './protect-files.js';
import { generateBlockDangerous } from './block-dangerous.js';
import { generateCheckSpecExists } from './check-spec-exists.js';
import { generateSessionContinuity } from './session-continuity.js';
import { generateFormatCode } from './format-code.js';
import { generateAnalyzeCode } from './analyze-code.js';
import { generateCheckFeatureReadme } from './check-feature-readme.js';
import { generateCheckConsistency } from './check-consistency.js';
import { generateCheckFileSize } from './check-file-size.js';
import { generatePostTaskChecklist } from './post-task-checklist.js';
import { generateHooksReadme } from './hooks-readme.js';
import { generateCheckSecrets } from './check-secrets.js';

export function generateAllHooks(config: GovernanceConfig, opts: WriteOptions): void {
    const hooksDir = join(config.projectDir, '.claude', 'hooks');
    const w = (name: string, content: string) => safeWrite(join(hooksDir, name), content, opts);

    w('protect-files.sh', generateProtectFiles(config));
    w('check-secrets.sh', generateCheckSecrets(config));
    w('block-dangerous-commands.sh', generateBlockDangerous(config));
    w('check-spec-exists.sh', generateCheckSpecExists(config));
    w('session-continuity.sh', generateSessionContinuity(config));
    w('format-code.sh', generateFormatCode(config));
    w('analyze-code.sh', generateAnalyzeCode(config));
    w('check-feature-readme.sh', generateCheckFeatureReadme(config));
    w('check-consistency.sh', generateCheckConsistency(config));
    w('check-file-size.sh', generateCheckFileSize(config));
    w('post-task-checklist.sh', generatePostTaskChecklist(config));
    w('README.md', generateHooksReadme(config));
}
