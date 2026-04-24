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

Verify: `ai-gov --version` → should show `14.3.0`

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
# # HOOK_VERSION=14.3.0
```

---

## Step 6: Start Using with Claude Code

```bash
# From your project directory
claude
```

Claude Code automatically reads `.claude/CLAUDE.md` and follows your governance rules.

### Your First Test — Try This Prompt

```
## Task Type: New Feature
## Feature: hello_world

Build a simple hello world screen.
```

**What should happen:**

1. Claude says "This is a New Feature task"
2. Claude reads steering files (architecture.md, coding-standards.md)
3. Claude checks if `specs/hello_world/` exists — it doesn't
4. Claude creates spec from template and fills requirements.md, design.md, tasks.md
5. Claude shows you the plan
6. Claude **STOPS** and waits for your "go ahead"
7. After you confirm, Claude implements in phase order

**If Claude skips straight to coding without specs:**
- Is `.claude/CLAUDE.md` present? → `ls .claude/CLAUDE.md`
- Is `jq` installed? → `jq --version`
- Are hooks registered? → `cat .claude/settings.json | head -20`

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
