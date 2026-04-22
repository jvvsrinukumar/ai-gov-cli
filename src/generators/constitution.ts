import type { GovernanceConfig } from '../types.js';

export function generateConstitution(c: GovernanceConfig): string {
    return `# Constitution — ${c.project.appName}

> **These rules are ABSOLUTE. You must never violate them.**
> **Priority: constitution.md > CLAUDE.md > steering files > specs**

## Hard Rules — You Must Obey These
${c.blocks.hardRules}

## Architecture Invariants — Never Deviate
**Layer flow:** ${c.profile.layerFlow}
${c.blocks.layerResps}

## High-Risk Files — Confirm Before Editing
${c.blocks.highRiskDisplay}
`;
}
