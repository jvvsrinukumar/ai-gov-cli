# Setup Guide — Step by Step

This guide assumes you've never used the governance framework before. Follow every step in order.

---

## Prerequisites

You need these installed before starting:

| Tool | Why | Check Command |
|------|-----|--------------|
| **Node.js 18+** | Runs the CLI | `node --version` |
| **npm** | Installs dependencies | `npm --version` |
| **jq** | All 11 hooks need it | `jq --version` |
| **git** | Repository detection | `git --version` |
| **Claude Code** | The AI agent | `claude --version` |

**If `jq` is missing, ALL hooks silently fail. Zero governance is enforced. This is the #1 setup issue.**

---

## Step 1: Install jq

```bash
# macOS
brew install jq

# Ubuntu / Linux
sudo apt update && sudo apt install -y jq

# Windows (in PowerShell as admin, then use WSL2 or Git Bash)
winget install jqlang.jq
```

Verify: `jq --version` → should show `jq-1.6` or higher.

---

## Step 2: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

Verify: `claude --version`

---

## Step 3: Clone and Build the Governance CLI

Every developer does this once.

```bash
# Clone the repo
git clone https://github.com/jvvsrinukumar/ai-gov-cli.git

# Go into the CLI directory
cd ai-gov-cli

# Install dependencies
npm install

# Build the TypeScript
npm run build

# Link globally — makes 'ai-gov' available from any directory
npm link
```

Verify: `ai-gov --version` → should show `15.0.0`

**What `npm link` does:** Creates a global symlink from `ai-gov` to your local build. No npm publish needed. The command `ai-gov` now works from any project directory on your machine.

---

## Step 4: Run Governance in Your Project

```bash
# Go to your project (the one you actually work on)
cd /path/to/your/project

# Run governance setup — auto-detects your stack
ai-gov init
```

The CLI scans your project, detects the stack and all libraries, and generates ~25 files under `.claude/` and `specs/`.

If it detects the wrong stack, specify explicitly:

```bash
ai-gov init --stack flutter
ai-gov init --stack react
ai-gov init --stack kotlin
ai-gov init --stack angular
ai-gov init --stack nodejs
ai-gov init --stack python
```

### Preview Before Generating

```bash
ai-gov init --dry-run    # shows what would be generated without writing anything
```

---

## Step 5: Verify Setup

Run these checks to make sure everything is working:

```bash
# 1. Check governance files were created
ls .claude/CLAUDE.md              # should exist
ls .claude/settings.json          # should exist
ls .claude/hooks/*.sh             # should show 11 scripts

# 2. Check jq works (critical — hooks depend on this)
echo '{"test":"ok"}' | jq -r '.test'    # should print "ok"

# 3. Test a hook manually
echo '{"tool_input":{"command":"git push --force"}}' | bash .claude/hooks/block-dangerous-commands.sh
# Should print: "BLOCKED: force push not allowed."

# 4. Check hook version
head -2 .claude/hooks/protect-files.sh
# Should show:
# #!/usr/bin/env bash
# # HOOK_VERSION=15.0.0
```

---

## Step 6: Start Claude Code — What You'll See

```bash
# From your project directory
claude
```

Claude Code automatically reads `.claude/CLAUDE.md` and all 8 steering files on startup.

### What Claude Shows When It First Loads

When you open a governed project in Claude Code, Claude loads your governance context immediately. Here is what a Flutter project looks like on first launch:

```
> claude

Claude Code (claude-sonnet-4-6)  ✓ Connected

Reading governance files...
  .claude/CLAUDE.md          ✓
  .claude/steering/architecture.md          ✓  (Flutter BLoC — clean arch)
  .claude/steering/coding-standards.md      ✓
  .claude/steering/naming-conventions.md    ✓
  .claude/steering/hard-rules.md            ✓
  .claude/steering/spec-first-workflow.md   ✓
  .claude/steering/workflow-classification.md ✓
  .claude/steering/constitution.md          ✓
  .claude/steering/test-strategy.md         ✓

Hooks active: 11 (check-spec-exists, check-secrets, block-dangerous,
  check-file-size, protect-files, session-continuity, format-code,
  analyze-code, check-feature-readme, check-consistency, post-task-checklist)

Stack: Flutter (BLoC + get_it + go_router + Dio + Hive)
Ready. I will follow all governance rules in this session.

>
```

### Session Start — What Claude Outputs Next

The `session-continuity` hook fires immediately and shows your progress:

```
[session-continuity] Last session: 2026-04-24
  Feature in progress: user_profile
  Tasks completed: 3/7 (phases 1-3 done)
  Next: Phase 4 — Repository layer
  High-risk files modified: lib/core/di/injection.dart
```

### Your First Test — Try This Prompt

```
## Task Type: New Feature
## Feature: hello_world

Build a simple hello world screen.
```

**What Claude does, step by step:**

1. Classifies task as "New Feature" (reads `workflow-classification.md`)
2. Reads `architecture.md` and `coding-standards.md`
3. Checks if `specs/hello_world/` exists — it doesn't
4. Creates spec from template: fills `requirements.md`, `design.md`, `tasks.md`
5. Shows the full plan (feature folder structure, phases, acceptance criteria)
6. **STOPS and waits for your "go ahead"**
7. After confirmation: implements phase by phase, hook fires after each file written

**If Claude skips straight to coding without specs:**
- Is `.claude/CLAUDE.md` present? → `ls .claude/CLAUDE.md`
- Is `jq` installed? → `jq --version`
- Are hooks registered? → `cat .claude/settings.json | head -20`

### Your First Governance Check — Run /audit

After init, run an audit to verify the CLI picked up your stack correctly and all steering is accurate:

```
/audit
```

Claude will run a 12-step check and return a health scorecard:

```
/audit — Project Truth Check
════════════════════════════════════════
Stack: Flutter (BLoC · get_it · go_router)
Audit date: 2026-04-25

HEALTH SCORECARD
────────────────
Governance       A  97/100  All 8 steering files present, hooks v15.0.0
Architecture     B  88/100  Layer flow clean — 1 widget calls repo directly
Code Patterns    A  92/100  94% BLoC usage, 2 files still use setState
Feature Structure B  80/100  4/5 features have spec + README
Test Coverage    C  65/100  3 features untested, BLoC tests missing
Dead Code        A  95/100  2 unused exports found

OVERALL: B  86/100  PASS WITH UPDATES
════════════════════════════════════════

Step 11: Updating .claude/steering/architecture.md ... done
Step 11: Updating .claude/steering/coding-standards.md ... done

ACTION ITEMS
1. Add BLoC unit tests for: auth_cubit, profile_cubit
2. Move direct repo call in profile_widget.dart to cubit
3. Create spec for: notifications feature
```

The scorecard improves each time you run `/audit` and fix the findings.

---

## Step 7: Commit Governance Files

```bash
git add .claude/ specs/ CLAUDE.md
git commit -m "chore: add AI governance framework v14.3"
git push
```

Every developer who pulls this branch gets the same governance enforced automatically.

---

## Alternative: Without npm link

If you prefer not to use `npm link`, you can run the CLI directly:

```bash
# Option A: Use full path
node /path/to/ai-gov-cli/dist/bin/ai-gov.js init

# Option B: Add an alias to ~/.bashrc or ~/.zshrc
echo 'alias ai-gov="node ~/ai-gov-cli/dist/bin/ai-gov.js"' >> ~/.bashrc
source ~/.bashrc

# Option C: Use npx with local path
npx /path/to/ai-gov-cli init
```

---

## Upgrading

When the CLI repo is updated:

```bash
# Pull latest changes
cd /path/to/ai-gov-cli
git pull
npm install
npm run build
# npm link is still active — ai-gov command now uses updated build

# Update hooks in your project
cd /path/to/your/project
ai-gov init --update-hooks              # updates only stale hooks
ai-gov init --update-hooks --dry-run    # preview first
ai-gov init --overwrite                 # regenerate everything
```

---

## Windows — Platform-Specific Notes

### WSL2 (Recommended)

```powershell
# Install WSL2 (PowerShell as Administrator)
wsl --install
# Restart, open Ubuntu from Start menu
# Follow all steps above inside WSL2
```

Your Windows files are at `/mnt/c/Users/YourName/Projects/your-project` inside WSL2.

### Git Bash

All steps above work in Git Bash. All hooks use `bash` prefix in settings.json which works on Git Bash.

If you see `\r` errors (Windows line endings):
```bash
sed -i 's/\r$//' .claude/hooks/*.sh
```

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| `ai-gov: command not found` | Run `npm link` inside the ai-gov-cli directory |
| `jq: command not found` | Install jq (Step 1) — without it, zero hooks work |
| Hooks don't fire (no status messages) | Check `jq --version` + check `.claude/settings.json` exists |
| Claude skips specs and codes directly | Check `.claude/CLAUDE.md` exists + check `jq` is installed |
| `permission denied` on hooks | Run `chmod +x .claude/hooks/*.sh` |
| Wrong stack detected | Re-run with `ai-gov init --stack <correct-stack> --overwrite` |
| Want to preview before generating | Use `ai-gov init --dry-run` |
| Hooks are outdated after CLI update | Run `ai-gov init --update-hooks` |
