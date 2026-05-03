import type { GovernanceConfig, Agent } from '../types.js';
import type { WriteOptions } from '../utils/safe-write.js';

export interface DoctorCheck {
    label: string;
    ok: boolean;
    detail?: string;
}

export interface AgentAdapter {
    /** Output directory name: '.claude' or '.kiro' */
    outputDir: string;

    /** Run the full governance generation for this agent */
    generate(config: GovernanceConfig): void;

    /** Upgrade existing governance files (hooks, commands, agent-specific config) */
    upgrade(config: GovernanceConfig, opts: WriteOptions, force: boolean): void;
}

// ── Agent Registry ──────────────────────────────────────────────────────────
// Adding a new agent? Register it here. The dispatcher uses this map
// instead of a switch statement, so new agents are a single-line addition.

import { generateClaudeCode, upgradeClaudeCode } from './claude-code/index.js';
import { generateKiro, upgradeKiro } from './kiro/index.js';

/**
 * Agent registry — maps agent identifiers to their orchestrator functions.
 *
 * To add a third agent:
 *   1. Create src/agents/<name>/index.ts with generate() and upgrade() functions
 *   2. Add the agent to the Agent union type in src/types.ts
 *   3. Register it here
 */
export const agentRegistry: Record<Agent, {
    generate: (config: GovernanceConfig) => void;
    upgrade: (config: GovernanceConfig, opts: WriteOptions, force: boolean) => void;
}> = {
    'claude-code': { generate: generateClaudeCode, upgrade: upgradeClaudeCode },
    'kiro': { generate: generateKiro, upgrade: upgradeKiro },
};
