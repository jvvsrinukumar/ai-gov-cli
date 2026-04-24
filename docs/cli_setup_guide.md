# Setup Guide — Step by Step

This guide assumes you've never used the governance framework before. Follow your platform section exactly.

---

## Prerequisites

You need these installed before starting:

| Tool | Why | Check Command |
|------|-----|--------------|
| **Node.js 18+** | Runs the CLI | `node --version` |
| **npm** | Installs the CLI | `npm --version` |
| **jq** | All 11 hooks need it | `jq --version` |
| **git** | Repository detection | `git --version` |
| **Claude Code** | The AI agent | `claude --version` |

**If `jq` is missing, ALL hooks silently fail. Zero governance is enforced. This is the #1 setup issue.**

---

## macOS

### Step 1: Install jq

```bash
brew install jq
```

If you don't have Homebrew: `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`

### Step 2: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### Step 3: Install the governance CLI

```bash
npm install -g @anthropic-governance/cli
```

### Step 4: Run it in your project

```bash
cd /path/to/your/project
ai-gov init
```

The script auto-detects your stack. If it guesses wrong: `ai-gov init --stack flutter`

### Step 5: Verify

```bash
# Check files were created
ls .claude/CLAUDE.md          # should exist
ls .claude/hooks/*.sh          # should show 11 scripts

# Check jq works (critical)
echo '{"test":"ok"}' | jq -r '.test'    # should print "ok"

# Check a hook manually
echo '{"tool_input":{"command":"git push --force"}}' | bash .claude/hooks/block-dangerous-commands.sh
# Should print: "BLOCKED: force push not allowed."
```

### Step 6: Start using

```bash
claude
```

Type your first task. Claude reads `.claude/CLAUDE.md` and follows the rules.

---

## Linux (Ubuntu/Debian)

### Step 1: Install prerequisites

```bash
sudo apt update
sudo apt install -y jq
```

### Step 2: Install Node.js 18+

```bash
# Option A: via nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20

# Option B: via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3: Install Claude Code + governance CLI

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @anthropic-governance/cli
```

### Step 4: Run it

```bash
cd /path/to/your/project
ai-gov init
```

### Step 5: Verify

Same as macOS Step 5 above.

---

## Windows

### Option A: WSL2 (Recommended)

```powershell
# Run PowerShell as Administrator
wsl --install
# Restart computer, open Ubuntu from Start menu
# Then follow the Linux guide above inside WSL2
```

Your Windows files are at `/mnt/c/Users/YourName/Projects/your-project` inside WSL2.

### Option B: Git Bash

```bash
# Install Git for Windows from https://git-scm.com/download/win
# Install jq: winget install jqlang.jq
# Install Node.js from https://nodejs.org (LTS)

npm install -g @anthropic-ai/claude-code
npm install -g @anthropic-governance/cli

cd /c/Users/YourName/Projects/your-project
ai-gov init
```

All hooks use `bash` prefix in settings.json — this works on Git Bash, WSL2, macOS, and Linux.

---

## After Setup — Your First Task

Open Claude Code in your project:

```bash
claude
```

Type this as your first prompt to test governance:

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

If Claude skips straight to coding without specs, check:
- Is `.claude/CLAUDE.md` present? (`ls .claude/CLAUDE.md`)
- Is `jq` installed? (`jq --version`)
- Are hooks executable? (`ls -la .claude/hooks/*.sh`)

---

## Upgrading

```bash
# Update the CLI
npm update -g @anthropic-governance/cli

# Update only hooks in your project (preserves your steering file edits)
ai-gov init --update-hooks

# Or preview first
ai-gov init --update-hooks --dry-run

# Full regeneration (resets everything)
ai-gov init --overwrite
```

---

## Commit the Governance Files

```bash
git add .claude/ specs/ CLAUDE.md
git commit -m "chore: add AI governance framework v14.3"
git push
```

Every developer who pulls this gets the same governance enforced automatically.
