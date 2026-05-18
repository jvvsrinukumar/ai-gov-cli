/**
 * Lenient markdown → governance-state.json migration.
 *
 * Reads existing v19 audit artifacts (.claude/audit-report.md, dead-code.md,
 * developer-actions.md) and produces a governance-state.json. Markdown files
 * are NEVER deleted — they become rendered views. The migration parser is
 * lenient by construction: anything it can't read becomes a parseGap, never
 * a thrown error.
 *
 * Phase A scope: parse the three .claude/ (or .kiro/) audit files. Assess
 * documents (docs/assessment/*.md) and backlog documents (docs/backlog/*.md)
 * are noted as parseGaps for now and will be wired in subsequent phases.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
    AuditRun,
    DeadCodeEntry,
    DeveloperAction,
    GovernanceState,
    ParseGap,
} from '../schemas/governance-state.schema.js';
import { SCHEMA_VERSION, ACCEPTANCE_CRITERIA } from '../schemas/governance-state.schema.js';

export interface MigrationInput {
    projectDir: string;
    agent: 'claude-code' | 'kiro';
    projectName: string;
    stack: string;
    hookVersion: string;
}

export interface MigrationResult {
    state: GovernanceState;
    sourcesRead: string[];
    sourcesAbsent: string[];
}

export function migrateToState(input: MigrationInput): MigrationResult {
    const govDir = input.agent === 'kiro' ? '.kiro' : '.claude';
    const root = join(input.projectDir, govDir);

    const parseGaps: ParseGap[] = [];
    const sourcesRead: string[] = [];
    const sourcesAbsent: string[] = [];

    const auditRuns = parseFileIfPresent(
        root, 'audit-report.md', sourcesRead, sourcesAbsent,
        (raw) => parseAuditReport(raw, parseGaps),
    ) ?? [];

    const deadCode = parseFileIfPresent(
        root, 'dead-code.md', sourcesRead, sourcesAbsent,
        (raw) => parseDeadCode(raw, parseGaps),
    ) ?? [];

    const developerActions = parseFileIfPresent(
        root, 'developer-actions.md', sourcesRead, sourcesAbsent,
        (raw) => parseDeveloperActions(raw, parseGaps),
    ) ?? [];

    // Note presence of assess/backlog docs but defer parsing.
    const assessDir = join(input.projectDir, 'docs', 'assessment');
    if (existsSync(assessDir)) {
        parseGaps.push({
            sourceFile: 'docs/assessment/',
            section: 'all',
            reason: 'Assessment documents detected but not yet migrated — wired in a later phase.',
        });
    }
    const backlogDir = join(input.projectDir, 'docs', 'backlog');
    if (existsSync(backlogDir)) {
        parseGaps.push({
            sourceFile: 'docs/backlog/',
            section: 'all',
            reason: 'Backlog documents detected but not yet migrated — wired in a later phase.',
        });
    }

    const state: GovernanceState = {
        version: SCHEMA_VERSION,
        project: {
            name: input.projectName,
            stack: input.stack,
            hookVersion: input.hookVersion,
            agent: input.agent,
        },
        lastUpdated: new Date().toISOString(),
        auditRuns,
        deadCode,
        developerActions,
        assumptions: [],
        parseGaps,
        acceptanceCriteria: Object.fromEntries(
            ACCEPTANCE_CRITERIA.map(ac => [ac.id, {
                id: ac.id,
                title: ac.title,
                status: 'BLOCKING' as const,
                evidence: 'Not yet evaluated by /doctor production-ready.',
                lastChecked: new Date().toISOString(),
            }]),
        ),
    };

    return { state, sourcesRead, sourcesAbsent };
}

// ─── File-level helpers ──────────────────────────────────────────────────────

function parseFileIfPresent<T>(
    root: string,
    name: string,
    sourcesRead: string[],
    sourcesAbsent: string[],
    parser: (raw: string) => T,
): T | null {
    const path = join(root, name);
    if (!existsSync(path)) {
        sourcesAbsent.push(name);
        return null;
    }
    try {
        const raw = readFileSync(path, 'utf-8');
        sourcesRead.push(name);
        return parser(raw);
    } catch {
        sourcesAbsent.push(`${name} (read failed)`);
        return null;
    }
}

// ─── audit-report.md parser ──────────────────────────────────────────────────

/**
 * Splits on `## Run N` headers. Each block contains a scorecard table and a
 * set of `**Key:** value` lines. Lenient — missing fields land in parseGaps.
 */
export function parseAuditReport(raw: string, parseGaps: ParseGap[]): AuditRun[] {
    const runs: AuditRun[] = [];
    const blocks = raw.split(/^## Run\s+/m).slice(1);

    for (const block of blocks) {
        const headerMatch = block.match(/^(\d+)\s*—\s*([^\n]+)/);
        if (!headerMatch) {
            parseGaps.push({
                sourceFile: 'audit-report.md',
                section: block.split('\n')[0]?.slice(0, 80) ?? '<unreadable>',
                reason: 'Run header did not match `## Run N — date` pattern.',
                rawContent: block.slice(0, 300),
            });
            continue;
        }
        const runNumber = parseInt(headerMatch[1], 10);
        const date = headerMatch[2].trim();

        const scores = {
            governanceFiles: extractScore(block, 'Governance Files'),
            governanceAccuracy: extractScore(block, 'Governance Accuracy'),
            steeringCoverage: extractScore(block, 'Steering Coverage'),
            testCoverage: extractScore(block, 'Test Coverage'),
            deadFileRisk: extractScore(block, 'Dead File Risk'),
            overall: extractScore(block, 'OVERALL'),
        };

        const verdict = extractVerdict(block);
        const gapsFixed = extractIntField(block, 'Gaps fixed this run') ?? 0;
        const gapsRemaining = extractIntField(block, 'Gaps remaining') ?? 0;

        runs.push({
            runNumber,
            date,
            scores,
            verdict,
            gapsFixed,
            gapsRemaining,
            // v19 did not emit a completion contract — flag for v20 audits to fill in.
            persistFilesWritten: 3,   // assume legacy runs persisted all 3 (best-effort)
            stepsCompleted: 12,
            completionContract: '',   // empty = pre-v20 run
        });

        if (scores.overall === 0 && scores.governanceFiles === 0) {
            parseGaps.push({
                sourceFile: 'audit-report.md',
                section: `Run ${runNumber}`,
                reason: 'Scorecard table not found or all zeros — likely a non-standard format.',
            });
        }
    }

    if (runs.length === 0 && raw.trim().length > 0) {
        parseGaps.push({
            sourceFile: 'audit-report.md',
            section: 'whole-file',
            reason: 'No `## Run N` blocks found in non-empty file.',
            rawContent: raw.slice(0, 300),
        });
    }

    return runs;
}

function extractScore(block: string, label: string): number {
    // Matches: | Governance Files | 95/100 | ...   (and bold variant for OVERALL)
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\|\\s*\\*{0,2}${escaped}\\*{0,2}\\s*\\|\\s*\\*{0,2}(\\d{1,3})\\s*\\/\\s*100`, 'i');
    const m = block.match(re);
    return m ? Math.min(100, Math.max(0, parseInt(m[1], 10))) : 0;
}

function extractVerdict(block: string): AuditRun['verdict'] {
    const m = block.match(/\*\*VERDICT:\*\*\s*([^\n]+)/);
    if (!m) return 'ACTION_NEEDED';
    const v = m[1].trim().toUpperCase();
    if (v.startsWith('ALIGNED')) return 'ALIGNED';
    if (v.startsWith('UPDATED')) return 'UPDATED';
    return 'ACTION_NEEDED';
}

function extractIntField(block: string, label: string): number | null {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(\\d+|none)`, 'i');
    const m = block.match(re);
    if (!m) return null;
    if (m[1].toLowerCase() === 'none') return 0;
    return parseInt(m[1], 10);
}

// ─── dead-code.md parser ─────────────────────────────────────────────────────

export function parseDeadCode(raw: string, parseGaps: ParseGap[]): DeadCodeEntry[] {
    const entries: DeadCodeEntry[] = [];
    const rows = extractTableRows(raw);

    for (const row of rows) {
        // Expected columns: # | File / Path | Reason flagged | First detected | Status
        if (row.length < 5) {
            parseGaps.push({
                sourceFile: 'dead-code.md',
                section: 'row',
                reason: `Row has ${row.length} cells, expected 5.`,
                rawContent: row.join(' | '),
            });
            continue;
        }
        const id = parseInt(row[0], 10);
        if (isNaN(id)) continue; // skip header / separator rows

        const status = parseDeadCodeStatus(row[4]);
        if (!status) {
            parseGaps.push({
                sourceFile: 'dead-code.md',
                section: `entry #${row[0]}`,
                reason: `Unrecognized status: "${row[4]}".`,
            });
            continue;
        }

        entries.push({
            id,
            path: row[1],
            reasonFlagged: row[2],
            firstDetected: row[3],
            status: status.status,
            ...(status.resolvedDate ? { resolvedDate: status.resolvedDate } : {}),
            ...(status.keptReason ? { keptReason: status.keptReason } : {}),
        });
    }

    return entries;
}

function parseDeadCodeStatus(cell: string): {
    status: DeadCodeEntry['status'];
    resolvedDate?: string;
    keptReason?: string;
} | null {
    const trimmed = cell.trim();
    if (/^\[\s*\]\s*PENDING/i.test(trimmed)) return { status: 'PENDING' };
    const deleted = trimmed.match(/^\[\s*x\s*\]\s*DELETED\s*(\S+)?/i);
    if (deleted) return { status: 'DELETED', resolvedDate: deleted[1] };
    const kept = trimmed.match(/^\[\s*~\s*\]\s*KEPT\s*—?\s*(.*)$/i);
    if (kept) return { status: 'KEPT', keptReason: kept[1] || undefined };
    return null;
}

// ─── developer-actions.md parser ─────────────────────────────────────────────

export function parseDeveloperActions(raw: string, parseGaps: ParseGap[]): DeveloperAction[] {
    const entries: DeveloperAction[] = [];
    const rows = extractTableRows(raw);

    for (const row of rows) {
        // Expected: # | Type | Action required | Why it matters | Added | Status
        if (row.length < 6) {
            parseGaps.push({
                sourceFile: 'developer-actions.md',
                section: 'row',
                reason: `Row has ${row.length} cells, expected 6.`,
                rawContent: row.join(' | '),
            });
            continue;
        }
        const id = parseInt(row[0], 10);
        if (isNaN(id)) continue;

        const typeRaw = row[1].toLowerCase().trim();
        const type: DeveloperAction['type'] = typeRaw === 'auto' ? 'auto' : 'decision';

        const status = parseActionStatus(row[5]);
        if (!status) {
            parseGaps.push({
                sourceFile: 'developer-actions.md',
                section: `entry #${row[0]}`,
                reason: `Unrecognized status: "${row[5]}".`,
            });
            continue;
        }

        entries.push({
            id,
            type,
            action: row[2],
            whyItMatters: row[3],
            added: row[4],
            status: status.status,
            ...(status.resolvedDate ? { resolvedDate: status.resolvedDate } : {}),
            ...(status.deferredReason ? { deferredReason: status.deferredReason } : {}),
        });
    }

    return entries;
}

function parseActionStatus(cell: string): {
    status: DeveloperAction['status'];
    resolvedDate?: string;
    deferredReason?: string;
} | null {
    const trimmed = cell.trim();
    if (/^\[\s*\]\s*OPEN/i.test(trimmed)) return { status: 'OPEN' };
    const done = trimmed.match(/^\[\s*x\s*\]\s*DONE\s*(\S+)?/i);
    if (done) return { status: 'DONE', resolvedDate: done[1] };
    const deferred = trimmed.match(/^\[\s*→\s*\]\s*DEFERRED\s*(.*)$/i);
    if (deferred) return { status: 'DEFERRED', deferredReason: deferred[1] || undefined };
    return null;
}

// ─── Shared markdown-table extractor ─────────────────────────────────────────

/**
 * Returns body rows from every pipe-table in the file. Header and separator
 * rows are filtered. Cells are trimmed; empty leading/trailing cells dropped.
 */
function extractTableRows(raw: string): string[][] {
    const rows: string[][] = [];
    const lines = raw.split('\n');
    let inTable = false;

    for (const line of lines) {
        if (!line.trim().startsWith('|')) {
            inTable = false;
            continue;
        }
        // Separator row (---|---|---)
        if (/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line)) {
            inTable = true; // next row is data
            continue;
        }
        const cells = line.split('|').map(c => c.trim());
        // Drop empty leading/trailing cells that '|' produces at row edges.
        if (cells.length > 0 && cells[0] === '') cells.shift();
        if (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
        if (cells.length === 0) continue;

        if (!inTable) {
            // This is a header row before we've seen a separator — skip.
            continue;
        }
        rows.push(cells);
    }

    return rows;
}
