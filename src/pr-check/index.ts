import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { GovernanceConfig } from '../types.js';
import type { CheckResult } from './types.js';
import { getChangedFiles, getDiff } from '../utils/git.js';
import { checkArchitecture } from './checks/architecture.js';
import { checkFileSize } from './checks/file-size.js';
import { checkCredentials } from './checks/credentials.js';
import { checkSpecCoverage } from './checks/spec-coverage.js';
import { checkTestCoverage } from './checks/test-coverage.js';
import { checkTodos } from './checks/todos.js';
import { checkCommitMessages } from './checks/commit-messages.js';
import { checkPRDescription } from './checks/pr-description.js';
import { checkKnowledgeFreshness } from './checks/knowledge-freshness.js';
import { formatTerminal } from './formatters/terminal.js';
import { formatGithub } from './formatters/github.js';
import { formatGitlab } from './formatters/gitlab.js';
import { formatJson } from './formatters/json.js';

function loadGovernanceConfig(projectDir: string): GovernanceConfig | null {
    // Check both agent directories — .claude/ (Claude Code) and .kiro/ (Kiro)
    const candidates = [
        join(projectDir, '.claude', 'governance.json'),
        join(projectDir, '.kiro', 'governance.json'),
    ];
    for (const configPath of candidates) {
        if (!existsSync(configPath)) continue;
        try {
            return JSON.parse(readFileSync(configPath, 'utf-8')) as GovernanceConfig;
        } catch {
            return null;
        }
    }
    return null;
}

function formatOutput(results: CheckResult[], changedFiles: string[], format: string): string {
    switch (format.toLowerCase()) {
        case 'github': return formatGithub(results, changedFiles);
        case 'gitlab': return formatGitlab(results, changedFiles);
        case 'json': return formatJson(results, changedFiles);
        default: return formatTerminal(results, changedFiles);
    }
}

export async function runPRCheck(
    projectDir: string,
    baseBranch: string,
    format: string
): Promise<{ results: CheckResult[]; hasBlockers: boolean }> {
    const changedFiles = getChangedFiles(projectDir, baseBranch);
    const diff = getDiff(projectDir, baseBranch);

    const FILE_CAP = 100;
    if (changedFiles.length > FILE_CAP) {
        console.warn(`\n  ⚠️  Large PR: ${changedFiles.length} files changed — governance checks limited to first ${FILE_CAP} files.\n`);
    }
    const filesToCheck = changedFiles.slice(0, FILE_CAP);

    const config = loadGovernanceConfig(projectDir);

    const results: CheckResult[] = [];

    results.push(checkArchitecture(filesToCheck, config, projectDir));
    results.push(checkFileSize(filesToCheck, config, projectDir));
    results.push(checkCredentials(diff, filesToCheck));
    results.push(checkSpecCoverage(filesToCheck, projectDir));
    results.push(checkTestCoverage(filesToCheck, projectDir, config));
    results.push(checkTodos(diff, filesToCheck));
    results.push(checkCommitMessages(projectDir, baseBranch));
    results.push(checkPRDescription(projectDir));
    results.push(checkKnowledgeFreshness(projectDir));

    const hasBlockers = results.some(r => r.status === 'fail');
    const output = formatOutput(results, changedFiles, format);

    console.log(output);
    return { results, hasBlockers };
}
