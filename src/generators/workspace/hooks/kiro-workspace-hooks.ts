import { join } from 'path';
import type { WriteOptions } from '../../../utils/safe-write.js';
import { safeWrite } from '../../../utils/safe-write.js';
import type { WorkspaceConfig, WorkspaceProject } from '../types.js';

// ─── helpers ────────────────────────────────────────────────────────────────

function projectList(projects: WorkspaceProject[]): string {
    return projects
        .map((p, i) => `  ${i + 1}. ${p.relativePath} [${p.stack}]`)
        .join('\n');
}

function projectPaths(projects: WorkspaceProject[]): string {
    return projects.map(p => p.relativePath).join(', ');
}

// ─── automated workspace-wide hooks ─────────────────────────────────────────

export function generateWsBlockDangerous(hookVersion: string): string {
    return JSON.stringify({
        name: 'Block Dangerous Commands',
        version: hookVersion,
        description: 'Blocks force push, destructive git ops, and rm -rf on workspace directories',
        when: {
            type: 'preToolUse',
            toolTypes: ['shell'],
        },
        then: {
            type: 'askAgent',
            prompt: `SECURITY GATE — Review the shell command about to execute.

You are FORBIDDEN from executing commands matching ANY of these patterns:
- git push --force or git push -f
- git reset --hard
- git clean -fd

If the command matches a blocked pattern, respond with 'DENIED: <reason>' and do NOT proceed. This is non-negotiable.

If the command does not match any blocked pattern, respond with 'APPROVED' and proceed.`,
        },
    }, null, 2) + '\n';
}

export function generateWsPreWriteSecretsGate(hookVersion: string): string {
    return JSON.stringify({
        name: 'Pre-Write Secrets Gate',
        version: hookVersion,
        description: 'Blocks writing files that contain secrets, tokens, or credentials',
        when: {
            type: 'preToolUse',
            toolTypes: ['write'],
        },
        then: {
            type: 'askAgent',
            prompt: `SECRETS GATE — Before writing this file, check for secrets.

Scan the content for:
- API keys, tokens, secrets, passwords, private keys
- Hardcoded credentials or connection strings with passwords
- Values that look like: sk-..., ghp_..., AKIA..., or similar token patterns

If secrets are found: respond with 'DENIED: file contains <type of secret>. Use environment variables instead.'
If clean: respond with 'APPROVED' and proceed.`,
        },
    }, null, 2) + '\n';
}

export function generateWsCheckSecrets(hookVersion: string): string {
    return JSON.stringify({
        name: 'Check Secrets',
        version: hookVersion,
        description: 'Scans edited files for accidentally committed secrets',
        when: {
            type: 'fileEdited',
        },
        then: {
            type: 'askAgent',
            prompt: `SECRETS SCAN — A file was just written. Scan it for secrets.

Check for:
- API keys, tokens, passwords, private keys
- Hardcoded connection strings with credentials
- Values matching patterns: sk-..., ghp_..., AKIA..., or similar

If secrets found: warn immediately — "WARNING: possible secret in <file>: <type>. Move to environment variable."
If clean: no output needed.`,
        },
    }, null, 2) + '\n';
}

export function generateWsRequireTaskType(hookVersion: string): string {
    return JSON.stringify({
        name: 'Require Task Type Classification',
        version: hookVersion,
        description: 'Prompts developers to classify tasks before starting development work',
        when: {
            type: 'promptSubmit',
        },
        then: {
            type: 'askAgent',
            prompt: `TASK CLASSIFICATION — Before starting development work, check if the user's message indicates a new task.

If the message is a development request (build, implement, create, fix, debug, refactor, etc.) that hasn't been classified, suggest:

"Please classify this task:
  - New Feature [name] — build something new (spec-first workflow)
  - Edit Feature [name] — extend an existing feature
  - Bug Fix [description] — reproduce, diagnose, fix, verify
  - Refactor [scope] — structural change with impact analysis
  - Hotfix [issue] — minimal urgent production fix

Or prefix your message with: ## Task Type: New Feature / Bug Fix / Refactor / Hotfix / Edit Feature"

Skip classification for:
- Short messages (< 6 words)
- Continuation messages (ok, yes, proceed, continue, next, done, approved, looks good, which project)
- Questions or exploration requests
- Messages that already contain "## Task Type:"`,
        },
    }, null, 2) + '\n';
}

export function generateWsSessionContinuity(
    hookVersion: string,
    projects: WorkspaceProject[],
): string {
    const projectChecks = projects
        .map(p => `- ${p.relativePath}/.kiro/specs/ — in-progress features for ${p.name}`)
        .join('\n');

    return JSON.stringify({
        name: 'Session Continuity',
        version: hookVersion,
        description: 'Preserves context between sessions by checking spec progress across all workspace projects',
        when: {
            type: 'promptSubmit',
        },
        then: {
            type: 'askAgent',
            prompt: `SESSION CONTEXT — Before starting work, check for in-progress features across the workspace.

Check these spec directories:
- .kiro/specs/ — workspace-level cross-project specs
${projectChecks}

For each tasks.md found: count completed (- [x]) vs pending (- [ ]) tasks.
If any feature has both completed and pending tasks, report briefly:
  "IN-PROGRESS: [project] / [feature] — N done / M remaining. Next: <first pending task>"

Report all in-progress features, then proceed with the user's request.`,
        },
    }, null, 2) + '\n';
}

// ─── userTriggered workspace workflow hooks ──────────────────────────────────

export function generateWsWorkflowNewFeature(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);
    const paths = projectPaths(projects);

    return JSON.stringify({
        name: 'New Feature [Workspace]',
        version: hookVersion,
        description: 'Start a new feature in any workspace project — spec-first 3-gate workflow',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `NEW FEATURE — Workspace: ${workspaceName}

> This is a new session — you have no conversation history. Read from disk first.

## STEP 0 — Pick a project

Check .kiro/specs/ for any cross-project in-progress features first.
Then ask:

"Which project are you working in?
${list}

  Or: **cross-project** — feature spans multiple projects (${paths})

  Also: what feature are you building? (1-2 sentences)"

---

## STEP 1 — Orient in the selected project

Once the user picks a project, read:
- <project>/.kiro/steering/architecture.md — layer flow + directory structure
- <project>/.kiro/steering/workflow.md — features dir, source dir, test command
- <project>/.kiro/specs/ — check for existing in-progress features

If an in-progress feature exists in that project, report it and ask: continue it or start new?

---

## STEP 2 — Run the spec-first 3-gate workflow

Use the layer flow, features dir, and test command from the steering files you just read.

### GATE 1 — REQUIREMENTS
Draft in chat (do NOT write files yet):
\`\`\`
# Feature: <name>
## Overview — [1-2 sentences]
## Acceptance Criteria
- [ ] [primary behaviour]
- [ ] [edge case]
- [ ] [error state]
## API Contracts (if applicable)
## Out of Scope
\`\`\`
Ask: "Does this capture the requirements? Say **ok** to proceed to design."
Do NOT write files. Wait for ok.

### GATE 2 — DESIGN
Draft in chat:
\`\`\`
# Design: <name>
## Architecture Layer Map — [layer → file → responsibility]
## Data Flow — [request path, one line per hop]
## State Shape — [key data model]
## Error Handling — [how errors propagate]
## Dependencies — [existing services this feature uses]
\`\`\`
Ask: "Does the layer breakdown work? Say **ok** to proceed to tasks."
Do NOT write files. Wait for ok.

### GATE 3 — TASKS
Draft in chat with phased breakdown. Ask: "Tasks look right? Say **ok** to lock the spec."
Do NOT write files. Wait for ok.

---

## STEP 3 — Write spec files

After Gate 3 approval, write to the SELECTED PROJECT's .kiro/specs/<name>/:
- requirements.md — Gate 1 content
- design.md — Gate 2 content
- tasks.md — Gate 3 content

For cross-project features, write to the workspace root .kiro/specs/<name>/ instead.

Then ask: "Spec locked. Implement now (all phases / phase N only / spec only)?"

---

## STEP 4 — Implement requested phases

Implement only the phases requested, in order.
After each phase: list files written + mark tasks done in tasks.md ([ ] → [x]).`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowFix(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);

    return JSON.stringify({
        name: 'Fix [Workspace]',
        version: hookVersion,
        description: 'Diagnose and fix a bug in any workspace project with root-cause analysis',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `FIX — Workspace: ${workspaceName}

> This is a new session — you have no conversation history. Read from disk first.

## STEP 0 — Pick a project

Ask:
"Which project has the bug?
${list}

  Also: what is the bug? (symptoms, error message, steps to reproduce)"

---

## STEP 1 — Orient in the selected project

Once the user picks a project, read:
- <project>/.kiro/steering/workflow.md — test command
- <project>/.kiro/specs/ — check for in-progress Bug Fix tasks

Run the test command. Note any currently failing tests.

---

## STEP 2 — REPRODUCE

Identify the failing condition.
If a test covers it: run that test. Note the failure output.
If no test: identify the code path from the description. Read those files.

---

## STEP 3 — ROOT CAUSE

Trace the data flow to find where the bug originates.
Present:
- Root cause: [one sentence]
- Files affected: [list with line numbers]
- Why it happens: [precise technical explanation]

Confirm: "Is this the root cause? Say **ok** to apply the fix."
Wait for confirmation.

---

## STEP 4 — FIX

Apply the minimal fix. Do NOT refactor surrounding code or add features.
Show what changed: file name, line range, before → after.

---

## STEP 5 — VERIFY

Run the project's test command. Report pass or diagnose new failure.

---

## STEP 6 — REGRESSION TEST

If no test existed for this bug, write one that would have caught it.
Run tests again. New test must pass.`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowEditFeature(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);

    return JSON.stringify({
        name: 'Edit Feature [Workspace]',
        version: hookVersion,
        description: 'Extend or modify an existing feature in any workspace project',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `EDIT FEATURE — Workspace: ${workspaceName}

> This is a new session — you have no conversation history. Read from disk first.

## STEP 0 — Pick a project

Ask:
"Which project has the feature you want to edit?
${list}

  Also: which feature and what change do you want to make?"

---

## STEP 1 — Orient in the selected project

Read:
- <project>/.kiro/steering/architecture.md — layer flow
- <project>/.kiro/specs/<feature>/requirements.md — original requirements (if exists)
- <project>/.kiro/specs/<feature>/tasks.md — task history (if exists)

List the files that make up the feature (read the feature directory).

---

## STEP 2 — IMPACT ANALYSIS

Before writing anything, identify:
- Which files will be modified?
- Which layers are affected?
- Are there tests that will break?
- Are there other features that depend on this one?

Show the impact summary. Confirm: "Does this scope look right? Say **ok** to proceed."

---

## STEP 3 — UPDATE SPEC (if spec exists)

If .kiro/specs/<feature>/ exists, update tasks.md with the new change:
- Add a task for each file change
- Prepend "Edit:" to the task description

If no spec: note it as unspecced — proceed anyway.

---

## STEP 4 — IMPLEMENT

Make the changes, smallest diff first.
After each file: mark its task done in tasks.md.
Run the project's test command after all changes.`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowRefactor(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);

    return JSON.stringify({
        name: 'Refactor [Workspace]',
        version: hookVersion,
        description: 'Safe structural refactor in any workspace project — impact analysis first',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `REFACTOR — Workspace: ${workspaceName}

> This is a new session — you have no conversation history. Read from disk first.

## STEP 0 — Pick a project

Ask:
"Which project are you refactoring?
${list}

  Also: what do you want to refactor and why?"

---

## STEP 1 — Orient in the selected project

Read:
- <project>/.kiro/steering/architecture.md — layer flow + directory structure
- <project>/.kiro/steering/coding-standards.md — naming, patterns in use
- <project>/.kiro/steering/workflow.md — test command

---

## STEP 2 — IMPACT ANALYSIS

Before touching any code:
- List all files that will change
- List all files that import/use the affected code
- Estimate risk: low (rename/move) / medium (interface change) / high (layer restructure)
- Identify which tests will break

Show a Refactor Plan. Confirm: "Does this plan look right? Say **ok** to proceed."

---

## STEP 3 — REFACTOR (smallest increment first)

Apply changes in order of dependency: lowest layer first.
Run the test command after each file or small group.
If tests break: diagnose before continuing.

---

## STEP 4 — UPDATE STEERING

If the refactor changed directory structure, layer names, or conventions:
Update <project>/.kiro/steering/architecture.md and coding-standards.md to match.

Report what changed in steering files.`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowHotfix(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);

    return JSON.stringify({
        name: 'Hotfix [Workspace]',
        version: hookVersion,
        description: 'Minimal urgent production fix in any workspace project',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `HOTFIX — Workspace: ${workspaceName}

> Hotfix = smallest possible change to stop the bleeding. No refactoring.

## STEP 0 — Pick a project

Ask:
"Which project needs the hotfix?
${list}

  Also: what is broken in production? (error message, symptoms)"

---

## STEP 1 — Find the exact broken line(s)

Read the stack trace or error message. Navigate directly to the affected file.
Do NOT read unrelated files.

---

## STEP 2 — CONFIRM SCOPE

State the minimal fix in one sentence: "Change X on line N in <file>."
Confirm: "This is the minimal fix. Say **ok** to apply."
Wait for confirmation.

---

## STEP 3 — APPLY HOTFIX

Make only the change described in Step 2.
Show before → after for every changed line.

---

## STEP 4 — VERIFY

Run the project's test command.
If tests pass: "Hotfix applied. Changed <N> line(s) in <file>."
If tests fail: diagnose before closing.`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowExplore(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);
    const paths = projectPaths(projects);

    return JSON.stringify({
        name: 'Explore [Workspace]',
        version: hookVersion,
        description: 'Read-only exploration — understand workspace structure or a specific project',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `EXPLORE — Workspace: ${workspaceName}

> Read-only. Do NOT write or modify any files. Do NOT run commands that change state.

## STEP 0 — Pick a scope

Ask:
"What do you want to explore?

  a) Workspace overview — how all 7 projects connect
  b) A specific project:
${list}
  c) A cross-project flow — e.g. 'how does login work across ${paths}'

  Also: what specifically do you want to understand?"

---

## STEP 1 — READ RELEVANT FILES

For workspace overview: read .kiro/steering/workspace-overview.md, cross-project-rules.md, project-registry.md.
For a specific project: read <project>/.kiro/steering/architecture.md, then the source files that answer the question.
For a cross-project flow: start from the API contract in .kiro/steering/cross-project-rules.md, then trace through each project.

Stay narrow — only read files that answer the question.

---

## STEP 2 — TRACE AND MAP

Trace the data flow or structure the user asked about.

---

## STEP 3 — REPORT

\`\`\`
EXPLORATION REPORT

Question: [what the user asked]
Scope: [workspace / project: X / cross-project flow]

Files read:
  <path> — [role in the answer]

Findings:
  [key observations — what IS, not what should be]

Patterns observed:
  [naming, structural patterns, consistency notes]

Potential concerns:
  [inconsistencies or things that might surprise a new developer]
  [or "none found"]
\`\`\``,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowAudit(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    const list = projectList(projects);

    return JSON.stringify({
        name: 'Audit [Workspace]',
        version: hookVersion,
        description: 'Governance audit — single project or full workspace sweep',
        when: {
            type: 'userTriggered',
        },
        then: {
            type: 'askAgent',
            prompt: `AUDIT — Workspace: ${workspaceName}

## STEP 0 — Pick audit scope

Ask:
"Audit scope:
  a) Full workspace sweep — audit all ${projects.length} projects in sequence
  b) Single project:
${list}"

---

## STEP 1 — Per-project audit (repeat for each selected project)

For each project being audited, run the 6-phase audit:

### Phase 1 — Governance Inventory
Read and confirm each file exists and is non-empty:
- .kiro/steering/constitution.md
- .kiro/steering/architecture.md
- .kiro/steering/coding-standards.md
- .kiro/steering/workflow.md
- .kiro/steering/ai-usage-policy.md
- .kiro/steering/spec-first-workflow.md

Check .kiro/hooks/ — all workflow hooks present? Versions match ${hookVersion}?

### Phase 2 — Project Discovery
Map actual directory structure. Read source files to observe:
- Framework / router in use
- State management
- Data flow through layers
- ORM / data tool
- Test approach

### Phase 3 — Gap Analysis
Compare actual code to .kiro/steering/ claims.
For each mismatch:
\`\`\`
GAP: <steering file> says "<claim>"
     Reality: <what the code actually does>
     Impact: Kiro will <specific wrong behaviour>
\`\`\`

### Phase 4 — Fix Governance
Update .kiro/steering/ files to match reality. Update directly — no approval needed.

### Phase 5 — Spec and Dead Code
- List features without specs (flag if spec-first-gate.kiro.hook is active)
- Scan for dead/abandoned files

### Phase 6 — Report
Write .kiro/audit-report.md, .kiro/dead-code.md, .kiro/developer-actions.md in the project dir.

---

## STEP 2 — Workspace summary (after all projects audited)

If full workspace sweep: write a summary at workspace root .kiro/audit-report.md:
- Per-project health scores
- Cross-project gaps (API contracts in cross-project-rules.md accurate?)
- Total governance gaps fixed
- ACTION NEEDED items`,
        },
    }, null, 2) + '\n';
}

export function generateWsWorkflowJiraSync(
    hookVersion: string,
    workspaceName: string,
    projects: WorkspaceProject[],
): string {
    // Scan workspace-root specs AND every project's specs. Covers cross-project
    // specs (workspace root) and per-project specs in one pass — one Jira story
    // can map to sub-tasks across multiple specs without running /jira-sync
    // separately in each project.
    const specPaths = [
        '.kiro/specs/',
        ...projects.flatMap(p => [`${p.relativePath}/.kiro/specs/`, `${p.relativePath}/specs/`]),
    ];
    const pathsList = specPaths.map(p => `\`${p}\``).join(', ');

    return JSON.stringify({
        name: 'Jira Sync [Workspace]',
        version: hookVersion,
        description: 'Workspace-aware Jira sync — discovers specs across workspace root and every project, maps to a single Jira story',
        when: { type: 'userTriggered' },
        then: {
            type: 'askAgent',
            prompt: `JIRA SYNC — Workspace: ${workspaceName}

> **Scope:** workspace \`${workspaceName}\` (${projects.length} project(s)) + workspace-root specs.

## Step 1 — Discover specs

Scan the following paths for subdirectories containing a \`tasks.md\` file:
${pathsList}

For each discovered spec, count the number of open task lines (\`- [ ]\`) and sum all time estimates (\`[~Xmin]\` and \`[~Xh]\` markers). Present results as a numbered table grouped by source (workspace root vs project):

| # | Source | Spec | Open tasks | Total estimate |
|---|--------|------|-----------|----------------|

If no specs with tasks.md are found, display: "No specs with tasks found across workspace or projects. Create a spec with tasks.md first." Stop.

If only one spec is found, select it automatically. Otherwise ask the developer which spec(s) to sync — multi-select supported (single Jira story can receive sub-tasks from multiple specs).

---

## Step 2 — Identify the Jira story ticket

Check whether a \`.jira\` metadata file exists in the SELECTED spec directory (format: \`{"storyId": "<ID>", "subtasks": ["<ID>", ...]}\`).

If multiple specs are selected, check each spec's \`.jira\` file. If they reference different story IDs, ask the developer to confirm whether all selected specs should sync to one story or to their respective stored IDs.

If no metadata file exists: ask for the Jira story ticket ID, or "new" to create one from \`requirements.md\`.

---

## Step 3 — Verify the ticket

Call \`jira_get\` with the chosen ticket ID. If it fails, offer:
1. Create a new story from \`requirements.md\` of the first selected spec
2. Enter a different ticket ID
3. Cancel

---

## Step 4 — Select phases to sync

For each selected spec, parse its \`tasks.md\` to identify phases (## Task N: / ## Phase N: headings). Show per-spec phase status:
- ✓ all tasks already in \`.jira\` subtasks
- ◑ some tasks already created
- ○ no tasks created yet

Let the developer choose which phases (across which specs) to sync now.

---

## Step 5 — Create sub-tasks

For each uncreated task in the selected phases:
1. Call \`jira_create\` with parent = story ticket ID. Summary includes the spec name as prefix when multiple specs sync into one story:
   - Single spec: \`Write token validation middleware [~2h]\`
   - Multi-spec:  \`[auth-service] Write token validation middleware [~2h]\`
2. Append the new sub-task ID to the relevant spec's \`.jira\` metadata immediately.

Show a final table:

| Spec | Sub-task | Title | Status |
|------|----------|-------|--------|

---

## Step 6 — Optional comment

Ask: "Add a comment to the story ticket summarising what was synced? (yes / no)"

If yes: call \`jira_add_comment\` on the story ticket with a brief summary including the list of specs that contributed sub-tasks.

---

## Done

Show the story ticket link and confirm sync is complete.`,
        },
    }, null, 2) + '\n';
}

// ─── main entry point ────────────────────────────────────────────────────────

export function generateWorkspaceKiroHooks(config: WorkspaceConfig, opts: WriteOptions): void {
    const hooksDir = join(config.workspaceDir, '.kiro', 'hooks');
    const { projects, hookVersion, workspaceName } = config;

    const w = (name: string, content: string) => safeWrite(join(hooksDir, name), content, opts);

    // Automated workspace-wide safety hooks
    w('block-dangerous-commands.kiro.hook', generateWsBlockDangerous(hookVersion));
    w('pre-write-secrets-gate.kiro.hook', generateWsPreWriteSecretsGate(hookVersion));
    w('check-secrets.kiro.hook', generateWsCheckSecrets(hookVersion));
    w('require-task-type.kiro.hook', generateWsRequireTaskType(hookVersion));
    w('session-continuity.kiro.hook', generateWsSessionContinuity(hookVersion, projects));

    // userTriggered workspace workflow hooks (these appear in the Kiro tab)
    w('workspace-new-feature.kiro.hook', generateWsWorkflowNewFeature(hookVersion, workspaceName, projects));
    w('workspace-fix.kiro.hook', generateWsWorkflowFix(hookVersion, workspaceName, projects));
    w('workspace-edit-feature.kiro.hook', generateWsWorkflowEditFeature(hookVersion, workspaceName, projects));
    w('workspace-refactor.kiro.hook', generateWsWorkflowRefactor(hookVersion, workspaceName, projects));
    w('workspace-hotfix.kiro.hook', generateWsWorkflowHotfix(hookVersion, workspaceName, projects));
    w('workspace-explore.kiro.hook', generateWsWorkflowExplore(hookVersion, workspaceName, projects));
    w('workspace-audit.kiro.hook', generateWsWorkflowAudit(hookVersion, workspaceName, projects));
    w('workspace-jira-sync.kiro.hook', generateWsWorkflowJiraSync(hookVersion, workspaceName, projects));
}
