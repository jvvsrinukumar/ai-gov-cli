/**
 * /doctor production-ready tests — verifies each AC check evaluates correctly
 * against fixture source trees and state files.
 *
 * Strategy: seed a temp directory with the file shapes that should make each
 * AC PASSING or BLOCKING, run runProductionReady, capture stdout, parse the
 * AC lines. No mocking of the check functions — we test the real output the
 * developer will see.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { runProductionReady } from '../src/commands/doctor-production-ready.js';
import { SCHEMA_FILENAME, SCHEMA_VERSION } from '../src/schemas/governance-state.schema.js';
import type { GovernanceState } from '../src/schemas/governance-state.schema.js';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

let dir: string;
let logs: string[];
let logSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;
let prevExitCode: number | string | undefined;

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'doctor-test-'));
    logs = [];
    logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
        logs.push(args.map(String).join(' '));
    });
    errSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
        logs.push(args.map(String).join(' '));
    });
    prevExitCode = process.exitCode;
    process.exitCode = undefined;
});
afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    logSpy.mockRestore();
    errSpy.mockRestore();
    process.exitCode = prevExitCode;
});

function output(): string { return logs.join('\n'); }

function acStatus(id: string): 'PASSING' | 'BLOCKING' | 'UNKNOWN' {
    const lines = logs.filter(l => l.includes(` ${id} —`));
    if (!lines.length) return 'UNKNOWN';
    if (lines.some(l => l.includes('✓'))) return 'PASSING';
    if (lines.some(l => l.includes('✗'))) return 'BLOCKING';
    return 'UNKNOWN';
}

function writeFile(rel: string, content: string): void {
    const path = join(dir, rel);
    mkdirSync(path.split('/').slice(0, -1).join('/'), { recursive: true });
    writeFileSync(path, content, 'utf-8');
}

function writeMinimalState(agent: 'claude-code' | 'kiro' = 'claude-code', overrides: Partial<GovernanceState> = {}): void {
    const govDir = agent === 'kiro' ? '.kiro' : '.claude';
    const state: GovernanceState = {
        version: SCHEMA_VERSION,
        project: { name: 'fixture', stack: 'nodejs', hookVersion: '20.0.0', agent },
        lastUpdated: '2026-05-18T00:00:00.000Z',
        auditRuns: [],
        deadCode: [],
        developerActions: [],
        assumptions: [],
        parseGaps: [],
        acceptanceCriteria: {},
        ...overrides,
    };
    writeFile(`${govDir}/${SCHEMA_FILENAME}`, JSON.stringify(state));
}

// ─── AC-1: Kiro parity ───────────────────────────────────────────────────────

describe('AC-1 Kiro parity', () => {
    it('BLOCKING when both Kiro hooks are missing', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-1')).toBe('BLOCKING');
    });

    it('PASSING when both workflow-assess and workflow-backlog exist', async () => {
        writeFile('src/agents/kiro/hooks/workflow-assess.ts', '// kiro assess');
        writeFile('src/agents/kiro/hooks/workflow-backlog.ts', '// kiro backlog');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-1')).toBe('PASSING');
    });

    it('BLOCKING when only one Kiro hook exists', async () => {
        writeFile('src/agents/kiro/hooks/workflow-assess.ts', '// kiro assess');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-1')).toBe('BLOCKING');
        expect(output()).toContain('workflow-backlog.ts');
    });
});

// ─── AC-2: Shared state ──────────────────────────────────────────────────────

describe('AC-2 shared governance-state.json', () => {
    it('BLOCKING when no state file exists', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-2')).toBe('BLOCKING');
    });

    it('PASSING with a valid v1 state file', async () => {
        writeMinimalState('claude-code');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-2')).toBe('PASSING');
    });

    it('BLOCKING when schema version is wrong', async () => {
        writeFile('.claude/' + SCHEMA_FILENAME,
            JSON.stringify({ version: 999, project: { name: 'x', stack: 'y' } }));
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-2')).toBe('BLOCKING');
        expect(output()).toContain('Schema version mismatch');
    });

    it('BLOCKING when project metadata is missing', async () => {
        writeFile('.claude/' + SCHEMA_FILENAME,
            JSON.stringify({ version: SCHEMA_VERSION, project: {}, auditRuns: [], deadCode: [], developerActions: [], assumptions: [], parseGaps: [], acceptanceCriteria: {}, lastUpdated: '' }));
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-2')).toBe('BLOCKING');
        expect(output()).toContain('missing required project metadata');
    });

    it('reads .kiro/ when agent is kiro', async () => {
        writeMinimalState('kiro');
        await runProductionReady({ dir, agent: 'kiro' });
        expect(acStatus('AC-2')).toBe('PASSING');
    });
});

// ─── AC-3: assess no human-input gates ───────────────────────────────────────

describe('AC-3 assess no human-input gates', () => {
    it('BLOCKING when assess-content.ts contains HUMAN INPUT REQUIRED', async () => {
        writeFile('src/agents/claude-code/commands/assess.ts', '// wrapper');
        writeFile('src/generators/assess-content.ts', 'gate: HUMAN INPUT REQUIRED');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-3')).toBe('BLOCKING');
    });

    it('PASSING when neither file contains the gate', async () => {
        writeFile('src/agents/claude-code/commands/assess.ts', '// wrapper');
        writeFile('src/generators/assess-content.ts', '// rubric only');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-3')).toBe('PASSING');
    });

    it('BLOCKING when the wrapper itself contains the gate', async () => {
        writeFile('src/agents/claude-code/commands/assess.ts', 'HUMAN INPUT REQUIRED');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-3')).toBe('BLOCKING');
    });
});

// ─── AC-4: backlog no human-input gates ──────────────────────────────────────

describe('AC-4 backlog no human-input gates', () => {
    it('BLOCKING when backlog-content.ts contains HUMAN INPUT NEEDED', async () => {
        writeFile('src/agents/claude-code/commands/backlog.ts', '// wrapper');
        writeFile('src/generators/backlog-content.ts', 'gate: HUMAN INPUT NEEDED');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-4')).toBe('BLOCKING');
    });

    it('PASSING when neither file contains the gate', async () => {
        writeFile('src/agents/claude-code/commands/backlog.ts', '// wrapper');
        writeFile('src/generators/backlog-content.ts', '// derivation only');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-4')).toBe('PASSING');
    });
});

// ─── AC-5: doctor exists ─────────────────────────────────────────────────────

describe('AC-5 doctor exists', () => {
    it('always PASSING (the function being called is the evidence)', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-5')).toBe('PASSING');
    });
});

// ─── AC-7: scanner confidence ────────────────────────────────────────────────

describe('AC-7 scanner confidence wrapper', () => {
    it('BLOCKING when state has no scannerSnapshot', async () => {
        writeMinimalState('claude-code');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-7')).toBe('BLOCKING');
    });

    it('PASSING when state has the 15 expected fields', async () => {
        const blank = { value: null, confidence: 'unknown' as const, source: 'manifest' as const };
        const snap: Record<string, typeof blank> = {};
        for (const k of ['stateFramework', 'diFramework', 'detectedORM', 'detectedTestFramework',
            'detectedLinter', 'detectedFormatter', 'detectedRouter', 'httpClient',
            'archPattern', 'serviceStyle', 'featuresDir', 'sourceDir',
            'layerNames', 'localStorageName', 'scaffoldTool']) {
            snap[k] = blank;
        }
        writeMinimalState('claude-code', { scannerSnapshot: snap as never });
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-7')).toBe('PASSING');
    });

    it('BLOCKING when scannerSnapshot is missing a field', async () => {
        writeMinimalState('claude-code', { scannerSnapshot: { stateFramework: { value: 'x', confidence: 'high', source: 'manifest' } } as never });
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-7')).toBe('BLOCKING');
        expect(output()).toMatch(/missing fields/);
    });
});

// ─── AC-8: completion contracts ──────────────────────────────────────────────

describe('AC-8 completion contracts', () => {
    it('BLOCKING when no command emits a contract', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-8')).toBe('BLOCKING');
    });

    it('PASSING when each of the three commands emits its contract', async () => {
        writeFile('src/agents/claude-code/commands/audit.ts', 'AUDIT_COMPLETE:');
        writeFile('src/agents/claude-code/commands/assess.ts', 'ASSESS_COMPLETE:');
        writeFile('src/agents/claude-code/commands/backlog.ts', 'BACKLOG_COMPLETE:');
        writeFile('src/generators/plan-phases-content.ts', 'PHASES_COMPLETE:');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-8')).toBe('PASSING');
    });

    it('accepts contract emitted from the shared content module', async () => {
        writeFile('src/generators/audit-content.ts', 'AUDIT_COMPLETE:');
        writeFile('src/generators/assess-content.ts', 'ASSESS_COMPLETE:');
        writeFile('src/generators/backlog-content.ts', 'BACKLOG_COMPLETE:');
        writeFile('src/generators/plan-phases-content.ts', 'PHASES_COMPLETE:');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-8')).toBe('PASSING');
    });

    it('BLOCKING when one of the four commands lacks its contract', async () => {
        writeFile('src/agents/claude-code/commands/audit.ts', 'AUDIT_COMPLETE:');
        writeFile('src/agents/claude-code/commands/assess.ts', '');
        writeFile('src/agents/claude-code/commands/backlog.ts', 'BACKLOG_COMPLETE:');
        writeFile('src/generators/plan-phases-content.ts', 'PHASES_COMPLETE:');
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-8')).toBe('BLOCKING');
        expect(output()).toContain('assess');
    });
});

// ─── Overall verdict & exit code ─────────────────────────────────────────────

describe('overall verdict', () => {
    it('sets process.exitCode=1 when any AC is BLOCKING', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(process.exitCode).toBe(1);
    });

    it('lists the BLOCKING items in the trailer', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(output()).toMatch(/BLOCKING — \d+ items?: AC-\d/);
    });

    it('prints PASSING when every AC passes', async () => {
        // Seed everything green.
        writeFile('src/agents/kiro/hooks/workflow-assess.ts', '// ok');
        writeFile('src/agents/kiro/hooks/workflow-backlog.ts', '// ok');
        writeFile('src/agents/claude-code/commands/assess.ts', '// no gate');
        writeFile('src/agents/claude-code/commands/backlog.ts', '// no gate');
        writeFile('src/generators/audit-content.ts', 'AUDIT_COMPLETE:');
        writeFile('src/generators/assess-content.ts', 'ASSESS_COMPLETE:');
        writeFile('src/generators/backlog-content.ts', 'BACKLOG_COMPLETE:');
        writeFile('src/generators/plan-phases-content.ts', 'PHASES_COMPLETE:');
        // Self-referential: doctor checks its own test file paths.
        const fakeAssertions = 'expect(0);'.repeat(30);
        writeFile('tests/audit.test.ts', fakeAssertions);
        writeFile('tests/assess.test.ts', fakeAssertions);
        writeFile('tests/doctor.test.ts', fakeAssertions);
        const blank = { value: null, confidence: 'unknown' as const, source: 'manifest' as const };
        const snap: Record<string, typeof blank> = {};
        for (const k of ['stateFramework', 'diFramework', 'detectedORM', 'detectedTestFramework',
            'detectedLinter', 'detectedFormatter', 'detectedRouter', 'httpClient',
            'archPattern', 'serviceStyle', 'featuresDir', 'sourceDir',
            'layerNames', 'localStorageName', 'scaffoldTool']) {
            snap[k] = blank;
        }
        writeMinimalState('claude-code', { scannerSnapshot: snap as never });
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(output()).toContain('PASSING');
        expect(output()).toContain('v20 acceptance criteria satisfied');
    });
});

// ─── AC-6: test parity (self-referential) ────────────────────────────────────

describe('AC-6 test parity', () => {
    it('BLOCKING when test files are missing', async () => {
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-6')).toBe('BLOCKING');
    });

    it('BLOCKING when test files exist but are below the 30-assertion threshold', async () => {
        writeFile('tests/audit.test.ts', 'expect(1);'.repeat(5));
        writeFile('tests/assess.test.ts', 'expect(1);'.repeat(5));
        writeFile('tests/doctor.test.ts', 'expect(1);'.repeat(5));
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-6')).toBe('BLOCKING');
        expect(output()).toMatch(/below parity threshold/);
    });

    it('PASSING when all three test files have ≥30 expects', async () => {
        writeFile('tests/audit.test.ts', 'expect(1);'.repeat(31));
        writeFile('tests/assess.test.ts', 'expect(2);'.repeat(31));
        writeFile('tests/doctor.test.ts', 'expect(3);'.repeat(31));
        await runProductionReady({ dir, agent: 'claude-code' });
        expect(acStatus('AC-6')).toBe('PASSING');
    });
});
