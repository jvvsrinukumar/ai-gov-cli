/**
 * Kiro agent orchestrator.
 * Generates .kiro/ governance files: steering (with front-matter), hooks (JSON),
 * spec templates, and git hooks.
 */
import { join } from 'path';
import type { GovernanceConfig } from '../../types.js';
import { safeWrite, type WriteOptions } from '../../utils/safe-write.js';
import { log } from '../../utils/logger.js';
import { wrapWithFrontMatter } from './steering.js';
import { generateAllKiroHooks } from './hooks/index.js';

// Shared content generators (agent-agnostic — same content as Claude Code)
import { generateConstitution } from '../../generators/constitution.js';
import { generateArchitecture } from '../../generators/architecture.js';
import { generateCodingStandards } from '../../generators/coding-standards.js';
import { generateWorkflow } from '../../generators/workflow.js';
import { generateDeveloperReference } from '../../generators/developer-reference.js';
import { generateMonorepoGovernance } from '../../generators/monorepo.js';
import { generateSystemContext } from '../../generators/system-context.js';

export function generateKiro(config: GovernanceConfig): void {
    console.log('');
    log.info('=== Governance Framework (Kiro) ===');
    const dir = config.projectDir;

    const opts: WriteOptions = {
        overwrite: config.overwrite,
        dryRun: config.dryRun,
        updateHooks: config.updateHooks,
        hookVersion: config.hookVersion,
        projectDir: dir,
        conflictMode: config.conflictMode,
    };

    // Ensure .gitattributes for LF line endings on hook scripts
    safeWrite(join(dir, '.kiro', '.gitattributes'), '*.sh text eol=lf\n', opts);

    if (config.updateHooks) {
        log.bold(`Updating stale hooks (v${config.hookVersion}):`);
        generateAllKiroHooks(config, opts);
        return;
    }

    // ── Steering files (shared content + Kiro front-matter) ──────────────
    log.section('Steering (5 files):');
    const steeringDir = join(dir, '.kiro', 'steering');

    safeWrite(join(steeringDir, 'constitution.md'),
        wrapWithFrontMatter(generateConstitution(config)), opts);
    safeWrite(join(steeringDir, 'architecture.md'),
        wrapWithFrontMatter(generateArchitecture(config)), opts);
    safeWrite(join(steeringDir, 'coding-standards.md'),
        wrapWithFrontMatter(generateCodingStandards(config)), opts);
    safeWrite(join(steeringDir, 'workflow.md'),
        wrapWithFrontMatter(generateWorkflow(config)), opts);
    safeWrite(join(steeringDir, 'developer-reference.md'),
        wrapWithFrontMatter(generateDeveloperReference(config)), opts);
    // Optional: system-context.md only when .kiro/notes/ has .md files
    const sysCtx = generateSystemContext(config);
    if (sysCtx) {
        safeWrite(join(steeringDir, 'system-context.md'),
            wrapWithFrontMatter(sysCtx, 'manual'), opts);
        log.created('system-context.md (notes/ index — manual inclusion)');
    }

    // ── Hooks (JSON files) ───────────────────────────────────────────────
    log.section('Hooks:');
    generateAllKiroHooks(config, opts);

    // ── Spec templates (.kiro/specs/_template/) ──────────────────────────
    log.section('Spec templates:');
    generateKiroSpecTemplates(config, opts);

    // ── Monorepo ─────────────────────────────────────────────────────────
    if (config.scan.detectedMonorepo) {
        generateMonorepoGovernance(config, opts, steeringDir);
    }
}

/**
 * Generate spec templates inside .kiro/specs/_template/.
 * Content is the same as Claude Code but:
 *   - Path is .kiro/specs/ (Kiro's native spec location)
 *   - tasks.md wrap-up references .kiro/steering/ instead of .claude/CLAUDE.md
 */
function generateKiroSpecTemplates(c: GovernanceConfig, opts: WriteOptions): void {
    const dir = c.projectDir;
    const b = c.blocks, p = c.profile, proj = c.project;
    const specDir = join(dir, '.kiro', 'specs', '_template');

    safeWrite(join(specDir, 'requirements.md'), `# Requirements — [Feature Name]

| Field | Value |
|-------|-------|
| **Feature** | _replace_ |
| **${proj.ticketSystem}** | _replace_ |
| **Author** | _replace_ |
| **Status** | Draft |

## User Stories

### US-1 — _title_ \`[P1]\`
**As a** [role], **I want to** [action], **so that** [benefit].

\`\`\`
Scenario 1: [happy path]
  Given [precondition]
  When  [action]
  Then  [result]
\`\`\`

## Data Source
- [ ] Remote API
- [ ] Local Database / ${p.localStorageName}
- [ ] In-Memory Only

### API Endpoints (if Remote API)
**Readiness:**
- [ ] API is live
- [ ] Contract available, not live yet
- [ ] No contract yet — blocked

| Method | Endpoint | Purpose |
|--------|----------|---------|
| \`POST\` | \`/api/example\` | _describe_ |

## Out of Scope
- _list explicitly_

## Open Questions
_Max 3 \`[NEEDS CLARIFICATION]\` items_
`, opts);

    safeWrite(join(specDir, 'design.md'), `# Design — [Feature Name]

## Hard Rules Compliance
| # | Rule | Compliant? | Justification if No |
|---|------|:----------:|---------------------|
${b.hardRulesCompliance}

## Layer Mapping
| Layer | Responsibility | Applies? |
|-------|---------------|----------|
${b.designLayerTable}

## File List
### New Files
| File | Layer | Purpose |
|------|-------|---------|
${b.designFiles}

### Modified Files
| File | Change |
|------|--------|
| _e.g. routes file_ | _add route_ |

${c.isBackend ? `## API Flow
\`\`\`
Request → Middleware (auth/RBAC) → Handler → Model/Service → Response
\`\`\`

## Integration Points
| System | Purpose | Direction |
|--------|---------|-----------|
| _e.g. MySQL_ | _describe_ | in / out |` : `## State Design
\`\`\`
Initial → Loading → Success(data) | Error(failure)
\`\`\`

## Navigation
\`\`\`
[Entry] → [This Feature] → [Next]
\`\`\``}
`, opts);

    const uiLabel = c.isBackend ? 'API Layer' : 'UI';
    safeWrite(join(specDir, 'tasks.md'), `# Tasks — [Feature Name]

## Status Guide
| Marker | Meaning |
|--------|---------|
| \`- [ ]\` | Pending |
| \`- [x]\` | Done |
| \`⚠️ BLOCKED:\` | Cannot proceed |
| \`_(deferred)_\` | Deferred |

## Size Guide: S < 30min · M 30min–2h · L 2h+

---

## Phase 1 — Setup
- [ ] **[S]** Generate scaffold${c.scan.scaffoldTool ? ` (${c.scan.scaffoldTool})` : ''}
- [ ] **[S]** Define domain model(s)

## Phase 2 — Data Layer
${b.taskDataPhase}

## Phase 3 — Business Logic
${b.taskLogicPhase}

## Phase 4 — State
${b.taskStatePhase}

## Phase 5 — ${uiLabel}
${b.taskUIPhase}

## Phase 6 — Tests
${b.taskTestPhase}

## Phase 7 — Wrap-Up
- [ ] **[S]** Post-task checklist (.kiro/steering/constitution.md)
- [ ] **[S]** Update feature README

---
## Blockers
| Blocker | Affects | Waiting On |
|---------|---------|-----------|
| _none_ | — | — |
`, opts);
}

/**
 * Upgrade Kiro governance files.
 * Always regenerates: hooks, git-hooks.
 * Optionally regenerates steering files (when force=true).
 */
export function upgradeKiro(config: GovernanceConfig, opts: WriteOptions, force: boolean): void {
    const dir = config.projectDir;

    log.section('Upgrading hooks (.kiro/hooks/):');
    generateAllKiroHooks(config, opts);

    if (force) {
        log.section('Upgrading steering files (--force):');
        const steeringDir = join(dir, '.kiro', 'steering');
        safeWrite(join(steeringDir, 'constitution.md'), wrapWithFrontMatter(generateConstitution(config)), opts);
        safeWrite(join(steeringDir, 'architecture.md'), wrapWithFrontMatter(generateArchitecture(config)), opts);
        safeWrite(join(steeringDir, 'coding-standards.md'), wrapWithFrontMatter(generateCodingStandards(config)), opts);
        safeWrite(join(steeringDir, 'workflow.md'), wrapWithFrontMatter(generateWorkflow(config)), opts);
        safeWrite(join(steeringDir, 'developer-reference.md'), wrapWithFrontMatter(generateDeveloperReference(config)), opts);
    } else {
        log.info('Steering files kept (use --force to also upgrade them)');
    }
}
