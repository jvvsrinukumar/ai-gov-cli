/**
 * Write the initial governance-state.json at init time.
 *
 * - On first init: produces a fresh state with project info + scannerSnapshot,
 *   empty arrays for audit runs / dead code / dev actions / assumptions,
 *   and all 8 acceptance criteria initialized to BLOCKING.
 * - On re-init: preserves existing audit runs / dead code / dev actions /
 *   assumptions; only refreshes scannerSnapshot and project metadata.
 * - Markdown source files are never touched here.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { GovernanceConfig } from '../types.js';
import { log } from './logger.js';
import { scanResultToSnapshot } from './scanner-snapshot.js';
import {
    SCHEMA_VERSION,
    SCHEMA_FILENAME,
    ACCEPTANCE_CRITERIA,
    type GovernanceState,
} from '../schemas/governance-state.schema.js';

export function writeInitialState(c: GovernanceConfig): void {
    const govDir = c.agent === 'kiro' ? '.kiro' : '.claude';
    const outPath = join(c.projectDir, govDir, SCHEMA_FILENAME);
    const now = new Date().toISOString();
    const snapshot = scanResultToSnapshot(c.scan, c.profile);

    const existing = readExistingState(outPath);

    const state: GovernanceState = {
        version: SCHEMA_VERSION,
        project: {
            name: c.project.appName,
            stack: c.stack,
            hookVersion: c.hookVersion,
            agent: c.agent,
        },
        lastUpdated: now,
        scannerSnapshot: snapshot,
        auditRuns: existing?.auditRuns ?? [],
        deadCode: existing?.deadCode ?? [],
        developerActions: existing?.developerActions ?? [],
        assessment: existing?.assessment,
        backlog: existing?.backlog,
        assumptions: existing?.assumptions ?? [],
        parseGaps: existing?.parseGaps ?? [],
        acceptanceCriteria: existing?.acceptanceCriteria ?? Object.fromEntries(
            ACCEPTANCE_CRITERIA.map(ac => [ac.id, {
                id: ac.id,
                title: ac.title,
                status: 'BLOCKING' as const,
                evidence: 'Initialized at init; not yet evaluated by /doctor production-ready.',
                lastChecked: now,
            }]),
        ),
    };

    if (c.dryRun) {
        const isUpdate = existing !== null;
        log.info(`[dry-run] ${govDir}/${SCHEMA_FILENAME} (${isUpdate ? 'update' : 'new'})`);
        return;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
    if (existing) {
        log.detected(`${govDir}/${SCHEMA_FILENAME} (updated — preserved ${existing.auditRuns.length} run(s), ${existing.deadCode.length} dead-code, ${existing.developerActions.length} action(s))`);
    } else {
        log.created(`${govDir}/${SCHEMA_FILENAME}`);
    }
}

function readExistingState(path: string): GovernanceState | null {
    if (!existsSync(path)) return null;
    try {
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw) as GovernanceState;
        if (typeof parsed !== 'object' || parsed === null) return null;
        if (parsed.version !== SCHEMA_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}
