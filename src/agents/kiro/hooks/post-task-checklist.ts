import type { GovernanceConfig } from '../../../types.js';

export function generatePostTaskChecklist(c: GovernanceConfig): string {
    return JSON.stringify({
        name: 'Post-Task Checklist',
        version: c.hookVersion,
        description: 'Reminds to verify architecture compliance and flag risks after completing a task',
        when: {
            type: 'postTaskExecution',
        },
        then: {
            type: 'askAgent',
            prompt: `POST-TASK CHECKLIST — A spec task was just completed. Verify:

1. **Architecture compliance** — Does the implementation follow the layer flow in .kiro/steering/architecture.md?
2. **No skipped layers** — Did you go through all required layers (${c.profile.layerFlow})?
3. **Tests written** — Is there a corresponding test for the code just written?
4. **File size** — Are all modified files under 200 lines?
5. **Spec updated** — Mark the completed task as [x] in the spec's tasks.md
6. **Risk flags** — Any security concerns, performance issues, or tech debt introduced?

Report any issues found. If all checks pass, confirm completion briefly.`,
        },
    }, null, 2) + '\n';
}
