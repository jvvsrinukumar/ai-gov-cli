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
import { generateRootClaudeMd, generateMasterClaudeMd } from '../src/agents/claude-code/claude-md.js';
import { generateCodingStandards } from '../src/generators/coding-standards.js';
import { generateConstitution } from '../src/generators/constitution.js';
import { generateWorkflow } from '../src/generators/workflow.js';
import { generateAIUsagePolicy } from '../src/generators/ai-usage-policy.js';
import { generateSpecFirstWorkflow } from '../src/generators/spec-first-workflow.js';
import { generateSettingsJson } from '../src/agents/claude-code/settings-json.js';
import { generateCheckFileSize } from '../src/agents/claude-code/hooks/check-file-size.js';
import { generateCheckSecrets } from '../src/agents/claude-code/hooks/check-secrets.js';
import { generateProtectFiles } from '../src/agents/claude-code/hooks/protect-files.js';
import { generateAnalyzeCode } from '../src/agents/claude-code/hooks/analyze-code.js';
import { generateFormatCode } from '../src/agents/claude-code/hooks/format-code.js';
import { generateBlockDangerous } from '../src/agents/claude-code/hooks/block-dangerous.js';
import { generatePostTaskChecklist } from '../src/agents/claude-code/hooks/post-task-checklist.js';
import { generateTechKnowledgeCommand } from '../src/agents/claude-code/commands/tech-knowledge.js';
import { generateProductKnowledgeCommand } from '../src/agents/claude-code/commands/product-knowledge.js';
import { generateDetectConflictsCommand } from '../src/agents/claude-code/commands/detect-conflicts.js';
import { generateNewFeatureCommand } from '../src/agents/claude-code/commands/new-feature.js';
import { generateEditFeatureCommand } from '../src/agents/claude-code/commands/edit-feature.js';
import { generateFixCommand } from '../src/agents/claude-code/commands/fix.js';
import { generateExploreCommand } from '../src/agents/claude-code/commands/explore.js';
import { generateRefactorCommand } from '../src/agents/claude-code/commands/refactor.js';
import { generateAssessCommand } from '../src/agents/claude-code/commands/assess.js';
import { generateAuditCommand } from '../src/agents/claude-code/commands/audit.js';

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
        agent: 'claude-code',
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
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
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

    test('claude-code: priority chain includes CLAUDE.md', () => {
        const out = generateConstitution(makeConfig('nodejs'));
        expect(out).toContain('CLAUDE.md');
        expect(out).toContain('constitution.md > CLAUDE.md > steering files > specs');
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

    test('claude-code: PR checklist says Claude Code was used', () => {
        const out = generateAIUsagePolicy(makeConfig('nodejs'));
        expect(out).toContain('- [ ] Claude Code was used');
    });

    test('claude-code: spec folder references specs/ not .kiro/specs/', () => {
        const out = generateAIUsagePolicy(makeConfig('nodejs'));
        expect(out).toContain('specs/<feature>/');
        expect(out).not.toContain('.kiro/specs/');
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

    test('claude-code: references check-spec-exists.sh and settings.json', () => {
        const out = generateSpecFirstWorkflow(makeConfig('nodejs', {}, { specFirstEnabled: true }));
        expect(out).toContain('check-spec-exists.sh');
        expect(out).not.toContain('spec-first-gate.kiro.hook');
    });

    test('claude-code: spec path uses specs/ not .kiro/specs/', () => {
        const out = generateSpecFirstWorkflow(makeConfig('nodejs'));
        expect(out).toContain('specs/<n>/');
        expect(out).not.toContain('.kiro/specs/');
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
    test('nodejs: no-op stub (backend stack exempt from 300-line limit)', () => {
        const out = generateCheckFileSize(makeConfig('nodejs'));
        expect(out).toContain('exit 0');
        expect(out).not.toContain('LINES');
    });

    test('react: active hook with frontend skip pattern (includes routes)', () => {
        const out = generateCheckFileSize(makeConfig('react'));
        expect(out).toContain('LINES');
        const skipLine = out.split('\n').find(l => l.includes('grep -qiE') && l.includes('exit 0'));
        expect(skipLine).toContain('routes');
    });

    test('flutter: active hook with .dart extension', () => {
        const out = generateCheckFileSize(makeConfig('flutter'));
        expect(out).toContain('.dart');
        expect(out).toContain('LINES');
    });

    test('python: no-op stub (backend stack exempt from 300-line limit)', () => {
        const out = generateCheckFileSize(makeConfig('python'));
        expect(out).toContain('exit 0');
        expect(out).not.toContain('LINES');
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
        for (const [, val] of Object.entries(blocks)) {
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

// ─── Knowledge Hub — Phase 1 commands ────────────────────────────────────────

describe('generateTechKnowledgeCommand', () => {
    test('contains INFERRED tag rules', () => {
        const out = generateTechKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('[INFERRED]');
        expect(out).toContain('Needs Clarification');
    });

    test('contains stack display name', () => {
        const cfg = makeConfig('nodejs');
        const out = generateTechKnowledgeCommand(cfg);
        expect(out).toContain(cfg.profile.stackDisplay);
    });

    test('contains output directory rule', () => {
        const out = generateTechKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('knowledge/');
    });

    test('contains read-only rule', () => {
        const out = generateTechKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('Read-only');
    });

    test('all stacks: non-empty output', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python', 'java'] as Stack[]) {
            expect(generateTechKnowledgeCommand(makeConfig(stack)).length).toBeGreaterThan(500);
        }
    });
});

describe('generateProductKnowledgeCommand', () => {
    test('contains INFERRED tag rules', () => {
        const out = generateProductKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('[INFERRED]');
        expect(out).toContain('Needs Clarification');
    });

    test('angular: uses Angular-specific reading strategy', () => {
        const out = generateProductKnowledgeCommand(makeConfig('angular'));
        expect(out).toContain('NgRx');
        expect(out).toContain('guards');
    });

    test('react: uses React-specific reading strategy', () => {
        const out = generateProductKnowledgeCommand(makeConfig('react'));
        expect(out).toContain('hooks/');
        expect(out).toContain('route');
    });

    test('nodejs: uses Node.js reading strategy', () => {
        const out = generateProductKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('middleware');
        expect(out).toContain('ORM');
    });

    test('python: uses Python reading strategy', () => {
        const out = generateProductKnowledgeCommand(makeConfig('python'));
        expect(out).toContain('FastAPI');
        expect(out).toContain('Pydantic');
    });

    test('contains User Flows and Domain Objects sections', () => {
        const out = generateProductKnowledgeCommand(makeConfig('nodejs'));
        expect(out).toContain('User Flows');
        expect(out).toContain('Domain Objects');
        expect(out).toContain('Permissions');
        expect(out).toContain('Business States');
    });

    test('all stacks: non-empty output', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'kotlin', 'python', 'angular', 'swiftui', 'java'] as Stack[]) {
            expect(generateProductKnowledgeCommand(makeConfig(stack)).length).toBeGreaterThan(500);
        }
    });
});

describe('generateDetectConflictsCommand', () => {
    test('contains all four conflict types', () => {
        const out = generateDetectConflictsCommand(makeConfig('nodejs'));
        expect(out).toContain('Permission conflicts');
        expect(out).toContain('Domain object conflicts');
        expect(out).toContain('Business state conflicts');
        expect(out).toContain('Flow assumption conflicts');
    });

    test('contains conservative threshold rule', () => {
        const out = generateDetectConflictsCommand(makeConfig('nodejs'));
        expect(out).toContain('conservative');
    });

    test('contains knowledge/conflicts/ output directory', () => {
        const out = generateDetectConflictsCommand(makeConfig('nodejs'));
        expect(out).toContain('knowledge/conflicts/');
    });

    test('contains resolution tracking instruction', () => {
        const out = generateDetectConflictsCommand(makeConfig('nodejs'));
        expect(out).toContain('Resolved');
        expect(out).toContain('re-raised');
    });

    test('all stacks: non-empty output', () => {
        for (const stack of ['nodejs', 'react', 'flutter', 'python'] as Stack[]) {
            expect(generateDetectConflictsCommand(makeConfig(stack)).length).toBeGreaterThan(500);
        }
    });
});

// ─── Knowledge Hub — Phase 2 utility injection ────────────────────────────────
// These tests catch the \${} escape bug: if the preamble is escaped in a template
// literal, the function is never called and this assertion fails immediately.

describe('Knowledge Hub preamble injection — Phase 2', () => {
    const preambleSection = '## KNOWLEDGE CONTEXT — Read Before Acting';

    test('new-feature.md contains knowledge preamble', () => {
        expect(generateNewFeatureCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('edit-feature.md contains knowledge preamble', () => {
        expect(generateEditFeatureCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('fix.md contains knowledge preamble', () => {
        expect(generateFixCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('explore.md contains knowledge preamble', () => {
        expect(generateExploreCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('refactor.md contains knowledge preamble', () => {
        expect(generateRefactorCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('assess.md contains knowledge preamble', () => {
        expect(generateAssessCommand(makeConfig('nodejs'))).toContain(preambleSection);
    });

    test('preamble contains [CONFIRMED] and [INFERRED] usage rules', () => {
        const out = generateFixCommand(makeConfig('nodejs'));
        expect(out).toContain('[CONFIRMED]');
        expect(out).toContain('[INFERRED]');
    });
});

// ─── Knowledge Hub — Phase 3 capture injection ────────────────────────────────

describe('Knowledge Hub capture injection — Phase 3', () => {
    const captureSection = '## SILENT KNOWLEDGE CAPTURE — After Gate 1 Approval';

    test('new-feature.md contains silent capture instruction', () => {
        expect(generateNewFeatureCommand(makeConfig('nodejs'))).toContain(captureSection);
    });

    test('edit-feature.md contains silent capture instruction', () => {
        expect(generateEditFeatureCommand(makeConfig('nodejs'))).toContain(captureSection);
    });

    test('edit-feature.md capture only targets NEW/CHANGED items', () => {
        const out = generateEditFeatureCommand(makeConfig('nodejs'));
        expect(out).toContain('<!-- NEW -->');
        expect(out).toContain('<!-- CHANGED');
    });

    test('capture instruction contains merge rules', () => {
        const out = generateNewFeatureCommand(makeConfig('nodejs'));
        expect(out).toContain('[CONFIRMED]');
        expect(out).toContain('never overwrite');
    });
});

// ─── Knowledge Hub — Phase 4 health check injection ───────────────────────────

describe('Knowledge Hub health check injection — Phase 4', () => {
    test('audit.md contains knowledge health check section', () => {
        const out = generateAuditCommand(makeConfig('nodejs'));
        expect(out).toContain('## KNOWLEDGE HEALTH CHECK');
    });

    test('audit.md health check contains STALE and UNVERIFIABLE classifications', () => {
        const out = generateAuditCommand(makeConfig('nodejs'));
        expect(out).toContain('[STALE]');
        expect(out).toContain('[UNVERIFIABLE]');
    });

    test('audit.md health check is read-only — no writes to knowledge files', () => {
        const out = generateAuditCommand(makeConfig('nodejs'));
        expect(out).toContain('Do NOT write to or modify any knowledge file');
    });
});
