import { join } from 'path';
import type { GovernanceConfig } from '../../../types.js';
import { safeWrite, type WriteOptions } from '../../../utils/safe-write.js';
import { generateBlockDangerous } from './block-dangerous.js';
import { generateProtectFiles } from './protect-files.js';
import { generateSpecFirstGate } from './spec-first-gate.js';
import { generateFormatCode } from './format-code.js';
import { generateAnalyzeCode } from './analyze-code.js';
import { generateCheckSecrets } from './check-secrets.js';
import { generateSessionContinuity } from './session-continuity.js';
import { generatePostTaskChecklist } from './post-task-checklist.js';
import { generateHooksReadme } from './hooks-readme.js';
import { generatePreWriteSecretsGate } from './pre-write-secrets-gate.js';
import { generateWorkflowAudit } from './workflow-audit.js';
import { generateWorkflowAssess } from './workflow-assess.js';
import { generateWorkflowBacklog } from './workflow-backlog.js';
import { generateWorkflowNewFeature } from './workflow-new-feature.js';
import { generateWorkflowFix } from './workflow-fix.js';
import { generateWorkflowRefactor } from './workflow-refactor.js';
import { generateWorkflowHotfix } from './workflow-hotfix.js';
import { generateWorkflowExplore } from './workflow-explore.js';
import { generateWorkflowEditFeature } from './workflow-edit-feature.js';
import { generateWorkflowTechKnowledge } from './workflow-tech-knowledge.js';
import { generateWorkflowProductKnowledge } from './workflow-product-knowledge.js';
import { generateWorkflowDetectConflicts } from './workflow-detect-conflicts.js';
import { generateWorkflowJiraSync } from './workflow-jira-sync.js';
import { generateWorkflowPlanPhases } from './workflow-plan-phases.js';

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

    // fileEdited hooks
    w('check-secrets.kiro.hook', generateCheckSecrets(config));

    // promptSubmit hooks
    w('session-continuity.kiro.hook', generateSessionContinuity(config));

    // postTaskExecution hooks
    w('analyze-code.kiro.hook', generateAnalyzeCode(config));        // null if no linter — runs once per task, not per file
    w('post-task-checklist.kiro.hook', generatePostTaskChecklist(config));

    // userTriggered workflow hooks
    w('workflow-audit.kiro.hook', generateWorkflowAudit(config));
    w('workflow-assess.kiro.hook', generateWorkflowAssess(config));
    w('workflow-backlog.kiro.hook', generateWorkflowBacklog(config));
    w('workflow-new-feature.kiro.hook', generateWorkflowNewFeature(config));
    w('workflow-fix.kiro.hook', generateWorkflowFix(config));
    w('workflow-refactor.kiro.hook', generateWorkflowRefactor(config));
    w('workflow-hotfix.kiro.hook', generateWorkflowHotfix(config));
    w('workflow-explore.kiro.hook', generateWorkflowExplore(config));
    w('workflow-edit-feature.kiro.hook', generateWorkflowEditFeature(config));
    w('workflow-tech-knowledge.kiro.hook', generateWorkflowTechKnowledge(config));
    w('workflow-product-knowledge.kiro.hook', generateWorkflowProductKnowledge(config));
    w('workflow-detect-conflicts.kiro.hook', generateWorkflowDetectConflicts(config));
    w('workflow-jira-sync.kiro.hook', generateWorkflowJiraSync(config));
    w('workflow-plan-phases.kiro.hook', generateWorkflowPlanPhases(config));

    // README
    w('README.md', generateHooksReadme(config));
}
