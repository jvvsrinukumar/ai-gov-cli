# Kiro Setup Guide

> Set up AI governance for teams using Kiro. This guide covers initialization, what gets generated, and how Kiro hooks work.

## Quick Start

```bash
# Initialize Kiro governance (--agent kiro is required)
npx ai-gov init --agent kiro

# Preview without writing files
npx ai-gov init --agent kiro --dry-run

# Force a specific stack
npx ai-gov init --agent kiro --stack flutter
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
│   │   ├── block-dangerous-commands.json  ← Blocks force push, rm -rf
│   │   ├── protect-files.json             ← Warns on high-risk file edits
│   │   ├── pre-write-secrets-gate.json    ← Blocks writes with hardcoded credentials
│   │   ├── spec-first-gate.json           ← Blocks writes without spec (if enabled)
│   │   ├── check-secrets.json             ← Scans for hardcoded credentials
│   │   ├── check-file-size.json           ← Warns on files > 200 lines
│   │   ├── format-code.json               ← Auto-formats after write
│   │   ├── analyze-code.json              ← Runs linter after write
│   │   ├── check-feature-readme.json      ← Reminds to update feature README
│   │   ├── check-consistency.json         ← Detects spec-vs-code drift
│   │   ├── session-continuity.json        ← Context preservation
│   │   ├── require-task-type.json         ← Task classification prompt
│   │   ├── post-task-checklist.json       ← Post-task verification
│   │   ├── workflow-audit.json            ← Governance audit (userTriggered)
│   │   ├── workflow-new-feature.json      ← Spec-first feature workflow (userTriggered)
│   │   ├── workflow-fix.json              ← Bug fix workflow (userTriggered)
│   │   ├── workflow-refactor.json         ← Refactor with impact gate (userTriggered)
│   │   ├── workflow-hotfix.json           ← Emergency production fix (userTriggered)
│   │   ├── workflow-explore.json          ← Read-only exploration (userTriggered)
│   │   └── README.md
│   └── specs/
│       └── _template/                     ← Spec templates (Kiro-native location)
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
```

## How Kiro Hooks Work

Kiro hooks are JSON files that Kiro discovers automatically from `.kiro/hooks/`. Each hook has:

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
| `workflow-audit.json` | `/audit` | Full governance audit: observe → compare to steering → report drift |
| `workflow-new-feature.json` | `/new-feature` | Spec-first 3-gate workflow: requirements → design → tasks → implement |
| `workflow-fix.json` | `/fix` | Bug diagnosis: reproduce → root cause → minimal fix → regression test |
| `workflow-refactor.json` | `/refactor` | Impact analysis gate → tests before → apply → tests after |
| `workflow-hotfix.json` | `/hotfix` | Emergency fix: smallest change, must have test |
| `workflow-explore.json` | `/explore` | Read-only exploration: trace data flows, map dependencies |

To use: open the **Agent Hooks** panel in Kiro, find the workflow, and click the trigger button.

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
