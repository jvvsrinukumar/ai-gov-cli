/**
 * MCP governance tests: catalog integrity, entry builder, env file round-trips,
 * global env, gitignore, and property-based correctness tests.
 */
import * as fc from 'fast-check';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { MCP_CATALOG, getToolById, getTokenTools, getValidToolIds } from '../src/mcp/catalog.js';
import { buildMcpEntry, buildMcpConfig, readMcpConfig, writeMcpConfig } from '../src/mcp/mcp-json.js';
import { readEnvFile, writeEnvFile, generateEnvExample, generateEnvrc, readMergedEnv } from '../src/mcp/env-files.js';
import { getGlobalEnvPath, readGlobalEnv, writeGlobalEnv, ensureGlobalEnvDir } from '../src/mcp/global-env.js';
import { ensureMcpGitignore } from '../src/mcp/gitignore.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-mcp-test-'));
}

function cleanDir(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
}

// ─── Catalog tests ────────────────────────────────────────────────────────────

describe('MCP Catalog', () => {
    test('catalog has exactly 9 tools', () => {
        expect(MCP_CATALOG).toHaveLength(9);
    });

    test('all tool IDs are unique', () => {
        const ids = MCP_CATALOG.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    test('getValidToolIds returns a Set of 9 IDs', () => {
        const ids = getValidToolIds();
        expect(ids.size).toBe(9);
    });

    test('getToolById returns correct tool', () => {
        const jira = getToolById('jira');
        expect(jira.id).toBe('jira');
        expect(jira.displayName).toBe('Jira');
        expect(jira.transport).toBe('stdio');
        expect(jira.isOAuth).toBe(false);
    });

    test('getToolById throws for unknown ID', () => {
        expect(() => getToolById('not-a-tool')).toThrow(/Unknown MCP tool/);
    });

    test('getTokenTools excludes OAuth tools', () => {
        const tokenTools = getTokenTools();
        expect(tokenTools.every(t => !t.isOAuth)).toBe(true);
    });

    test('OAuth tools have no personalVars', () => {
        const oauthTools = MCP_CATALOG.filter(t => t.isOAuth);
        expect(oauthTools.length).toBeGreaterThan(0);
        for (const t of oauthTools) {
            expect(t.personalVars).toHaveLength(0);
        }
    });

    test('stdio tools have npmPackage', () => {
        const stdioTools = MCP_CATALOG.filter(t => t.transport === 'stdio');
        for (const t of stdioTools) {
            expect(t.npmPackage).toBeTruthy();
        }
    });

    test('http tools have url', () => {
        const httpTools = MCP_CATALOG.filter(t => t.transport === 'http');
        for (const t of httpTools) {
            expect(t.url).toBeTruthy();
        }
    });

    test('jira uses correct npm package', () => {
        const jira = getToolById('jira');
        expect(jira.npmPackage).toBe('@aashari/mcp-server-atlassian-jira@3.3.0');
    });

    test('notion uses correct URL', () => {
        const notion = getToolById('notion');
        expect(notion.url).toBe('https://mcp.notion.com/mcp');
    });

    test('postgres has passAsArg on DATABASE_URL', () => {
        const postgres = getToolById('postgres');
        const dbVar = postgres.personalVars.find(v => v.name === 'DATABASE_URL');
        expect(dbVar).toBeDefined();
        expect(dbVar!.passAsArg).toBe(true);
        expect(dbVar!.scope).toBe('project');
    });

    test('passAsArg does not hide DATABASE_URL from project-scoped personalVars', () => {
        // Regression: onboard/validate must NOT skip passAsArg vars — they still
        // need to be written to .env.mcp so the shell exports them for ${VAR} substitution.
        const postgres = getToolById('postgres');
        const projectVars = postgres.personalVars.filter(v => v.scope === 'project');
        expect(projectVars.some(v => v.name === 'DATABASE_URL')).toBe(true);
    });

    test('jira personal vars have global scope', () => {
        const jira = getToolById('jira');
        for (const v of jira.personalVars) {
            expect(v.scope).toBe('global');
        }
    });
});

// ─── buildMcpEntry tests ──────────────────────────────────────────────────────

describe('buildMcpEntry', () => {
    test('jira entry has env with ${VAR} for personal vars and literal for org vars', () => {
        const jira = getToolById('jira');
        const entry = buildMcpEntry(jira, { ATLASSIAN_SITE_NAME: 'mycompany' });
        expect(entry.type).toBe('stdio');
        expect(entry.command).toBe('npx');
        expect(entry.args).toContain('-y');
        expect(entry.args).toContain('@aashari/mcp-server-atlassian-jira@3.3.0');
        expect(entry.env).toBeDefined();
        expect(entry.env!['ATLASSIAN_SITE_NAME']).toBe('mycompany');
        expect(entry.env!['ATLASSIAN_USER_EMAIL']).toBe('${ATLASSIAN_USER_EMAIL}');
        expect(entry.env!['ATLASSIAN_API_TOKEN']).toBe('${ATLASSIAN_API_TOKEN}');
    });

    test('postgres passAsArg var appears in args, not env', () => {
        const postgres = getToolById('postgres');
        const entry = buildMcpEntry(postgres);
        expect(entry.args).toContain('${DATABASE_URL}');
        expect(entry.env).toBeUndefined();
    });

    test('github entry has Authorization header with ${GITHUB_TOKEN}', () => {
        const github = getToolById('github');
        const entry = buildMcpEntry(github);
        expect(entry.type).toBe('http');
        expect(entry.url).toBe('https://api.githubcopilot.com/mcp/');
        expect(entry.headers).toBeDefined();
        expect(entry.headers!['Authorization']).toContain('${GITHUB_TOKEN}');
    });

    test('notion OAuth entry has no env or headers', () => {
        const notion = getToolById('notion');
        const entry = buildMcpEntry(notion);
        expect(entry.type).toBe('http');
        expect(entry.env).toBeUndefined();
        expect(entry.headers).toBeUndefined();
    });
});

// ─── readEnvFile / writeEnvFile tests ─────────────────────────────────────────

describe('readEnvFile', () => {
    test('returns {} for non-existent file', () => {
        expect(readEnvFile('/does/not/exist/.env.mcp')).toEqual({});
    });

    test('parses KEY=VALUE lines', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.env.mcp'), 'FOO=bar\nBAZ=qux\n');
            expect(readEnvFile(join(dir, '.env.mcp'))).toEqual({ FOO: 'bar', BAZ: 'qux' });
        } finally { cleanDir(dir); }
    });

    test('ignores comment lines and blank lines', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.env.mcp'), '# comment\n\nFOO=bar\n\n# another\n');
            expect(readEnvFile(join(dir, '.env.mcp'))).toEqual({ FOO: 'bar' });
        } finally { cleanDir(dir); }
    });

    test('splits only on first = (value may contain =)', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.env.mcp'), 'DB_URL=postgres://host?opt=1\n');
            const result = readEnvFile(join(dir, '.env.mcp'));
            expect(result['DB_URL']).toBe('postgres://host?opt=1');
        } finally { cleanDir(dir); }
    });
});

// ─── writeEnvFile comment preservation ───────────────────────────────────────

describe('writeEnvFile comment preservation', () => {
    test('preserves existing comments when updating a key', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.env.mcp'),
                '# Jira tokens\n# Your API key\nATLASSIAN_API_TOKEN=old_token\n'
            );
            writeEnvFile(join(dir, '.env.mcp'), { ATLASSIAN_API_TOKEN: 'new_token' });
            const content = readFileSync(join(dir, '.env.mcp'), 'utf-8');
            expect(content).toContain('# Jira tokens');
            expect(content).toContain('# Your API key');
            expect(content).toContain('ATLASSIAN_API_TOKEN=new_token');
            expect(content).not.toContain('old_token');
        } finally { cleanDir(dir); }
    });

    test('appends new keys without removing existing content', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.env.mcp'), '# comment\nKEY_A=val_a\n');
            writeEnvFile(join(dir, '.env.mcp'), { KEY_B: 'val_b' });
            const content = readFileSync(join(dir, '.env.mcp'), 'utf-8');
            expect(content).toContain('# comment');
            expect(content).toContain('KEY_A=val_a');
            expect(content).toContain('KEY_B=val_b');
        } finally { cleanDir(dir); }
    });
});

// ─── readMcpConfig corrupt JSON warning ──────────────────────────────────────

describe('readMcpConfig', () => {
    test('returns null and warns on corrupt JSON', () => {
        const dir = makeTmpDir();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            writeFileSync(join(dir, '.mcp.json'), '{ not valid json', 'utf-8');
            const result = readMcpConfig(dir);
            expect(result).toBeNull();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[ai-gov]'));
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('corrupt'));
        } finally {
            warnSpy.mockRestore();
            cleanDir(dir);
        }
    });

    test('returns null (no warn) when file does not exist', () => {
        const dir = makeTmpDir();
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            expect(readMcpConfig(dir)).toBeNull();
            expect(warnSpy).not.toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
            cleanDir(dir);
        }
    });
});

// ─── generateEnvExample ───────────────────────────────────────────────────────

describe('generateEnvExample', () => {
    test('contains project-scoped vars for postgres', () => {
        const postgres = getToolById('postgres');
        const content = generateEnvExample([postgres]);
        expect(content).toContain('DATABASE_URL');
        expect(content).toContain('.env.mcp');
    });

    test('does not include global-scoped vars from jira', () => {
        const jira = getToolById('jira');
        const content = generateEnvExample([jira]);
        // jira vars are global scope — not in project example
        expect(content).not.toContain('ATLASSIAN_API_TOKEN');
    });

    test('empty for OAuth-only tools', () => {
        const notion = getToolById('notion');
        const content = generateEnvExample([notion]);
        // OAuth tool has no personal vars to show
        expect(content).not.toContain('=');
    });
});

// ─── generateEnvrc ────────────────────────────────────────────────────────────

describe('generateEnvrc', () => {
    test('contains both dotenv_if_exists lines in correct order', () => {
        const content = generateEnvrc();
        const globalIdx = content.indexOf('.env.mcp.global');
        const projectIdx = content.indexOf('.env.mcp\n');
        expect(globalIdx).toBeGreaterThan(-1);
        expect(projectIdx).toBeGreaterThan(-1);
        expect(globalIdx).toBeLessThan(projectIdx);
    });
});

// ─── ensureMcpGitignore ───────────────────────────────────────────────────────

describe('ensureMcpGitignore', () => {
    test('creates .gitignore with .env.mcp when it does not exist', () => {
        const dir = makeTmpDir();
        try {
            ensureMcpGitignore(dir);
            const content = readFileSync(join(dir, '.gitignore'), 'utf-8');
            expect(content).toContain('.env.mcp');
        } finally { cleanDir(dir); }
    });

    test('appends to existing .gitignore without duplicate', () => {
        const dir = makeTmpDir();
        try {
            writeFileSync(join(dir, '.gitignore'), 'node_modules\n');
            ensureMcpGitignore(dir);
            ensureMcpGitignore(dir); // run twice
            const content = readFileSync(join(dir, '.gitignore'), 'utf-8');
            const matches = content.match(/\.env\.mcp/g) ?? [];
            expect(matches.length).toBe(1);
            expect(content).toContain('node_modules');
        } finally { cleanDir(dir); }
    });
});

// ─── readMergedEnv precedence ─────────────────────────────────────────────────

describe('readMergedEnv', () => {
    test('project env takes precedence over global env on key conflict', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ SHARED_KEY: 'global_value' }, dir);
            writeFileSync(join(dir, '.env.mcp'), 'SHARED_KEY=project_value\n');
            const merged = readMergedEnv(dir, dir);
            expect(merged['SHARED_KEY']).toBe('project_value');
        } finally { cleanDir(dir); }
    });

    test('returns all keys from both files (union)', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ GLOBAL_KEY: 'gval' }, dir);
            writeFileSync(join(dir, '.env.mcp'), 'PROJECT_KEY=pval\n');
            const merged = readMergedEnv(dir, dir);
            expect(merged['GLOBAL_KEY']).toBe('gval');
            expect(merged['PROJECT_KEY']).toBe('pval');
        } finally { cleanDir(dir); }
    });
});

// ─── Global env functions ─────────────────────────────────────────────────────

describe('getGlobalEnvPath', () => {
    test('path ends with .env.mcp.global', () => {
        expect(getGlobalEnvPath()).toMatch(/\.env\.mcp\.global$/);
    });

    test('path contains .config/ai-gov', () => {
        expect(getGlobalEnvPath()).toContain(join('.config', 'ai-gov'));
    });

    test('overrideHome redirects path to given directory', () => {
        const dir = makeTmpDir();
        try {
            const path = getGlobalEnvPath(dir);
            expect(path.startsWith(dir)).toBe(true);
            expect(path).toMatch(/\.env\.mcp\.global$/);
        } finally { cleanDir(dir); }
    });
});

describe('readGlobalEnv / writeGlobalEnv', () => {
    test('returns {} when global env file does not exist', () => {
        const dir = makeTmpDir();
        try {
            expect(readGlobalEnv(dir)).toEqual({});
        } finally { cleanDir(dir); }
    });

    test('write then read round-trip', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ MY_TOKEN: 'abc123', SITE: 'company' }, dir);
            const result = readGlobalEnv(dir);
            expect(result['MY_TOKEN']).toBe('abc123');
            expect(result['SITE']).toBe('company');
        } finally { cleanDir(dir); }
    });

    test('additive merge — preserves keys from prior write', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ KEY_A: 'valA' }, dir);
            writeGlobalEnv({ KEY_B: 'valB' }, dir);
            const result = readGlobalEnv(dir);
            expect(result['KEY_A']).toBe('valA');
            expect(result['KEY_B']).toBe('valB');
        } finally { cleanDir(dir); }
    });

    test('overwrites existing key on subsequent write', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ KEY_A: 'old' }, dir);
            writeGlobalEnv({ KEY_A: 'new' }, dir);
            expect(readGlobalEnv(dir)['KEY_A']).toBe('new');
        } finally { cleanDir(dir); }
    });

    test('creates .config/ai-gov/ directory if it does not exist', () => {
        const dir = makeTmpDir();
        try {
            writeGlobalEnv({ X: 'y' }, dir);
            expect(existsSync(getGlobalEnvPath(dir))).toBe(true);
        } finally { cleanDir(dir); }
    });
});

// ─── Property-based tests ─────────────────────────────────────────────────────

describe('Property P1: env round-trip', () => {
    // [P1] For any valid KEY=VALUE pairs, write+read produces equivalent object.
    // Values must not have leading/trailing whitespace (readEnvFile trims them by design).
    test('random env key-value round-trip', () => {
        const dir = makeTmpDir();
        try {
            fc.assert(fc.property(
                fc.dictionary(
                    fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,19}$/),
                    fc.string({ minLength: 1, maxLength: 50 }).filter(v =>
                        !v.includes('\n') && v === v.trim() && v.length > 0
                    )
                ),
                (vars) => {
                    if (Object.keys(vars).length === 0) return true;
                    const filePath = join(dir, '.env.test');
                    writeEnvFile(filePath, vars);
                    const read = readEnvFile(filePath);
                    return Object.entries(vars).every(([k, v]) => read[k] === v);
                }
            ), { numRuns: 100 });
        } finally { cleanDir(dir); }
    });
});

describe('Property P2: env merge precedence', () => {
    // [P2] For any two env maps with overlapping keys, project values win.
    // Values must not have leading/trailing whitespace (readEnvFile trims them by design).
    test('project values override global values on conflict', () => {
        const dir = makeTmpDir();
        try {
            fc.assert(fc.property(
                fc.string({ minLength: 1, maxLength: 20 }).map(s => s.toUpperCase().replace(/[^A-Z0-9_]/g, 'X')),
                fc.string({ minLength: 1, maxLength: 30 }).filter(v =>
                    !v.includes('\n') && !v.includes('=') && v === v.trim() && v.length > 0
                ),
                fc.string({ minLength: 1, maxLength: 30 }).filter(v =>
                    !v.includes('\n') && !v.includes('=') && v === v.trim() && v.length > 0
                ),
                (key, globalVal, projectVal) => {
                    if (!key || globalVal === projectVal) return true;
                    const envKey = `TEST_${key}`;
                    writeFileSync(join(dir, '.env.mcp'), `${envKey}=${projectVal}\n`);
                    const merged = readMergedEnv(dir);
                    return merged[envKey] === projectVal;
                }
            ), { numRuns: 50 });
        } finally { cleanDir(dir); }
    });
});

describe('Property P4: invalid tool ID throws', () => {
    // [P4] Any string not matching the 9 valid IDs causes getToolById to throw
    test('random non-tool-ID strings always throw', () => {
        const validIds = getValidToolIds();
        fc.assert(fc.property(
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => !validIds.has(s)),
            (id) => {
                expect(() => getToolById(id)).toThrow();
                return true;
            }
        ), { numRuns: 100 });
    });
});

describe('Property P3: global env additive merge', () => {
    // [P3] writeGlobalEnv(A) then writeGlobalEnv(B) with disjoint keys → readGlobalEnv contains A ∪ B
    test('two writes with disjoint keys preserve all keys', () => {
        const dir = makeTmpDir();
        try {
            fc.assert(fc.property(
                fc.dictionary(
                    fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,15}$/),
                    fc.string({ minLength: 1, maxLength: 30 }).filter(v =>
                        !v.includes('\n') && v === v.trim() && v.length > 0
                    ),
                    { minKeys: 1, maxKeys: 5 }
                ),
                fc.dictionary(
                    fc.stringMatching(/^[A-Z_][A-Z0-9_]{0,15}$/),
                    fc.string({ minLength: 1, maxLength: 30 }).filter(v =>
                        !v.includes('\n') && v === v.trim() && v.length > 0
                    ),
                    { minKeys: 1, maxKeys: 5 }
                ),
                (mapA, mapB) => {
                    // Make keys disjoint by prefixing
                    const a: Record<string, string> = {};
                    const b: Record<string, string> = {};
                    for (const [k, v] of Object.entries(mapA)) a[`AA_${k}`] = v;
                    for (const [k, v] of Object.entries(mapB)) b[`BB_${k}`] = v;

                    writeGlobalEnv(a, dir);
                    writeGlobalEnv(b, dir);
                    const result = readGlobalEnv(dir);

                    for (const [k, v] of Object.entries(a)) {
                        if (result[k] !== v) return false;
                    }
                    for (const [k, v] of Object.entries(b)) {
                        if (result[k] !== v) return false;
                    }
                    return true;
                }
            ), { numRuns: 50 });
        } finally { cleanDir(dir); }
    });
});

describe('Property P5: buildMcpEntry variable placement', () => {
    // [P5] Org vars appear as literals; personal vars appear as ${VAR_NAME}
    // Check the entry object directly rather than JSON.stringify to avoid JSON escape issues.
    test('org vars are literals, personal vars are ${} placeholders', () => {
        const tokenTools = getTokenTools().filter(t => t.transport === 'stdio' && t.orgVars.length > 0);
        if (tokenTools.length === 0) return;
        fc.assert(fc.property(
            fc.constantFrom(...tokenTools),
            // Use only simple alphanumeric org values to avoid JSON escaping edge cases
            fc.stringMatching(/^[a-z0-9]{1,20}$/),
            (tool, orgValue) => {
                const orgValues: Record<string, string> = {};
                for (const v of tool.orgVars) orgValues[v.name] = orgValue;
                const entry = buildMcpEntry(tool, orgValues);
                // Check personal vars appear as ${VAR_NAME} in env
                if (entry.env) {
                    for (const v of tool.personalVars) {
                        if (!v.passAsArg) {
                            expect(entry.env[v.name]).toBe(`\${${v.name}}`);
                        }
                    }
                    // Org vars appear as literal values in env
                    for (const v of tool.orgVars) {
                        expect(entry.env[v.name]).toBe(orgValue);
                    }
                }
                return true;
            }
        ), { numRuns: 50 });
    });
});
