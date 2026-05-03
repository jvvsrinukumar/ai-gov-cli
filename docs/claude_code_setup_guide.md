# Claude Code Setup Guide

> Set up AI governance for teams using Claude Code. This guide covers initialization, what gets generated, and how Claude Code hooks work.

## Quick Start

```bash
# Initialize Claude Code governance (default — no --agent flag needed)
npx ai-gov init

# Explicit (same result as above)
npx ai-gov init --agent claude-code

# Preview without writing files
npx ai-gov init --dry-run

# Force a specific stack
npx ai-gov init --stack flutter

# All three layers at once
npx ai-gov init --git-hooks --ci github
```

> **Note:** Claude Code is the default agent. Running `npx ai-gov init` without `--agent` picks Claude Code automatically — unless a `.kiro/` directory already exists (in which case it auto-detects Kiro).

## What Gets Generated

```
your-project/
├── CLAUDE.md                              ← Root pointer: tells Claude "go read .claude/CLAUDE.md"
├── .claude/
│   ├── CLAUDE.md                          ← Master rules file (Claude reads this every session)
│   ├── settings.json                      ← Registers all 11 Claude Code hooks
│   ├── custom-hooks.json                  ← Your team's custom hooks (never overwritten)
│   ├── steering/
│   │   ├── constitution.md                ← Hard rules (never skip layers, never bypass specs)
│   │   ├── architecture.md                ← Layer flow, project structure, high-risk files
│   │   ├── coding-standards.md            ← Naming, file size limits, error handling
│   │   ├── ai-usage-policy.md             ← What Claude can/cannot do autonomously
│   │   ├── workflow.md                    ← Feature, bug, hotfix workflows
│   │   ├── spec-first-workflow.md         ← Spec-before-code enforcement with STOP gates
│   │   ├── feature-readme.md              ← README policy per feature
│   │   └── prompt-templates.md            ← Reusable templates for common tasks
│   ├── hooks/                             ← 11 bash hook scripts (run inside the IDE)
│   │   ├── check-spec-exists.sh           ← Blocks file writes until spec is complete
│   │   ├── protect-files.sh               ← Warns on high-risk file edits
│   │   ├── check-secrets.sh               ← Blocks hardcoded credentials
│   │   ├── block-dangerous-commands.sh    ← Blocks force push, rm -rf src/
│   │   ├── check-file-size.sh             ← Warns >200 lines, blocks >300 lines
│   │   ├── format-code.sh                 ← Auto-formats after every file write
│   │   ├── analyze-code.sh                ← Runs linter after every file write
│   │   ├── check-feature-readme.sh        ← Ensures README is updated per feature
│   │   ├── check-consistency.sh           ← Warns when spec and code have drifted
│   │   ├── session-continuity.sh          ← Context summary at session start
│   │   └── post-task-checklist.sh         ← Reminds Claude to confirm arch, flag risks
│   ├── commands/                          ← Slash commands (type /command in Claude Code)
│   │   ├── new-feature.md                 ← /new-feature — 3-gate spec workflow
│   │   ├── edit-feature.md                ← /edit-feature — targeted changes
│   │   ├── fix.md                         ← /fix — reproduce, diagnose, fix, verify
│   │   ├── refactor.md                    ← /refactor — impact analysis gate
│   │   ├── hotfix.md                      ← /hotfix — minimal urgent fix
│   │   ├── explore.md                     ← /explore — read-only codebase questions
│   │   ├── audit.md                       ← /audit — full governance audit
│   │   └── assess.md                      ← /assess — refactor vs rewrite assessment
│   └── extensions/
│       ├── manifest.json
│       ├── jira-sync/run.sh
│       ├── retrospective/run.sh
│       └── verify/run.sh
└── specs/
    └── _template/                         ← Blank spec template to copy per feature
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

## How Claude Code Hooks Work

Claude Code hooks are bash scripts registered in `.claude/settings.json`. They fire automatically when Claude performs actions in the IDE.

### Hook Types

| Event | When It Fires | Example |
|-------|---------------|---------|
| `PreToolUse` (bash) | Before Claude writes a file or runs a command | Block dangerous commands, check spec exists |
| `PostToolUse` (bash) | After Claude writes a file | Format code, check file size, run linter |
| `UserPromptSubmit` (bash) | When a message is sent | Session continuity, task classification |

### Enforcement Model

Claude Code hooks use hard enforcement via exit codes:

- **`exit 0`** — hook passes, Claude proceeds
- **`exit 2`** — hook blocks the action, Claude cannot proceed (hard block)
- **Warning (exit 0 with stderr)** — hook passes but prints a warning Claude must acknowledge

This is mechanical enforcement — Claude cannot bypass an `exit 2`. The hook script runs before the tool call completes, and a non-zero exit cancels it.

### Slash Commands

Slash commands are markdown files in `.claude/commands/`. Type `/command-name` in Claude Code chat to trigger a guided workflow.

| Command | Gates | What It Does |
|---------|:-----:|--------------|
| `/new-feature` | 3 | Spec-first: requirements → design → tasks → implement |
| `/edit-feature` | 1 | Read existing spec + code → propose changes → implement |
| `/fix` | 1 | Reproduce → root cause → minimal fix → regression test |
| `/refactor` | 1 | Impact analysis → tests before → apply → tests after |
| `/hotfix` | 1 | Emergency: smallest change, must have test |
| `/explore` | 0 | Read-only: trace data flows, answer questions |
| `/audit` | 0 | 11-step governance audit → writes dated report to docs/ |
| `/assess` | 0 | Refactor vs rewrite evidence-based assessment |

**Plan mode:** Commands that have gates start with `EnterPlanMode`. Claude can read files and show plans but cannot write anything until you approve each gate.

## Adding Git Hooks

```bash
npx ai-gov init --git-hooks
```

This generates bash scripts in `.claude/git-hooks/` that run on `git commit`:

- **pre-commit.sh** — orchestrator running 6 checks (file size, secrets, TODOs, debug statements, format, lint)
- **commit-msg.sh** — validates conventional commit format
- **config.json** — enable/disable checks, set thresholds

### What gets blocked

| Check | Blocks | Warns |
|-------|--------|-------|
| File size | > 300 lines | > 200 lines |
| Secrets | AWS AKIA keys, credential-named variables | — |
| TODOs | — | TODO/FIXME without ticket reference |
| Debug | — | console.log, print, debugger |
| Format | — | Unformatted files (off by default) |
| Lint | — | Lint errors (off by default) |

## Adding CI

```bash
npx ai-gov init --ci github    # GitHub Actions
npx ai-gov init --ci gitlab    # GitLab CI
npx ai-gov init --ci bitbucket # Bitbucket Pipelines
```

Generates a CI pipeline that runs `ai-gov pr-check` on every PR and posts results as a comment. No tokens needed — uses built-in CI credentials.

## Workspace Setup

For multi-project workspaces:

```bash
npx ai-gov workspace --dir /path/to/workspace
```

Auto-discovers sub-projects, detects each stack, generates per-project governance, and adds shared workspace-level steering files.

## Upgrading

```bash
# Upgrade hooks + commands (preserves steering files)
npx ai-gov upgrade

# Upgrade everything including steering files
npx ai-gov upgrade --force
```

**Always upgraded:** hooks, git-hooks, commands, CLAUDE.md
**Preserved by default:** steering files, specs, custom-hooks.json

## Doctor

Verify your Claude Code governance setup:

```bash
npx ai-gov doctor
```

Checks: CLAUDE.md exists, settings.json valid, all 11 hooks present, python3/jq installed, git hooks wired, config.json schema valid.

## New Developer Onboarding

After cloning a repo with Claude Code governance:

```bash
npx ai-gov onboard
```

Installs `.git/hooks/` wrappers, verifies python3/jq runtime, confirms governance files are present.

Or without Node.js:

```bash
curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash
```
