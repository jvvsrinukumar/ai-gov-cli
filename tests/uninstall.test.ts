/**
 * Tests for ai-gov uninstall command.
 * Covers: git-hook wrapper removal, CI file removal, GitLab surgical strip,
 * dry-run safety, and skipping hooks/files that aren't ai-gov managed.
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runUninstall, stripGitlabGovernanceJob } from '../src/commands/uninstall.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(label: string): string {
    const dir = join(tmpdir(), `ai-gov-uninstall-${label}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    return dir;
}

const AI_GOV_PRE_COMMIT = `#!/usr/bin/env bash
# Installed by ai-gov — calls .claude/git-hooks/pre-commit.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/.claude/git-hooks/pre-commit.sh" "$@"
`;

const AI_GOV_COMMIT_MSG = `#!/usr/bin/env bash
# Installed by ai-gov — calls .claude/git-hooks/commit-msg.sh
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$REPO_ROOT/.claude/git-hooks/commit-msg.sh" "$1"
`;

const CUSTOM_PRE_COMMIT = `#!/bin/bash
# Custom team hook — managed by husky
npm run lint
`;

const GITHUB_CI = `name: Governance Check
on:
  pull_request:
jobs:
  governance:
    runs-on: ubuntu-latest
    steps:
      - run: ai-gov pr-check
`;

const BITBUCKET_CI = `pipelines:
  pull-requests:
    '**':
      - step:
          name: Governance Check
          script:
            - npm install -g ai-gov
            - ai-gov pr-check
`;

const GITLAB_ONLY_GOVERNANCE = `stages:
  - test

governance-check:
  stage: test
  image: node:20
  before_script:
    - npm install -g ai-gov
  script:
    - ai-gov pr-check --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

const GITLAB_WITH_EXTRA_JOB = `stages:
  - test

my-job:
  stage: test
  script: echo hi

governance-check:
  stage: test
  image: node:20
  before_script:
    - npm install -g ai-gov
  script:
    - ai-gov pr-check --format gitlab
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
`;

function makeGitHooksDir(dir: string): string {
    const hooksDir = join(dir, '.git', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    return hooksDir;
}

// ---------------------------------------------------------------------------
// Suite: git-hook wrapper removal
// ---------------------------------------------------------------------------

describe('uninstall --git-hooks', () => {
    test('removes pre-commit and commit-msg when they are ai-gov wrappers', () => {
        const dir = makeTmpDir('hooks-remove');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), AI_GOV_PRE_COMMIT);
        writeFileSync(join(hooksDir, 'commit-msg'), AI_GOV_COMMIT_MSG);

        runUninstall({ projectDir: dir, gitHooks: true, dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(false);
        expect(existsSync(join(hooksDir, 'commit-msg'))).toBe(false);
    });

    test('skips pre-commit that is not an ai-gov wrapper', () => {
        const dir = makeTmpDir('hooks-skip');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), CUSTOM_PRE_COMMIT);

        runUninstall({ projectDir: dir, gitHooks: true, dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
        expect(readFileSync(join(hooksDir, 'pre-commit'), 'utf-8')).toBe(CUSTOM_PRE_COMMIT);
    });

    test('skips missing hooks without throwing', () => {
        const dir = makeTmpDir('hooks-missing');
        makeGitHooksDir(dir); // empty dir

        expect(() =>
            runUninstall({ projectDir: dir, gitHooks: true, dryRun: false, agent: 'claude-code' })
        ).not.toThrow();
    });

    test('dry-run leaves ai-gov hooks intact', () => {
        const dir = makeTmpDir('hooks-dryrun');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), AI_GOV_PRE_COMMIT);
        writeFileSync(join(hooksDir, 'commit-msg'), AI_GOV_COMMIT_MSG);

        runUninstall({ projectDir: dir, gitHooks: true, dryRun: true, agent: 'claude-code' });

        expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
        expect(existsSync(join(hooksDir, 'commit-msg'))).toBe(true);
    });

    test('kiro agent advisory mentions .kiro/git-hooks/', () => {
        const dir = makeTmpDir('hooks-kiro');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), AI_GOV_PRE_COMMIT);

        const output: string[] = [];
        const origLog = console.log;
        console.log = (...args: unknown[]) => output.push(args.join(' '));
        runUninstall({ projectDir: dir, gitHooks: true, dryRun: false, agent: 'kiro' });
        console.log = origLog;

        expect(output.some(l => l.includes('.kiro/git-hooks/'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Suite: CI file removal
// ---------------------------------------------------------------------------

describe('uninstall --ci github', () => {
    test('removes governance-check.yml', () => {
        const dir = makeTmpDir('ci-github');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, ci: 'github', dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(false);
    });

    test('dry-run leaves governance-check.yml intact', () => {
        const dir = makeTmpDir('ci-github-dry');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, ci: 'github', dryRun: true, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(true);
    });

    test('warns and continues when file does not exist', () => {
        const dir = makeTmpDir('ci-github-missing');
        expect(() =>
            runUninstall({ projectDir: dir, ci: 'github', dryRun: false, agent: 'claude-code' })
        ).not.toThrow();
    });

    test('preserves other workflow files in the same directory', () => {
        const dir = makeTmpDir('ci-github-preserve');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);
        writeFileSync(join(workflowDir, 'ci.yml'), 'name: CI\non: push\n');

        runUninstall({ projectDir: dir, ci: 'github', dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(false);
        expect(existsSync(join(workflowDir, 'ci.yml'))).toBe(true);
    });
});

describe('uninstall --ci bitbucket', () => {
    test('removes bitbucket-pipelines.yml', () => {
        const dir = makeTmpDir('ci-bb');
        writeFileSync(join(dir, 'bitbucket-pipelines.yml'), BITBUCKET_CI);

        runUninstall({ projectDir: dir, ci: 'bitbucket', dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(dir, 'bitbucket-pipelines.yml'))).toBe(false);
    });

    test('dry-run leaves bitbucket-pipelines.yml intact', () => {
        const dir = makeTmpDir('ci-bb-dry');
        writeFileSync(join(dir, 'bitbucket-pipelines.yml'), BITBUCKET_CI);

        runUninstall({ projectDir: dir, ci: 'bitbucket', dryRun: true, agent: 'claude-code' });

        expect(existsSync(join(dir, 'bitbucket-pipelines.yml'))).toBe(true);
    });
});

describe('uninstall --ci gitlab', () => {
    test('removes entire .gitlab-ci.yml when it only contains the governance job', () => {
        const dir = makeTmpDir('ci-gl-only');
        writeFileSync(join(dir, '.gitlab-ci.yml'), GITLAB_ONLY_GOVERNANCE);

        runUninstall({ projectDir: dir, ci: 'gitlab', dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(dir, '.gitlab-ci.yml'))).toBe(false);
    });

    test('strips governance-check job but leaves other jobs intact', () => {
        const dir = makeTmpDir('ci-gl-partial');
        writeFileSync(join(dir, '.gitlab-ci.yml'), GITLAB_WITH_EXTRA_JOB);

        runUninstall({ projectDir: dir, ci: 'gitlab', dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(dir, '.gitlab-ci.yml'))).toBe(true);
        const content = readFileSync(join(dir, '.gitlab-ci.yml'), 'utf-8');
        expect(content).not.toContain('governance-check:');
        expect(content).toContain('my-job:');
    });

    test('dry-run leaves .gitlab-ci.yml unchanged', () => {
        const dir = makeTmpDir('ci-gl-dry');
        writeFileSync(join(dir, '.gitlab-ci.yml'), GITLAB_WITH_EXTRA_JOB);

        runUninstall({ projectDir: dir, ci: 'gitlab', dryRun: true, agent: 'claude-code' });

        const content = readFileSync(join(dir, '.gitlab-ci.yml'), 'utf-8');
        expect(content).toBe(GITLAB_WITH_EXTRA_JOB);
    });

    test('skips .gitlab-ci.yml with no governance-check job', () => {
        const dir = makeTmpDir('ci-gl-skip');
        const noGovContent = 'stages:\n  - test\n\nmy-job:\n  stage: test\n  script: echo hi\n';
        writeFileSync(join(dir, '.gitlab-ci.yml'), noGovContent);

        runUninstall({ projectDir: dir, ci: 'gitlab', dryRun: false, agent: 'claude-code' });

        expect(readFileSync(join(dir, '.gitlab-ci.yml'), 'utf-8')).toBe(noGovContent);
    });
});

describe('uninstall --ci auto-detect', () => {
    test('removes all detected CI files', () => {
        const dir = makeTmpDir('ci-auto');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);
        writeFileSync(join(dir, 'bitbucket-pipelines.yml'), BITBUCKET_CI);

        // --ci with no platform (true = auto)
        runUninstall({ projectDir: dir, ci: true, dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(false);
        expect(existsSync(join(dir, 'bitbucket-pipelines.yml'))).toBe(false);
    });

    test('no-ops cleanly when no CI files present', () => {
        const dir = makeTmpDir('ci-auto-empty');
        expect(() =>
            runUninstall({ projectDir: dir, ci: true, dryRun: false, agent: 'claude-code' })
        ).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Suite: pr-check removal (auto-detects platform)
// ---------------------------------------------------------------------------

describe('uninstall --pr-check', () => {
    test('removes GitHub CI when governance-check.yml is present', () => {
        const dir = makeTmpDir('pr-github');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, prCheck: true, dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(false);
    });

    test('surgically removes governance-check job from GitLab, leaving other jobs', () => {
        const dir = makeTmpDir('pr-gitlab');
        writeFileSync(join(dir, '.gitlab-ci.yml'), GITLAB_WITH_EXTRA_JOB);

        runUninstall({ projectDir: dir, prCheck: true, dryRun: false, agent: 'claude-code' });

        const content = readFileSync(join(dir, '.gitlab-ci.yml'), 'utf-8');
        expect(content).not.toContain('governance-check:');
        expect(content).toContain('my-job:');
    });

    test('no-ops cleanly when no CI files detected', () => {
        const dir = makeTmpDir('pr-empty');
        expect(() =>
            runUninstall({ projectDir: dir, prCheck: true, dryRun: false, agent: 'claude-code' })
        ).not.toThrow();
    });

    test('dry-run leaves CI files intact', () => {
        const dir = makeTmpDir('pr-dry');
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, prCheck: true, dryRun: true, agent: 'claude-code' });

        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Suite: --all shorthand
// ---------------------------------------------------------------------------

describe('uninstall --all', () => {
    test('removes git-hook wrappers and all CI files', () => {
        const dir = makeTmpDir('all');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), AI_GOV_PRE_COMMIT);
        writeFileSync(join(hooksDir, 'commit-msg'), AI_GOV_COMMIT_MSG);
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, all: true, dryRun: false, agent: 'claude-code' });

        expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(false);
        expect(existsSync(join(hooksDir, 'commit-msg'))).toBe(false);
        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(false);
    });

    test('dry-run --all leaves everything intact', () => {
        const dir = makeTmpDir('all-dry');
        const hooksDir = makeGitHooksDir(dir);
        writeFileSync(join(hooksDir, 'pre-commit'), AI_GOV_PRE_COMMIT);
        const workflowDir = join(dir, '.github', 'workflows');
        mkdirSync(workflowDir, { recursive: true });
        writeFileSync(join(workflowDir, 'governance-check.yml'), GITHUB_CI);

        runUninstall({ projectDir: dir, all: true, dryRun: true, agent: 'claude-code' });

        expect(existsSync(join(hooksDir, 'pre-commit'))).toBe(true);
        expect(existsSync(join(workflowDir, 'governance-check.yml'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Suite: stripGitlabGovernanceJob unit tests
// ---------------------------------------------------------------------------

describe('stripGitlabGovernanceJob', () => {
    test('removes governance-check block when it is the last job', () => {
        const result = stripGitlabGovernanceJob(GITLAB_ONLY_GOVERNANCE);
        expect(result).not.toContain('governance-check:');
        expect(result.trim()).toBe('stages:\n  - test');
    });

    test('removes governance-check block and preserves preceding jobs', () => {
        const result = stripGitlabGovernanceJob(GITLAB_WITH_EXTRA_JOB);
        expect(result).not.toContain('governance-check:');
        expect(result).toContain('my-job:');
        expect(result).toContain('stage: test');
        expect(result).toContain('echo hi');
    });

    test('does not collapse more than two consecutive blank lines', () => {
        const result = stripGitlabGovernanceJob(GITLAB_WITH_EXTRA_JOB);
        expect(result).not.toMatch(/\n{3,}/);
    });

    test('ends with a single newline', () => {
        const result = stripGitlabGovernanceJob(GITLAB_WITH_EXTRA_JOB);
        expect(result.endsWith('\n')).toBe(true);
        expect(result.endsWith('\n\n')).toBe(false);
    });

    test('returns empty string when content has only the governance job', () => {
        const minimal = '\ngovernance-check:\n  stage: test\n  script: ai-gov pr-check\n';
        const result = stripGitlabGovernanceJob(minimal);
        expect(result.trim()).toBe('');
    });

    test('is idempotent — stripping twice does not corrupt content', () => {
        const once = stripGitlabGovernanceJob(GITLAB_WITH_EXTRA_JOB);
        const twice = stripGitlabGovernanceJob(once);
        expect(once).toBe(twice);
    });
});
