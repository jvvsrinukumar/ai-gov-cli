/**
 * Jira sync tests: task-estimates generator, /jira command, Kiro workflow hook,
 * shared prompt consistency, and property-based structural invariants.
 */
import * as fc from 'fast-check';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { loadBaseProfile } from '../src/profiles.js';
import { createDefaultScanResult } from '../src/types.js';
import { computeContentBlocks } from '../src/content-blocks.js';
import type { GovernanceConfig, ScanResult, Stack } from '../src/types.js';

import { generateTaskEstimates } from '../src/generators/task-estimates.js';
import { buildJiraSyncPrompt } from '../src/generators/jira-sync-prompt.js';
import { generateJiraCommand } from '../src/agents/claude-code/commands/jira.js';
import { generateWorkflowJiraSync } from '../src/agents/kiro/hooks/workflow-jira-sync.js';
import { generateClaudeCode } from '../src/agents/claude-code/index.js';
import { generateKiro } from '../src/agents/kiro/index.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_STACKS: Stack[] = ['flutter', 'kotlin', 'nodejs', 'react', 'next', 'angular', 'swiftui', 'python', 'java'];

const DEFAULT_PROJECT = {
    packageName: 'test-app', appName: 'test-app', appDescription: '',
    ticketSystem: 'Jira', ticketPrefix: 'TEST', legacyDescription: 'No legacy code',
};

function makeConfig(stack: Stack = 'nodejs', agent: 'claude-code' | 'kiro' = 'claude-code'): GovernanceConfig {
    const profile = loadBaseProfile(stack);
    const scan: ScanResult = { ...createDefaultScanResult() };
    const blocks = computeContentBlocks(stack, profile, scan);
    return {
        agent, stack, profile, scan, project: DEFAULT_PROJECT, blocks,
        isBackend: stack === 'nodejs' || stack === 'python' || stack === 'java',
        hookVersion: '18.0.0', projectDir: '/tmp/test',
        specFirstEnabled: false, conflictMode: 'keep',
        overwrite: false, dryRun: false, updateHooks: false,
    };
}

function makeTmpDir(): string {
    return mkdtempSync(join(tmpdir(), 'ai-gov-jira-test-'));
}

// ─── generateTaskEstimates ────────────────────────────────────────────────────

describe('generateTaskEstimates', () => {
    test('returns non-empty string longer than 500 chars', () => {
        const content = generateTaskEstimates(makeConfig('nodejs'));
        expect(content.length).toBeGreaterThan(500);
    });

    test('contains bracket format notation [~', () => {
        const content = generateTaskEstimates(makeConfig('nodejs'));
        expect(content).toContain('[~');
    });

    test('contains size markers [S], [M], [L]', () => {
        const content = generateTaskEstimates(makeConfig('nodejs'));
        expect(content).toContain('[S]');
        expect(content).toContain('[M]');
        expect(content).toContain('[L]');
    });

    test('does not contain template placeholder patterns', () => {
        const content = generateTaskEstimates(makeConfig('nodejs'));
        expect(content).not.toMatch(/_replace_|TODO:|FIXME:|XXX:|{{/);
    });
});

// ─── generateJiraCommand ─────────────────────────────────────────────────────

describe('generateJiraCommand', () => {
    test('first line is exactly "# /jira"', () => {
        const content = generateJiraCommand(makeConfig());
        expect(content.split('\n')[0]).toBe('# /jira');
    });

    test('contains buildJiraSyncPrompt output verbatim', () => {
        const config = makeConfig();
        const prompt = buildJiraSyncPrompt(config);
        const command = generateJiraCommand(config);
        expect(command).toContain(prompt);
    });

    test('contains required substrings: jira_get, .jira, storyId, subtasks, [~', () => {
        const content = generateJiraCommand(makeConfig());
        expect(content).toContain('jira_get');
        expect(content).toContain('.jira');
        expect(content).toContain('storyId');
        expect(content).toContain('subtasks');
        expect(content).toContain('[~');
    });

    test('does not contain Kiro-specific JSON artifacts', () => {
        const content = generateJiraCommand(makeConfig());
        expect(content).not.toContain('"when":');
        expect(content).not.toContain('"userTriggered"');
    });
});

// ─── generateWorkflowJiraSync ─────────────────────────────────────────────────

describe('generateWorkflowJiraSync', () => {
    test('output is valid JSON', () => {
        const output = generateWorkflowJiraSync(makeConfig('nodejs', 'kiro'));
        expect(() => JSON.parse(output)).not.toThrow();
    });

    test('name is "Jira Sync"', () => {
        const hook = JSON.parse(generateWorkflowJiraSync(makeConfig('nodejs', 'kiro')));
        expect(hook.name).toBe('Jira Sync');
    });

    test('when.type is "userTriggered"', () => {
        const hook = JSON.parse(generateWorkflowJiraSync(makeConfig('nodejs', 'kiro')));
        expect(hook.when.type).toBe('userTriggered');
    });

    test('then.type is "askAgent"', () => {
        const hook = JSON.parse(generateWorkflowJiraSync(makeConfig('nodejs', 'kiro')));
        expect(hook.then.type).toBe('askAgent');
    });

    test('version equals config.hookVersion', () => {
        const config = makeConfig('nodejs', 'kiro');
        const hook = JSON.parse(generateWorkflowJiraSync(config));
        expect(hook.version).toBe(config.hookVersion);
    });

    test('then.prompt contains required substrings', () => {
        const hook = JSON.parse(generateWorkflowJiraSync(makeConfig('nodejs', 'kiro')));
        expect(hook.then.prompt).toContain('jira_get');
        expect(hook.then.prompt).toContain('.jira');
        expect(hook.then.prompt).toContain('storyId');
        expect(hook.then.prompt).toContain('[~');
    });
});

// ─── Shared prompt consistency ────────────────────────────────────────────────

describe('Prompt consistency across agents', () => {
    test('buildJiraSyncPrompt appears verbatim in generateJiraCommand', () => {
        const config = makeConfig('react');
        expect(generateJiraCommand(config)).toContain(buildJiraSyncPrompt(config));
    });

    test('buildJiraSyncPrompt appears verbatim in then.prompt of generateWorkflowJiraSync', () => {
        const config = makeConfig('react', 'kiro');
        const hook = JSON.parse(generateWorkflowJiraSync(config));
        expect(hook.then.prompt).toContain(buildJiraSyncPrompt(config));
    });

    test('key phrases appear in all three outputs', () => {
        const config = makeConfig('flutter');
        const prompt = buildJiraSyncPrompt(config);
        const command = generateJiraCommand(config);
        const hookPrompt = JSON.parse(generateWorkflowJiraSync(makeConfig('flutter', 'kiro'))).then.prompt;

        const phrases = ['jira_get', '.jira', 'storyId', 'subtasks'];
        for (const phrase of phrases) {
            expect(prompt).toContain(phrase);
            expect(command).toContain(phrase);
            expect(hookPrompt).toContain(phrase);
        }
    });
});

// ─── Integration: file generation ─────────────────────────────────────────────

describe('Integration: Claude Code file generation', () => {
    test('generates jira.md and task-estimates.md on init', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ai-gov-cc-jira-'));
        try {
            const config: GovernanceConfig = {
                ...makeConfig('nodejs', 'claude-code'),
                projectDir: dir,
                overwrite: true,
                dryRun: false,
            };
            generateClaudeCode(config);
            expect(existsSync(join(dir, '.claude', 'commands', 'jira.md'))).toBe(true);
            expect(existsSync(join(dir, '.claude', 'steering', 'task-estimates.md'))).toBe(true);

            const jiraContent = readFileSync(join(dir, '.claude', 'commands', 'jira.md'), 'utf-8');
            expect(jiraContent.startsWith('# /jira')).toBe(true);

            const estimatesContent = readFileSync(join(dir, '.claude', 'steering', 'task-estimates.md'), 'utf-8');
            expect(estimatesContent).toContain('[~');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('Integration: Kiro file generation', () => {
    test('generates workflow-jira-sync.kiro.hook and task-estimates.md on init', () => {
        const dir = mkdtempSync(join(tmpdir(), 'ai-gov-kiro-jira-'));
        try {
            const config: GovernanceConfig = {
                ...makeConfig('nodejs', 'kiro'),
                projectDir: dir,
                overwrite: true,
                dryRun: false,
            };
            generateKiro(config);
            expect(existsSync(join(dir, '.kiro', 'hooks', 'workflow-jira-sync.kiro.hook'))).toBe(true);
            expect(existsSync(join(dir, '.kiro', 'steering', 'task-estimates.md'))).toBe(true);

            const hookContent = readFileSync(join(dir, '.kiro', 'hooks', 'workflow-jira-sync.kiro.hook'), 'utf-8');
            const hook = JSON.parse(hookContent);
            expect(hook.when.type).toBe('userTriggered');
            expect(hook.then.type).toBe('askAgent');

            const estimatesContent = readFileSync(join(dir, '.kiro', 'steering', 'task-estimates.md'), 'utf-8');
            expect(estimatesContent).toContain('---'); // Kiro front-matter
            expect(estimatesContent).toContain('[~');
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

// ─── Property-based tests ─────────────────────────────────────────────────────

describe('Property P6: generateTaskEstimates structural invariants', () => {
    // [P6] For any valid GovernanceConfig, output has required structural elements
    test('all stacks produce structurally valid task-estimates content', () => {
        fc.assert(fc.property(
            fc.constantFrom(...ALL_STACKS),
            (stack) => {
                const content = generateTaskEstimates(makeConfig(stack));
                expect(content.length).toBeGreaterThan(500);
                expect(content).toContain('[~');
                expect(content).toContain('[S]');
                expect(content).toContain('[M]');
                expect(content).toContain('[L]');
                expect(content).not.toMatch(/_replace_|TODO:|FIXME:|XXX:|{{/);
                return true;
            }
        ), { numRuns: ALL_STACKS.length });
    });
});

describe('Property P7: generateWorkflowJiraSync valid structure', () => {
    // [P7] For any valid GovernanceConfig, output is valid JSON with correct structure
    test('all stacks produce valid hook JSON', () => {
        fc.assert(fc.property(
            fc.constantFrom(...ALL_STACKS),
            (stack) => {
                const config = makeConfig(stack, 'kiro');
                const output = generateWorkflowJiraSync(config);
                const hook = JSON.parse(output);
                expect(hook.name).toBe('Jira Sync');
                expect(hook.when.type).toBe('userTriggered');
                expect(hook.then.type).toBe('askAgent');
                expect(hook.version).toBe(config.hookVersion);
                expect(hook.then.prompt).toContain('jira_get');
                expect(hook.then.prompt).toContain('.jira');
                expect(hook.then.prompt).toContain('storyId');
                expect(hook.then.prompt).toContain('[~');
                return true;
            }
        ), { numRuns: ALL_STACKS.length });
    });
});

describe('Property P8: prompt consistency across agents', () => {
    // [P8] buildJiraSyncPrompt is substring of both command and hook prompt for any config
    test('prompt consistency holds for all stacks', () => {
        fc.assert(fc.property(
            fc.constantFrom(...ALL_STACKS),
            (stack) => {
                const ccConfig = makeConfig(stack, 'claude-code');
                const kiroConfig = makeConfig(stack, 'kiro');
                const prompt = buildJiraSyncPrompt(ccConfig);
                expect(generateJiraCommand(ccConfig)).toContain(prompt);
                const hook = JSON.parse(generateWorkflowJiraSync(kiroConfig));
                expect(hook.then.prompt).toContain(buildJiraSyncPrompt(kiroConfig));
                return true;
            }
        ), { numRuns: ALL_STACKS.length });
    });
});

describe('Property P9: generateJiraCommand is stack-agnostic', () => {
    // [P9] Two configs differing only in stack produce identical /jira command
    test('output is identical regardless of stack', () => {
        fc.assert(fc.property(
            fc.constantFrom(...ALL_STACKS),
            fc.constantFrom(...ALL_STACKS),
            (stack1, stack2) => {
                const out1 = generateJiraCommand(makeConfig(stack1));
                const out2 = generateJiraCommand(makeConfig(stack2));
                expect(out1).toBe(out2);
                return true;
            }
        ), { numRuns: 50 });
    });
});
