export interface JiraSyncOptions {
    /** Spec roots to scan in Step 1. Defaults to `.kiro/specs/` and `specs/` (project-level). */
    specPaths?: string[];
    /** Optional descriptor printed in the intro (e.g. "workspace (N projects)"). */
    scopeLabel?: string;
}

export function buildJiraSyncPrompt(opts: JiraSyncOptions = {}): string {
    const specPaths = opts.specPaths && opts.specPaths.length > 0
        ? opts.specPaths
        : ['.kiro/specs/', 'specs/'];
    const pathsList = specPaths.map(p => `\`${p}\``).join(specPaths.length === 2 ? ' and ' : ', ');
    const scopeIntro = opts.scopeLabel
        ? `\n> **Scope:** ${opts.scopeLabel}\n`
        : '';

    return `## Jira Sync Workflow${scopeIntro}

### Step 1 — Discover specs

Scan ${pathsList} for subdirectories that contain a \`tasks.md\` file.

If **no specs with tasks.md are found**: display the error "No specs with tasks found. Create a spec with a tasks.md file first." and stop — do not continue to the next step.

For each discovered spec, count open task lines (\`- [ ]\`), completed task lines (\`- [x]\`), and sum all time estimates (\`[~Xmin]\` and \`[~Xh]\` markers). Present results as a numbered table:

| # | Spec | Open tasks | Completed tasks | Total estimate |
|---|------|-----------|-----------------|----------------|
| 1 | my-feature | 6 | 2 | ~4h 30min |

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

For each phase, check the \`.jira\` metadata \`subtasks\` array and the task checkbox state:
- **All tasks created and all checked \`[x]\`**: mark as ✓ done — non-selectable
- **All tasks created, some checked \`[x]\`**: mark as ◑ has completed tasks — selectable to log work
- **Some tasks created**: mark as ◑ partially done — selectable for remaining tasks
- **No tasks created**: mark as ○ pending — fully selectable

Present a checkbox list and ask which phases to sync. The developer can select individual phases, combine multiple phases, or select all.

---

### Step 5 — Create sub-tasks

For each **uncreated** task (\`- [ ]\`) in the selected phases:
1. Parse the time estimate from the task description (e.g. \`[~2h]\` → \`"2h"\`, \`[~30min]\` → \`"30m"\`, \`[~1d]\` → \`"1d"\`).
2. Call \`jira_create\` with:
   - **Summary**: the task description with its estimate, e.g. \`Write token validation middleware [~2h]\`
   - **Issue type**: Sub-task (or Task if sub-tasks are disabled for this project)
   - **Parent**: the story ticket ID from Step 2/3
   - **timetracking.originalEstimate**: the parsed estimate (e.g. \`"2h"\`). Omit if no estimate marker present.

3. Immediately after each successful creation, append the new sub-task ID to the \`subtasks\` array in the \`.jira\` metadata file (create the file if it does not yet exist):
   \`\`\`json
   {"storyId": "PROJECT-111", "subtasks": ["PROJECT-112", "PROJECT-113"]}
   \`\`\`
   This ensures partial progress is preserved if a later creation fails.

After all sub-tasks are created, show a summary table:

| Sub-task | Title | Estimate | Status |
|----------|-------|----------|--------|
| PROJECT-112 | Write JWT signing utility [~1h] | 1h | ✓ created |

---

### Step 5b — Log worked hours for completed tasks

For each **completed** task (\`- [x]\`) in the selected phases that already has a sub-task ID in the \`.jira\` metadata:

Ask the developer for each task (can batch-confirm if all the same):
\`\`\`
Task: Write JWT signing utility (PROJECT-112)
  Hours worked? [default: 1h from estimate, or enter custom e.g. 3h]
  Start date?   [default: today YYYY-MM-DD, or enter e.g. 2026-05-17]
\`\`\`

**Validate before logging:**
- Start date cannot be in the future (after today)
- If developer enters a date that seems wrong, show a warning and ask to confirm

Call \`jira_post\` to \`/rest/api/3/issue/{KEY}/worklog\` for each task:
\`\`\`json
{
  "timeSpent": "3h",
  "started": "2026-05-17T09:00:00.000+0000"
}
\`\`\`

Show a worklog summary table after all entries are logged:

| Sub-task | Title | Hours Logged | Start Date | Status |
|----------|-------|-------------|------------|--------|
| PROJECT-112 | Write JWT signing utility | 1h | 2026-05-19 | ✓ logged |

If there are no completed tasks (\`- [x]\`) in the selected phases, skip this step silently.

---

### Step 6 — Optional comment

Ask: "Add a comment to the story ticket summarising what was synced? (yes / no)"

If yes: call \`jira_add_comment\` on the story ticket with a brief summary of the phases and sub-tasks just created or updated.

---

### Step 7 — Update story status

1. Call \`jira_get\` on the story ticket to read its current status.
2. Call \`jira_get\` on \`/rest/api/3/issue/{STORY-ID}/transitions\` to fetch the available transitions for that status.
3. Show the developer:
   \`\`\`
   Story [STORY-ID] is currently: [current status]
   Available transitions: [list transition names]
   \`\`\`
4. Ask: "Transition story to which status? (Enter number or press Enter to skip)"
5. If the developer selects a transition, call \`jira_post\` to \`/rest/api/3/issue/{STORY-ID}/transitions\` with:
   \`\`\`json
   { "transition": { "id": "<selected-transition-id>" } }
   \`\`\`
6. Confirm the new status.

---

### Done

Show the story ticket link and confirm sync is complete.
`;
}
