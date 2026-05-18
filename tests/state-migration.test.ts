/**
 * state-migration tests. The parser must be lenient: it should extract what
 * it can and push unparseable content into parseGaps[] without throwing.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import {
    migrateToState,
    parseAuditReport,
    parseDeadCode,
    parseDeveloperActions,
} from '../src/utils/state-migration.js';
import type { ParseGap } from '../src/schemas/governance-state.schema.js';
import { SCHEMA_VERSION, ACCEPTANCE_CRITERIA } from '../src/schemas/governance-state.schema.js';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_AUDIT_REPORT = `# Audit history

## Run 1 — 2026-04-25

| Category           | Score   | Grade | vs Previous |
|--------------------|---------|-------|-------------|
| Governance Files   | 95/100  | A     | —           |
| Governance Accuracy| 80/100  | B     | —           |
| Steering Coverage  | 90/100  | A     | —           |
| Test Coverage      | 0/100   | D     | —           |
| Dead File Risk     | 100/100 | A     | —           |
| **OVERALL**        | **73/100** | **C** | **—**   |

**VERDICT:** UPDATED — 4 gaps fixed
**Gaps fixed this run:** 4 — architecture, workflow, constitution, ai-usage-policy
**Gaps remaining:** 0
**Dead code candidates:** 2
**Open developer actions:** 1

---

## Run 2 — 2026-05-10

| Category           | Score   | Grade | vs Previous |
|--------------------|---------|-------|-------------|
| Governance Files   | 100/100 | A     | +5          |
| Governance Accuracy| 95/100  | A     | +15         |
| Steering Coverage  | 95/100  | A     | +5          |
| Test Coverage      | 50/100  | C     | +50         |
| Dead File Risk     | 100/100 | A     | —           |
| **OVERALL**        | **88/100** | **B** | **+15** |

**VERDICT:** ALIGNED
**Gaps fixed this run:** 0
**Gaps remaining:** none
**Dead code candidates:** 0
**Open developer actions:** 0

---
`;

const VALID_DEAD_CODE = `# Dead Code Registry — test-app

| # | File / Path | Reason flagged | First detected | Status |
|---|-------------|----------------|----------------|--------|
| 1 | src/routes/deprecated.js | Misleading name | 2026-04-25 | [ ] PENDING |
| 2 | .claude/hooks/old.sh | STALE v14.1.0 | 2026-04-25 | [x] DELETED 2026-05-01 |
| 3 | src/utils/legacy.ts | Looks unused | 2026-04-25 | [~] KEPT — kept for batch jobs |
`;

const VALID_DEVELOPER_ACTIONS = `# Developer Actions — test-app

| # | Type | Action required | Why it matters | Added | Status |
|---|------|----------------|----------------|-------|--------|
| 1 | auto | Set up test infrastructure | SCENARIO A — zero tests | 2026-04-25 | [ ] OPEN |
| 2 | decision | Resolve dual NFT impl | Unclear which zone wins | 2026-04-25 | [x] DONE 2026-05-05 |
| 3 | decision | Pick test framework | Multiple candidates | 2026-04-25 | [→] DEFERRED until Q3 |
`;

function mkTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'state-migration-'));
}

// ─── parseAuditReport ────────────────────────────────────────────────────────

describe('parseAuditReport', () => {
    it('parses both runs from a valid file', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs.length).toBe(2);
        expect(gaps.length).toBe(0);
    });

    it('extracts correct run numbers and dates', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[0].runNumber).toBe(1);
        expect(runs[0].date).toBe('2026-04-25');
        expect(runs[1].runNumber).toBe(2);
        expect(runs[1].date).toBe('2026-05-10');
    });

    it('extracts every score in the scorecard table', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[0].scores.governanceFiles).toBe(95);
        expect(runs[0].scores.governanceAccuracy).toBe(80);
        expect(runs[0].scores.steeringCoverage).toBe(90);
        expect(runs[0].scores.testCoverage).toBe(0);
        expect(runs[0].scores.deadFileRisk).toBe(100);
        expect(runs[0].scores.overall).toBe(73);
    });

    it('parses bold OVERALL score correctly', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[1].scores.overall).toBe(88);
    });

    it('extracts ALIGNED verdict', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[1].verdict).toBe('ALIGNED');
    });

    it('extracts UPDATED verdict', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[0].verdict).toBe('UPDATED');
    });

    it('extracts gapsFixed and gapsRemaining integers', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[0].gapsFixed).toBe(4);
        expect(runs[0].gapsRemaining).toBe(0);
    });

    it('treats "none" in Gaps remaining as 0', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[1].gapsRemaining).toBe(0);
    });

    it('produces empty completionContract for pre-v20 runs', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(VALID_AUDIT_REPORT, gaps);
        expect(runs[0].completionContract).toBe('');
        expect(runs[1].completionContract).toBe('');
    });

    it('flags a block with a malformed header instead of throwing', () => {
        const malformed = '## Run garbage\nnot a real run\n';
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(malformed, gaps);
        expect(runs.length).toBe(0);
        expect(gaps.length).toBeGreaterThan(0);
        expect(gaps[0].sourceFile).toBe('audit-report.md');
    });

    it('produces a whole-file gap when no Run blocks exist in non-empty input', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport('## Some Other Header\nbody text', gaps);
        expect(runs.length).toBe(0);
        const wholeFileGap = gaps.find(g => g.section === 'whole-file');
        expect(wholeFileGap).toBeDefined();
    });

    it('produces no gaps for an empty file', () => {
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport('', gaps);
        expect(runs.length).toBe(0);
        expect(gaps.length).toBe(0);
    });

    it('does not throw on completely garbled input', () => {
        const gaps: ParseGap[] = [];
        expect(() => parseAuditReport('|||\n###\n[[[', gaps)).not.toThrow();
    });

    it('flags a Run block whose scorecard is missing', () => {
        const noScoreCard = '## Run 1 — 2026-04-25\n\n**VERDICT:** ALIGNED\n';
        const gaps: ParseGap[] = [];
        const runs = parseAuditReport(noScoreCard, gaps);
        expect(runs.length).toBe(1);
        const scorecardGap = gaps.find(g => g.section === 'Run 1');
        expect(scorecardGap).toBeDefined();
    });
});

// ─── parseDeadCode ───────────────────────────────────────────────────────────

describe('parseDeadCode', () => {
    it('parses all three entries from a valid file', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(VALID_DEAD_CODE, gaps);
        expect(entries.length).toBe(3);
        expect(gaps.length).toBe(0);
    });

    it('extracts PENDING status', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(VALID_DEAD_CODE, gaps);
        expect(entries[0].status).toBe('PENDING');
    });

    it('extracts DELETED status with resolvedDate', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(VALID_DEAD_CODE, gaps);
        expect(entries[1].status).toBe('DELETED');
        expect(entries[1].resolvedDate).toBe('2026-05-01');
    });

    it('extracts KEPT status with keptReason', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(VALID_DEAD_CODE, gaps);
        expect(entries[2].status).toBe('KEPT');
        expect(entries[2].keptReason).toBe('kept for batch jobs');
    });

    it('extracts the file path correctly', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(VALID_DEAD_CODE, gaps);
        expect(entries[0].path).toBe('src/routes/deprecated.js');
    });

    it('flags a row with unrecognized status without throwing', () => {
        const weird = `| # | File | Reason | Date | Status |
|---|------|--------|------|--------|
| 1 | x.js | reason | 2026-04-25 | [?] WAT |
`;
        const gaps: ParseGap[] = [];
        const entries = parseDeadCode(weird, gaps);
        expect(entries.length).toBe(0);
        expect(gaps.length).toBeGreaterThan(0);
        expect(gaps[0].reason).toContain('status');
    });

    it('returns empty array on empty input', () => {
        const gaps: ParseGap[] = [];
        expect(parseDeadCode('', gaps)).toEqual([]);
        expect(gaps).toEqual([]);
    });
});

// ─── parseDeveloperActions ───────────────────────────────────────────────────

describe('parseDeveloperActions', () => {
    it('parses all three entries from a valid file', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(VALID_DEVELOPER_ACTIONS, gaps);
        expect(entries.length).toBe(3);
        expect(gaps.length).toBe(0);
    });

    it('distinguishes auto from decision type', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(VALID_DEVELOPER_ACTIONS, gaps);
        expect(entries[0].type).toBe('auto');
        expect(entries[1].type).toBe('decision');
    });

    it('extracts OPEN status', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(VALID_DEVELOPER_ACTIONS, gaps);
        expect(entries[0].status).toBe('OPEN');
    });

    it('extracts DONE status with resolvedDate', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(VALID_DEVELOPER_ACTIONS, gaps);
        expect(entries[1].status).toBe('DONE');
        expect(entries[1].resolvedDate).toBe('2026-05-05');
    });

    it('extracts DEFERRED status with deferredReason', () => {
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(VALID_DEVELOPER_ACTIONS, gaps);
        expect(entries[2].status).toBe('DEFERRED');
        expect(entries[2].deferredReason).toBe('until Q3');
    });

    it('flags a row with too few columns without throwing', () => {
        const thin = `| # | Type | Action |
|---|------|--------|
| 1 | auto | do it |
`;
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(thin, gaps);
        expect(entries.length).toBe(0);
        expect(gaps.length).toBeGreaterThan(0);
    });

    it('treats unknown type values as decision (lenient default)', () => {
        const odd = `| # | Type | Action | Why | Added | Status |
|---|------|--------|-----|-------|--------|
| 1 | mystery | x | y | 2026-04-25 | [ ] OPEN |
`;
        const gaps: ParseGap[] = [];
        const entries = parseDeveloperActions(odd, gaps);
        expect(entries[0].type).toBe('decision');
    });
});

// ─── migrateToState end-to-end ───────────────────────────────────────────────

describe('migrateToState', () => {
    let dir: string;
    beforeEach(() => { dir = mkTempDir(); });
    afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

    function writeFiles(govDir: string, files: Record<string, string>): void {
        const full = join(dir, govDir);
        mkdirSync(full, { recursive: true });
        for (const [name, content] of Object.entries(files)) {
            writeFileSync(join(full, name), content, 'utf-8');
        }
    }

    it('emits a state file with no audit runs and no error when sources are absent', () => {
        const result = migrateToState({
            projectDir: dir, agent: 'claude-code',
            projectName: 'p', stack: 'react', hookVersion: '19.1.0',
        });
        expect(result.state.version).toBe(SCHEMA_VERSION);
        expect(result.state.auditRuns).toEqual([]);
        expect(result.state.deadCode).toEqual([]);
        expect(result.state.developerActions).toEqual([]);
        expect(result.sourcesRead).toEqual([]);
        expect(result.sourcesAbsent.length).toBeGreaterThan(0);
    });

    it('populates project metadata from input', () => {
        const result = migrateToState({
            projectDir: dir, agent: 'kiro',
            projectName: 'my-app', stack: 'flutter', hookVersion: '19.1.0',
        });
        expect(result.state.project.name).toBe('my-app');
        expect(result.state.project.stack).toBe('flutter');
        expect(result.state.project.agent).toBe('kiro');
    });

    it('reads all three .claude artifacts when present', () => {
        writeFiles('.claude', {
            'audit-report.md': VALID_AUDIT_REPORT,
            'dead-code.md': VALID_DEAD_CODE,
            'developer-actions.md': VALID_DEVELOPER_ACTIONS,
        });
        const result = migrateToState({
            projectDir: dir, agent: 'claude-code',
            projectName: 'p', stack: 'react', hookVersion: '19.1.0',
        });
        expect(result.state.auditRuns.length).toBe(2);
        expect(result.state.deadCode.length).toBe(3);
        expect(result.state.developerActions.length).toBe(3);
        expect(result.sourcesRead.sort()).toEqual(
            ['audit-report.md', 'dead-code.md', 'developer-actions.md'],
        );
    });

    it('reads .kiro/ artifacts when agent=kiro', () => {
        writeFiles('.kiro', { 'audit-report.md': VALID_AUDIT_REPORT });
        const result = migrateToState({
            projectDir: dir, agent: 'kiro',
            projectName: 'p', stack: 'kotlin', hookVersion: '19.1.0',
        });
        expect(result.state.auditRuns.length).toBe(2);
    });

    it('produces parseGaps for docs/assessment when directory exists', () => {
        mkdirSync(join(dir, 'docs', 'assessment'), { recursive: true });
        const result = migrateToState({
            projectDir: dir, agent: 'claude-code',
            projectName: 'p', stack: 'react', hookVersion: '19.1.0',
        });
        const gap = result.state.parseGaps.find(g => g.sourceFile === 'docs/assessment/');
        expect(gap).toBeDefined();
    });

    it('initializes all 8 acceptance criteria as BLOCKING', () => {
        const result = migrateToState({
            projectDir: dir, agent: 'claude-code',
            projectName: 'p', stack: 'react', hookVersion: '19.1.0',
        });
        for (const ac of ACCEPTANCE_CRITERIA) {
            expect(result.state.acceptanceCriteria[ac.id]).toBeDefined();
            expect(result.state.acceptanceCriteria[ac.id].status).toBe('BLOCKING');
        }
    });

    it('never throws on completely garbage inputs', () => {
        writeFiles('.claude', {
            'audit-report.md': '|||???\n###\n',
            'dead-code.md': 'not a table at all',
            'developer-actions.md': '',
        });
        expect(() => migrateToState({
            projectDir: dir, agent: 'claude-code',
            projectName: 'p', stack: 'react', hookVersion: '19.1.0',
        })).not.toThrow();
    });
});
