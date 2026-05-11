/**
 * Unit tests for src/utils/hub-config.ts
 * Tests readHubConfig() for correct parsing, defaults, and error handling.
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';

import { readHubConfig } from '../src/utils/hub-config.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'hub-config-test-'));
}

function writeConfig(projectDir: string, content: string): void {
    const configDir = join(projectDir, '.ai-gov');
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, 'config.json'), content, 'utf-8');
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('readHubConfig', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = makeTempDir();
    });

    afterEach(() => {
        rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns full HubConfig when all fields are present', () => {
        writeConfig(tempDir, JSON.stringify({
            hub: 'https://my-hub.railway.app',
            project: 'my-project',
            team: 'platform-team',
            platform: 'github',
        }));

        const result = readHubConfig(tempDir);
        expect(result).toEqual({
            hub: 'https://my-hub.railway.app',
            project: 'my-project',
            team: 'platform-team',
            platform: 'github',
        });
    });

    it('applies defaults for missing fields', () => {
        writeConfig(tempDir, JSON.stringify({ hub: 'https://hub.example.com' }));

        const result = readHubConfig(tempDir);
        expect(result).toEqual({
            hub: 'https://hub.example.com',
            project: basename(tempDir),
            team: 'ungrouped',
            platform: 'unknown',
        });
    });

    it('applies all defaults for empty object', () => {
        writeConfig(tempDir, '{}');

        const result = readHubConfig(tempDir);
        expect(result).toEqual({
            hub: '',
            project: basename(tempDir),
            team: 'ungrouped',
            platform: 'unknown',
        });
    });

    it('returns null when config file does not exist', () => {
        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('returns null for unparseable JSON', () => {
        writeConfig(tempDir, 'not valid json {{{');

        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('returns null when JSON parses to an array', () => {
        writeConfig(tempDir, '[1, 2, 3]');

        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('returns null when JSON parses to a string', () => {
        writeConfig(tempDir, '"hello"');

        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('returns null when JSON parses to a number', () => {
        writeConfig(tempDir, '42');

        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('returns null when JSON parses to null', () => {
        writeConfig(tempDir, 'null');

        const result = readHubConfig(tempDir);
        expect(result).toBeNull();
    });

    it('ignores non-string field values and applies defaults', () => {
        writeConfig(tempDir, JSON.stringify({
            hub: 123,
            project: true,
            team: null,
            platform: ['github'],
        }));

        const result = readHubConfig(tempDir);
        expect(result).toEqual({
            hub: '',
            project: basename(tempDir),
            team: 'ungrouped',
            platform: 'unknown',
        });
    });

    it('uses platform-appropriate path resolution (join)', () => {
        // Verifies that the path is constructed correctly regardless of trailing slashes
        const dirWithSlash = tempDir + '/';
        writeConfig(tempDir, JSON.stringify({ hub: 'https://hub.test' }));

        const result = readHubConfig(dirWithSlash);
        expect(result).not.toBeNull();
        expect(result!.hub).toBe('https://hub.test');
    });
});
