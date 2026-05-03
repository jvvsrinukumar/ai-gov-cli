/**
 * Governance generator dispatcher.
 * Routes to the appropriate agent orchestrator via the agent registry.
 */
import type { GovernanceConfig } from '../types.js';
import { agentRegistry } from '../agents/types.js';

export function runGovernance(config: GovernanceConfig): void {
    const agent = agentRegistry[config.agent];
    if (!agent) {
        throw new Error(`Unknown agent: ${config.agent}. Registered agents: ${Object.keys(agentRegistry).join(', ')}`);
    }
    agent.generate(config);
}
