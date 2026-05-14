# Kiro Setup Guide

> Set up AI governance for teams using Kiro. This guide covers initialization, what gets generated, and how Kiro hooks work.

## Quick Start

```bash
# Initialize Kiro governance (--agent kiro is required)
npx ai-gov init --agent kiro

# Preview without writing files
npx ai-gov init --agent kiro --dry-run

# Force a specific stack (flutter|kotlin|nodejs|react|next|angular|swiftui|python|java)
npx ai-gov init --agent kiro --stack flutter
npx ai-gov init --agent kiro --stack next
```

> **Note:** Unlike Claude Code, Kiro is not the default. You must pass `--agent kiro` explicitly — unless a `.kiro/` directory already exists (in which case the CLI auto-detects it).

## What Gets Generated

```
your-project/
├── .kiro/
│   ├── .gitattributes                     ← LF line endings for scripts
│   ├── steering/                          ← Kiro reads these automatically
│   │   ├── constitution.md                ← Hard rules (inclusion: always)
│   │   ├── architecture.md                ← Layer flow, structure (inclusion: always)
│   │   ├── coding-standards.md            ← Naming, file size limits (inclusion: always)
│   │   ├── ai-usage-policy.md             ← What Kiro can/cannot do (inclusion: always)
│   │   ├── workflow.md                    ← Feature, bug, hotfix workflows (inclusion: always)
│   │   ├── spec-first-workflow.md         ← Spec enforcement rules (inclusion: always)
│   │   ├── feature-readme.md              ← README policy per feature (inclusion: always)
│   │   └── prompt-templates.md            ← Reusable templates (inclusion: always)
│   ├── hooks/                             ← Kiro JSON hooks (auto-discovered)
│   │   ├── block-dangerous-commands.kiro.hook  ← Blocks force push, rm -rf
│   │   ├── protect-files.kiro.hook             ← Warns on high-risk file edits
│   │   ├── pre-write-secrets-gate.kiro.hook    ← Blocks writes with hardcoded credentials
│   │   ├── spec-first-gate.kiro.hook           ← Blocks writes without spec (if enabled)
│   │   ├── check-secrets.kiro.hook             ← Scans for hardcoded credentials
│   │   ├── check-file-size.kiro.hook           ← Warns on files > 200 lines
│   │   ├── format-code.kiro.hook               ← Auto-formats after write
│   │   ├── analyze-code.kiro.hook              ← Runs linter after write
│   │   ├── check-feature-readme.kiro.hook      ← Reminds to update feature README
│   │   ├── check-consistency.kiro.hook         ← Detects spec-vs-code drift
│   │   ├── session-continuity.kiro.hook        ← Context preservation
│   │   ├── require-task-type.kiro.hook         ← Task classification prompt
│   │   ├── post-task-checklist.kiro.hook       ← Post-task verification
│   │   ├── workflow-audit.kiro.hook            ← Governance audit (userTriggered)
│   │   ├── workflow-new-feature.kiro.hook      ← Spec-first feature workflow (userTriggered)
│   │   ├── workflow-fix.kiro.hook              ← Bug fix workflow (userTriggered)
│   │   ├── workflow-refactor.kiro.hook         ← Refactor with impact gate (userTriggered)
│   │   ├── workflow-hotfix.kiro.hook           ← Emergency production fix (userTriggered)
│   │   ├── workflow-explore.kiro.hook          ← Read-only exploration (userTriggered)
│   │   └── README.md
│   └── specs/
│       └── _template/                     ← Spec templates (Kiro-native location)
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
```

## How Kiro Hooks Work

Kiro hooks are JSON files (with `.kiro.hook` extension) that Kiro discovers automatically from `.kiro/hooks/`. Each hook has:

- **`when`** — the event that triggers the hook
- **`then`** — what happens (either `askAgent` or `runCommand`)

### Hook Types

| Event | When It Fires | Example |
|-------|---------------|---------|
| `preToolUse` | Before a tool executes | Block dangerous commands |
| `postToolUse` | After a tool executes | Format code, check file size |
| `fileEdited` | When a file is saved | Scan for secrets |
| `promptSubmit` | When a message is sent | Session continuity, task classification |
| `postTaskExecution` | After a spec task completes | Post-task checklist |
| `userTriggered` | When user clicks the hook button | Workflow shortcuts (audit, new-feature, fix, refactor, hotfix, explore) |

### Enforcement Model

Kiro hooks use two enforcement mechanisms:

- **`askAgent`** — sends a prompt to Kiro. For `preToolUse` hooks, if the prompt responds with "DENIED", Kiro is forbidden from proceeding with the tool call.
- **`runCommand`** — executes a shell command. Used for mechanical tasks like formatting and linting.

### Workflow Shortcuts (userTriggered hooks)

These are the Kiro equivalent of Claude Code's slash commands (`/audit`, `/new-feature`, etc.). They appear as buttons in the Agent Hooks panel — click to trigger a guided workflow.

| Hook | Equivalent | What It Does |
|------|-----------|--------------|
| `workflow-audit.kiro.hook` | `/audit` | Full governance audit: observe → compare to steering → report drift |
| `workflow-new-feature.kiro.hook` | `/new-feature` | Spec-first 3-gate workflow: requirements → design → tasks → implement |
| `workflow-fix.kiro.hook` | `/fix` | Bug diagnosis: reproduce → root cause → minimal fix → regression test |
| `workflow-refactor.kiro.hook` | `/refactor` | Impact analysis gate → tests before → apply → tests after |
| `workflow-hotfix.kiro.hook` | `/hotfix` | Emergency fix: smallest change, must have test |
| `workflow-explore.kiro.hook` | `/explore` | Read-only exploration: trace data flows, map dependencies |

To use: open the **Agent Hooks** panel in Kiro, find the workflow, and click the play button (▷) or select the hook and click **Start Hook**.

## Adding Git Hooks

```bash
npx ai-gov init --agent kiro --git-hooks
```

This generates bash scripts in `.kiro/git-hooks/` that run on `git commit`. These are the same checks regardless of agent — file size, secrets, commit message format, TODOs.

## Workspace Setup

For multi-project workspaces:

```bash
npx ai-gov workspace --agent kiro --dir /path/to/workspace
```

This generates per-project governance in each sub-project's `.kiro/` directory, plus shared workspace-level steering files.

## Upgrading

```bash
# Upgrade hooks only (preserves steering files)
npx ai-gov upgrade --agent kiro

# Upgrade everything including steering files
npx ai-gov upgrade --agent kiro --force
```

## Doctor

Verify your Kiro governance setup:

```bash
npx ai-gov doctor --agent kiro
```

Checks: steering files present with front-matter, hook JSON files valid, spec templates present, python3/jq available for git hooks.

## New Developer Onboarding

After cloning a repo with Kiro governance:

```bash
npx ai-gov onboard
```

Auto-detects `.kiro/` and installs git hook wrappers.

```bash
# Preview what onboard would do
npx ai-gov onboard --dry-run
```

If the project uses MCP servers, also run:

```bash
npx ai-gov mcp onboard
```

See [MCP Governance Guide](./mcp-governance-guide.md) for MCP token setup details.
