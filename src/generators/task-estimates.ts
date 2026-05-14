import type { GovernanceConfig } from '../types.js';

export function generateTaskEstimates(_c: GovernanceConfig): string {
    return `# Task Estimate Format Guide

Use these markers when writing time estimates in \`tasks.md\` files.
The \`/jira\` command reads these estimates to populate Jira sub-task descriptions.

## Time markers

| Marker | Meaning | Use when |
|--------|---------|----------|
| \`[~10min]\` | ~10 minutes | Trivial tasks: config change, 1-line fix |
| \`[~30min]\` | ~30 minutes | Small task: single function, minor UI tweak |
| \`[~1h]\` | ~1 hour | Medium-small: straightforward implementation |
| \`[~2h]\` | ~2 hours | Medium: one complete unit of work |
| \`[~4h]\` | ~4 hours | Half-day: larger feature component |
| \`[~1d]\` | ~1 day | Full-day: significant chunk of work |
| \`[~2d]\` | ~2 days | Multi-day: complex feature or integration |

## Size markers (when hours are uncertain)

| Marker | Meaning |
|--------|---------|
| \`[S]\` | Small — fits in < 2h |
| \`[M]\` | Medium — 2–4h |
| \`[L]\` | Large — > 4h, consider splitting |

## Example tasks.md entry

\`\`\`markdown
## Task 2: Auth module

- [ ] 2.1 Create JWT signing utility \`[~1h]\`
- [ ] 2.2 Write token validation middleware \`[~2h]\`
- [ ] 2.3 Add refresh token rotation \`[~4h]\`
- [ ] 2.4 Integration tests for all auth paths \`[~2h]\`
\`\`\`

## Rules

- Every sub-task in \`tasks.md\` should have a time estimate.
- Use time markers for tasks where effort is predictable.
- Use size markers when the scope is unclear — revisit before sprint planning.
- Do not combine markers: use one per sub-task line.
- The \`/jira\` command will include these estimates in the Jira sub-task description.
`;
}
