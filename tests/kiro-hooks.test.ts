/**
 * Kiro hook JSON validation tests.
 * Verifies schema compliance, content correctness, cross-stack behavior,
 * and absence of Claude Code artifacts.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateBlockDangerous } from '../src/agents/kiro/hooks/block-dangerous.js';
import { generateProtectFiles } from '../src/agents/kiro/hooks/protect-files.js';
import { generateSpecFirstGate } from '../src/agents/kiro/hooks/spec-first-gate.js';
import { generateFormatCode } from '../src/agents/kiro/hooks/format-code.js';
import { generateAnalyzeCode } from '../src/agents/kiro/hooks/analyze-code.js';
import { generateCheckFileSize } from '../src/agents/kiro/hooks/check-file-size.js';
import { generateCheckSecrets } from '../src/agents/kiro/hooks/check-secrets.js';
import { generateSessionContinuity } from '../src/agents/kiro/hooks/session-continuity.js';
import { generatePostTaskChecklist } from '../src/agents/kiro/hooks/post-task-checklist.js';
import { generateCheckFeatureReadme } from '../src/agents/kiro/hooks/check-feature-readme.js';
import { generateCheckConsistency } from '../src/agents/kiro/hooks/check-consistency.js';
import { generateRequireTaskType } from '../src/agents/kiro/hooks/require-task-type.js';
import { generateAllKiroHooks } from '../src/agents/kiro/hooks/index.js';

const DEFAULT_PROJECT = {
    packageName: 'test-app', appName: 'test-app', appDescription: '',
    ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: 'No legacy code',
};

function makeConfig(
    stack: Stack = 'nodejs',
    scanOverrides: Partial<ScanResult> = {},
    extras: { specFirstEnabled?: boolean } = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'kiro', stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '17.0.0', projectDir: '/tmp/test',
        specFirstEnabled: extras.specFirstEnabled ?? false,
        conflictMode: 'keep', overwrite: false, dryRun: false, updateHooks: false,
    };
}

// Silence console output
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Kiro hook JSON schema validator ──────────────────────────────────────────

function validateKiroHookSchema(jsonStr: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    let obj: Record<string, unknown>;
    try {
        obj = JSON.parse(jsonStr);
    } catch {
        return { valid: false, errors: ['Invalid JSON'] };
    }
    if (typeof obj.name !== 'string') errors.push('missing or invalid "name"');
    if (typeof obj.version !== 'string') errors.push('missing or invalid "version"');
    if (!obj.when || typeof obj.when !== 'object') { errors.push('missing "when"'); return { valid: errors.length === 0, errors }; }
    const when = obj.when as Record<string, unknown>;
    const validTypes = ['preToolUse', 'postToolUse', 'fileEdited', 'fileCreated', 'fileDeleted', 'userTriggered', 'promptSubmit', 'agentStop', 'preTaskExecution', 'postTaskExecution'];
    if (!validTypes.includes(when.type as string)) errors.push(`invalid when.type: ${when.type}`);
    if (['preToolUse', 'postToolUse'].includes(when.type as string) && !Array.isArray(when.toolTypes)) errors.push('preToolUse/postToolUse requires when.toolTypes array');
    if (when.type === 'fileEdited' && !Array.isArray(when.patterns)) errors.push('fileEdited requires when.patterns array');
    if (!obj.then || typeof obj.then !== 'object') { errors.push('missing "then"'); return { valid: errors.length === 0, errors }; }
    const then = obj.then as Record<string, unknown>;
    if (then.type !== 'askAgent' && then.type !== 'runCommand') errors.push(`invalid then.type: ${then.type}`);
    if (then.type === 'askAgent' && typeof then.prompt !== 'string') errors.push('askAgent requires then.prompt string');
    if (then.type === 'runCommand' && typeof then.command !== 'string') errors.push('runCommand requires then.command string');
    return { valid: errors.length === 0, errors };
}

// ─── Schema validation ───────────────────────────────────────────────────────

describe('Kiro hook schema validation', () => {
    const hookGenerators: Array<{ name: string; generate: (c: GovernanceConfig) => string | null }> = [
        { name: 'block-dangerous', generate: generateBlockDangerous },
        { name: 'protect-files', generate: generateProtectFiles },
        { name: 'check-file-size', generate: generateCheckFileSize },
        { name: 'check-secrets', generate: generateCheckSecrets },
        { name: 'session-continuity', generate: generateSessionContinuity },
        { name: 'post-task-checklist', generate: generatePostTaskChecklist },
        { name: 'check-feature-readme', generate: generateCheckFeatureReadme },
        { name: 'check-consistency', generate: generateCheckConsistency },
        { name: 'require-task-type', generate: generateRequireTaskType },
    ];

    for (const { name, generate } of hookGenerators) {
        test(`${name}.json validates against Kiro schema`, () => {
            const output = generate(makeConfig());
            expect(output).not.toBeNull();
            const result = validateKiroHookSchema(output!);
            expect(result.errors).toEqual([]);
            expect(result.valid).toBe(true);
        });
    }

    test('spec-first-gate.json validates when specFirstEnabled=true', () => {
        const output = generateSpecFirstGate(makeConfig('nodejs', {}, { specFirstEnabled: true }));
        expect(output).not.toBeNull();
        const result = validateKiroHookSchema(output!);
        expect(result.errors).toEqual([]);
    });

    test('format-code.json validates when formatter detected', () => {
        const cfg = makeConfig('nodejs', { detectedFormatter: 'prettier', detectedHasFormatterConfig: true });
        cfg.profile.formatCmd = 'npx prettier --write .';
        const output = generateFormatCode(cfg);
        expect(output).not.toBeNull();
        const result = validateKiroHookSchema(output!);
        expect(result.errors).toEqual([]);
    });

    test('analyze-code.json validates when linter detected', () => {
        const cfg = makeConfig('nodejs', { detectedLinter: 'eslint', detectedHasLinterConfig: true });
        cfg.profile.analyzeCmd = 'npx eslint src/';
        const output = generateAnalyzeCode(cfg);
        expect(output).not.toBeNull();
        const result = validateKiroHookSchema(output!);
        expect(result.errors).toEqual([]);
    });
});

// ─── Content correctness ─────────────────────────────────────────────────────

describe('Kiro hook content correctness', () => {
    test('block-dangerous: contains force push and rm -rf patterns', () => {
        const json = JSON.parse(generateBlockDangerous(makeConfig()));
        expect(json.then.prompt).toContain('force');
        expect(json.when.toolTypes).toContain('shell');
    });

    test('protect-files: contains high-risk files from scan', () => {
        const json = JSON.parse(generateProtectFiles(makeConfig('nodejs', { highRiskFiles: ['src/app.js', '.env'] })));
        expect(json.then.prompt).toContain('src/app.js');
        expect(json.then.prompt).toContain('.env');
    });

    test('spec-first-gate: only generated when specFirstEnabled=true', () => {
        expect(generateSpecFirstGate(makeConfig('nodejs', {}, { specFirstEnabled: false }))).toBeNull();
        expect(generateSpecFirstGate(makeConfig('nodejs', {}, { specFirstEnabled: true }))).not.toBeNull();
    });

    test('format-code: contains stack formatter command', () => {
        const cfg = makeConfig('nodejs', { detectedFormatter: 'prettier', detectedHasFormatterConfig: true });
        cfg.profile.formatCmd = 'npx prettier --write .';
        const json = JSON.parse(generateFormatCode(cfg)!);
        expect(json.then.command).toContain('prettier');
        expect(json.then.type).toBe('runCommand');
    });

    test('format-code: null when no formatter detected', () => {
        const cfg = makeConfig('nodejs');
        cfg.profile.formatCmd = '';
        expect(generateFormatCode(cfg)).toBeNull();
    });

    test('analyze-code: contains stack linter command', () => {
        const cfg = makeConfig('nodejs', { detectedLinter: 'eslint', detectedHasLinterConfig: true });
        cfg.profile.analyzeCmd = 'npx eslint src/';
        const json = JSON.parse(generateAnalyzeCode(cfg)!);
        expect(json.then.command).toContain('eslint');
    });

    test('analyze-code: null when no linter detected', () => {
        const cfg = makeConfig('nodejs');
        cfg.profile.analyzeCmd = '';
        expect(generateAnalyzeCode(cfg)).toBeNull();
    });

    test('check-file-size: contains 200-line threshold', () => {
        const json = JSON.parse(generateCheckFileSize(makeConfig()));
        expect(json.then.prompt).toContain('200');
    });

    test('check-secrets: file patterns match stack extensions', () => {
        const json = JSON.parse(generateCheckSecrets(makeConfig('nodejs')));
        expect(json.when.patterns).toContain('*.js');
    });

    test('session-continuity: contains context preservation instructions', () => {
        const json = JSON.parse(generateSessionContinuity(makeConfig()));
        expect(json.then.prompt).toContain('SESSION');
        expect(json.when.type).toBe('promptSubmit');
    });

    test('post-task-checklist: contains architecture compliance', () => {
        const json = JSON.parse(generatePostTaskChecklist(makeConfig()));
        expect(json.then.prompt).toContain('Architecture compliance');
        expect(json.when.type).toBe('postTaskExecution');
    });

    test('check-feature-readme: contains README check', () => {
        const json = JSON.parse(generateCheckFeatureReadme(makeConfig()));
        expect(json.then.prompt).toContain('README');
    });

    test('require-task-type: contains task classification', () => {
        const json = JSON.parse(generateRequireTaskType(makeConfig()));
        expect(json.then.prompt).toContain('Task Type');
    });
});

// ─── Cross-stack ─────────────────────────────────────────────────────────────

describe('Kiro hooks cross-stack', () => {
    const stackExtensions: Record<Stack, string> = {
        nodejs: '.js', react: '.tsx', flutter: '.dart', python: '.py',
        kotlin: '.kt', java: '.java', angular: '.ts', swiftui: '.swift',
    };

    for (const [stack, ext] of Object.entries(stackExtensions)) {
        test(`${stack}: check-secrets patterns include ${ext}`, () => {
            const json = JSON.parse(generateCheckSecrets(makeConfig(stack as Stack)));
            const patterns = json.when.patterns as string[];
            expect(patterns.some((p: string) => p.includes(ext))).toBe(true);
        });
    }
});

// ─── Version ─────────────────────────────────────────────────────────────────

describe('Kiro hook version', () => {
    const generators: Array<{ name: string; generate: (c: GovernanceConfig) => string | null }> = [
        { name: 'block-dangerous', generate: generateBlockDangerous },
        { name: 'protect-files', generate: generateProtectFiles },
        { name: 'check-file-size', generate: generateCheckFileSize },
        { name: 'check-secrets', generate: generateCheckSecrets },
    ];

    for (const { name, generate } of generators) {
        test(`${name}.json contains version 17.0.0`, () => {
            const cfg = makeConfig();
            cfg.hookVersion = '17.0.0';
            const json = JSON.parse(generate(cfg)!);
            expect(json.version).toBe('17.0.0');
        });
    }
});

// ─── No Claude Code artifacts ────────────────────────────────────────────────

describe('No Claude Code artifacts in Kiro hooks', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-hooks-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function getAllHookContent(): string {
        const config = makeConfig('nodejs', {
            detectedFormatter: 'prettier',
            detectedHasFormatterConfig: true,
            detectedLinter: 'eslint',
            detectedHasLinterConfig: true,
        });
        config.profile.formatCmd = 'npx prettier --write .';
        config.profile.analyzeCmd = 'npx eslint src/';
        config.projectDir = tmpDir;
        config.overwrite = true;
        config.specFirstEnabled = true;
        generateAllKiroHooks(config, {
            overwrite: true, dryRun: false, updateHooks: false,
            hookVersion: '17.0.0', projectDir: tmpDir, conflictMode: 'overwrite',
        });

        const hooksDir = join(tmpDir, '.kiro', 'hooks');
        let allContent = '';
        for (const f of readdirSync(hooksDir)) {
            if (f.endsWith('.json')) {
                allContent += readFileSync(join(hooksDir, f), 'utf-8') + '\n';
            }
        }
        return allContent;
    }

    test('no hook contains #!/usr/bin/env bash', () => {
        expect(getAllHookContent()).not.toContain('#!/usr/bin/env bash');
    });

    test('no hook contains $CLAUDE_PROJECT_DIR', () => {
        expect(getAllHookContent()).not.toContain('CLAUDE_PROJECT_DIR');
    });

    test('no hook contains _json()', () => {
        expect(getAllHookContent()).not.toContain('_json(');
    });

    test('no hook contains exit 2', () => {
        expect(getAllHookContent()).not.toContain('exit 2');
    });
});

// ─── Workflow hook tests ─────────────────────────────────────────────────────

import { generateWorkflowAudit } from '../src/agents/kiro/hooks/workflow-audit.js';
import { generateWorkflowNewFeature } from '../src/agents/kiro/hooks/workflow-new-feature.js';
import { generateWorkflowFix } from '../src/agents/kiro/hooks/workflow-fix.js';
import { generateWorkflowRefactor } from '../src/agents/kiro/hooks/workflow-refactor.js';
import { generateWorkflowHotfix } from '../src/agents/kiro/hooks/workflow-hotfix.js';
import { generateWorkflowExplore } from '../src/agents/kiro/hooks/workflow-explore.js';
import { generatePreWriteSecretsGate } from '../src/agents/kiro/hooks/pre-write-secrets-gate.js';

describe('Workflow hook schema validation', () => {
    const workflowGenerators = [
        { name: 'workflow-audit', generate: generateWorkflowAudit },
        { name: 'workflow-new-feature', generate: generateWorkflowNewFeature },
        { name: 'workflow-fix', generate: generateWorkflowFix },
        { name: 'workflow-refactor', generate: generateWorkflowRefactor },
        { name: 'workflow-hotfix', generate: generateWorkflowHotfix },
        { name: 'workflow-explore', generate: generateWorkflowExplore },
    ];

    for (const { name, generate } of workflowGenerators) {
        test(`${name}.json validates against Kiro schema`, () => {
            const output = generate(makeConfig());
            const result = validateKiroHookSchema(output);
            expect(result.errors).toEqual([]);
            expect(result.valid).toBe(true);
        });

        test(`${name}.json uses userTriggered event`, () => {
            const json = JSON.parse(generate(makeConfig()));
            expect(json.when.type).toBe('userTriggered');
        });

        test(`${name}.json uses askAgent action`, () => {
            const json = JSON.parse(generate(makeConfig()));
            expect(json.then.type).toBe('askAgent');
        });
    }
});

describe('Workflow hook content correctness — stack-specific values', () => {
    // ── New Feature ──────────────────────────────────────────────────────────
    test('workflow-new-feature (flutter): references flutter test and layer flow', () => {
        const cfg = makeConfig('flutter');
        const json = JSON.parse(generateWorkflowNewFeature(cfg));
        expect(json.then.prompt).toContain('flutter test');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
        expect(json.then.prompt).toContain(cfg.profile.featuresDir);
    });

    test('workflow-new-feature (nodejs): references npm test and layer flow', () => {
        const cfg = makeConfig('nodejs');
        const json = JSON.parse(generateWorkflowNewFeature(cfg));
        expect(json.then.prompt).toContain('npm test');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    test('workflow-new-feature (react): references test command and layer flow', () => {
        const cfg = makeConfig('react');
        const json = JSON.parse(generateWorkflowNewFeature(cfg));
        expect(json.then.prompt).toContain(cfg.profile.testCmd);
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    test('workflow-new-feature (python): references pytest and layer flow', () => {
        const cfg = makeConfig('python');
        const json = JSON.parse(generateWorkflowNewFeature(cfg));
        expect(json.then.prompt).toContain('pytest');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    test('workflow-new-feature (java): references mvn test and layer flow', () => {
        const cfg = makeConfig('java');
        const json = JSON.parse(generateWorkflowNewFeature(cfg));
        expect(json.then.prompt).toContain('mvn test');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    // ── Fix ──────────────────────────────────────────────────────────────────
    test('workflow-fix (flutter): references flutter test', () => {
        const cfg = makeConfig('flutter');
        const json = JSON.parse(generateWorkflowFix(cfg));
        expect(json.then.prompt).toContain('flutter test');
        expect(json.then.prompt).toContain('Flutter');
    });

    test('workflow-fix (nodejs): references npm test', () => {
        const cfg = makeConfig('nodejs');
        const json = JSON.parse(generateWorkflowFix(cfg));
        expect(json.then.prompt).toContain('npm test');
    });

    // ── Refactor ─────────────────────────────────────────────────────────────
    test('workflow-refactor (flutter): references flutter test and layer flow', () => {
        const cfg = makeConfig('flutter');
        const json = JSON.parse(generateWorkflowRefactor(cfg));
        expect(json.then.prompt).toContain('flutter test');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    test('workflow-refactor (kotlin): references ./gradlew test and layer flow', () => {
        const cfg = makeConfig('kotlin');
        const json = JSON.parse(generateWorkflowRefactor(cfg));
        expect(json.then.prompt).toContain('./gradlew test');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    // ── Hotfix ───────────────────────────────────────────────────────────────
    test('workflow-hotfix (nodejs): references npm test', () => {
        const cfg = makeConfig('nodejs');
        const json = JSON.parse(generateWorkflowHotfix(cfg));
        expect(json.then.prompt).toContain('npm test');
        expect(json.then.prompt).toContain('Node.js');
    });

    test('workflow-hotfix (python): references pytest', () => {
        const cfg = makeConfig('python');
        const json = JSON.parse(generateWorkflowHotfix(cfg));
        expect(json.then.prompt).toContain('pytest');
    });

    // ── Audit ────────────────────────────────────────────────────────────────
    test('workflow-audit (nodejs): references source dir and layer flow', () => {
        const cfg = makeConfig('nodejs');
        const json = JSON.parse(generateWorkflowAudit(cfg));
        expect(json.then.prompt).toContain(cfg.profile.sourceDir);
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
        expect(json.then.prompt).toContain('Node.js');
    });

    test('workflow-audit (flutter): references Flutter stack', () => {
        const cfg = makeConfig('flutter');
        const json = JSON.parse(generateWorkflowAudit(cfg));
        expect(json.then.prompt).toContain('Flutter');
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
    });

    // ── Explore ──────────────────────────────────────────────────────────────
    test('workflow-explore (react): references source dir and layer flow', () => {
        const cfg = makeConfig('react');
        const json = JSON.parse(generateWorkflowExplore(cfg));
        expect(json.then.prompt).toContain(cfg.profile.sourceDir);
        expect(json.then.prompt).toContain(cfg.profile.layerFlow);
        expect(json.then.prompt).toContain('React');
    });

    test('workflow-explore (angular): references Angular stack', () => {
        const cfg = makeConfig('angular');
        const json = JSON.parse(generateWorkflowExplore(cfg));
        expect(json.then.prompt).toContain('Angular');
    });
});

describe('Workflow hooks cross-stack — all 8 stacks produce valid hooks', () => {
    const stacks: Stack[] = ['nodejs', 'react', 'flutter', 'python', 'kotlin', 'java', 'angular', 'swiftui'];
    const generators = [
        { name: 'audit', generate: generateWorkflowAudit },
        { name: 'new-feature', generate: generateWorkflowNewFeature },
        { name: 'fix', generate: generateWorkflowFix },
        { name: 'refactor', generate: generateWorkflowRefactor },
        { name: 'hotfix', generate: generateWorkflowHotfix },
        { name: 'explore', generate: generateWorkflowExplore },
    ];

    for (const stack of stacks) {
        for (const { name, generate } of generators) {
            test(`${stack} × ${name}: valid JSON with stack-specific testCmd`, () => {
                const cfg = makeConfig(stack);
                const json = JSON.parse(generate(cfg));
                expect(json.name).toBeTruthy();
                expect(json.version).toBe('17.0.0');
                expect(json.when.type).toBe('userTriggered');
                expect(json.then.type).toBe('askAgent');
                expect(json.then.prompt).toContain(cfg.profile.stackDisplay);
            });
        }
    }
});

// ─── Pre-write secrets gate ──────────────────────────────────────────────────

describe('Pre-write secrets gate', () => {
    test('validates against Kiro schema', () => {
        const output = generatePreWriteSecretsGate(makeConfig());
        const result = validateKiroHookSchema(output);
        expect(result.errors).toEqual([]);
        expect(result.valid).toBe(true);
    });

    test('uses preToolUse with write toolType', () => {
        const json = JSON.parse(generatePreWriteSecretsGate(makeConfig()));
        expect(json.when.type).toBe('preToolUse');
        expect(json.when.toolTypes).toContain('write');
    });

    test('contains AKIA pattern detection', () => {
        const json = JSON.parse(generatePreWriteSecretsGate(makeConfig()));
        expect(json.then.prompt).toContain('AKIA');
    });

    test('contains FORBIDDEN and DENIED language', () => {
        const json = JSON.parse(generatePreWriteSecretsGate(makeConfig()));
        expect(json.then.prompt).toContain('FORBIDDEN');
        expect(json.then.prompt).toContain('DENIED');
    });

    test('excludes test directories', () => {
        const json = JSON.parse(generatePreWriteSecretsGate(makeConfig()));
        expect(json.then.prompt).toContain('test/');
        expect(json.then.prompt).toContain('fixtures/');
    });

    test('contains version 17.0.0', () => {
        const json = JSON.parse(generatePreWriteSecretsGate(makeConfig()));
        expect(json.version).toBe('17.0.0');
    });
});
