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
import { generateWorkflowEditFeature } from './workflow-edit-feature.js';

export function generateAllKiroHooks(config: GovernanceConfig, opts: WriteOptions): void {
    const hooksDir = join(config.projectDir, '.kiro', 'hooks');

    const w = (name: string, content: string | null) => {
        if (content !== null) {
            safeWrite(join(hooksDir, name), content, opts);
        }
    };

    // preToolUse hooks
    w('block-dangerous-commands.kiro.hook', generateBlockDangerous(config));
    w('protect-files.kiro.hook', generateProtectFiles(config));
    w('pre-write-secrets-gate.kiro.hook', generatePreWriteSecretsGate(config));
    w('spec-first-gate.kiro.hook', generateSpecFirstGate(config));  // null if specFirstEnabled=false

    // postToolUse hooks
    w('format-code.kiro.hook', generateFormatCode(config));          // null if no formatter
    w('analyze-code.kiro.hook', generateAnalyzeCode(config));        // null if no linter
    w('check-file-size.kiro.hook', generateCheckFileSize(config));
    w('check-feature-readme.kiro.hook', generateCheckFeatureReadme(config));
    w('check-consistency.kiro.hook', generateCheckConsistency(config));

    // fileEdited hooks
    w('check-secrets.kiro.hook', generateCheckSecrets(config));

    // promptSubmit hooks
    w('session-continuity.kiro.hook', generateSessionContinuity(config));
    w('require-task-type.kiro.hook', generateRequireTaskType(config));

    // postTaskExecution hooks
    w('post-task-checklist.kiro.hook', generatePostTaskChecklist(config));

    // userTriggered workflow hooks
    w('workflow-audit.kiro.hook', generateWorkflowAudit(config));
    w('workflow-new-feature.kiro.hook', generateWorkflowNewFeature(config));
    w('workflow-fix.kiro.hook', generateWorkflowFix(config));
    w('workflow-refactor.kiro.hook', generateWorkflowRefactor(config));
    w('workflow-hotfix.kiro.hook', generateWorkflowHotfix(config));
    w('workflow-explore.kiro.hook', generateWorkflowExplore(config));
    w('workflow-edit-feature.kiro.hook', generateWorkflowEditFeature(config));

    // README
    w('README.md', generateHooksReadme(config));
}
