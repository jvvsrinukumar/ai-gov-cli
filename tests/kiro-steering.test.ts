/**
 * Kiro steering file tests — verifies front-matter wrapping,
 * content parity with Claude Code, and correct output structure.
 */
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { wrapWithFrontMatter } from '../src/agents/kiro/steering.js';
import { generateKiro } from '../src/agents/kiro/index.js';
import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

// Shared content generators (same ones Kiro uses)
import { generateConstitution } from '../src/generators/constitution.js';
import { generateArchitecture } from '../src/generators/architecture.js';
import { generateCodingStandards } from '../src/generators/coding-standards.js';
import { generateAIUsagePolicy } from '../src/generators/ai-usage-policy.js';
import { generateWorkflow } from '../src/generators/workflow.js';
import { generateSpecFirstWorkflow } from '../src/generators/spec-first-workflow.js';
import { generateFeatureReadme } from '../src/generators/feature-readme.js';
import { generatePromptTemplates } from '../src/generators/prompt-templates.js';

const DEFAULT_PROJECT = {
    packageName: 'test-app',
    appName: 'test-app',
    appDescription: '',
    ticketSystem: 'Jira',
    ticketPrefix: 'TICKET',
    legacyDescription: 'No legacy code',
};

function makeConfig(
    stack: Stack = 'nodejs',
    scanOverrides: Partial<ScanResult> = {},
): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'kiro',
        stack,
        profile,
        scan,
        project: DEFAULT_PROJECT,
        blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '16.0.0',
        projectDir: '/tmp/test-project',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

// Silence console output
beforeAll(() => { jest.spyOn(console, 'log').mockImplementation(() => { }); });
afterAll(() => { jest.restoreAllMocks(); });

// ─── wrapWithFrontMatter ──────────────────────────────────────────────────────

describe('wrapWithFrontMatter', () => {
    test('adds inclusion: always front-matter by default', () => {
        const result = wrapWithFrontMatter('# Hello');
        expect(result).toBe('---\ninclusion: always\n---\n\n# Hello');
    });

    test('adds fileMatch inclusion with pattern', () => {
        const result = wrapWithFrontMatter('# Hello', 'fileMatch', 'README*');
        expect(result).toBe("---\ninclusion: fileMatch\nfileMatchPattern: 'README*'\n---\n\n# Hello");
    });

    test('adds manual inclusion', () => {
        const result = wrapWithFrontMatter('# Hello', 'manual');
        expect(result).toBe('---\ninclusion: manual\n---\n\n# Hello');
    });
});

// ─── Steering file content parity ─────────────────────────────────────────────

describe('Kiro steering files have front-matter + matching content', () => {
    const steeringGenerators: Array<{ name: string; generate: (c: GovernanceConfig) => string }> = [
        { name: 'constitution', generate: generateConstitution },
        { name: 'architecture', generate: generateArchitecture },
        { name: 'coding-standards', generate: generateCodingStandards },
        { name: 'ai-usage-policy', generate: generateAIUsagePolicy },
        { name: 'workflow', generate: generateWorkflow },
        { name: 'spec-first-workflow', generate: generateSpecFirstWorkflow },
        { name: 'feature-readme', generate: generateFeatureReadme },
        { name: 'prompt-templates', generate: generatePromptTemplates },
    ];

    for (const { name, generate } of steeringGenerators) {
        test(`${name}.md has inclusion: always front-matter`, () => {
            const config = makeConfig();
            const wrapped = wrapWithFrontMatter(generate(config));
            expect(wrapped).toMatch(/^---\ninclusion: always\n---\n\n/);
        });
    }

    for (const { name, generate } of steeringGenerators) {
        test(`${name}.md body matches Claude Code version`, () => {
            const config = makeConfig();
            const claudeContent = generate(config);
            const kiroContent = wrapWithFrontMatter(claudeContent);
            // Strip front-matter and verify body is identical
            const body = kiroContent.replace(/^---\n.*?\n---\n\n/s, '');
            expect(body).toBe(claudeContent);
        });
    }
});

// ─── Kiro orchestrator output structure ───────────────────────────────────────

describe('Kiro orchestrator output', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    function runKiro(stack: Stack = 'nodejs') {
        const config = makeConfig(stack);
        config.projectDir = tmpDir;
        config.overwrite = true;
        generateKiro(config);
    }

    test('writes to .kiro/steering/ not .claude/steering/', () => {
        runKiro();
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'architecture.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'constitution.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'coding-standards.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'workflow.md'))).toBe(true);
    });

    test('writes spec templates to .kiro/specs/_template/', () => {
        runKiro();
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'requirements.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'design.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.kiro', 'specs', '_template', 'tasks.md'))).toBe(true);
    });

    test('spec tasks.md references .kiro/ paths, not .claude/', () => {
        runKiro();
        const tasksContent = readFileSync(join(tmpDir, '.kiro', 'specs', '_template', 'tasks.md'), 'utf-8');
        expect(tasksContent).toContain('.kiro/steering/constitution.md');
        expect(tasksContent).not.toContain('.claude/');
    });

    test('does NOT create root-level specs/ directory', () => {
        runKiro();
        expect(existsSync(join(tmpDir, 'specs'))).toBe(false);
    });

    test('does NOT create .claude/ directory', () => {
        runKiro();
        expect(existsSync(join(tmpDir, '.claude'))).toBe(false);
    });

    test('does NOT create CLAUDE.md', () => {
        runKiro();
        expect(existsSync(join(tmpDir, 'CLAUDE.md'))).toBe(false);
    });

    test('does NOT create settings.json', () => {
        runKiro();
        expect(existsSync(join(tmpDir, '.kiro', 'settings.json'))).toBe(false);
    });

    test('does NOT create commands/ directory', () => {
        runKiro();
        expect(existsSync(join(tmpDir, '.kiro', 'commands'))).toBe(false);
    });

    test('monorepo: writes monorepo.md to .kiro/steering/, not .claude/steering/', () => {
        // Create a monorepo structure with a package
        mkdirSync(join(tmpDir, 'packages', 'core'), { recursive: true });
        writeFileSync(join(tmpDir, 'packages', 'core', 'package.json'), '{"name":"core"}');

        const config = makeConfig('nodejs', { detectedMonorepo: 'npm workspaces' });
        config.projectDir = tmpDir;
        config.overwrite = true;
        generateKiro(config);

        expect(existsSync(join(tmpDir, '.kiro', 'steering', 'monorepo.md'))).toBe(true);
        expect(existsSync(join(tmpDir, '.claude', 'steering', 'monorepo.md'))).toBe(false);
    });
});
