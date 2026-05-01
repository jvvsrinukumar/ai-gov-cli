/**
 * Generator smoke tests — one test suite per generator.
 * Strategy: build a minimal GovernanceConfig, call the generator,
 * assert key strings are present in the output.
 * These tests catch regressions introduced by generator edits.
 */
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateArchitecture } from '../src/generators/architecture.js';
import { generateRootClaudeMd, generateMasterClaudeMd } from '../src/generators/claude-md.js';
import { generateCodingStandards } from '../src/generators/coding-standards.js';
import { generateConstitution } from '../src/generators/constitution.js';
import { generateWorkflow } from '../src/generators/workflow.js';
import { generateAIUsagePolicy } from '../src/generators/ai-usage-policy.js';
import { generateSpecFirstWorkflow } from '../src/generators/spec-first-workflow.js';
import { generateSettingsJson } from '../src/generators/settings-json.js';
import { generateCheckFileSize } from '../src/generators/hooks/check-file-size.js';
import { generateCheckSecrets } from '../src/generators/hooks/check-secrets.js';
import { generateProtectFiles } from '../src/generators/hooks/protect-files.js';
import { generateAnalyzeCode } from '../src/generators/hooks/analyze-code.js';
import { generateFormatCode } from '../src/generators/hooks/format-code.js';
import { generateBlockDangerous } from '../src/generators/hooks/block-dangerous.js';
import { generatePostTaskChecklist } from '../src/generators/hooks/post-task-checklist.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

const DEFAULT_PROJECT = {
    packageName: 'test-app',
    appName: 'test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(
    stack: Stack,
    scanOverrides: Partial<ScanResult> = {},
    extras: Partial<Pick<GovernanceConfig, 'specFirstEnabled' | 'projectDir'>> = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        stack,
        profile,
        scan,
        project: DEFAULT_PROJECT,
        blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '16.0.0',
        projectDir: extras.projectDir ?? '/tmp/test-project',
        specFirstEnabled: extras.specFirstEnabled ?? false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

// Silence all console output during generator tests
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => {}); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── Architecture ─────────────────────────────────────────────────────────────

describe('generateArchitecture', () => {
    test('nodejs routes-models: structure matches flow (no controller/ dir)', () => {
        const out = generateArchitecture(makeConfig('nodejs', { detectedArchPattern: 'routes-models' }));
        expect(out).toContain('## Layer Flow');
        expect(out).toContain('## Project Structure');
        expect(out).toContain('Route → Model');
        expect(out).toContain('routes/');
        expect(out).toContain('models/');
        expect(out).not.toContain('controller/    # HTTP handlers');
    });

    test('nodejs mixedArch: shows both legacy and new layers', () => {
        const out = generateArchitecture(makeConfig('nodejs', {
            detectedArchPattern: 'routes-models',
            mixedArch: true,
            mixedArchNote: 'Mixed architecture detected',
        }));
        expect(out).toContain('routes/');
        expect(out).toContain('controller/');
        expect(out).toContain('Mixed architecture detected');
    });

    test('nodejs controller-service: shows 4-layer structure', () => {
        const out = generateArchitecture(makeConfig('nodejs', {
            detectedArchPattern: 'controller-service',
            mixedArch: false,
        }));
        expect(out).toContain('controller/');
        expect(out).toContain('service/');
    });

    test('nodejs routes-only: minimal structure', () => {
        const out = generateArchitecture(makeConfig('nodejs', { detectedArchPattern: 'routes-only' }));
        expect(out).toContain('routes/');
        expect(out).not.toContain('models/');
    });

    test('python: shows Python-specific layout', () => {
        const out = generateArchitecture(makeConfig('python'));
        expect(out).toContain('## Project Structure');
        expect(out).toContain('services/');
    });

    test('react: shows feature-based structure', () => {
        const out = generateArchitecture(makeConfig('react'));
        expect(out).toContain('data/');
        expect(out).toContain('domain/');
        expect(out).toContain('presentation/');
    });

    test('flutter: shows feature-based structure', () => {
        const out = generateArchitecture(makeConfig('flutter'));
        expect(out).toContain('data/');
        expect(out).toContain('domain/');
        expect(out).toContain('presentation/');
    });

    test('all stacks: contains General Rules section', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'kotlin', 'python', 'angular', 'swiftui', 'java'] as Stack[]) {
            const out = generateArchitecture(makeConfig(stack));
            expect(out).toContain('## General Rules');
        }
    });

    test('flutter legacy zones: emits Zone Rules section in architecture.md', () => {
        const out = generateArchitecture(makeConfig('flutter', {
            hasLegacyZones: true,
            legacyZones: ['lib/screens/', 'lib/models/', 'lib/services/'],
            cleanZones: ['lib/features/'],
            legacyZoneNote: 'Dual-mode: legacy MVC zones (lib/screens/, lib/models/, lib/services/) coexist with clean architecture (lib/features/)',
        }));
        expect(out).toContain('## Zone Rules — Dual-Mode Project');
        expect(out).toContain('lib/screens/');
        expect(out).toContain('lib/features/');
        expect(out).toContain('Never add new features to legacy zones');
    });

    test('no legacy zones: Zone Rules section absent', () => {
        const out = generateArchitecture(makeConfig('flutter'));
        expect(out).not.toContain('## Zone Rules — Dual-Mode Project');
    });
});

// ─── CLAUDE.md ────────────────────────────────────────────────────────────────

describe('generateRootClaudeMd', () => {
    test('contains pointer to master CLAUDE.md', () => {
        const out = generateRootClaudeMd();
        expect(out).toContain('.claude/CLAUDE.md');
    });
});

describe('generateMasterClaudeMd', () => {
    test('nodejs: contains stack name and core task types', () => {
        const out = generateMasterClaudeMd(makeConfig('nodejs'));
        expect(out).toContain('Node.js');
        expect(out).toContain('New Feature');
        expect(out).toContain('Edit Feature');
        expect(out).toContain('Bug Fix');
    });

    test('flutter: contains Flutter stack name', () => {
        const out = generateMasterClaudeMd(makeConfig('flutter'));
        expect(out).toContain('Flutter');
        expect(out).toContain('New Feature');
        expect(out).toContain('Edit Feature');
    });

    test('specFirstEnabled=true: mandates spec creation step', () => {
        const out = generateMasterClaudeMd(makeConfig('nodejs', {}, { specFirstEnabled: true }));
        expect(out).toContain('spec');
    });

    test('all stacks: output is non-empty and contains Hard Rules', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'kotlin', 'python', 'angular', 'swiftui', 'java'] as Stack[]) {
            const out = generateMasterClaudeMd(makeConfig(stack));
            expect(out.length).toBeGreaterThan(500);
            expect(out).toContain('Hard Rules');
        }
    });
});

// ─── Coding Standards ─────────────────────────────────────────────────────────

describe('generateCodingStandards', () => {
    test('nodejs: contains JS file extension and naming rules', () => {
        const out = generateCodingStandards(makeConfig('nodejs'));
        expect(out).toContain('.js');
        expect(out).toContain('camelCase');
    });

    test('flutter: contains snake_case file naming rule', () => {
        const out = generateCodingStandards(makeConfig('flutter'));
        expect(out).toContain('snake_case');
    });

    test('python: contains py extension', () => {
        const out = generateCodingStandards(makeConfig('python'));
        expect(out).toContain('.py');
    });

    test('all stacks: output is non-empty', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'kotlin', 'python', 'angular', 'swiftui', 'java'] as Stack[]) {
            const out = generateCodingStandards(makeConfig(stack));
            expect(out.length).toBeGreaterThan(200);
        }
    });

    test('flutter legacy zones: emits Zone Rules section in coding-standards.md', () => {
        const out = generateCodingStandards(makeConfig('flutter', {
            hasLegacyZones: true,
            legacyZones: ['lib/screens/', 'lib/models/'],
            cleanZones: ['lib/features/'],
            legacyZoneNote: 'Dual-mode detected',
        }));
        expect(out).toContain('## Zone Rules — Dual-Mode Project');
        expect(out).toContain('lib/screens/');
        expect(out).toContain('lib/features/');
        expect(out).toContain('Bug fixes only');
    });

    test('no legacy zones: Zone Rules section absent from coding-standards.md', () => {
        const out = generateCodingStandards(makeConfig('flutter'));
        expect(out).not.toContain('## Zone Rules — Dual-Mode Project');
    });
});

// ─── Constitution ─────────────────────────────────────────────────────────────

describe('generateConstitution', () => {
    test('contains core governance principles', () => {
        const out = generateConstitution(makeConfig('nodejs'));
        expect(out).toContain('# Constitution');
        expect(out.length).toBeGreaterThan(300);
    });

    test('all stacks: non-empty output', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python'] as Stack[]) {
            expect(generateConstitution(makeConfig(stack)).length).toBeGreaterThan(100);
        }
    });
});

// ─── Workflow ─────────────────────────────────────────────────────────────────

describe('generateWorkflow', () => {
    test('contains New Feature and Edit Feature sections (v14.3)', () => {
        const out = generateWorkflow(makeConfig('nodejs'));
        expect(out).toContain('New Feature');
        expect(out).toContain('Edit Feature');
    });

    test('contains Bug Fix workflow', () => {
        const out = generateWorkflow(makeConfig('nodejs'));
        expect(out).toContain('Bug Fix');
    });

    test('all stacks: non-empty', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python'] as Stack[]) {
            expect(generateWorkflow(makeConfig(stack)).length).toBeGreaterThan(200);
        }
    });
});

// ─── AI Usage Policy ──────────────────────────────────────────────────────────

describe('generateAIUsagePolicy', () => {
    test('contains Edit Feature in task type list (v14.3)', () => {
        const out = generateAIUsagePolicy(makeConfig('nodejs'));
        expect(out).toContain('Edit Feature');
    });

    test('contains standard task types', () => {
        const out = generateAIUsagePolicy(makeConfig('nodejs'));
        expect(out).toContain('Bug Fix');
        expect(out).toContain('Refactor');
        expect(out).toContain('Hotfix');
    });
});

// ─── Spec First Workflow ──────────────────────────────────────────────────────

describe('generateSpecFirstWorkflow', () => {
    test('specFirstEnabled=true: uses mandatory enforcement language', () => {
        const out = generateSpecFirstWorkflow(makeConfig('nodejs', {}, { specFirstEnabled: true }));
        expect(out).toContain('ABSOLUTE RULE');
    });

    test('specFirstEnabled=false: uses opt-in language', () => {
        const out = generateSpecFirstWorkflow(makeConfig('nodejs', {}, { specFirstEnabled: false }));
        expect(out).not.toContain('ABSOLUTE RULE');
    });
});

// ─── Settings JSON ────────────────────────────────────────────────────────────

describe('generateSettingsJson', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function runSettingsJson(config: GovernanceConfig) {
        const { existsSync, readFileSync } = require('fs');
        const opts = {
            overwrite: true, dryRun: false, updateHooks: false,
            hookVersion: config.hookVersion, projectDir: tmpDir,
            conflictMode: 'keep' as const,
        };
        generateSettingsJson({ ...config, projectDir: tmpDir }, opts);
        const settingsPath = join(tmpDir, '.claude', 'settings.json');
        expect(existsSync(settingsPath)).toBe(true);
        return JSON.parse(readFileSync(settingsPath, 'utf-8'));
    }

    test('nodejs: produces valid JSON with hooks key', () => {
        const json = runSettingsJson(makeConfig('nodejs'));
        expect(json).toHaveProperty('hooks');
    });

    test('nodejs: check-secrets.sh present in PreToolUse', () => {
        const json = runSettingsJson(makeConfig('nodejs'));
        const preToolUse = JSON.stringify(json.hooks?.PreToolUse ?? []);
        expect(preToolUse).toContain('check-secrets.sh');
    });

    test('specFirstEnabled=false: check-spec-exists.sh absent from PreToolUse', () => {
        const json = runSettingsJson(makeConfig('nodejs', {}, { specFirstEnabled: false }));
        const preToolUse = JSON.stringify(json.hooks?.PreToolUse ?? []);
        expect(preToolUse).not.toContain('check-spec-exists.sh');
    });

    test('specFirstEnabled=true: check-spec-exists.sh present in PreToolUse', () => {
        const json = runSettingsJson(makeConfig('nodejs', {}, { specFirstEnabled: true }));
        const preToolUse = JSON.stringify(json.hooks?.PreToolUse ?? []);
        expect(preToolUse).toContain('check-spec-exists.sh');
    });
});

// ─── check-file-size.sh ───────────────────────────────────────────────────────

describe('generateCheckFileSize', () => {
    test('nodejs: active hook with 200-line limit and .js extension', () => {
        const out = generateCheckFileSize(makeConfig('nodejs'));
        expect(out).toContain('200');
        expect(out).toContain('.js');
        expect(out).toContain('LINES');
    });

    test('nodejs: does not skip routes files (backend skip pattern)', () => {
        const out = generateCheckFileSize(makeConfig('nodejs'));
        // Backend skip pattern should NOT include 'routes' (we want to catch God-route files)
        const skipLine = out.split('\n').find(l => l.includes('grep -qiE') && l.includes('exit 0'));
        expect(skipLine).not.toContain('routes');
    });

    test('react: active hook with frontend skip pattern (includes routes)', () => {
        const out = generateCheckFileSize(makeConfig('react'));
        expect(out).toContain('200');
        const skipLine = out.split('\n').find(l => l.includes('grep -qiE') && l.includes('exit 0'));
        expect(skipLine).toContain('routes');
    });

    test('flutter: active hook with .dart extension', () => {
        const out = generateCheckFileSize(makeConfig('flutter'));
        expect(out).toContain('.dart');
        expect(out).toContain('200');
    });

    test('python: active hook', () => {
        const out = generateCheckFileSize(makeConfig('python'));
        expect(out).toContain('200');
        expect(out).toContain('LINES');
    });

    test('swiftui: no-op (not in active stacks)', () => {
        const out = generateCheckFileSize(makeConfig('swiftui'));
        const lines = out.split('\n').filter(l => l.trim()).length;
        expect(lines).toBeLessThanOrEqual(4);
        expect(out).toContain('exit 0');
        expect(out).not.toContain('LINES');
    });
});

// ─── check-secrets.sh ────────────────────────────────────────────────────────

describe('generateCheckSecrets', () => {
    test('contains HOOK_VERSION header', () => {
        const out = generateCheckSecrets(makeConfig('nodejs'));
        expect(out).toContain('HOOK_VERSION=16.0.0');
    });

    test('contains AWS AKIA key pattern', () => {
        const out = generateCheckSecrets(makeConfig('nodejs'));
        expect(out).toContain('AKIA');
    });

    test('contains credential-named variable pattern (bash regex literal)', () => {
        const out = generateCheckSecrets(makeConfig('nodejs'));
        // The bash regex uses literal `?` chars — test for the bash pattern string, not a JS regex
        expect(out).toContain('secret_?key');
        expect(out).toContain('api_?key');
    });

    test('all stacks produce same non-empty output', () => {
        const outputs = (['nodejs', 'react', 'flutter', 'python'] as Stack[])
            .map(s => generateCheckSecrets(makeConfig(s)));
        expect(new Set(outputs).size).toBe(1); // identical across stacks
        expect(outputs[0].length).toBeGreaterThan(100);
    });
});

// ─── protect-files.sh ────────────────────────────────────────────────────────

describe('generateProtectFiles', () => {
    test('high-risk files appear in generated hook', () => {
        const out = generateProtectFiles(makeConfig('nodejs', {
            highRiskFiles: ['src/app.js', '.env'],
        }));
        expect(out).toContain('src/app.js');
        expect(out).toContain('.env');
    });

    test('empty high-risk list: hook still valid bash', () => {
        const out = generateProtectFiles(makeConfig('nodejs', { highRiskFiles: [] }));
        expect(out).toContain('#!/usr/bin/env bash');
        expect(out).toContain('exit 0');
    });

    test('contains HOOK_VERSION', () => {
        const out = generateProtectFiles(makeConfig('nodejs'));
        expect(out).toContain('HOOK_VERSION=16.0.0');
    });
});

// ─── analyze-code.sh ─────────────────────────────────────────────────────────

describe('generateAnalyzeCode', () => {
    test('no linter: produces minimal no-op', () => {
        const out = generateAnalyzeCode(makeConfig('nodejs'));
        const lines = out.split('\n').filter(l => l.trim()).length;
        expect(lines).toBeLessThanOrEqual(4);
        expect(out).toContain('exit 0');
    });

    test('eslint + config: active linting hook', () => {
        const cfg = makeConfig('nodejs', { detectedLinter: 'eslint', detectedHasLinterConfig: true });
        cfg.profile.analyzeCmd = 'npx eslint src/';
        cfg.profile.analyzeCmdFile = 'npx eslint';
        const out = generateAnalyzeCode(cfg);
        expect(out).toContain('npx eslint');
        expect(out).toContain('additionalContext');
    });

    test('eslint detected but NO config: warns Claude instead of silently failing', () => {
        const out = generateAnalyzeCode(makeConfig('nodejs', {
            detectedLinter: 'eslint',
            detectedHasLinterConfig: false,
        }));
        expect(out).toContain('WARNING:');
        expect(out).toContain('eslint');
    });

    test('flutter: active dart analyze hook', () => {
        const out = generateAnalyzeCode(makeConfig('flutter'));
        expect(out).toContain('dart analyze');
    });

    test('python: active ruff check hook', () => {
        const out = generateAnalyzeCode(makeConfig('python'));
        expect(out).toContain('ruff');
    });
});

// ─── format-code.sh ──────────────────────────────────────────────────────────

describe('generateFormatCode', () => {
    test('no formatter: produces minimal no-op', () => {
        const out = generateFormatCode(makeConfig('nodejs'));
        const lines = out.split('\n').filter(l => l.trim()).length;
        expect(lines).toBeLessThanOrEqual(5);
    });

    test('prettier + config: active formatting hook', () => {
        const cfg = makeConfig('nodejs', {
            detectedFormatter: 'prettier',
            detectedHasFormatterConfig: true,
        });
        cfg.profile.formatCmd = 'npx prettier --write';
        const out = generateFormatCode(cfg);
        expect(out).toContain('prettier --write');
    });

    test('prettier detected but NO config: warns Claude instead of silently failing', () => {
        const out = generateFormatCode(makeConfig('nodejs', {
            detectedFormatter: 'prettier',
            detectedHasFormatterConfig: false,
        }));
        expect(out).toContain('WARNING:');
        expect(out).toContain('prettier');
    });

    test('biome: always active (no config file needed)', () => {
        const cfg = makeConfig('nodejs', {
            detectedFormatter: 'biome',
            detectedHasFormatterConfig: false,
        });
        cfg.profile.formatCmd = 'npx biome format --write';
        const out = generateFormatCode(cfg);
        expect(out).toContain('biome format');
    });

    test('flutter: active dart format hook', () => {
        const out = generateFormatCode(makeConfig('flutter'));
        expect(out).toContain('dart format');
    });

    test('python: active ruff format hook', () => {
        const cfg = makeConfig('python', {
            detectedFormatter: 'ruff',
            detectedHasFormatterConfig: false,
        });
        cfg.profile.formatCmd = 'ruff format';
        const out = generateFormatCode(cfg);
        expect(out).toContain('ruff format');
    });
});

// ─── block-dangerous-commands.sh ─────────────────────────────────────────────

describe('generateBlockDangerous', () => {
    test('contains rm -rf guard', () => {
        const out = generateBlockDangerous(makeConfig('nodejs'));
        expect(out).toContain('rm');
        expect(out).toContain('HOOK_VERSION=16.0.0');
    });

    test('all stacks: non-empty valid bash', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python'] as Stack[]) {
            const out = generateBlockDangerous(makeConfig(stack));
            expect(out).toContain('#!/usr/bin/env bash');
        }
    });
});

// ─── post-task-checklist.sh ──────────────────────────────────────────────────

describe('generatePostTaskChecklist', () => {
    test('contains Edit Feature task type (v14.3)', () => {
        const out = generatePostTaskChecklist(makeConfig('nodejs'));
        expect(out).toContain('Edit Feature');
    });

    test('contains New Feature task type', () => {
        const out = generatePostTaskChecklist(makeConfig('nodejs'));
        expect(out).toContain('New Feature');
    });
});

// ─── computeContentBlocks ────────────────────────────────────────────────────

describe('computeContentBlocks', () => {
    test('all fields are strings (no undefined)', () => {
        const cfg = makeConfig('nodejs');
        const blocks = computeContentBlocks(cfg.stack, cfg.profile, cfg.scan);
        for (const [key, val] of Object.entries(blocks)) {
            expect(typeof val).toBe('string');
        }
    });

    test('detectedHasTests=false: hardRules contains no-test-runner warning', () => {
        const cfg = makeConfig('nodejs', { detectedHasTests: false });
        const blocks = computeContentBlocks(cfg.stack, cfg.profile, cfg.scan);
        expect(blocks.hardRules).toContain('No test runner');
    });

    test('detectedHasTests=true: hardRules does NOT contain no-test-runner warning', () => {
        const cfg = makeConfig('nodejs', { detectedHasTests: true });
        const blocks = computeContentBlocks(cfg.stack, cfg.profile, cfg.scan);
        expect(blocks.hardRules).not.toContain('No test runner');
    });

    test('nodejs mixedArch routes-models: hardRules replaced with dual-mode block', () => {
        const cfg = makeConfig('nodejs', {
            mixedArch: true,
            detectedArchPattern: 'routes-models',
        });
        const blocks = computeContentBlocks(cfg.stack, cfg.profile, cfg.scan);
        // Dual-mode block signals mixed architecture — check for actual replacement content
        expect(blocks.hardRules).toContain('DUAL architecture');
    });

    test('all stacks: hardRules is non-empty', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'kotlin', 'python', 'angular', 'swiftui', 'java'] as Stack[]) {
            const profile = loadBaseProfile(stack);
            const scan = createDefaultScanResult();
            const blocks = computeContentBlocks(stack, profile, scan);
            expect(blocks.hardRules.length).toBeGreaterThan(10);
        }
    });
});
