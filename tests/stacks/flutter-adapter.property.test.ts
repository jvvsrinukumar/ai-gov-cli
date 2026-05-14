/**
 * Property-based tests for the Flutter adapter.
 *
 * Feature: project-init
 * Tests Properties 7, 8, 10–14 from the design document.
 */

// Mock @inquirer/prompts before any imports
jest.mock('@inquirer/prompts', () => ({
    input: jest.fn(),
    confirm: jest.fn(),
    select: jest.fn(),
}));

// Mock node:child_process to prevent actual shell commands during scaffold
jest.mock('node:child_process', () => ({
    execSync: jest.fn(() => Buffer.from('')),
}));

import * as fc from 'fast-check';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { validateFlutterName } from '../../src/stacks/flutter/prompts.js';
import type { FlutterContext, FlutterService, FlutterEndpoint } from '../../src/stacks/flutter/prompts.js';
import type { ScaffoldContext } from '../../src/stacks/adapter.js';
import { FlutterAdapter } from '../../src/stacks/flutter/adapter.js';
import { scaffoldFlutter } from '../../src/stacks/flutter/scaffold.js';
import { endpointConstName, toCamel } from '../../src/stacks/flutter/helpers.js';
import { pubspecYaml } from '../../src/stacks/flutter/templates/pubspec.js';
import { appConfigDart } from '../../src/stacks/flutter/templates/dart-core.js';

// ─── Arbitraries ────────────────────────────────────────────────────────────

/** Generates valid Flutter snake_case app names */
const validFlutterName: fc.Arbitrary<string> = fc.tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
        fc.constantFrom(
            ...'abcdefghijklmnopqrstuvwxyz0123456789_'.split('')
        ),
        { minLength: 0, maxLength: 20 }
    ),
).map(([first, rest]) => first + rest.join(''));

/** Generates invalid Flutter names (strings that don't match ^[a-z][a-z0-9_]*$) */
const invalidFlutterName: fc.Arbitrary<string> = fc.oneof(
    // Starts with digit
    fc.tuple(
        fc.constantFrom(...'0123456789'.split('')),
        fc.string({ minLength: 0, maxLength: 10 }),
    ).map(([d, rest]) => d + rest),
    // Starts with uppercase
    fc.tuple(
        fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')),
        fc.string({ minLength: 0, maxLength: 10 }),
    ).map(([u, rest]) => u + rest),
    // Contains hyphen
    fc.tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.string({ minLength: 0, maxLength: 5 }),
        fc.constant('-'),
        fc.string({ minLength: 1, maxLength: 5 }),
    ).map(([f, mid, h, end]) => f + mid + h + end),
    // Contains space
    fc.tuple(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
        fc.constant(' '),
        fc.string({ minLength: 1, maxLength: 5 }),
    ).map(([f, sp, rest]) => f + sp + rest),
    // Empty string
    fc.constant(''),
    // Starts with underscore
    fc.tuple(
        fc.constant('_'),
        fc.string({ minLength: 1, maxLength: 10 }),
    ).map(([u, rest]) => u + rest),
).filter(s => !/^[a-z][a-z0-9_]*$/.test(s));

/** Generates a valid FlutterService */
const validFlutterService: fc.Arbitrary<FlutterService> = fc.tuple(
    validFlutterName,
    fc.constant({
        local: 'http://localhost:3000',
        dev: 'https://dev-api.example.com',
        qa: 'https://qa-api.example.com',
        staging: 'https://staging-api.example.com',
        prod: 'https://api.example.com',
    }),
).map(([name, urls]) => ({
    name,
    urls,
    headers: '',
    endpoints: [],
}));

/** Generates a non-empty list of FlutterService objects with unique names */
const nonEmptyServiceList: fc.Arbitrary<FlutterService[]> = fc.array(
    validFlutterService,
    { minLength: 1, maxLength: 5 }
).map(services => {
    // Ensure unique names
    const seen = new Set<string>();
    return services.filter(s => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
    });
}).filter(arr => arr.length > 0);

/** Generates a valid endpoint path segment (non-parameterised) */
const pathSegment: fc.Arbitrary<string> = fc.tuple(
    fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')),
    fc.array(
        fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')),
        { minLength: 0, maxLength: 8 }
    ),
).map(([first, rest]) => first + rest.join(''));

/** Generates a parameterised segment like {userId} */
const paramSegment: fc.Arbitrary<string> = pathSegment.map(s => `{${s}}`);

/** Generates an endpoint path with mix of static and parameterised segments */
const endpointPath: fc.Arbitrary<string> = fc.tuple(
    fc.array(
        fc.oneof(pathSegment, paramSegment),
        { minLength: 1, maxLength: 4 }
    ),
).map(([segments]) => '/' + segments.join('/'));

/** HTTP methods */
const httpMethod: fc.Arbitrary<string> = fc.constantFrom('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

/** Generates a valid FlutterEndpoint */
const validEndpoint: fc.Arbitrary<FlutterEndpoint> = fc.tuple(
    httpMethod,
    endpointPath,
).map(([method, path]) => ({ method, path }));

// ─── Helpers ────────────────────────────────────────────────────────────────

function createBaseContext(overrides: Partial<ScaffoldContext> = {}): ScaffoldContext {
    return {
        appName: 'test_app',
        displayName: 'Test App',
        outputDir: '/tmp',
        projectDir: '/tmp/test_app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
        ...overrides,
    };
}

function createFlutterContext(overrides: Partial<FlutterContext> = {}): FlutterContext {
    return {
        appName: 'test_app',
        displayName: 'Test App',
        outputDir: '/tmp',
        projectDir: '/tmp/test_app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
        androidPackageId: 'com.example.testapp',
        iosBundleId: 'com.example.testapp',
        flutterVersion: '3.29.0',
        services: [{
            name: 'api',
            urls: {
                local: 'http://localhost:3000',
                dev: 'https://dev-api.example.com',
                qa: 'https://qa-api.example.com',
                staging: 'https://staging-api.example.com',
                prod: 'https://api.example.com',
            },
            headers: '',
            endpoints: [],
        }],
        ...overrides,
    };
}

/** Recursively collect all .dart files in a directory */
function collectDartFiles(dir: string): string[] {
    const results: string[] = [];
    if (!existsSync(dir)) return results;
    const entries = readdirSync(dir);
    for (const entry of entries) {
        const full = join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
            results.push(...collectDartFiles(full));
        } else if (entry.endsWith('.dart')) {
            results.push(full);
        }
    }
    return results;
}

// Silence console output during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});
afterAll(() => { jest.restoreAllMocks(); });

// ─── Property 7: runPrompts Preserves Base Context ──────────────────────────

describe('Feature: project-init, Property 7: runPrompts Preserves Base Context', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any ScaffoldContext passed to adapter.runPrompts(base),
     * the returned context contains all key-value pairs from the original
     * base context unchanged (stack-specific fields are added, existing fields
     * are not modified).
     */
    it('returned context contains all original base fields unchanged', async () => {
        // Mock the prompts module to avoid interactive input
        const { input, confirm } = jest.requireMock('@inquirer/prompts') as {
            input: jest.Mock;
            confirm: jest.Mock;
        };

        await fc.assert(
            fc.asyncProperty(
                validFlutterName,
                fc.constantFrom('claude-code' as const, 'kiro' as const),
                fc.boolean(),
                fc.constantFrom('github' as const, 'gitlab' as const, 'bitbucket' as const, 'none' as const),
                async (appName, agent, gitHooks, ci) => {
                    const base: ScaffoldContext = {
                        appName,
                        displayName: 'Test App',
                        outputDir: '/tmp/projects',
                        projectDir: `/tmp/projects/${appName}`,
                        agent,
                        gitHooks,
                        ci,
                    };

                    // Mock prompts to return valid Flutter-specific values
                    let callCount = 0;
                    input.mockImplementation(() => {
                        callCount++;
                        if (callCount === 1) return Promise.resolve('com.example.testapp');
                        if (callCount === 2) return Promise.resolve('com.example.testapp');
                        if (callCount === 3) return Promise.resolve('3.29.0');
                        return Promise.resolve('');
                    });
                    confirm.mockResolvedValue(false);

                    const { collectFlutterPrompts } = await import('../../src/stacks/flutter/prompts.js');
                    const result = await collectFlutterPrompts(base);

                    // All original base fields must be preserved
                    expect(result.appName).toBe(base.appName);
                    expect(result.displayName).toBe(base.displayName);
                    expect(result.outputDir).toBe(base.outputDir);
                    expect(result.projectDir).toBe(base.projectDir);
                    expect(result.agent).toBe(base.agent);
                    expect(result.gitHooks).toBe(base.gitHooks);
                    expect(result.ci).toBe(base.ci);

                    // Reset call count for next iteration
                    callCount = 0;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 8: Flutter Naming Convention Validation ────────────────────────

describe('Feature: project-init, Property 8: Flutter Naming Convention Validation', () => {
    /**
     * **Validates: Requirements 4.1**
     *
     * For any string, the Flutter name validator accepts it if and only if
     * it matches the regex ^[a-z][a-z0-9_]*$.
     */
    it('accepts valid snake_case names matching ^[a-z][a-z0-9_]*$', () => {
        fc.assert(
            fc.property(validFlutterName, (name: string) => {
                const result = validateFlutterName(name);
                expect(result).toBe(true);
            }),
            { numRuns: 100 }
        );
    });

    it('rejects strings not matching ^[a-z][a-z0-9_]*$', () => {
        fc.assert(
            fc.property(invalidFlutterName, (name: string) => {
                const result = validateFlutterName(name);
                expect(result).not.toBe(true);
                expect(typeof result).toBe('string');
            }),
            { numRuns: 100 }
        );
    });

    it('validator result matches regex for arbitrary strings', () => {
        const anyString = fc.string({ minLength: 0, maxLength: 30 });
        fc.assert(
            fc.property(anyString, (name: string) => {
                const result = validateFlutterName(name);
                const matchesRegex = /^[a-z][a-z0-9_]*$/.test(name);
                if (matchesRegex) {
                    expect(result).toBe(true);
                } else {
                    expect(result).not.toBe(true);
                }
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 10: Flutter Scaffold Directory Completeness ───────────────────

describe('Feature: project-init, Property 10: Flutter Scaffold Directory Completeness', () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any valid FlutterContext, after scaffold(ctx) completes,
     * all required directories exist within ctx.projectDir.
     */
    it('all required directories exist after scaffold', async () => {
        const requiredDirs = [
            'lib/core/config',
            'lib/core/di',
            'lib/core/network',
            'lib/features',
            'assets/images',
            'bricks/clean_feature/__brick__',
            'test/architecture',
        ];

        await fc.assert(
            fc.asyncProperty(validFlutterName, async (appName: string) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'flutter-prop10-'));
                const projectDir = join(tmpDir, appName);

                try {
                    const ctx = createFlutterContext({
                        appName,
                        projectDir,
                        outputDir: tmpDir,
                    });

                    await scaffoldFlutter(ctx);

                    for (const dir of requiredDirs) {
                        const fullPath = join(projectDir, dir);
                        expect(existsSync(fullPath)).toBe(true);
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 11: Flutter Endpoint Name Derivation ──────────────────────────

describe('Feature: project-init, Property 11: Flutter Endpoint Name Derivation', () => {
    /**
     * **Validates: Requirements 5.4, 5.5, 5.11**
     *
     * Transformation rules produce correct constant names:
     * - Strip leading slash
     * - Remove parameterised segments (those matching {...})
     * - Join remaining segments in camelCase
     * - Append "ById" if any parameterised segments existed
     * - Prefix with method if duplicate
     */
    it('strips leading slash and joins segments in camelCase', () => {
        fc.assert(
            fc.property(
                fc.array(pathSegment, { minLength: 1, maxLength: 4 }),
                httpMethod,
                (segments, method) => {
                    const path = '/' + segments.join('/');
                    const usedNames = new Set<string>();
                    const result = endpointConstName(method, path, usedNames, 'api');

                    // Result should be a non-empty string
                    expect(result.length).toBeGreaterThan(0);

                    // Result should be valid camelCase (starts with lowercase)
                    expect(result[0]).toMatch(/[a-z]/);

                    // No slashes in result
                    expect(result).not.toContain('/');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('appends "by" prefix for parameterised segments', () => {
        fc.assert(
            fc.property(
                pathSegment,
                pathSegment,
                httpMethod,
                (staticSeg, paramName, method) => {
                    const path = `/${staticSeg}/{${paramName}}`;
                    const usedNames = new Set<string>();
                    const result = endpointConstName(method, path, usedNames, 'api');

                    // When params exist, the result should contain "by" (from by_{paramName})
                    // The implementation converts {param} to by_param then camelCases
                    expect(result.toLowerCase()).toContain('by');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('prefixes with method when duplicate names occur', () => {
        fc.assert(
            fc.property(
                endpointPath,
                httpMethod,
                httpMethod.filter(m => true), // second method
                (path, method1, method2) => {
                    const usedNames = new Set<string>();
                    const first = endpointConstName(method1, path, usedNames, 'api');
                    const second = endpointConstName(method2, path, usedNames, 'api');

                    // Both should be non-empty strings
                    expect(first.length).toBeGreaterThan(0);
                    expect(second.length).toBeGreaterThan(0);

                    // If methods are different, names should be different
                    if (method1 !== method2) {
                        expect(first).not.toBe(second);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('all generated names are unique within a service', () => {
        fc.assert(
            fc.property(
                fc.array(validEndpoint, { minLength: 2, maxLength: 6 }),
                (endpoints) => {
                    const usedNames = new Set<string>();
                    const names: string[] = [];

                    for (const ep of endpoints) {
                        const name = endpointConstName(ep.method, ep.path, usedNames, 'api');
                        names.push(name);
                    }

                    // All names should be unique
                    const uniqueNames = new Set(names);
                    expect(uniqueNames.size).toBe(names.length);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ─── Property 12: Flutter AppConfig Getter-Per-Service ──────────────────────

describe('Feature: project-init, Property 12: Flutter AppConfig Getter-Per-Service', () => {
    /**
     * **Validates: Requirements 5.2**
     *
     * For any non-empty list of FlutterService objects, generated app_config.dart
     * contains exactly one static getter per service with correct naming.
     */
    it('one getter per service with correct naming', () => {
        fc.assert(
            fc.property(nonEmptyServiceList, (services: FlutterService[]) => {
                const ctx = createFlutterContext({ services });
                const content = appConfigDart(ctx);

                for (const svc of services) {
                    const expectedGetter = `${toCamel(svc.name)}BaseUrl`;
                    const getterPattern = `static String get ${expectedGetter}`;
                    expect(content).toContain(getterPattern);
                }

                // Count total getters (excluding isProduction and enableLogging)
                const getterMatches = content.match(/static String get \w+BaseUrl/g) || [];
                expect(getterMatches.length).toBe(services.length);
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 13: Flutter pubspec.yaml Correctness ──────────────────────────

describe('Feature: project-init, Property 13: Flutter pubspec.yaml Correctness', () => {
    /**
     * **Validates: Requirements 5.7**
     *
     * For any valid FlutterContext, the generated pubspec.yaml has its name field
     * equal to ctx.appName and includes flutter_bloc, dio, get_it, and go_router
     * in its dependencies.
     */
    it('name matches appName and required deps present', () => {
        fc.assert(
            fc.property(validFlutterName, (appName: string) => {
                const ctx = createFlutterContext({ appName });
                const content = pubspecYaml(ctx);

                // name field matches appName
                expect(content).toMatch(new RegExp(`^name: ${appName}$`, 'm'));

                // Required dependencies present
                expect(content).toContain('flutter_bloc:');
                expect(content).toContain('dio:');
                expect(content).toContain('get_it:');
                expect(content).toContain('go_router:');
            }),
            { numRuns: 100 }
        );
    });
});

// ─── Property 14: Flutter Package Import Prefix ─────────────────────────────

describe('Feature: project-init, Property 14: Flutter Package Import Prefix', () => {
    /**
     * **Validates: Requirements 5.10**
     *
     * For any valid FlutterContext with appName X, all generated Dart files
     * that contain import statements use the package:X/ prefix for internal imports.
     */
    it('all generated Dart files use package:<appName>/ for internal imports', async () => {
        await fc.assert(
            fc.asyncProperty(validFlutterName, async (appName: string) => {
                const tmpDir = mkdtempSync(join(tmpdir(), 'flutter-prop14-'));
                const projectDir = join(tmpDir, appName);

                try {
                    const ctx = createFlutterContext({
                        appName,
                        projectDir,
                        outputDir: tmpDir,
                    });

                    await scaffoldFlutter(ctx);

                    const dartFiles = collectDartFiles(join(projectDir, 'lib'));
                    const expectedPrefix = `package:${appName}/`;

                    for (const file of dartFiles) {
                        const content = readFileSync(file, 'utf8');
                        const importLines = content.split('\n').filter(
                            line => line.trim().startsWith('import') && !line.trim().startsWith('//')
                        );

                        for (const importLine of importLines) {
                            // Skip external package imports (package:flutter/, package:dio/, etc.)
                            const match = importLine.match(/import\s+'(package:[^']+)'/);
                            if (match) {
                                const importPath = match[1];
                                // If it's a package import that's not an external package,
                                // it should use our app's package prefix
                                if (importPath.startsWith('package:') &&
                                    !importPath.startsWith('package:flutter') &&
                                    !importPath.startsWith('package:dio') &&
                                    !importPath.startsWith('package:get_it') &&
                                    !importPath.startsWith('package:go_router') &&
                                    !importPath.startsWith('package:flutter_bloc') &&
                                    !importPath.startsWith('package:equatable') &&
                                    !importPath.startsWith('package:either_dart') &&
                                    !importPath.startsWith('package:pretty_dio_logger') &&
                                    !importPath.startsWith('package:connectivity_plus') &&
                                    !importPath.startsWith('package:shared_preferences') &&
                                    !importPath.startsWith('package:flutter_secure_storage') &&
                                    !importPath.startsWith('package:logger') &&
                                    !importPath.startsWith('package:intl') &&
                                    !importPath.startsWith('package:test') &&
                                    !importPath.startsWith('package:mocktail') &&
                                    !importPath.startsWith('package:bloc_test') &&
                                    !importPath.startsWith('package:integration_test')) {
                                    expect(importPath).toMatch(new RegExp(`^package:${appName}/`));
                                }
                            }

                            // Check for relative imports (should not exist in lib/)
                            // Dart files in lib/ should use package imports, not relative
                            if (importLine.match(/import\s+'\.\.?\//)) {
                                // Relative imports are not allowed — they should use package prefix
                                // But 'part' directives are okay
                                if (!importLine.trim().startsWith('part')) {
                                    fail(`Found relative import in ${file}: ${importLine}`);
                                }
                            }
                        }
                    }
                } finally {
                    rmSync(tmpDir, { recursive: true, force: true });
                }
            }),
            { numRuns: 100 }
        );
    });
});
