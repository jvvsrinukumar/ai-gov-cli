import type { GovernanceConfig } from '../types.js';

export function generateFeatureReadme(c: GovernanceConfig): string {
    return `# Feature README Policy

Every \`${c.profile.featuresDir}<feature>/\` **must** have a \`README.md\`.

## When to Create
Immediately after scaffold — before any implementation.

## Auto-Update Rule
Update the README whenever any file in the feature is added, modified, or deleted — in the same task. Do not wait to be asked.

## Required Sections
\`\`\`markdown
# <Feature Name>
## Overview
## Architecture
### Layer Flow: ${c.profile.layerFlow}
### Files (table: File | Layer | Purpose)
## API Endpoints (table: Method | Endpoint | Status)
## State Definitions
## Dependencies
## Status (checklist)
\`\`\`

## Rules
1. Never delete the README
2. Update the Files table on every file change
3. List every file — nothing undocumented
`;
}
