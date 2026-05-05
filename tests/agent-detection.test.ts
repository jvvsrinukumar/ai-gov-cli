/**
 * Agent detection tests — verifies detectAgent() logic.
 * Tests auto-detection from existing directories, explicit flags,
 * and default behavior.
 */
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Mock isInteractiveTTY to always return false in tests (prevents /dev/tty blocking)
jest.mock('../src/utils/tty.js', () => ({
    isInteractiveTTY: () => false,
    readTTYLine: () => '',
}));

import { detectAgent } from '../src/agents/detect-agent.js';

// Silence console output and mock process.exit
let mockLog: jest.SpyInstance;
let mockError: jest.SpyInstance;
let mockExit: jest.SpyInstance;

beforeAll(() => {
    mockLog = jest.spyOn(console, 'log').mockImplementation(() => { });
    mockError = jest.spyOn(console, 'error').mockImplementation(() => { });
    mockExit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`process.exit(${code})`);
    }) as never);
});

afterAll(() => {
    mockLog.mockRestore();
    mockError.mockRestore();
    mockExit.mockRestore();
});

function makeTmpDir(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-agent-test-'));
}

describe('detectAgent', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = makeTmpDir();
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('explicit --agent kiro returns kiro', () => {
        expect(detectAgent(tmpDir, 'kiro')).toBe('kiro');
    });

    test('explicit --agent claude-code returns claude-code', () => {
        expect(detectAgent(tmpDir, 'claude-code')).toBe('claude-code');
    });

    test('only .kiro/ exists → returns kiro', () => {
        mkdirSync(join(tmpDir, '.kiro'));
        expect(detectAgent(tmpDir)).toBe('kiro');
    });

    test('only .claude/ exists → returns claude-code', () => {
        mkdirSync(join(tmpDir, '.claude'));
        expect(detectAgent(tmpDir)).toBe('claude-code');
    });

    test('neither exists → returns claude-code (default)', () => {
        expect(detectAgent(tmpDir)).toBe('claude-code');
    });

    test('both exist + non-interactive → returns claude-code', () => {
        mkdirSync(join(tmpDir, '.kiro'));
        mkdirSync(join(tmpDir, '.claude'));
        // isInteractiveTTY is mocked to return false, so should default to claude-code
        expect(detectAgent(tmpDir)).toBe('claude-code');
    });

    test('invalid agent string → exits with error', () => {
        expect(() => detectAgent(tmpDir, 'invalid-agent')).toThrow('process.exit(1)');
        expect(mockExit).toHaveBeenCalledWith(1);
    });

    test('auto-detect with .kiro/ and no .claude/ → kiro', () => {
        mkdirSync(join(tmpDir, '.kiro'));
        expect(detectAgent(tmpDir)).toBe('kiro');
    });
});
