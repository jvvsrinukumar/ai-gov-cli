import type { GovernanceConfig } from '../types.js';

export function buildJiraSyncPrompt(_c: GovernanceConfig): string {
    return `## Jira Sync Workflow

### Step 1 — Discover specs

Scan \`.kiro/specs/\` and \`specs/\` for subdirectories that contain a \`tasks.md\` file.

If **no specs with tasks.md are found**: display the error "No specs with tasks found. Create a spec with a tasks.md file first." and stop — do not continue to the next step.

For each discovered spec, count the number of open task lines (\`- [ ]\`) and sum all time estimates (\`[~Xmin]\` and \`[~Xh]\` markers). Present results as a numbered table:

| # | Spec | Open tasks | Total estimate |
|---|------|-----------|----------------|
| 1 | my-feature | 8 | ~4h 30min |

If only **one spec** is found, select it automatically without prompting. Otherwise ask the developer which spec to sync.

---

### Step 2 — Identify the Jira story ticket

Check whether a \`.jira\` metadata file exists in the spec directory (format: \`{"storyId": "<ID>", "subtasks": ["<ID>", ...]}\`).

**If the metadata file exists:**
- Read and parse the JSON. If the JSON is invalid or the \`subtasks\` array is missing, display "Metadata file is corrupt. Fix or delete the .jira file and re-run." and stop.
- Show the existing story ID and ask: "Continue syncing to [STORY-ID]? Or enter a different ticket ID."

**If no metadata file:**
Ask: "Enter the Jira story ticket ID (e.g. PROJECT-123), or type 'new' to create a story from requirements.md."

If the developer types **'new'**:
- Read \`requirements.md\` from the spec directory.
- Use the first \`#\` heading as the story title.
- Use the content under the Acceptance Criteria section as the story description.
- Call \`jira_create\` to create the story, then proceed with the returned ticket ID.

---

### Step 3 — Verify the ticket

Call \`jira_get\` with the provided ticket ID to verify it exists.

**If jira_get returns an error or the ticket is not found:**
Present three options:
1. Create a new story from \`requirements.md\` (same flow as "new" above)
2. Enter a different ticket ID
3. Cancel and exit

---

### Step 4 — Select phases to sync

Parse \`tasks.md\` to identify task groups (e.g. "## Task 1: Setup", "## Phase 2: Auth"). Each group is a phase.

For each phase, check whether all tasks in that phase already appear in the \`.jira\` metadata \`subtasks\` array:
- **All tasks created**: mark as ✓ completed — non-selectable
- **Some tasks created**: mark as ◑ partially done — selectable for remaining tasks only
- **No tasks created**: mark as ○ pending — fully selectable

Present a checkbox list and ask which phases to sync. The developer can select individual phases, combine multiple phases, or select all.

---

### Step 5 — Create sub-tasks

For each uncreated task in the selected phases:
1. Call \`jira_create\` with:
   - **Summary**: the task description with its estimate, e.g. \`Write token validation middleware [~2h]\`
   - **Issue type**: Sub-task (or Task if sub-tasks are disabled for this project)
   - **Parent**: the story ticket ID from Step 2/3

2. Immediately after each successful creation, append the new sub-task ID to the \`subtasks\` array in the \`.jira\` metadata file (create the file if it does not yet exist):
   \`\`\`json
   {"storyId": "PROJECT-111", "subtasks": ["PROJECT-112", "PROJECT-113"]}
   \`\`\`
   This ensures partial progress is preserved if a later creation fails.

After all sub-tasks are created, show a summary table:

| Sub-task | Title | Status |
|----------|-------|--------|
| PROJECT-112 | Write JWT signing utility [~1h] | ✓ created |

---

### Step 6 — Optional comment

Ask: "Add a comment to the story ticket summarising what was synced? (yes / no)"

If yes: call \`jira_add_comment\` on the story ticket with a brief summary of the phases and sub-tasks just created.

---

### Done

Show the story ticket link and confirm sync is complete.
`;
}
