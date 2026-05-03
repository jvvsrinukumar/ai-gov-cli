import type { GovernanceConfig } from '../../../types.js';

export function generateSessionContinuity(c: GovernanceConfig): string {
    const featuresDir = c.profile.featuresDir;

    return JSON.stringify({
        name: 'Session Continuity',
        version: c.hookVersion,
        description: 'Preserves context between sessions by checking spec progress',
        when: {
            type: 'promptSubmit',
        },
        then: {
            type: 'askAgent',
            prompt: `SESSION CONTEXT — Before starting work, check for in-progress features:

1. Look in .kiro/specs/ for feature directories with tasks.md
2. For each tasks.md, count completed (- [x]) vs pending (- [ ]) tasks
3. If any feature has both completed and pending tasks, report:
   "SESSION: feature '<name>' has N done / M remaining. Next: <first pending task>"
4. Check ${featuresDir}/ for recently modified feature directories

This helps maintain continuity across sessions. Report findings briefly, then proceed with the user's request.`,
        },
    }, null, 2) + '\n';
}
