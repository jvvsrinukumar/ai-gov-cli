import { existsSync } from 'fs';
import { join } from 'path';
import type { Agent } from '../types.js';
import { isInteractiveTTY, readTTYLine } from '../utils/tty.js';
import { log } from '../utils/logger.js';

const VALID_AGENTS: Agent[] = ['claude-code', 'kiro'];

/**
 * Detect which agent to generate governance for.
 *
 * Priority:
 *   1. Explicit --agent flag (always wins)
 *   2. Existing .kiro/ or .claude/ directory (auto-detect)
 *   3. Default to 'claude-code' (backward compatible)
 *
 * If both .kiro/ and .claude/ exist and no explicit flag:
 *   - Interactive TTY: prompt the user
 *   - Non-interactive: default to 'claude-code'
 */
export function detectAgent(projectDir: string, explicit?: string): Agent {
    if (explicit) {
        if (!VALID_AGENTS.includes(explicit as Agent)) {
            log.error(`Unknown agent: ${explicit}. Valid agents: ${VALID_AGENTS.join(', ')}`);
            process.exit(1);
        }
        log.info(`Agent: ${explicit}`);
        return explicit as Agent;
    }

    const hasKiro = existsSync(join(projectDir, '.kiro'));
    const hasClaude = existsSync(join(projectDir, '.claude'));

    if (hasKiro && !hasClaude) {
        log.info('Agent: kiro (auto-detected from .kiro/)');
        return 'kiro';
    }

    if (hasClaude && !hasKiro) {
        log.info('Agent: claude-code (auto-detected from .claude/)');
        return 'claude-code';
    }

    if (hasKiro && hasClaude) {
        if (isInteractiveTTY()) {
            return promptAgentChoice();
        }
        // Non-interactive: default to claude-code
        log.info('Agent: claude-code (both .kiro/ and .claude/ found — defaulting in non-interactive mode)');
        return 'claude-code';
    }

    // Neither exists — default to claude-code (backward compatible)
    return 'claude-code';
}

function promptAgentChoice(): Agent {
    console.log('');
    console.log('  Both .kiro/ and .claude/ detected. Which agent?');
    console.log('');
    console.log('  1  claude-code  [default]');
    console.log('  2  kiro');
    console.log('');

    let choice = '';
    while (!['1', '2', 'claude-code', 'kiro'].includes(choice)) {
        process.stdout.write('  Choice [1/2] (Enter = claude-code): ');
        choice = readTTYLine().toLowerCase().trim();
        if (choice === '') choice = '1';
        if (!['1', '2', 'claude-code', 'kiro'].includes(choice)) {
            console.log('  Please enter 1 or 2.');
        }
    }

    const agent: Agent = (choice === '2' || choice === 'kiro') ? 'kiro' : 'claude-code';
    log.info(`Agent: ${agent}`);
    return agent;
}
