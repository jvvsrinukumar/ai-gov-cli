/**
 * Knowledge Hub tests.
 * Covers: /knowledge command, silent capture instructions, knowledge preambles,
 * knowledge health check, and integration (knowledge.md written on init).
 */
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateKnowledgeCommand } from '../src/agents/claude-code/commands/knowledge.js';
import {
    generateSilentCaptureInstructionNewFeature,
    generateSilentCaptureInstructionFix,
    generateSilentCaptureInstructionEditFeature,
} from '../src/utils/knowledge-capture.js';
import { generateKnowledgeHealthCheck } from '../src/utils/knowledge-health-check.js';
import {
    generateKnowledgePreambleCommand,
    generateKnowledgePreambleHook,
} from '../src/utils/knowledge-preamble.js';
import { generateClaudeCode } from '../src/agents/claude-code/index.js';
import { normalizeSlug } from '../src/utils/knowledge-slug.js';
import {
    KNOWLEDGE_HTML_CSS,
    wrapKnowledgePage,
} from '../src/utils/knowledge-html-template.js';
import { generateKnowledgeConfirmedCheck } from '../src/generators/git-hooks/checks/knowledge-confirmed.js';
import { generateTechKnowledgeCommand } from '../src/agents/claude-code/commands/tech-knowledge.js';
import { generateProductKnowledgeCommand } from '../src/agents/claude-code/commands/product-knowledge.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(stack: Stack, scanOverrides: Partial<ScanResult> = {}): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult(), ...scanOverrides };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent: 'claude-code',
        stack,
        profile,
        scan,
        project: {
            packageName: 'test-app',
            appName: 'test-app',
            appDescription: '',
            ticketSystem: 'Jira',
            ticketPrefix: 'TICKET',
            legacyDescription: 'No legacy code',
        },
        blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '19.0.0',
        projectDir: '/tmp/test-project',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
    };
}

function mkTmp(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-knowledge-test-'));
}

// ─── /knowledge command ───────────────────────────────────────────────────────

describe('generateKnowledgeCommand', () => {
    const config = makeConfig('nodejs');
    let output: string;

    beforeAll(() => {
        output = generateKnowledgeCommand(config);
    });

    test('has correct heading', () => {
        expect(output).toContain('# /knowledge');
    });

    test('is explicitly read-only', () => {
        expect(output).toContain('Read-Only');
    });

    test('references tech knowledge files', () => {
        expect(output).toContain('knowledge/tech-');
    });

    test('references product knowledge files', () => {
        expect(output).toContain('knowledge/product-');
    });

    test('mentions CONFIRMED and INFERRED confidence levels', () => {
        expect(output).toContain('[CONFIRMED]');
        expect(output).toContain('[INFERRED]');
    });

    test('includes stack display from config', () => {
        expect(output).toContain(config.profile.stackDisplay);
    });

    test('explains what to do when knowledge/ does not exist', () => {
        expect(output).toContain('does not exist');
    });

    test('rules section prohibits writes', () => {
        expect(output).toContain('Read-only — never write or modify any file');
    });

    test('rules section prohibits code scanning', () => {
        expect(output).toContain('Never scan source code');
    });

    test('rules section prohibits creating knowledge files', () => {
        expect(output).toContain('Never create knowledge files');
    });

    test('handles react stack', () => {
        const reactConfig = makeConfig('react');
        const reactOutput = generateKnowledgeCommand(reactConfig);
        expect(reactOutput).toContain(reactConfig.profile.stackDisplay);
    });
});

// ─── Silent capture — new feature ────────────────────────────────────────────

describe('generateSilentCaptureInstructionNewFeature', () => {
    let output: string;

    beforeAll(() => {
        output = generateSilentCaptureInstructionNewFeature();
    });

    test('has correct section heading', () => {
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
    });

    test('triggers after Gate 1 approval', () => {
        expect(output).toContain('Gate 1');
    });

    test('targets product knowledge file', () => {
        expect(output).toContain('knowledge/product-[slug].md');
    });

    test('extracts user flows', () => {
        expect(output).toContain('User Flows');
    });

    test('extracts domain objects', () => {
        expect(output).toContain('Domain Objects');
    });

    test('extracts permissions and roles', () => {
        expect(output).toContain('Permissions & Roles');
    });

    test('extracts business states', () => {
        expect(output).toContain('Business States');
    });

    test('uses CONFIRMED tag for new entries', () => {
        expect(output).toContain('[CONFIRMED]');
    });

    test('never overwrites CONFIRMED entries', () => {
        expect(output).toContain('[CONFIRMED]');
        expect(output).toContain('never overwrite');
    });

    test('is silent — no developer input', () => {
        expect(output).toContain('Do not ask the developer for input');
    });

    test('outputs one status line', () => {
        expect(output).toContain('One status line only');
    });

    test('proceeds to Gate 2 after capture', () => {
        expect(output).toContain('Proceed to Gate 2');
    });
});

// ─── Silent capture — fix ────────────────────────────────────────────────────

describe('generateSilentCaptureInstructionFix', () => {
    let output: string;

    beforeAll(() => {
        output = generateSilentCaptureInstructionFix();
    });

    test('has correct section heading', () => {
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
    });

    test('triggers after fix is applied', () => {
        expect(output).toContain('After Fix Applied');
    });

    test('derives slug from file path', () => {
        expect(output).toContain('feature folder name');
    });

    test('targets product knowledge file', () => {
        expect(output).toContain('knowledge/product-[slug].md');
    });

    test('extracts business rules', () => {
        expect(output).toContain('Business rule');
    });

    test('extracts constraints', () => {
        expect(output).toContain('Constraint');
    });

    test('extracts edge cases', () => {
        expect(output).toContain('Edge case');
    });

    test('tags entries as INFERRED', () => {
        expect(output).toContain('[INFERRED]');
    });

    test('never overwrites CONFIRMED entries', () => {
        expect(output).toContain('[CONFIRMED]');
        expect(output).toContain('never overwrite');
    });

    test('appends under Business Rules section', () => {
        expect(output).toContain('Business Rules');
    });

    test('is silent — no developer input', () => {
        expect(output).toContain('Do not ask the developer for input');
    });

    test('outputs one status line', () => {
        expect(output).toContain('One status line only');
    });

    test('handles purely technical fixes with no business meaning', () => {
        expect(output).toContain('purely technical');
        expect(output).toContain('no business rules extracted');
    });
});

// ─── Silent capture — edit feature ───────────────────────────────────────────

describe('generateSilentCaptureInstructionEditFeature', () => {
    let output: string;

    beforeAll(() => {
        output = generateSilentCaptureInstructionEditFeature();
    });

    test('has correct section heading', () => {
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
    });

    test('triggers after Gate 1 approval', () => {
        expect(output).toContain('Gate 1');
    });

    test('only captures NEW and CHANGED items', () => {
        expect(output).toContain('<!-- NEW -->');
        expect(output).toContain('<!-- CHANGED');
    });

    test('does not re-capture unchanged requirements', () => {
        expect(output).toContain('Do not re-capture existing unchanged requirements');
    });

    test('targets product knowledge file', () => {
        expect(output).toContain('knowledge/product-[slug].md');
    });

    test('never overwrites CONFIRMED entries', () => {
        expect(output).toContain('[CONFIRMED]');
        expect(output).toContain('never overwrite');
    });

    test('is silent — no developer input', () => {
        expect(output).toContain('Do not ask the developer for input');
    });
});

// ─── Knowledge health check ───────────────────────────────────────────────────

describe('generateKnowledgeHealthCheck', () => {
    let output: string;

    beforeAll(() => {
        output = generateKnowledgeHealthCheck();
    });

    test('has correct section heading', () => {
        expect(output).toContain('KNOWLEDGE HEALTH CHECK');
    });

    test('classifies entries as Current, Stale, or Unverifiable', () => {
        expect(output).toContain('[STALE]');
        expect(output).toContain('[UNVERIFIABLE]');
        expect(output).toContain('Current');
    });

    test('reports file and entry counts', () => {
        expect(output).toContain('Files checked');
        expect(output).toContain('Entries checked');
    });

    test('shows stale entries require action', () => {
        expect(output).toContain('Stale entries (require action)');
    });

    test('shows unverifiable entries require human review', () => {
        expect(output).toContain('Unverifiable entries (require human review)');
    });

    test('handles missing knowledge/ directory gracefully', () => {
        expect(output).toContain("knowledge/ directory");
    });

    test('rules: does not write to knowledge files', () => {
        expect(output).toContain('Do NOT write to or modify any knowledge file');
    });

    test('stale is higher urgency than unverifiable', () => {
        const staleIdx = output.indexOf('[STALE] is higher urgency');
        expect(staleIdx).toBeGreaterThan(-1);
    });
});

// ─── Knowledge preamble ───────────────────────────────────────────────────────

describe('generateKnowledgePreambleCommand', () => {
    let output: string;

    beforeAll(() => {
        output = generateKnowledgePreambleCommand();
    });

    test('has section heading', () => {
        expect(output).toContain('KNOWLEDGE CONTEXT');
    });

    test('reads tech and product files', () => {
        expect(output).toContain('knowledge/tech-[slug].md');
        expect(output).toContain('knowledge/product-[slug].md');
    });

    test('falls back to overview files', () => {
        expect(output).toContain('knowledge/tech-overview.md');
        expect(output).toContain('knowledge/product-overview.md');
    });

    test('explains CONFIRMED vs INFERRED usage', () => {
        expect(output).toContain('[CONFIRMED]');
        expect(output).toContain('[INFERRED]');
    });

    test('skips silently if knowledge/ is absent', () => {
        expect(output).toContain('skip silently');
    });

    test('prohibits editing knowledge files', () => {
        expect(output).toContain('Do not edit the knowledge file');
    });
});

describe('generateKnowledgePreambleHook', () => {
    let output: string;

    beforeAll(() => {
        output = generateKnowledgePreambleHook();
    });

    test('has section heading', () => {
        expect(output).toContain('KNOWLEDGE CONTEXT');
    });

    test('reads tech and product files', () => {
        expect(output).toContain('knowledge/tech-[slug].md');
        expect(output).toContain('knowledge/product-[slug].md');
    });

    test('skips silently if knowledge/ is absent', () => {
        expect(output).toContain("skip silently");
    });

    test('hook preamble is shorter than command preamble', () => {
        const commandOutput = generateKnowledgePreambleCommand();
        expect(output.length).toBeLessThan(commandOutput.length);
    });
});

// ─── Integration: knowledge.md written on init ────────────────────────────────

describe('generateClaudeCode — knowledge command written', () => {
    let dir: string;

    beforeAll(() => {
        dir = mkTmp();
        mkdirSync(join(dir, '.git'));
        const config = makeConfig('nodejs');
        config.projectDir = dir;
        generateClaudeCode(config);
    });

    afterAll(() => {
        rmSync(dir, { recursive: true, force: true });
    });

    test('writes .claude/commands/knowledge.md', () => {
        expect(existsSync(join(dir, '.claude', 'commands', 'knowledge.md'))).toBe(true);
    });

    test('knowledge.md contains /knowledge heading', () => {
        const content = readFileSync(join(dir, '.claude', 'commands', 'knowledge.md'), 'utf-8');
        expect(content).toContain('# /knowledge');
    });

    test('knowledge.md is read-only command', () => {
        const content = readFileSync(join(dir, '.claude', 'commands', 'knowledge.md'), 'utf-8');
        expect(content).toContain('Read-Only');
    });

    test('knowledge.md written alongside tech-knowledge.md and product-knowledge.md', () => {
        expect(existsSync(join(dir, '.claude', 'commands', 'tech-knowledge.md'))).toBe(true);
        expect(existsSync(join(dir, '.claude', 'commands', 'product-knowledge.md'))).toBe(true);
        expect(existsSync(join(dir, '.claude', 'commands', 'knowledge.md'))).toBe(true);
    });
});

// ─── Integration: fix and hotfix inject silent capture ───────────────────────

describe('fix and hotfix commands contain silent capture', () => {
    test('/fix command output contains silent capture section', async () => {
        const { generateFixCommand } = await import('../src/agents/claude-code/commands/fix.js');
        const config = makeConfig('nodejs');
        const output = generateFixCommand(config);
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
        expect(output).toContain('After Fix Applied');
    });

    test('/hotfix command output contains silent capture section', async () => {
        const { generateHotfixCommand } = await import('../src/agents/claude-code/commands/hotfix.js');
        const config = makeConfig('nodejs');
        const output = generateHotfixCommand(config);
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
        expect(output).toContain('After Fix Applied');
    });

    test('/hotfix command output contains knowledge preamble', async () => {
        const { generateHotfixCommand } = await import('../src/agents/claude-code/commands/hotfix.js');
        const config = makeConfig('nodejs');
        const output = generateHotfixCommand(config);
        expect(output).toContain('KNOWLEDGE CONTEXT');
    });

    test('/edit-feature command output contains silent capture section', async () => {
        const { generateEditFeatureCommand } = await import('../src/agents/claude-code/commands/edit-feature.js');
        const config = makeConfig('nodejs');
        const output = generateEditFeatureCommand(config);
        expect(output).toContain('SILENT KNOWLEDGE CAPTURE');
        expect(output).toContain('Gate 1');
    });
});

// ─── v19.1 hardening — normalizeSlug ─────────────────────────────────────────

describe('normalizeSlug (v19.1)', () => {
    test('lowercases input', () => {
        expect(normalizeSlug('AUTH')).toBe('auth');
    });
    test('converts spaces to hyphens', () => {
        expect(normalizeSlug('user auth')).toBe('user-auth');
    });
    test('collapses consecutive separators', () => {
        expect(normalizeSlug('a--b__c')).toBe('a-b-c');
    });
    test('trims leading and trailing hyphens', () => {
        expect(normalizeSlug('-auth-')).toBe('auth');
    });
    test('strips non-alphanumeric except hyphens', () => {
        expect(normalizeSlug('pay!ments?')).toBe('pay-ments');
    });
    test('empty string returns empty', () => {
        expect(normalizeSlug('')).toBe('');
    });
    test('whitespace-only returns empty', () => {
        expect(normalizeSlug('   ')).toBe('');
    });
    test('preserves digits', () => {
        expect(normalizeSlug('v2-state')).toBe('v2-state');
    });
    test('caps at 40 chars', () => {
        const long = 'a'.repeat(60);
        expect(normalizeSlug(long).length).toBeLessThanOrEqual(40);
    });
    test('combined: trim, lowercase, hyphenate, strip', () => {
        expect(normalizeSlug('  User AUTH!!  ')).toBe('user-auth');
    });
});

// ─── v19.1 hardening — knowledge-html-template ───────────────────────────────

describe('KNOWLEDGE_HTML_CSS (v19.1)', () => {
    test('contains body styling', () => {
        expect(KNOWLEDGE_HTML_CSS).toContain('body {');
    });
    test('contains tag-confirmed class', () => {
        expect(KNOWLEDGE_HTML_CSS).toContain('.tag-confirmed');
    });
    test('contains tag-inferred class', () => {
        expect(KNOWLEDGE_HTML_CSS).toContain('.tag-inferred');
    });
    test('contains mermaid class', () => {
        expect(KNOWLEDGE_HTML_CSS).toContain('.mermaid');
    });
    test('contains drift class for confirmed-entry warnings', () => {
        expect(KNOWLEDGE_HTML_CSS).toContain('.drift');
    });
});

describe('wrapKnowledgePage (v19.1)', () => {
    const out = wrapKnowledgePage({
        title: 'Tech Knowledge — auth',
        stackDisplay: 'Node.js',
        bodyHtml: '<h2>Layer Map</h2>',
        generatedByCommand: '/tech-knowledge',
    });
    test('renders DOCTYPE', () => {
        expect(out).toContain('<!DOCTYPE html>');
    });
    test('injects title', () => {
        expect(out).toContain('Tech Knowledge — auth');
    });
    test('injects stackDisplay', () => {
        expect(out).toContain('Node.js');
    });
    test('injects bodyHtml', () => {
        expect(out).toContain('<h2>Layer Map</h2>');
    });
    test('mentions internet requirement for Mermaid', () => {
        expect(out).toContain('requires internet');
    });
    test('loads Mermaid from CDN', () => {
        expect(out).toContain('cdn.jsdelivr.net');
    });
    test('initializes Mermaid on load', () => {
        expect(out).toContain('mermaid.initialize');
    });
    test('embeds shared CSS', () => {
        expect(out).toContain(KNOWLEDGE_HTML_CSS);
    });
    test('renders footer with generatedByCommand', () => {
        expect(out).toContain('/tech-knowledge');
        expect(out).toContain('<footer>');
    });
});

// ─── v19.1 hardening — pre-commit guard ──────────────────────────────────────

describe('generateKnowledgeConfirmedCheck (v19.1)', () => {
    const script = generateKnowledgeConfirmedCheck();
    test('shebang present', () => {
        expect(script.startsWith('#!/usr/bin/env bash')).toBe(true);
    });
    test('reads staged files from stdin', () => {
        expect(script).toContain('STAGED_FILES=$(cat)');
    });
    test('filters knowledge/*.md', () => {
        expect(script).toMatch(/knowledge\/.*\\\.md/);
    });
    test('allows new files via git cat-file existence probe', () => {
        expect(script).toContain('git cat-file -e "HEAD:$file"');
    });
    test('supports AI_GOV_KNOWLEDGE_OVERRIDE env-var bypass', () => {
        expect(script).toContain('AI_GOV_KNOWLEDGE_OVERRIDE');
    });
    test('env-var bypass accepts 1, true, TRUE, True', () => {
        expect(script).toMatch(/1\|true\|TRUE\|True/);
    });
    test('extracts [CONFIRMED] lines from HEAD', () => {
        expect(script).toContain("git show \"HEAD:$file\"");
        expect(script).toContain('[CONFIRMED]');
    });
    test('extracts [CONFIRMED] lines from staged version', () => {
        expect(script).toContain("git show \":$file\"");
    });
    test('emits blocking error message on removal', () => {
        expect(script).toContain('Knowledge guard');
        expect(script).toContain('removed');
    });
    test('points users to the env-var bypass in the error message', () => {
        expect(script).toContain("AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit");
    });
});

// ─── v19.1 hardening — /fix DO-NOT-CAPTURE blocklist ─────────────────────────

describe('generateSilentCaptureInstructionFix DO-NOT-CAPTURE (v19.1)', () => {
    const out = generateSilentCaptureInstructionFix();
    test('contains DO NOT CAPTURE heading', () => {
        expect(out).toContain('DO NOT CAPTURE');
    });
    test('lists null/undefined check', () => {
        expect(out).toMatch(/null\/undefined/);
    });
    test('lists off-by-one', () => {
        expect(out).toContain('off-by-one');
    });
    test('lists typo', () => {
        expect(out).toContain('typo');
    });
    test('lists missing await', () => {
        expect(out).toContain('missing await');
    });
    test('lists test-only change', () => {
        expect(out).toContain('test-only');
    });
    test('lists lint cleanup', () => {
        expect(out).toContain('lint cleanup');
    });
    test('lists dependency upgrade', () => {
        expect(out).toContain('dependency upgrade');
    });
    test('default is no business rules extracted', () => {
        expect(out).toContain('no business rules extracted');
    });
});

// ─── v19.1 hardening — mechanical drift detection ────────────────────────────

describe('mechanical drift detection (v19.1)', () => {
    const config = makeConfig('nodejs');
    test('tech-knowledge prompt instructs `git diff --stat`', () => {
        const out = generateTechKnowledgeCommand(config);
        expect(out).toContain('git diff --stat');
    });
    test('tech-knowledge references [OLD_HASH] for diff base', () => {
        const out = generateTechKnowledgeCommand(config);
        expect(out).toContain('[OLD_HASH]');
    });
    test('tech-knowledge uses numeric thresholds (>10 files, >200 lines)', () => {
        const out = generateTechKnowledgeCommand(config);
        expect(out).toMatch(/>\s*10 files/);
        expect(out).toMatch(/>\s*200 lines/);
    });
    test('product-knowledge prompt instructs `git diff --stat`', () => {
        const out = generateProductKnowledgeCommand(config);
        expect(out).toContain('git diff --stat');
    });
    test('product-knowledge references [OLD_HASH]', () => {
        const out = generateProductKnowledgeCommand(config);
        expect(out).toContain('[OLD_HASH]');
    });
    test('knowledge-health-check uses `git diff --stat`', () => {
        const out = generateKnowledgeHealthCheck();
        expect(out).toContain('git diff --stat');
    });
    test('drift detection labels phrase is "significant drift likely"', () => {
        const out = generateTechKnowledgeCommand(config);
        expect(out).toContain('significant drift likely');
    });
});

// ─── v19.1 hardening — Mermaid wording honesty ───────────────────────────────

describe('Mermaid CDN wording (v19.1)', () => {
    const config = makeConfig('nodejs');
    test('tech-knowledge prompt says "requires internet"', () => {
        expect(generateTechKnowledgeCommand(config)).toContain('requires internet');
    });
    test('product-knowledge prompt says "requires internet"', () => {
        expect(generateProductKnowledgeCommand(config)).toContain('requires internet');
    });
    test('tech-knowledge no longer claims "self-contained HTML"', () => {
        expect(generateTechKnowledgeCommand(config)).not.toContain('self-contained HTML');
    });
    test('product-knowledge no longer claims "self-contained HTML"', () => {
        expect(generateProductKnowledgeCommand(config)).not.toContain('self-contained HTML');
    });
});

// ─── v19.1 hardening — shared CSS interpolation in command templates ─────────

describe('command templates reuse shared HTML CSS (v19.1)', () => {
    const config = makeConfig('nodejs');
    test('tech-knowledge command template embeds shared CSS', () => {
        const out = generateTechKnowledgeCommand(config);
        // Sample a known rule from the shared CSS — proves interpolation worked.
        expect(out).toContain('.tag-confirmed');
        expect(out).toContain('font-family: system-ui');
    });
    test('product-knowledge command template embeds shared CSS', () => {
        const out = generateProductKnowledgeCommand(config);
        expect(out).toContain('.tag-confirmed');
        expect(out).toContain('font-family: system-ui');
    });
    test('shared CSS appears once per command template (no inline duplication)', () => {
        const tech = generateTechKnowledgeCommand(config);
        const cssAnchorCount = tech.split('.tag-confirmed').length - 1;
        expect(cssAnchorCount).toBe(1);
    });
});

// ─── v19.1 hardening — pre-commit wiring ─────────────────────────────────────

describe('pre-commit knowledge-confirmed wiring (v19.1)', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-precommit-test-'));
    });

    afterEach(() => {
        rmSync(tmpDir, { recursive: true, force: true });
    });

    test('generateClaudeCode writes knowledge-confirmed.sh', async () => {
        const { generateGitHooks } = await import('../src/generators/git-hooks/index.js');
        const config = makeConfig('nodejs');
        config.projectDir = tmpDir;
        generateGitHooks(config, tmpDir);
        const checkPath = join(tmpDir, '.claude', 'git-hooks', 'checks', 'knowledge-confirmed.sh');
        expect(existsSync(checkPath)).toBe(true);
        const content = readFileSync(checkPath, 'utf-8');
        expect(content).toContain('Knowledge guard');
        expect(content).toContain('Knowledge-override:');
    });

    test('pre-commit.sh runs the knowledge-confirmed check', async () => {
        const { generatePreCommit } = await import('../src/generators/git-hooks/pre-commit.js');
        const out = generatePreCommit();
        expect(out).toContain('run_check "knowledge-confirmed"');
        expect(out).toContain('"block"');
    });
});

// ─── v20.1 — workspace Jira sync — version bump ──────────────────────────────

describe('version (v20.5)', () => {
    test('VERSION is 20.4.0', async () => {
        const { VERSION, HOOK_VERSION } = await import('../src/constants.js');
        expect(VERSION).toBe('20.5.1');
        expect(HOOK_VERSION).toBe('20.5.1');
    });
});
