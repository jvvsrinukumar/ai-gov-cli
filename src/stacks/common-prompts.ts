import { input, confirm, select } from '@inquirer/prompts';
import type { Agent } from '../types.js';

export interface CommonAnswers {
    appName: string;
    displayName: string;
    outputDir: string;
    agent: Agent;
    gitHooks: boolean;
    ci: 'github' | 'gitlab' | 'bitbucket' | 'none';
}

export interface GovernanceAnswers {
    agent: Agent;
    gitHooks: boolean;
    ci: 'github' | 'gitlab' | 'bitbucket' | 'none';
}

/**
 * Transforms a kebab-case or snake_case name into a human-readable display name.
 * Replaces hyphens and underscores with spaces and capitalizes the first letter of each word.
 */
export function toDisplayName(name: string): string {
    return name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Collects only governance-related prompts (agent, git hooks, CI).
 * Use when app name and output directory are already known (e.g. --name / --dir flags).
 */
export async function collectGovernanceAnswers(): Promise<GovernanceAnswers> {
    const agent = await select<Agent>({
        message: 'AI agent:',
        choices: [
            { name: 'Claude Code', value: 'claude-code' },
            { name: 'Kiro', value: 'kiro' },
        ],
    });

    const gitHooks = await confirm({
        message: 'Enable git hooks?',
        default: true,
    });

    const ci = await select<'github' | 'gitlab' | 'bitbucket' | 'none'>({
        message: 'CI platform:',
        choices: [
            { name: 'GitHub Actions', value: 'github' },
            { name: 'GitLab CI', value: 'gitlab' },
            { name: 'Bitbucket', value: 'bitbucket' },
            { name: 'None', value: 'none' },
        ],
    });

    return { agent, gitHooks, ci };
}

/**
 * Collects common project answers shared across all stack adapters.
 *
 * @param nameHint - Stack-specific naming hint (e.g. "snake_case" or "kebab-case")
 * @param nameValidator - Stack-specific name validation function; returns `true` on success or an error string on failure
 */
export async function collectCommonAnswers(
    nameHint: string,
    nameValidator: (name: string) => string | true,
): Promise<CommonAnswers> {
    // 1. App name
    const appName = await input({
        message: `App name (${nameHint}):`,
        validate(value: string): string | true {
            const trimmed = value.trim();
            if (!trimmed) {
                return 'App name cannot be empty or whitespace-only.';
            }
            return nameValidator(trimmed);
        },
        transformer(value: string): string {
            return value.trim();
        },
    });

    const trimmedAppName = appName.trim();

    // 2. Display name
    const displayName = await input({
        message: 'Display name:',
        default: toDisplayName(trimmedAppName),
    });

    // 3. Output directory
    const useCurrentDir = await confirm({
        message: 'Create in current directory?',
        default: true,
    });

    let outputDir: string;
    if (useCurrentDir) {
        outputDir = process.cwd();
    } else {
        outputDir = await input({
            message: 'Output directory:',
            default: process.cwd(),
        });
    }

    // 4–6. Governance answers
    const governance = await collectGovernanceAnswers();

    return {
        appName: trimmedAppName,
        displayName,
        outputDir,
        ...governance,
    };
}
