import type { GovernanceConfig } from '../types.js';

export function generateWorkflow(c: GovernanceConfig): string {
    const scaffoldStep = c.scan.scaffoldTool
        ? `scaffold (${c.scan.scaffoldTool}) → `
        : '';

    const buildLine = c.profile.buildCmd
        ? `\n| Build   | \`${c.profile.buildCmd}\` |`
        : '';
    const codegenLine = c.profile.codegenCmd
        ? `\n| Codegen | \`${c.profile.codegenCmd}\` |`
        : '';
    const analyzeLine = c.profile.analyzeCmd
        ? `\n| Analyze | \`${c.profile.analyzeCmd}\` |`
        : '';
    const formatLine = c.profile.formatCmdFull
        ? `\n| Format  | \`${c.profile.formatCmdFull}\` |`
        : '';

    return `# Workflow

## New Feature
\`\`\`
Ticket → spec (_template) → requirements.md → design.md → tasks.md
→ approval → ${scaffoldStep}implement → tests → PR
\`\`\`

## Edit Feature (update/extend existing)
\`\`\`
Ticket → read existing spec → update requirements.md → update design.md
→ update tasks.md → show changes → approval → implement new tasks only → tests → PR
\`\`\`

## Bug Fix
\`\`\`
Ticket → reproduce → root cause → minimal fix → verify → PR
\`\`\`

## Refactor
\`\`\`
Ticket → impact analysis → approval (if >10 files) → refactor → tests → PR
\`\`\`

## Hotfix
\`\`\`
Fix → verify → PR → ticket after
\`\`\`

## Layer Build Order
\`\`\`
${c.blocks.layerExecOrder}
\`\`\`

## Commands
| Step | Command |
|------|---------|
| Install | \`${c.profile.installCmd}\` |
| Run     | \`${c.profile.runCmd}\` |${buildLine}${codegenLine}${analyzeLine}${formatLine}
| Test    | \`${c.profile.testCmd}\` |
`;
}
