/**
 * writeInitialState tests — verifies the init-time governance-state.json
 * write path. Particularly the preservation invariant: re-init must not
 * destroy existing audit runs, dead-code entries, or developer actions.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { writeInitialState } from '../src/utils/state-writer.js';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, Stack } from '../src/types.js';
import { SCHEMA_FILENAME, SCHEMA_VERSION, ACCEPTANCE_CRITERIA } from '../src/schemas/governance-state.schema.js';
import type { GovernanceState } from '../src/schemas/governance-state.schema.js';

const DEFAULT_PROJECT = {
    packageName: 'test-app', appName: 'test-app', appDescription: '',
    ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: 'No legacy code',
};

function makeConfig(dir: string, agent: 'claude-code' | 'kiro' = 'claude-code', stack: Stack = 'nodejs'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    scan.detectedORM = 'Prisma';
    scan.detectedTestFramework = 'Jest';
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent, stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: true, hookVersion: '20.0.0', projectDir: dir,
        specFirstEnabled: false, conflictMode: 'keep',
        overwrite: false, dryRun: false, updateHooks: false,
    };
}

function readState(dir: string, agent: string): GovernanceState {
    const path = join(dir, agent === 'kiro' ? '.kiro' : '.claude', SCHEMA_FILENAME);
    return JSON.parse(readFileSync(path, 'utf-8'));
}

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'state-writer-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('writeInitialState (first init)', () => {
    it('creates the state file at .claude/governance-state.json', () => {
        writeInitialState(makeConfig(dir));
        expect(existsSync(join(dir, '.claude', SCHEMA_FILENAME))).toBe(true);
    });

    it('writes schema version 1', () => {
        writeInitialState(makeConfig(dir));
        expect(readState(dir, 'claude-code').version).toBe(SCHEMA_VERSION);
    });

    it('populates project metadata from config', () => {
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.project.name).toBe('test-app');
        expect(s.project.stack).toBe('nodejs');
        expect(s.project.agent).toBe('claude-code');
        expect(s.project.hookVersion).toBe('20.0.0');
    });

    it('writes to .kiro/ when agent is kiro', () => {
        writeInitialState(makeConfig(dir, 'kiro'));
        expect(existsSync(join(dir, '.kiro', SCHEMA_FILENAME))).toBe(true);
        expect(existsSync(join(dir, '.claude', SCHEMA_FILENAME))).toBe(false);
    });

    it('populates scannerSnapshot with all 15 fields', () => {
        writeInitialState(makeConfig(dir));
        const snap = readState(dir, 'claude-code').scannerSnapshot!;
        expect(snap).toBeDefined();
        expect(Object.keys(snap).length).toBe(15);
    });

    it('propagates scanner values into the snapshot', () => {
        writeInitialState(makeConfig(dir));
        const snap = readState(dir, 'claude-code').scannerSnapshot!;
        expect(snap.detectedORM.value).toBe('Prisma');
        expect(snap.detectedORM.confidence).toBe('high');
        expect(snap.detectedTestFramework.value).toBe('Jest');
    });

    it('initializes empty arrays for runs/deadCode/devActions/assumptions/parseGaps', () => {
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.auditRuns).toEqual([]);
        expect(s.deadCode).toEqual([]);
        expect(s.developerActions).toEqual([]);
        expect(s.assumptions).toEqual([]);
        expect(s.parseGaps).toEqual([]);
    });

    it('initializes all 8 acceptance criteria as BLOCKING', () => {
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        for (const ac of ACCEPTANCE_CRITERIA) {
            expect(s.acceptanceCriteria[ac.id].status).toBe('BLOCKING');
        }
    });

    it('lastUpdated is a parseable ISO 8601 timestamp', () => {
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(() => new Date(s.lastUpdated).toISOString()).not.toThrow();
        expect(new Date(s.lastUpdated).toISOString()).toBe(s.lastUpdated);
    });
});

describe('writeInitialState (re-init preservation)', () => {
    function seedExistingState(agent: 'claude-code' | 'kiro'): void {
        const govDir = agent === 'kiro' ? '.kiro' : '.claude';
        mkdirSync(join(dir, govDir), { recursive: true });
        const existing: GovernanceState = {
            version: SCHEMA_VERSION,
            project: { name: 'old-name', stack: 'nodejs', hookVersion: '19.1.0', agent },
            lastUpdated: '2026-01-01T00:00:00.000Z',
            auditRuns: [{
                runNumber: 1, date: '2026-04-25',
                scores: { governanceFiles: 95, governanceAccuracy: 80, steeringCoverage: 90, testCoverage: 0, deadFileRisk: 100, overall: 73 },
                verdict: 'UPDATED', gapsFixed: 4, gapsRemaining: 0,
                persistFilesWritten: 3, stepsCompleted: 12, completionContract: '',
            }],
            deadCode: [{ id: 1, path: 'src/x.ts', reasonFlagged: 'r', firstDetected: '2026-04-25', status: 'PENDING' }],
            developerActions: [{ id: 1, type: 'auto', action: 'set up tests', whyItMatters: 'A', added: '2026-04-25', status: 'OPEN' }],
            assumptions: [],
            parseGaps: [],
            acceptanceCriteria: {},
        };
        writeFileSync(join(dir, govDir, SCHEMA_FILENAME), JSON.stringify(existing, null, 2));
    }

    it('preserves prior audit runs on re-init', () => {
        seedExistingState('claude-code');
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.auditRuns.length).toBe(1);
        expect(s.auditRuns[0].runNumber).toBe(1);
    });

    it('preserves prior dead-code entries on re-init', () => {
        seedExistingState('claude-code');
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.deadCode.length).toBe(1);
        expect(s.deadCode[0].path).toBe('src/x.ts');
    });

    it('preserves prior developer actions on re-init', () => {
        seedExistingState('claude-code');
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.developerActions.length).toBe(1);
        expect(s.developerActions[0].action).toBe('set up tests');
    });

    it('refreshes scannerSnapshot on re-init even when preserving other fields', () => {
        seedExistingState('claude-code');
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.scannerSnapshot?.detectedORM.value).toBe('Prisma');
    });

    it('updates project metadata on re-init (e.g. new appName)', () => {
        seedExistingState('claude-code');
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        expect(s.project.name).toBe('test-app');           // from config (new)
        expect(s.project.hookVersion).toBe('20.0.0');      // from config (new)
    });

    it('does not overwrite when an existing schema version differs', () => {
        const govDir = '.claude';
        mkdirSync(join(dir, govDir), { recursive: true });
        const futureState = { version: 999, project: { name: 'x', stack: 'y' } };
        writeFileSync(join(dir, govDir, SCHEMA_FILENAME), JSON.stringify(futureState));
        writeInitialState(makeConfig(dir));
        const s = readState(dir, 'claude-code');
        // Existing state was rejected as unrecognizable; we wrote a fresh one.
        expect(s.version).toBe(SCHEMA_VERSION);
        expect(s.auditRuns).toEqual([]);
    });
});

describe('writeInitialState (dry-run)', () => {
    it('does not write the file when dryRun=true', () => {
        const cfg = makeConfig(dir);
        cfg.dryRun = true;
        // Silence the dry-run log line.
        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        writeInitialState(cfg);
        spy.mockRestore();
        expect(existsSync(join(dir, '.claude', SCHEMA_FILENAME))).toBe(false);
    });
});
