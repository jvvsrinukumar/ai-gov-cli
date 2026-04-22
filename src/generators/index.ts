import { join } from 'path';
import { chmodSync, existsSync, readdirSync } from 'fs';
import type { GovernanceConfig } from '../types.js';
import { safeWrite, type WriteOptions } from '../utils/safe-write.js';
import { log } from '../utils/logger.js';
import { generateRootClaudeMd, generateMasterClaudeMd } from './claude-md.js';
import { generateSettingsJson } from './settings-json.js';
import { generateConstitution } from './constitution.js';
import { generateArchitecture } from './architecture.js';
import { generateCodingStandards } from './coding-standards.js';
import { generateAIUsagePolicy } from './ai-usage-policy.js';
import { generateWorkflow } from './workflow.js';
import { generateSpecFirstWorkflow } from './spec-first-workflow.js';
import { generateFeatureReadme } from './feature-readme.js';
import { generatePromptTemplates } from './prompt-templates.js';
import { generateSpecTemplates } from './spec-templates.js';
import { generateExtensions } from './extensions.js';
import { generateMonorepoGovernance } from './monorepo.js';
import { generateAllHooks } from './hooks/index.js';

export function runGovernance(config: GovernanceConfig): void {
    console.log('');
    log.info('=== Governance Framework (Claude Code) ===');
    const dir = config.projectDir;
    const opts: WriteOptions = {
        overwrite: config.overwrite, dryRun: config.dryRun,
        updateHooks: config.updateHooks, hookVersion: config.hookVersion,
        projectDir: dir,
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

    log.section('Hooks:');
    generateAllHooks(config, opts);

    log.section('Extensions:');
    generateExtensions(config, opts);

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
