import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { GovernanceConfig } from '../types.js';
import { generateGithubCI } from '../generators/ci/github.js';
import { generateGitlabCI } from '../generators/ci/gitlab.js';
import { generateBitbucketCI } from '../generators/ci/bitbucket.js';
import { readHubConfig } from '../utils/hub-config.js';
import { log } from '../utils/logger.js';

export function generateCIConfig(config: GovernanceConfig, platform: string): void {
    const projectDir = config.projectDir;
    const cfg = readHubConfig(projectDir);
    const hubUrl = cfg?.hub || undefined;

    switch (platform.toLowerCase()) {
        case 'github': {
            const outPath = join(projectDir, '.github', 'workflows', 'governance-check.yml');
            mkdirSync(dirname(outPath), { recursive: true });
            const content = generateGithubCI({ hubUrl });
            if (!config.dryRun) {
                writeFileSync(outPath, content);
                log.created('.github/workflows/governance-check.yml');
            } else {
                log.dryNew('.github/workflows/governance-check.yml', content.split('\n').length);
            }
            break;
        }
        case 'gitlab': {
            const outPath = join(projectDir, '.gitlab-ci.yml');
            const existingContent = existsSync(outPath) ? readFileSync(outPath, 'utf-8') : undefined;
            const content = generateGitlabCI({ hubUrl, existingContent });
            if (!config.dryRun) {
                writeFileSync(outPath, content);
                log.created('.gitlab-ci.yml');
            } else {
                log.dryNew('.gitlab-ci.yml', content.split('\n').length);
            }
            break;
        }
        case 'bitbucket': {
            const outPath = join(projectDir, 'bitbucket-pipelines.yml');
            const content = generateBitbucketCI({ hubUrl });
            if (!config.dryRun) {
                writeFileSync(outPath, content);
                log.created('bitbucket-pipelines.yml');
            } else {
                log.dryNew('bitbucket-pipelines.yml', content.split('\n').length);
            }
            break;
        }
        default:
            log.warn(`Unknown CI platform: ${platform}. Use github, gitlab, or bitbucket.`);
    }
}
