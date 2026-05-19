/**
 * Claude Code agent orchestrator.
 * Extracted from src/generators/index.ts — generates all .claude/ governance files.
 */
import { join } from 'path';
import { chmodSync, existsSync, readdirSync } from 'fs';
import { createPatch } from 'diff';
import { isInteractiveTTY, readTTYLine } from '../../utils/tty.js';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { log } from '../../utils/logger.js';
import { generateRootClaudeMd, generateMasterClaudeMd } from './claude-md.js';
import { generateSettingsJson } from './settings-json.js';
import { generateConstitution } from '../../generators/constitution.js';
import { generateArchitecture } from '../../generators/architecture.js';
import { generateCodingStandards } from '../../generators/coding-standards.js';
import { generateAIUsagePolicy } from '../../generators/ai-usage-policy.js';
import { generateWorkflow } from '../../generators/workflow.js';
import { generateSpecFirstWorkflow } from '../../generators/spec-first-workflow.js';
import { generateFeatureReadme } from '../../generators/feature-readme.js';
import { generatePromptTemplates } from '../../generators/prompt-templates.js';
import { generateSpecTemplates } from '../../generators/spec-templates.js';
import { generateExtensions } from './extensions.js';
import { generateMonorepoGovernance } from '../../generators/monorepo.js';
import { generateAllHooks } from './hooks/index.js';
import { generateAuditCommand } from './commands/audit.js';
import { generateNewFeatureCommand } from './commands/new-feature.js';
import { generateEditFeatureCommand } from './commands/edit-feature.js';
import { generateFixCommand } from './commands/fix.js';
import { generateRefactorCommand } from './commands/refactor.js';
import { generateHotfixCommand } from './commands/hotfix.js';
import { generateExploreCommand } from './commands/explore.js';
import { generateAssessCommand } from './commands/assess.js';
import { generateTechKnowledgeCommand } from './commands/tech-knowledge.js';
import { generateProductKnowledgeCommand } from './commands/product-knowledge.js';
import { generateDetectConflictsCommand } from './commands/detect-conflicts.js';
import { generateKnowledgeCommand } from './commands/knowledge.js';
import { generateBacklogCommand } from './commands/backlog.js';
import { generatePlanPhasesCommand } from './commands/plan-phases.js';
import { generateJiraCommand } from './commands/jira.js';
import { generateTaskEstimates } from '../../generators/task-estimates.js';

export function generateClaudeCode(config: GovernanceConfig): void {
    console.log('');
    log.info('=== Governance Framework (Claude Code) ===');
    const dir = config.projectDir;

    // Build per-file conflict prompt closure for 'ask' mode
    let _approveAll = false;
    let _skipAll = false;
    const onConflict = (rel: string, existing: string, incoming: string): boolean => {
        if (_approveAll) return true;
        if (_skipAll) return false;

        process.stdout.write(`\n  Conflict: ${rel}\n`);

        // Non-interactive (CI / piped stdin): default to keep
        if (!isInteractiveTTY()) {
            process.stdout.write('  (non-interactive — keeping existing)\n');
            return false;
        }

        let answer = '';
        while (!['y', 'n', 'a', 's'].includes(answer)) {
            process.stdout.write('  Update? [y=yes / n=no / d=diff / a=all / s=skip all] ');
            answer = readTTYLine().toLowerCase();
            if (answer === '') answer = 'n';  // bare Enter = no (keep existing)
            if (answer === 'd') {
                const patch = createPatch(rel, existing, incoming, 'current', 'generated');
                const lines = patch.split('\n').slice(2);
                console.log('');
                for (const line of lines) {
                    if (line.startsWith('+') && !line.startsWith('+++')) {
                        process.stdout.write(`\x1b[32m${line}\x1b[0m\n`);
                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                        process.stdout.write(`\x1b[31m${line}\x1b[0m\n`);
                    } else if (line.startsWith('@@')) {
                        process.stdout.write(`\x1b[36m${line}\x1b[0m\n`);
                    } else {
                        process.stdout.write(`${line}\n`);
                    }
                }
                console.log('');
                answer = '';
            }
        }

        if (answer === 'a') { _approveAll = true; return true; }
        if (answer === 's') { _skipAll = true; return false; }
        return answer === 'y';
    };

    const opts: WriteOptions = {
        overwrite: config.overwrite, dryRun: config.dryRun,
        updateHooks: config.updateHooks, hookVersion: config.hookVersion,
        projectDir: dir,
        conflictMode: config.conflictMode,
        onConflict: config.conflictMode === 'ask' ? onConflict : undefined,
    };

    // Ensure .gitattributes for LF line endings on hooks
    safeWrite(join(dir, '.claude', '.gitattributes'), '*.sh text eol=lf\n', opts);

    if (config.updateHooks) {
        log.bold(`Updating stale hooks (v${config.hookVersion}):`);
        generateAllHooks(config, opts);
        makeExecutable(dir, config.dryRun);
        return;
    }

    log.section('Root:');
    safeWrite(join(dir, 'CLAUDE.md'), generateRootClaudeMd(), opts);
    safeWrite(join(dir, '.claude', 'CLAUDE.md'), generateMasterClaudeMd(config), opts);
    generateSettingsJson(config, opts);

    log.section('Steering:');
    safeWrite(join(dir, '.claude', 'steering', 'constitution.md'), generateConstitution(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'architecture.md'), generateArchitecture(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'coding-standards.md'), generateCodingStandards(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'ai-usage-policy.md'), generateAIUsagePolicy(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'workflow.md'), generateWorkflow(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'spec-first-workflow.md'), generateSpecFirstWorkflow(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'feature-readme.md'), generateFeatureReadme(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'prompt-templates.md'), generatePromptTemplates(config), opts);
    safeWrite(join(dir, '.claude', 'steering', 'task-estimates.md'), generateTaskEstimates(config), opts);

    log.section('Hooks:');
    generateAllHooks(config, opts);

    log.section('Extensions:');
    generateExtensions(config, opts);

    log.section('Commands:');
    safeWrite(join(dir, '.claude', 'commands', 'audit.md'), generateAuditCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'new-feature.md'), generateNewFeatureCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'edit-feature.md'), generateEditFeatureCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'fix.md'), generateFixCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'refactor.md'), generateRefactorCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'hotfix.md'), generateHotfixCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'explore.md'), generateExploreCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'assess.md'), generateAssessCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'tech-knowledge.md'), generateTechKnowledgeCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'product-knowledge.md'), generateProductKnowledgeCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'detect-conflicts.md'), generateDetectConflictsCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'knowledge.md'), generateKnowledgeCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'backlog.md'), generateBacklogCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'plan-phases.md'), generatePlanPhasesCommand(config), opts);
    safeWrite(join(dir, '.claude', 'commands', 'jira.md'), generateJiraCommand(config), opts);

    log.section('Spec templates:');
    generateSpecTemplates(config, opts);

    // Monorepo
    if (config.scan.detectedMonorepo) {
        generateMonorepoGovernance(config, opts);
    }

    makeExecutable(dir, config.dryRun);
}

function makeExecutable(dir: string, dryRun: boolean): void {
    if (dryRun) return;
    const hooksDir = join(dir, '.claude', 'hooks');
    const extDir = join(dir, '.claude', 'extensions');
    try {
        if (existsSync(hooksDir)) {
            for (const f of readdirSync(hooksDir)) {
                if (f.endsWith('.sh')) chmodSync(join(hooksDir, f), 0o755);
            }
        }
        const loadExt = join(extDir, 'load-extensions.sh');
        if (existsSync(loadExt)) chmodSync(loadExt, 0o755);
        for (const sub of ['jira-sync', 'retrospective', 'verify']) {
            const run = join(extDir, sub, 'run.sh');
            if (existsSync(run)) chmodSync(run, 0o755);
        }
        log.detected('Hooks + extensions executable');
    } catch { /* ignore chmod errors on Windows */ }
}

/**
 * Upgrade Claude Code governance files.
 * Always regenerates: hooks, git-hooks, commands, CLAUDE.md.
 * Optionally regenerates steering files (when force=true).
 */
export function upgradeClaudeCode(config: GovernanceConfig, opts: WriteOptions, force: boolean): void {
    const dir = config.projectDir;

    log.section('Upgrading hooks (.claude/hooks/):');
    generateAllHooks(config, opts);
    makeExecutable(dir, config.dryRun);

    log.section('Upgrading commands (.claude/commands/):');
    const cmdDir = join(dir, '.claude', 'commands');
    safeWrite(join(cmdDir, 'audit.md'), generateAuditCommand(config), opts);
    safeWrite(join(cmdDir, 'new-feature.md'), generateNewFeatureCommand(config), opts);
    safeWrite(join(cmdDir, 'edit-feature.md'), generateEditFeatureCommand(config), opts);
    safeWrite(join(cmdDir, 'fix.md'), generateFixCommand(config), opts);
    safeWrite(join(cmdDir, 'refactor.md'), generateRefactorCommand(config), opts);
    safeWrite(join(cmdDir, 'hotfix.md'), generateHotfixCommand(config), opts);
    safeWrite(join(cmdDir, 'explore.md'), generateExploreCommand(config), opts);
    safeWrite(join(cmdDir, 'assess.md'), generateAssessCommand(config), opts);
    safeWrite(join(cmdDir, 'tech-knowledge.md'), generateTechKnowledgeCommand(config), opts);
    safeWrite(join(cmdDir, 'product-knowledge.md'), generateProductKnowledgeCommand(config), opts);
    safeWrite(join(cmdDir, 'detect-conflicts.md'), generateDetectConflictsCommand(config), opts);
    safeWrite(join(cmdDir, 'knowledge.md'), generateKnowledgeCommand(config), opts);
    safeWrite(join(cmdDir, 'backlog.md'), generateBacklogCommand(config), opts);
    safeWrite(join(cmdDir, 'plan-phases.md'), generatePlanPhasesCommand(config), opts);
    safeWrite(join(cmdDir, 'jira.md'), generateJiraCommand(config), opts);

    log.section('Upgrading .claude/CLAUDE.md:');
    safeWrite(join(dir, '.claude', 'CLAUDE.md'), generateMasterClaudeMd(config), opts);

    if (force) {
        log.section('Upgrading steering files (--force):');
        const steeringDir = join(dir, '.claude', 'steering');
        safeWrite(join(steeringDir, 'architecture.md'), generateArchitecture(config), opts);
        safeWrite(join(steeringDir, 'coding-standards.md'), generateCodingStandards(config), opts);
        safeWrite(join(steeringDir, 'workflow.md'), generateWorkflow(config), opts);
        safeWrite(join(steeringDir, 'constitution.md'), generateConstitution(config), opts);
    } else {
        log.info('Steering files kept (use --force to also upgrade them)');
    }
}
