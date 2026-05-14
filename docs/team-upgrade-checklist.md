# Team Upgrade Checklist

**Package:** `ai-gov` · **Current version:** 17.6.0 · **Audience:** All developers + Team leads

Share this page whenever a new version of `ai-gov` is released. Follow the steps top to bottom.

---

## Step 1 — Check your current CLI version

```bash
ai-gov --version
```

If you get "command not found", the CLI is not installed globally. Install it first (Step 2).

Expected output for this release:

```
17.6.0
```

---

## Step 2 — Upgrade the CLI globally

```bash
npm install -g ai-gov@latest
```

Verify the upgrade worked:

```bash
ai-gov --version
# 17.6.0
```

> **First install?** Same command: `npm install -g ai-gov@latest`

---

## Step 3 — Upgrade governance in your project

Run this from the root of each project that has been initialised with `ai-gov init`.

### Standard upgrade (recommended — preserves steering files)

```bash
npx ai-gov upgrade
```

What changes:

| Path | Action |
|------|--------|
| `.claude/hooks/` (11 scripts) | Regenerated |
| `.claude/git-hooks/` (pre-commit + checks) | Regenerated |
| `.claude/commands/` (slash commands: jira, backlog, audit, …) | Regenerated |
| `.claude/CLAUDE.md` | Regenerated (app name preserved) |
| `.claude/steering/architecture.md` | **Preserved** |
| `.claude/steering/coding-standards.md` | **Preserved** |
| `.claude/steering/workflow.md` | **Preserved** |
| `.claude/steering/constitution.md` | **Preserved** |

> Same applies to `.kiro/` if you use Kiro agent.

### Preview before writing (dry run)

```bash
npx ai-gov upgrade --dry-run
```

Nothing is written — shows you exactly which files would change.

### Full upgrade including steering (team lead only)

Use this when the framework's baseline guidance has changed significantly and the team wants to review the new templates.

```bash
# Back up your customisations first
cp -r .claude/steering .claude/steering-backup

# Regenerate everything including steering
npx ai-gov upgrade --force

# Diff your backup vs the new generated versions and re-apply custom rules
```

---

## Step 4 — Commit and push

```bash
git add .claude/        # or .kiro/ if using Kiro
git commit -m "chore: upgrade ai-gov to v17.6.0"
git push
```

Teammates get the updated hooks and commands on their next `git pull`. **No one else needs to run upgrade** — the scripts live in `.claude/` (committed to git).

> **Exception:** A developer who has never run `npx ai-gov init --git-hooks` on their machine will not have the local `.git/hooks/pre-commit` wrapper installed. They need to run that once after pulling:
> ```bash
> npx ai-gov init --git-hooks
> ```

---

## Step 5 — Workspace projects (if applicable)

If you maintain a workspace with multiple sub-projects, run the workspace upgrade from the workspace root:

```bash
npx ai-gov workspace --upgrade
```

This runs `upgrade` across every sub-project that has governance set up. Use `--force` to also regenerate steering files:

```bash
npx ai-gov workspace --upgrade --force
```

Or upgrade individual sub-projects one at a time:

```bash
npx ai-gov upgrade --dir ./frontend
npx ai-gov upgrade --dir ./backend
npx ai-gov upgrade --dir ./mobile
```

---

## MCP governance — check if anything changed

If this release updated MCP server versions (package pins), regenerate `.mcp.json` and `.env.mcp.example`:

```bash
# Team lead runs this in each project that uses MCP
npx ai-gov mcp init --overwrite
git add .mcp.json .env.mcp.example
git commit -m "chore: update MCP server versions"
git push
```

Developers then run `onboard` to check if any new tokens are needed:

```bash
npx ai-gov mcp onboard
# Already-set tokens are skipped automatically
```

---

## Quick reference — all version/upgrade commands

```bash
# Check CLI version
ai-gov --version

# Upgrade CLI globally
npm install -g ai-gov@latest

# Upgrade single project (hooks + commands, preserves steering)
npx ai-gov upgrade

# Upgrade single project + steering
npx ai-gov upgrade --force

# Preview only — writes nothing
npx ai-gov upgrade --dry-run

# Upgrade specific directory
npx ai-gov upgrade --dir ./path/to/project

# Upgrade entire workspace
npx ai-gov workspace --upgrade

# Upgrade workspace + steering
npx ai-gov workspace --upgrade --force

# Health check after upgrade
npx ai-gov doctor
```

---

## What changed in v17.6.0

### MCP governance (`ai-gov mcp`)

New command group for managing MCP server tokens securely across a team:

- `ai-gov mcp init` — team lead sets up `.mcp.json` with `${VAR}` placeholders; no tokens ever committed
- `ai-gov mcp onboard` — each developer sets their own tokens once; global tokens (Jira, Figma, GitHub) stored in `~/.config/ai-gov/.env.mcp.global` and reused across all projects automatically
- `ai-gov mcp validate` — checks all required tokens are present in current environment
- `ai-gov mcp update-token --tool jira` — rotate a single tool's tokens

See [MCP Governance Guide](./mcp-governance-guide.md) for the full walkthrough.

### Jira Sync command (`/jira`)

New slash command for Claude Code (`/jira`) and Kiro hook (`workflow-jira-sync`) that reads spec `tasks.md` time estimates and creates Jira stories + sub-tasks via the Jira MCP server. Stores `.jira` metadata per spec to prevent duplicate sub-tasks on re-runs.

### Task estimates steering

`task-estimates.md` is now generated in both `.claude/steering/` and `.kiro/steering/` — provides Claude and Kiro with the team's time-boxing conventions (`[S]` / `[M]` / `[L]` / `[~Xmin]`).

---

## Troubleshooting

**`ai-gov: command not found` after global install**

Your npm global bin directory is not in `PATH`. Find it and add it:

```bash
npm root -g          # e.g. /usr/local/lib/node_modules
npm bin -g           # e.g. /usr/local/bin  ← add this to PATH
```

Add to `~/.zshrc` or `~/.bashrc`:

```bash
export PATH="$(npm bin -g):$PATH"
```

**"`.claude/` not found — run `ai-gov init` first"**

The project was never initialised. Run init first:

```bash
npx ai-gov init
```

**App name is wrong after upgrade**

Upgrade extracts the app name from the existing `.claude/CLAUDE.md` line `**App:** <name>`. If that line was removed, it falls back to `package.json`. Edit `.claude/CLAUDE.md` after upgrade and correct the `**App:**` line.

**Steering files changed when I didn't use `--force`**

Standard upgrade never touches steering files. If they changed, check for a concurrent git merge — the changes are from git, not the upgrade command.

**`--force` overwrote steering files accidentally**

Restore from git:

```bash
git checkout HEAD -- .claude/steering/
```
