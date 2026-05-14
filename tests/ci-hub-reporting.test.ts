/**
 * CI Template Hub Reporting Tests
 *
 * Tests that GitHub, GitLab, and Bitbucket CI template generators
 * correctly include/omit hub reporting steps based on hubUrl parameter,
 * and that developer_hash computation uses the correct platform-specific actor.
 *
 * Validates: Requirements 10.3, 10.5
 */
import { generateGithubCI } from '../src/generators/ci/github.js';
import { generateGitlabCI } from '../src/generators/ci/gitlab.js';
import { generateBitbucketCI } from '../src/generators/ci/bitbucket.js';

// ─── GitHub Actions ───────────────────────────────────────────────────────────

describe('generateGithubCI — hub reporting', () => {
    const hubUrl = 'https://hub.example.com';

    test('includes hub reporting step when hubUrl is provided', () => {
        const output = generateGithubCI({ hubUrl });
        expect(output).toContain('Report to Governance Hub');
        expect(output).toContain('/api/pr-reports');
        expect(output).toContain(hubUrl);
    });

    test('omits hub reporting step when hubUrl is not provided', () => {
        const output = generateGithubCI();
        expect(output).not.toContain('Report to Governance Hub');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('omits hub reporting step when options is empty object', () => {
        const output = generateGithubCI({});
        expect(output).not.toContain('Report to Governance Hub');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('computes developer_hash from github.actor using sha256sum', () => {
        const output = generateGithubCI({ hubUrl });
        expect(output).toContain('github.actor');
        expect(output).toContain('sha256sum');
    });

    test('uses Bearer token from secrets.AI_GOV_SECRET', () => {
        const output = generateGithubCI({ hubUrl });
        expect(output).toContain('secrets.AI_GOV_SECRET');
        expect(output).toContain('Authorization: Bearer');
    });

    test('curl command is suffixed with || true', () => {
        const output = generateGithubCI({ hubUrl });
        expect(output).toContain('|| true');
    });

    test('still generates base governance check without hubUrl', () => {
        const output = generateGithubCI();
        expect(output).toContain('Governance Check');
        expect(output).toContain('ai-gov pr-check');
    });
});

// ─── GitLab CI ────────────────────────────────────────────────────────────────

describe('generateGitlabCI — hub reporting', () => {
    const hubUrl = 'https://hub.example.com';

    test('includes hub reporting step when hubUrl is provided', () => {
        const output = generateGitlabCI({ hubUrl });
        expect(output).toContain('hub-report');
        expect(output).toContain('/api/pr-reports');
        expect(output).toContain(hubUrl);
    });

    test('omits hub reporting step when hubUrl is not provided', () => {
        const output = generateGitlabCI();
        expect(output).not.toContain('hub-report');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('omits hub reporting step when options is empty object', () => {
        const output = generateGitlabCI({});
        expect(output).not.toContain('hub-report');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('computes developer_hash from GITLAB_USER_LOGIN using sha256sum', () => {
        const output = generateGitlabCI({ hubUrl });
        expect(output).toContain('GITLAB_USER_LOGIN');
        expect(output).toContain('sha256sum');
    });

    test('uses Bearer token from AI_GOV_SECRET env var', () => {
        const output = generateGitlabCI({ hubUrl });
        expect(output).toContain('$AI_GOV_SECRET');
        expect(output).toContain('Authorization: Bearer');
    });

    test('curl command is suffixed with || true', () => {
        const output = generateGitlabCI({ hubUrl });
        expect(output).toContain('|| true');
    });

    test('still generates base governance check without hubUrl', () => {
        const output = generateGitlabCI();
        expect(output).toContain('governance-check');
        expect(output).toContain('ai-gov pr-check');
    });

    test('appends hub reporting to existing content when provided', () => {
        const existing = 'stages:\n  - build\n  - test\n\nbuild-job:\n  stage: build\n  script: echo build';
        const output = generateGitlabCI({ hubUrl, existingContent: existing });
        expect(output).toContain('build-job');
        expect(output).toContain('hub-report');
        expect(output).toContain('/api/pr-reports');
    });
});

// ─── Bitbucket Pipelines ──────────────────────────────────────────────────────

describe('generateBitbucketCI — hub reporting', () => {
    const hubUrl = 'https://hub.example.com';

    test('includes hub reporting step when hubUrl is provided', () => {
        const output = generateBitbucketCI({ hubUrl });
        expect(output).toContain('Report to Governance Hub');
        expect(output).toContain('/api/pr-reports');
        expect(output).toContain(hubUrl);
    });

    test('omits hub reporting step when hubUrl is not provided', () => {
        const output = generateBitbucketCI();
        expect(output).not.toContain('Report to Governance Hub');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('omits hub reporting step when options is empty object', () => {
        const output = generateBitbucketCI({});
        expect(output).not.toContain('Report to Governance Hub');
        expect(output).not.toContain('/api/pr-reports');
    });

    test('computes developer_hash from BITBUCKET_PR_AUTHOR with platform suffix using sha256sum', () => {
        const output = generateBitbucketCI({ hubUrl });
        expect(output).toContain('BITBUCKET_PR_AUTHOR');
        expect(output).toContain('bitbucket');
        expect(output).toContain('sha256sum');
    });

    test('uses Bearer token from AI_GOV_SECRET env var', () => {
        const output = generateBitbucketCI({ hubUrl });
        expect(output).toContain('$AI_GOV_SECRET');
        expect(output).toContain('Authorization: Bearer');
    });

    test('curl command is suffixed with || true', () => {
        const output = generateBitbucketCI({ hubUrl });
        expect(output).toContain('|| true');
    });

    test('still generates base governance check without hubUrl', () => {
        const output = generateBitbucketCI();
        expect(output).toContain('Governance Check');
        expect(output).toContain('ai-gov pr-check');
    });
});
