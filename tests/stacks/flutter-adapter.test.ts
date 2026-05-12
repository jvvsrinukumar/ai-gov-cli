/**
 * Unit tests for the Flutter adapter.
 *
 * Validates: Requirements 4.1, 5.1–5.11, 7.1–7.6, 8.1–8.9
 */

// Mock @inquirer/prompts before any imports
jest.mock('@inquirer/prompts', () => ({
    select: jest.fn().mockResolvedValue('flutter'),
    confirm: jest.fn().mockResolvedValue(true),
    input: jest.fn().mockResolvedValue('test_app'),
}));

// Mock node:child_process for postSetup tests (adapter uses 'node:child_process' import)
jest.mock('node:child_process', () => ({
    execSync: jest.fn(),
}));

import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'node:child_process';

import { FlutterAdapter } from '../../src/stacks/flutter/adapter.js';
import { validateFlutterName } from '../../src/stacks/flutter/prompts.js';
import type { FlutterContext, FlutterService } from '../../src/stacks/flutter/prompts.js';
import { pubspecYaml, analysisOptionsYaml } from '../../src/stacks/flutter/templates/pubspec.js';
import { appConfigDart, apiEndpointsDart, serviceHeadersDart } from '../../src/stacks/flutter/templates/dart-core.js';
import { dioFactoryDart } from '../../src/stacks/flutter/templates/dart-network.js';
import { mainDart } from '../../src/stacks/flutter/templates/dart-main.js';
import { endpointConstName } from '../../src/stacks/flutter/helpers.js';
import type { ScaffoldContext } from '../../src/stacks/adapter.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const mockedExecSync = execSync as jest.MockedFunction<typeof execSync>;

function createFlutterContext(overrides: Partial<FlutterContext> = {}): FlutterContext {
    const base: FlutterContext = {
        appName: 'test_app',
        displayName: 'Test App',
        outputDir: '/tmp',
        projectDir: '/tmp/test_app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
        androidPackageId: 'com.example.test_app',
        iosBundleId: 'com.example.test_app',
        flutterVersion: '3.29.0',
        services: [
            {
                name: 'api',
                urls: {
                    local: 'http://localhost:3000',
                    dev: 'https://dev-api.example.com',
                    qa: 'https://qa-api.example.com',
                    staging: 'https://staging-api.example.com',
                    prod: 'https://api.example.com',
                },
                headers: '',
                endpoints: [
                    { method: 'POST', path: '/auth/login' },
                    { method: 'GET', path: '/users' },
                ],
            },
        ],
    };
    return { ...base, ...overrides };
}

function createServiceWithEndpoints(
    name: string,
    endpoints: Array<{ method: string; path: string }>,
    headers = '',
): FlutterService {
    return {
        name,
        urls: {
            local: 'http://localhost:3000',
            dev: `https://dev-${name}.example.com`,
            qa: `https://qa-${name}.example.com`,
            staging: `https://staging-${name}.example.com`,
            prod: `https://${name}.example.com`,
        },
        headers,
        endpoints,
    };
}

// Silence console output during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'warn').mockImplementation(() => { });
});
afterAll(() => { jest.restoreAllMocks(); });

// ─── Naming Convention (Req 4.1) ────────────────────────────────────────────

describe('Flutter Naming Convention (Req 4.1)', () => {
    it('accepts valid snake_case names', () => {
        expect(validateFlutterName('my_app')).toBe(true);
        expect(validateFlutterName('a')).toBe(true);
        expect(validateFlutterName('hello_world_123')).toBe(true);
        expect(validateFlutterName('app2')).toBe(true);
    });

    it('rejects names starting with a digit', () => {
        expect(validateFlutterName('2app')).not.toBe(true);
    });

    it('rejects names with uppercase letters', () => {
        expect(validateFlutterName('MyApp')).not.toBe(true);
        expect(validateFlutterName('my_App')).not.toBe(true);
    });

    it('rejects names with hyphens', () => {
        expect(validateFlutterName('my-app')).not.toBe(true);
    });

    it('rejects empty string', () => {
        expect(validateFlutterName('')).not.toBe(true);
    });

    it('rejects names with special characters', () => {
        expect(validateFlutterName('my app')).not.toBe(true);
        expect(validateFlutterName('my.app')).not.toBe(true);
        expect(validateFlutterName('my@app')).not.toBe(true);
    });

    it('rejects names starting with underscore', () => {
        expect(validateFlutterName('_my_app')).not.toBe(true);
    });
});

// ─── adapter.validateName (Req 4.1, StackAdapter interface) ─────────────────

describe('FlutterAdapter.validateName', () => {
    const adapter = new FlutterAdapter();

    it('returns true for valid snake_case names', () => {
        expect(adapter.validateName('my_app')).toBe(true);
        expect(adapter.validateName('test123')).toBe(true);
    });

    it('returns error string for names with uppercase letters', () => {
        expect(adapter.validateName('MyApp')).not.toBe(true);
        expect(typeof adapter.validateName('MyApp')).toBe('string');
    });

    it('returns error string for names with hyphens', () => {
        expect(adapter.validateName('my-app')).not.toBe(true);
    });
});

// ─── Directory Structure (Req 5.1) ─────────────────────────────────────────

describe('Flutter Scaffold Directory Structure (Req 5.1)', () => {
    let tmpDir: string;
    let projectDir: string;
    let adapter: FlutterAdapter;

    beforeAll(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'flutter-scaffold-'));
        projectDir = join(tmpDir, 'test_app');
        adapter = new FlutterAdapter();

        // Reset execSync mock to actually do nothing for scaffold (scaffold doesn't use execSync)
        mockedExecSync.mockImplementation(() => Buffer.from(''));

        const ctx = createFlutterContext({
            outputDir: tmpDir,
            projectDir,
        });

        await adapter.scaffold(ctx);
    });

    afterAll(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    const requiredDirs = [
        'lib/core/config',
        'lib/core/di',
        'lib/core/framework',
        'lib/core/network',
        'lib/core/connectivity',
        'lib/core/router',
        'lib/core/theme',
        'lib/core/logger',
        'lib/core/utils',
        'lib/core/pagination',
        'lib/core/services',
        'lib/features',
        'assets/images',
        'assets/icons',
        'assets/fonts',
        'bricks/clean_feature/__brick__',
        'bricks/clean_form_feature/__brick__',
        'test/architecture',
        'test/core/connectivity',
        'test/core/network',
        'test/core/pagination',
        'test/helpers',
        'integration_test',
        '.github/workflows',
        '.vscode',
    ];

    it.each(requiredDirs)('creates directory: %s', (dir) => {
        expect(existsSync(join(projectDir, dir))).toBe(true);
    });
});

// ─── pubspec.yaml (Req 5.7) ────────────────────────────────────────────────

describe('Flutter pubspec.yaml (Req 5.7)', () => {
    it('sets name field to appName', () => {
        const ctx = createFlutterContext({ appName: 'accu_shield' });
        const content = pubspecYaml(ctx);
        expect(content).toMatch(/^name: accu_shield$/m);
    });

    it('includes flutter_bloc dependency', () => {
        const ctx = createFlutterContext();
        const content = pubspecYaml(ctx);
        expect(content).toContain('flutter_bloc:');
    });

    it('includes dio dependency', () => {
        const ctx = createFlutterContext();
        const content = pubspecYaml(ctx);
        expect(content).toContain('dio:');
    });

    it('includes get_it dependency', () => {
        const ctx = createFlutterContext();
        const content = pubspecYaml(ctx);
        expect(content).toContain('get_it:');
    });

    it('includes go_router dependency', () => {
        const ctx = createFlutterContext();
        const content = pubspecYaml(ctx);
        expect(content).toContain('go_router:');
    });

    it('includes description with display name', () => {
        const ctx = createFlutterContext({ displayName: 'My Cool App' });
        const content = pubspecYaml(ctx);
        expect(content).toContain('My Cool App');
    });
});

// ─── app_config.dart (Req 5.2, 5.3) ────────────────────────────────────────

describe('Flutter app_config.dart generation', () => {
    describe('single service (Req 5.2)', () => {
        it('generates one getter for a single service', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [])],
            });
            const content = appConfigDart(ctx);
            expect(content).toContain('static String get apiBaseUrl');
        });

        it('includes all 5 environments in _urls map', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [])],
            });
            const content = appConfigDart(ctx);
            expect(content).toContain('AppEnv.local');
            expect(content).toContain('AppEnv.dev');
            expect(content).toContain('AppEnv.qa');
            expect(content).toContain('AppEnv.staging');
            expect(content).toContain('AppEnv.prod');
        });
    });

    describe('multi-service', () => {
        it('generates one getter per service', () => {
            const ctx = createFlutterContext({
                services: [
                    createServiceWithEndpoints('api', []),
                    createServiceWithEndpoints('node', []),
                    createServiceWithEndpoints('auth_service', []),
                ],
            });
            const content = appConfigDart(ctx);
            expect(content).toContain('static String get apiBaseUrl');
            expect(content).toContain('static String get nodeBaseUrl');
            expect(content).toContain('static String get authServiceBaseUrl');
        });

        it('includes URLs for all services in each environment', () => {
            const ctx = createFlutterContext({
                services: [
                    createServiceWithEndpoints('api', []),
                    createServiceWithEndpoints('node', []),
                ],
            });
            const content = appConfigDart(ctx);
            // Check that both services appear in the _urls map
            expect(content).toContain("'api':");
            expect(content).toContain("'node':");
        });
    });

    describe('default services (Req 5.3)', () => {
        it('uses api and node as default services when none provided', () => {
            // When no services are provided, the prompts module adds defaults.
            // We test the template with the default services directly.
            const ctx = createFlutterContext({
                services: [
                    {
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
                    },
                    {
                        name: 'node',
                        urls: {
                            local: 'http://localhost:3001',
                            dev: 'https://dev-node.example.com',
                            qa: 'https://qa-node.example.com',
                            staging: 'https://staging-node.example.com',
                            prod: 'https://node.example.com',
                        },
                        headers: '',
                        endpoints: [],
                    },
                ],
            });
            const content = appConfigDart(ctx);
            expect(content).toContain('static String get apiBaseUrl');
            expect(content).toContain('static String get nodeBaseUrl');
            expect(content).toContain('http://localhost:3000');
            expect(content).toContain('http://localhost:3001');
        });
    });

    it('uses package import prefix', () => {
        const ctx = createFlutterContext({ appName: 'my_app' });
        const content = appConfigDart(ctx);
        expect(content).toContain("import 'package:my_app/core/config/app_env.dart'");
    });
});

// ─── api_endpoints.dart (Req 5.4, 5.5, 5.6, 5.11) ──────────────────────────

describe('Flutter api_endpoints.dart generation', () => {
    describe('camelCase derivation (Req 5.4)', () => {
        it('converts /auth/login to authLogin', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [
                    { method: 'POST', path: '/auth/login' },
                ])],
            });
            const content = apiEndpointsDart(ctx);
            expect(content).toContain('static const authLogin');
            expect(content).toContain("'/auth/login'");
        });

        it('converts /users to users', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [
                    { method: 'GET', path: '/users' },
                ])],
            });
            const content = apiEndpointsDart(ctx);
            expect(content).toContain('static const users');
        });
    });

    describe('parameterised paths (Req 5.5)', () => {
        it('handles {id} parameter with ById suffix', () => {
            const usedNames = new Set<string>();
            const name = endpointConstName('GET', '/users/{id}', usedNames, 'api');
            expect(name).toContain('By');
        });

        it('handles multiple parameters', () => {
            const usedNames = new Set<string>();
            const name = endpointConstName('GET', '/users/{userId}/posts/{postId}', usedNames, 'api');
            // Should contain the parameterised segments transformed
            expect(name).toBeTruthy();
            expect(typeof name).toBe('string');
        });

        it('generates endpoint with parameterised path in template', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [
                    { method: 'GET', path: '/users/{id}' },
                ])],
            });
            const content = apiEndpointsDart(ctx);
            expect(content).toContain("'/users/{id}'");
        });
    });

    describe('TODO for empty endpoints (Req 5.6)', () => {
        it('generates TODO comment when service has no endpoints', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [])],
            });
            const content = apiEndpointsDart(ctx);
            expect(content).toContain('// TODO: add api endpoints');
        });
    });

    describe('duplicate disambiguation (Req 5.11)', () => {
        it('prefixes with method when duplicate names occur', () => {
            const usedNames = new Set<string>();
            const first = endpointConstName('GET', '/auth/login', usedNames, 'api');
            const second = endpointConstName('POST', '/auth/login', usedNames, 'api');
            expect(first).not.toBe(second);
            // Second should have method prefix
            expect(second.toLowerCase()).toContain('post');
        });

        it('handles duplicates in template output', () => {
            const ctx = createFlutterContext({
                services: [createServiceWithEndpoints('api', [
                    { method: 'GET', path: '/auth/login' },
                    { method: 'POST', path: '/auth/login' },
                ])],
            });
            const content = apiEndpointsDart(ctx);
            // Both should be present with different names
            const constMatches = content.match(/static const \w+/g) || [];
            expect(constMatches.length).toBe(2);
            // They should be different
            expect(constMatches[0]).not.toBe(constMatches[1]);
        });
    });
});

// ─── service_headers.dart (Req 5.8 implied) ─────────────────────────────────

describe('Flutter service_headers.dart generation', () => {
    it('generates empty map for service with no headers', () => {
        const ctx = createFlutterContext({
            services: [createServiceWithEndpoints('api', [], '')],
        });
        const content = serviceHeadersDart(ctx);
        expect(content).toContain('static Map<String, String> get api');
        // Should have empty map body (just opening and closing braces)
        expect(content).toMatch(/get api => \{\s*\};/s);
    });

    it('generates single header entry', () => {
        const ctx = createFlutterContext({
            services: [createServiceWithEndpoints('api', [], 'X-Api-Key:abc123')],
        });
        const content = serviceHeadersDart(ctx);
        expect(content).toContain("'X-Api-Key': 'abc123'");
    });

    it('generates multiple header entries', () => {
        const ctx = createFlutterContext({
            services: [createServiceWithEndpoints('api', [], 'X-Api-Key:abc123,X-Client:mobile')],
        });
        const content = serviceHeadersDart(ctx);
        expect(content).toContain("'X-Api-Key': 'abc123'");
        expect(content).toContain("'X-Client': 'mobile'");
    });

    it('generates getters for multiple services', () => {
        const ctx = createFlutterContext({
            services: [
                createServiceWithEndpoints('api', [], 'X-Api-Key:key1'),
                createServiceWithEndpoints('node', [], 'X-Node-Key:key2'),
            ],
        });
        const content = serviceHeadersDart(ctx);
        expect(content).toContain('static Map<String, String> get api');
        expect(content).toContain('static Map<String, String> get node');
    });
});

// ─── dio_factory.dart (Req 5.8) ─────────────────────────────────────────────

describe('Flutter dio_factory.dart generation (Req 5.8)', () => {
    it('contains DioFactory class', () => {
        const content = dioFactoryDart('test_app');
        expect(content).toContain('class DioFactory');
    });

    it('accepts ConnectivityCubit parameter', () => {
        const content = dioFactoryDart('test_app');
        expect(content).toContain('ConnectivityCubit');
        expect(content).toContain('final ConnectivityCubit _connectivity');
    });

    it('adds PrettyDioLogger interceptor', () => {
        const content = dioFactoryDart('test_app');
        expect(content).toContain('PrettyDioLogger');
    });

    it('uses package import prefix', () => {
        const content = dioFactoryDart('my_cool_app');
        expect(content).toContain("import 'package:my_cool_app/core/connectivity/connectivity_cubit.dart'");
        expect(content).toContain("import 'package:my_cool_app/core/logger/app_logger.dart'");
        expect(content).toContain("import 'package:my_cool_app/core/network/app_interceptors.dart'");
    });

    it('imports dio package', () => {
        const content = dioFactoryDart('test_app');
        expect(content).toContain("import 'package:dio/dio.dart'");
    });

    it('imports pretty_dio_logger package', () => {
        const content = dioFactoryDart('test_app');
        expect(content).toContain("import 'package:pretty_dio_logger/pretty_dio_logger.dart'");
    });
});

// ─── analysis_options.yaml (Req 5.9) ────────────────────────────────────────

describe('Flutter analysis_options.yaml (Req 5.9)', () => {
    it('includes avoid_print: true rule', () => {
        const content = analysisOptionsYaml();
        expect(content).toContain('avoid_print: true');
    });

    it('includes always_use_package_imports: true rule', () => {
        const content = analysisOptionsYaml();
        expect(content).toContain('always_use_package_imports: true');
    });

    it('includes flutter_lints package', () => {
        const content = analysisOptionsYaml();
        expect(content).toContain('package:flutter_lints/flutter.yaml');
    });
});

// ─── scanHints (Req 8.1–8.9) ────────────────────────────────────────────────

describe('Flutter scanHints (Req 8.1–8.9)', () => {
    const adapter = new FlutterAdapter();
    const ctx: ScaffoldContext = {
        appName: 'test_app',
        displayName: 'Test App',
        outputDir: '/tmp',
        projectDir: '/tmp/test_app',
        agent: 'claude-code',
        gitHooks: true,
        ci: 'github',
    };

    let hints: ReturnType<typeof adapter.scanHints>;

    beforeAll(() => {
        hints = adapter.scanHints(ctx);
    });

    it('returns detectedState: BLoC (Req 8.2)', () => {
        expect(hints.detectedState).toBe('BLoC');
    });

    it('returns detectedDI: GetIt (Req 8.3)', () => {
        expect(hints.detectedDI).toBe('GetIt');
    });

    it('returns detectedNetwork: Dio (Req 8.4)', () => {
        expect(hints.detectedNetwork).toBe('Dio');
    });

    it('returns detectedRouter: go_router (Req 8.5)', () => {
        expect(hints.detectedRouter).toBe('go_router');
    });

    it('returns detectedPackageManager: pub (Req 8.8)', () => {
        expect(hints.detectedPackageManager).toBe('pub');
    });

    it('returns detectedMason: true (Req 8.6)', () => {
        expect(hints.detectedMason).toBe(true);
    });

    it('returns detectedFVM: true (Req 8.7)', () => {
        expect(hints.detectedFVM).toBe(true);
    });

    it('returns scaffoldTool: Mason (Req 8.9)', () => {
        expect(hints.scaffoldTool).toBe('Mason');
    });

    it('returns scaffoldCmdFeature: mason make clean_feature (Req 8.10)', () => {
        expect(hints.scaffoldCmdFeature).toBe('mason make clean_feature');
    });

    it('returns detectedTestFramework: flutter_test (Req 8.11)', () => {
        expect(hints.detectedTestFramework).toBe('flutter_test');
    });

    it('returns detectedHasTests: true (Req 8.12)', () => {
        expect(hints.detectedHasTests).toBe(true);
    });

    it('returns detectedLinter: flutter_lints (Req 8.13)', () => {
        expect(hints.detectedLinter).toBe('flutter_lints');
    });

    it('returns detectedHasLinterConfig: true (Req 8.14)', () => {
        expect(hints.detectedHasLinterConfig).toBe(true);
    });

    it('returns detectedFormatter: dart format (Req 8.15)', () => {
        expect(hints.detectedFormatter).toBe('dart format');
    });

    it('returns detectedHasFormatterConfig: true (Req 8.16)', () => {
        expect(hints.detectedHasFormatterConfig).toBe(true);
    });
});

// ─── postSetup (Req 7.1–7.6) ────────────────────────────────────────────────

describe('Flutter postSetup (Req 7.1–7.6)', () => {
    const adapter = new FlutterAdapter();

    beforeEach(() => {
        mockedExecSync.mockReset();
    });

    function createPostSetupCtx(): FlutterContext {
        return createFlutterContext({
            projectDir: '/tmp/test_app',
            flutterVersion: '3.29.0',
        });
    }

    describe('success path', () => {
        beforeEach(() => {
            mockedExecSync.mockImplementation(() => Buffer.from(''));
        });

        it('runs git init (Req 7.1)', async () => {
            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git init',
                expect.objectContaining({ cwd: '/tmp/test_app' }),
            );
        });

        it('runs fvm use with correct version (Req 7.3)', async () => {
            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'fvm use 3.29.0 --force',
                expect.objectContaining({ cwd: '/tmp/test_app' }),
            );
        });

        it('runs fvm flutter pub get (Req 7.3)', async () => {
            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'fvm flutter pub get',
                expect.objectContaining({ cwd: '/tmp/test_app' }),
            );
        });

        it('runs git add -A and git commit (Req 7.6)', async () => {
            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git add -A',
                expect.objectContaining({ cwd: '/tmp/test_app' }),
            );
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git commit -m "chore: initial project scaffold"',
                expect.objectContaining({ cwd: '/tmp/test_app' }),
            );
        });

        it('executes commands in correct order', async () => {
            const calls: string[] = [];
            mockedExecSync.mockImplementation((cmd) => {
                calls.push(cmd as string);
                return Buffer.from('');
            });

            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);

            expect(calls[0]).toBe('git init');
            expect(calls[1]).toBe('fvm use 3.29.0 --force');
            expect(calls[2]).toBe('fvm flutter pub get');
            expect(calls[3]).toBe('git add -A');
            expect(calls[4]).toBe('git commit -m "chore: initial project scaffold"');
        });
    });

    describe('FVM not found → warning (Req 7.4)', () => {
        it('continues when fvm use fails', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string).includes('fvm use')) {
                    throw new Error('command not found: fvm');
                }
                return Buffer.from('');
            });

            const ctx = createPostSetupCtx();
            // Should not throw
            await expect(adapter.postSetup(ctx)).resolves.toBeUndefined();

            // Should still attempt subsequent commands
            expect(mockedExecSync).toHaveBeenCalledWith(
                'fvm flutter pub get',
                expect.anything(),
            );
        });

        it('prints warning when fvm is not available', async () => {
            const warnSpy = jest.spyOn(console, 'warn');
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string).includes('fvm use')) {
                    throw new Error('command not found: fvm');
                }
                return Buffer.from('');
            });

            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('FVM not available'),
            );
        });
    });

    describe('pub get failure → warning (Req 7.5)', () => {
        it('continues when pub get fails', async () => {
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string).includes('pub get')) {
                    throw new Error('pub get failed');
                }
                return Buffer.from('');
            });

            const ctx = createPostSetupCtx();
            // Should not throw
            await expect(adapter.postSetup(ctx)).resolves.toBeUndefined();

            // Should still attempt git add and commit
            expect(mockedExecSync).toHaveBeenCalledWith(
                'git add -A',
                expect.anything(),
            );
        });

        it('prints warning when pub get fails', async () => {
            const warnSpy = jest.spyOn(console, 'warn');
            mockedExecSync.mockImplementation((cmd) => {
                if ((cmd as string).includes('pub get')) {
                    throw new Error('pub get failed');
                }
                return Buffer.from('');
            });

            const ctx = createPostSetupCtx();
            await adapter.postSetup(ctx);

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('pub get failed'),
            );
        });
    });
});

// ─── mainDart displayName apostrophe escaping ────────────────────────────────

describe('mainDart displayName escaping', () => {
    it('escapes single quotes in displayName', () => {
        const code = mainDart('my_app', "McDonald's App");
        expect(code).toContain("title: 'McDonald\\'s App'");
        expect(code).not.toMatch(/title: 'McDonald's App'/);
    });

    it('escapes backslashes in displayName', () => {
        const code = mainDart('my_app', 'App\\Name');
        expect(code).toContain("title: 'App\\\\Name'");
    });

    it('leaves safe displayName unchanged', () => {
        const code = mainDart('my_app', 'My App');
        expect(code).toContain("title: 'My App'");
    });
});
