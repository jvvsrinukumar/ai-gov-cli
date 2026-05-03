import { join } from 'path';
import type { GovernanceConfig } from '../../../types.js';
import { safeWrite, type WriteOptions } from '../../../utils/safe-write.js';
import { generateBlockDangerous } from './block-dangerous.js';
import { generateProtectFiles } from './protect-files.js';
import { generateSpecFirstGate } from './spec-first-gate.js';
import { generateFormatCode } from './format-code.js';
import { generateAnalyzeCode } from './analyze-code.js';
import { generateCheckFileSize } from './check-file-size.js';
import { generateCheckSecrets } from './check-secrets.js';
import { generateSessionContinuity } from './session-continuity.js';
import { generatePostTaskChecklist } from './post-task-checklist.js';
import { generateCheckFeatureReadme } from './check-feature-readme.js';
import { generateCheckConsistency } from './check-consistency.js';
import { generateRequireTaskType } from './require-task-type.js';
import { generateHooksReadme } from './hooks-readme.js';
import { generatePreWriteSecretsGate } from './pre-write-secrets-gate.js';
import { generateWorkflowAudit } from './workflow-audit.js';
import { generateWorkflowNewFeature } from './workflow-new-feature.js';
import { generateWorkflowFix } from './workflow-fix.js';
import { generateWorkflowRefactor } from './workflow-refactor.js';
import { generateWorkflowHotfix } from './workflow-hotfix.js';
import { generateWorkflowExplore } from './workflow-explore.js';

export function generateAllKiroHooks(config: GovernanceConfig, opts: WriteOptions): void {
    const hooksDir = join(config.projectDir, '.kiro', 'hooks');

    const w = (name: string, content: string | null) => {
        if (content !== null) {
            safeWrite(join(hooksDir, name), content, opts);
        }
    };

    // preToolUse hooks
    w('block-dangerous-commands.json', generateBlockDangerous(config));
    w('protect-files.json', generateProtectFiles(config));
    w('pre-write-secrets-gate.json', generatePreWriteSecretsGate(config));
    w('spec-first-gate.json', generateSpecFirstGate(config));  // null if specFirstEnabled=false

    // postToolUse hooks
    w('format-code.json', generateFormatCode(config));          // null if no formatter
    w('analyze-code.json', generateAnalyzeCode(config));        // null if no linter
    w('check-file-size.json', generateCheckFileSize(config));
    w('check-feature-readme.json', generateCheckFeatureReadme(config));
    w('check-consistency.json', generateCheckConsistency(config));

    // fileEdited hooks
    w('check-secrets.json', generateCheckSecrets(config));

    // promptSubmit hooks
    w('session-continuity.json', generateSessionContinuity(config));
    w('require-task-type.json', generateRequireTaskType(config));

    // postTaskExecution hooks
    w('post-task-checklist.json', generatePostTaskChecklist(config));

    // userTriggered workflow hooks
    w('workflow-audit.json', generateWorkflowAudit(config));
    w('workflow-new-feature.json', generateWorkflowNewFeature(config));
    w('workflow-fix.json', generateWorkflowFix(config));
    w('workflow-refactor.json', generateWorkflowRefactor(config));
    w('workflow-hotfix.json', generateWorkflowHotfix(config));
    w('workflow-explore.json', generateWorkflowExplore(config));

    // README
    w('README.md', generateHooksReadme(config));
}
