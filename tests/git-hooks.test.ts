import { generatePreCommit } from '../src/generators/git-hooks/pre-commit.js';
import { generateCommitMsg } from '../src/generators/git-hooks/commit-msg.js';
import { generateFileSizeCheck } from '../src/generators/git-hooks/checks/file-size.js';
import { generateSecretsCheck } from '../src/generators/git-hooks/checks/secrets.js';
import { generateNoTodosCheck } from '../src/generators/git-hooks/checks/no-todos.js';
import { generateNoDebug } from '../src/generators/git-hooks/checks/no-debug.js';
import { generateGitHooksConfig } from '../src/generators/git-hooks/config.js';
import { detectExistingHookSystem } from '../src/commands/init-git-hooks.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { GovernanceConfig } from '../src/types.js';

function makeMinimalConfig(overrides: Partial<GovernanceConfig> = {}): GovernanceConfig {
    return {
        agent: 'claude-code',
        stack: 'react',
        profile: {
            stackDisplay: 'React',
            fileExt: '.tsx',
            layerFlow: 'UI → Logic → Data',
            layerNames: [],
            layerUI: 'ui',
            layerState: 'state',
            layerLogic: 'domain',
            layerAdapter: 'adapter',
            layerData: 'data',
            formatCmd: 'prettier --write .',
            formatCmdFull: '',
            analyzeCmd: 'eslint .',
            analyzeCmdFile: '',
            testCmd: 'jest',
            buildCmd: 'npm run build',
            installCmd: 'npm install',
            cleanCmd: '',
            runCmd: '',
            codegenCmd: '',
            sourceDir: 'src',
            featuresDir: 'src/features',
            manifestFile: 'package.json',
            diFramework: '',
            stateFramework: 'zustand',
            namingClasses: 'PascalCase',
            namingMethods: 'camelCase',
            namingFiles: 'kebab-case',
            namingConstants: 'UPPER_SNAKE',
            namingUISuffix: '',
            importStyle: 'named',
            statePattern: '',
            errorPattern: '',
            localStorageName: '',
            formatExtensions: '.ts,.tsx',
            analyzeFileLevel: false,
            pkgAddBlockPattern: '',
            rmBlockDirs: '',
            generatedExts: '',
            generatedPatterns: '',
            archSimple: false,
        },
        scan: {} as any,
        project: { packageName: 'test', appName: 'test', appDescription: '', ticketSystem: 'Jira', ticketPrefix: 'TICKET', legacyDescription: '' },
        blocks: {} as any,
        isBackend: false,
        hookVersion: '15.2.0',
        projectDir: '/tmp',
        specFirstEnabled: false,
        conflictMode: 'keep',
        overwrite: false,
        dryRun: false,
        updateHooks: false,
        ...overrides,
    };
}

describe('Git hook generators', () => {
    test('pre-commit skips merge commits', () => {
        const script = generatePreCommit();
        expect(script).toContain('[[ -f ".git/MERGE_HEAD" ]] && exit 0');
    });

    test('pre-commit skips rebase', () => {
        const script = generatePreCommit();
        expect(script).toContain('[[ -d ".git/rebase-merge" || -d ".git/rebase-apply" ]] && exit 0');
    });

    test('file-size respects frontend-only config', () => {
        const script = generateFileSizeCheck();
        expect(script).toContain('FRONTEND_ONLY');
        expect(script).toContain('.dart');
        expect(script).toContain('.tsx');
    });

    test('secrets skips test directories', () => {
        const script = generateSecretsCheck();
        expect(script).toContain('SKIP_DIRS');
        expect(script).toContain('__tests__');
        expect(script).toContain('fixtures');
    });

    test('secrets allows nosecret comment', () => {
        const script = generateSecretsCheck();
        expect(script).toContain('nosecret');
        expect(script).toContain('ai-gov:ignore');
    });

    test('no-todos allows ticket references', () => {
        const script = generateNoTodosCheck();
        expect(script).toContain('allow-with-ticket');
        expect(script).toContain('TICKET_PAT');
    });

    test('commit-msg validates conventional format', () => {
        const script = generateCommitMsg();
        expect(script).toContain('conventional-commits');
        expect(script).toContain('"feat"');
        expect(script).toContain('"fix"');
        expect(script).toContain('"refactor"');
        expect(script).toContain('join("|")');
    });

    test('commit-msg skips merge commits', () => {
        const script = generateCommitMsg();
        expect(script).toContain("grep -qE '^Merge ' && exit 0");
    });

    test('config.json defaults are correct', () => {
        const configJson = generateGitHooksConfig();
        const config = JSON.parse(configJson);
        // Only file-size, secrets, no-todos, no-debug are enabled by default
        expect(config['pre-commit']['file-size'].enabled).toBe(true);
        expect(config['pre-commit']['secrets'].enabled).toBe(true);
        expect(config['pre-commit']['no-todos'].enabled).toBe(true);
        expect(config['pre-commit']['no-debug'].enabled).toBe(true);
        // format and lint are off by default
        expect(config['pre-commit']['format-check'].enabled).toBe(false);
        expect(config['pre-commit']['lint-check'].enabled).toBe(false);
        // commit-msg conventional commits on
        expect(config['commit-msg']['conventional-commits']).toBe(true);
        expect(config['pre-commit']['file-size']['max-lines']).toBe(300);
    });

    test('existing hook detection finds husky', () => {
        const tmpDir = join(tmpdir(), `ai-gov-test-${Date.now()}`);
        mkdirSync(tmpDir, { recursive: true });
        mkdirSync(join(tmpDir, '.husky'), { recursive: true });

        const result = detectExistingHookSystem(tmpDir);
        expect(result).toBe('husky');

        rmSync(tmpDir, { recursive: true, force: true });
    });
});
