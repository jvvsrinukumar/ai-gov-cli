# MCP Governance Guide

**Version:** 18.0.0 · **Audience:** Team leads + Developers · **Feature:** `ai-gov mcp`

Governs how MCP (Model Context Protocol) servers — Jira, Figma, Zeplin, PostgreSQL, GitHub, and others — are configured across a team so that:

- No tokens are ever committed to git
- Every developer gets prompted for exactly the tokens they need
- Adding a new tool takes one command

---

## The problem this solves

Without governance, teams end up with configs like this committed to git:

```json
"env": {
  "ATLASSIAN_API_TOKEN": "ATATT3xFfGF0p8Wmr96vcix..."
}
```

With this system:
- `.mcp.json` is committed with `${ENV_VAR}` placeholders — no real values
- Each developer's tokens live in their local `.env.mcp` — never committed
- Onboarding is a single command with guided prompts

---

## Two roles, two commands

```
TEAM LEAD (once per project)              DEVELOPER (once per clone)
─────────────────────────────             ──────────────────────────
npx ai-gov mcp init                       git clone <repo>
  → picks tools: jira, figma, postgres    npx ai-gov mcp onboard
  → enters org-wide values                  → prompted per tool, skip any
    (ATLASSIAN_SITE_NAME=accushield)      → writes .env.mcp (gitignored)
  → generates .mcp.json  ── git push ──→  → loads tokens into shell
  → generates .env.mcp.example
  → adds .env.mcp to .gitignore
  → generates .envrc (direnv)
  → commits all 3 files
```

---

## What gets committed vs gitignored

| File | Committed | Contains |
|------|-----------|----------|
| `.mcp.json` | Yes | Tool config with `${VAR}` placeholders; org values baked in |
| `.env.mcp.example` | Yes | Template listing all required vars with instructions |
| `.envrc` | Yes | Loads global env file then project `.env.mcp` — direnv loader |
| `.env.mcp` | **No (gitignored)** | Per-project tokens for this repo only |
| `~/.config/ai-gov/.env.mcp.global` | **No (machine-local)** | Global tokens shared across all your projects |

---

## Team Lead: `npx ai-gov mcp init`

Run this once per project. Commit the output.

### Terminal walkthrough

```
============================================
 MCP Governance — Project Setup
============================================

  Configures .mcp.json with ${ENV_VAR} placeholders for team use.
  Each developer runs: npx ai-gov mcp onboard to set their tokens.

? Which tools does this project use? (Space = toggle, Enter = confirm)

  ◉ Jira (Atlassian)     [pm]
  ◉ Figma                [design]
  ◉ Zeplin               [design]
  ◉ PostgreSQL           [database]
  ◯ GitHub               [devops]
  ◯ Linear               [pm]
  ◯ Notion               [communication]
  ◯ Slack                [communication]
  ◯ Sentry               [devops]

──── Org-wide values (shared by all developers, not secret) ────

  Jira: Atlassian Site Name
  (e.g. "accushield" from accushield.atlassian.net)
? Site name: accushield

────────────────────────────────────────────
  Created: .mcp.json
  Created: .env.mcp.example
  Created: .envrc
  Updated: .gitignore (.env.mcp added)

  Next steps:
    1. Review .mcp.json
    2. git add .mcp.json .env.mcp.example .envrc .gitignore
    3. git commit -m "chore: add MCP governance"
    4. git push
    Each developer then runs: npx ai-gov mcp onboard
```

### What `.mcp.json` looks like after init

Org-wide values (like site name) are baked in as literals. Personal tokens use `${VAR}` placeholders that Claude Code substitutes from the developer's environment at startup.

```json
{
  "_aigov": {
    "version": "18.0.0",
    "tools": ["jira", "figma", "zeplin", "postgres"]
  },
  "mcpServers": {
    "jira": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@aashari/mcp-server-atlassian-jira@3.3.0"],
      "env": {
        "ATLASSIAN_SITE_NAME": "accushield",
        "ATLASSIAN_USER_EMAIL": "${ATLASSIAN_USER_EMAIL}",
        "ATLASSIAN_API_TOKEN":  "${ATLASSIAN_API_TOKEN}"
      },
      "timeout": 120000,
      "autoApprove": ["jira_get", "jira_post", "jira_put"]
    },
    "figma": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "figma-mcp@0.1.4"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}"
      },
      "timeout": 120000,
      "autoApprove": ["figma_get_file", "figma_get_node"]
    },
    "zeplin": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zeplin/mcp@0.1.4"],
      "env": {
        "ZEPLIN_ACCESS_TOKEN": "${ZEPLIN_ACCESS_TOKEN}"
      },
      "timeout": 120000,
      "autoApprove": ["get_screen"]
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres@0.6.2", "${DATABASE_URL}"],
      "timeout": 1200000,
      "autoApprove": ["query"]
    }
  }
}
```

### What `.env.mcp.example` looks like after init

```bash
# MCP Server Tokens — personal credentials, one per developer
# Copy this file to .env.mcp and fill in your own values.
# .env.mcp is gitignored — never commit it.
#
# Setup: npx ai-gov mcp onboard

# ── Jira (Atlassian) ─────────────────────────────
# Token URL: https://id.atlassian.com/manage-profile/security/api-tokens
# Your Atlassian account email
ATLASSIAN_USER_EMAIL=
# Atlassian personal API token
ATLASSIAN_API_TOKEN=

# ── Figma ────────────────────────────────────────
# Token URL: https://www.figma.com/settings (Personal access tokens)
# Figma personal access token for reading designs
FIGMA_ACCESS_TOKEN=

# ── Zeplin ───────────────────────────────────────
# Token URL: https://app.zeplin.io/profile/developer-tools
# Zeplin personal access token
ZEPLIN_ACCESS_TOKEN=

# ── PostgreSQL ───────────────────────────────────
# Full PostgreSQL connection URL
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
```

---

## Developer: `npx ai-gov mcp onboard`

Run this after cloning. Each tool asks "do you use this?" before requesting tokens. Skip any tool you don't use — it simply won't be available in your Claude Code session.

### Terminal walkthrough

```
============================================
 MCP Token Setup
============================================

  Found 4 tools in .mcp.json: jira, figma, zeplin, postgres

──── Jira (Atlassian) ────────────────────

? Do you use Jira? (Y/n): Y

  Your Atlassian login email
? Email: srinu@accushield.com

  Personal API token — never share this
  Generate one: https://id.atlassian.com/manage-profile/security/api-tokens
? API Token: [hidden ****]

──── Figma ───────────────────────────────

? Do you use Figma? (Y/n): Y

  Personal access token
  Generate one: https://www.figma.com/settings → Security → Personal tokens
? Figma Token: [hidden ****]

──── Zeplin ──────────────────────────────

? Do you use Zeplin? (Y/n): n
  → Skipped. Zeplin won't be available in your Claude Code session.

──── PostgreSQL ──────────────────────────

? Do you use PostgreSQL? (Y/n): Y

  Full connection URL including credentials
? DATABASE_URL: postgresql://srinu:mypass@localhost:5432/dev

──── Done ────────────────────────────────

  .env.mcp written  (3 of 4 tools configured, 1 skipped)

  Load tokens into your shell — pick one:

  Option A: direnv (recommended, .envrc already in repo)
    Install direnv: https://direnv.net
    Run once per clone: direnv allow
    Tokens load automatically when you cd into this directory.

  Option B: shell profile
    Add to ~/.zshrc or ~/.bashrc:
    [ -f "$PWD/.env.mcp" ] && set -a && source "$PWD/.env.mcp" && set +a

  Then restart your shell and start Claude Code.
```

### What `.env.mcp` looks like after onboard

This file is gitignored. Only you have it, only on your machine.

```bash
# MCP Server Tokens — personal, never commit this file
# Updated: 2026-05-14T10:23:00.000Z

# Jira (Atlassian)
ATLASSIAN_USER_EMAIL=srinu@accushield.com
ATLASSIAN_API_TOKEN=ATATT3xFfGF0p8Wmr96vcix...

# Figma
FIGMA_ACCESS_TOKEN=figd_abc123...

# PostgreSQL
DATABASE_URL=postgresql://srinu:mypass@localhost:5432/dev
```

---

## Re-running onboard (idempotent)

Running `onboard` again skips tokens already set and only prompts for missing ones.

```
npx ai-gov mcp onboard   (second run)

  ✓ ATLASSIAN_USER_EMAIL — already set
  ✓ ATLASSIAN_API_TOKEN  — already set
  ✓ FIGMA_ACCESS_TOKEN   — already set
  - ZEPLIN_ACCESS_TOKEN  — skipped by you

  All done. Nothing changed.
```

---

## Updating a token

```bash
# Single tool — only re-prompts that tool's tokens
npx ai-gov mcp update-token --tool jira

# All tokens — re-prompts everything
npx ai-gov mcp update-token
```

Useful when:
- Your Atlassian token expires (90-day default)
- You rotate credentials
- You switch to a different database environment

---

## Validating your setup

```bash
npx ai-gov mcp validate
```

```
============================================
 MCP Token Validation
============================================

  ✓ Jira (Atlassian)  — ATLASSIAN_USER_EMAIL, ATLASSIAN_API_TOKEN
  ✓ Figma             — FIGMA_ACCESS_TOKEN
  - Zeplin            — skipped (no token set)
  ✓ PostgreSQL        — DATABASE_URL

  3 of 4 tools ready. Zeplin not configured (skipped during onboard).
```

**Use in CI to verify the project config is valid** (not developer tokens — those aren't in CI):

```yaml
# .github/workflows/ci.yml
- name: Validate MCP config
  run: npx ai-gov mcp validate --config-only
```

---

## Adding a new MCP tool to the project

### Case A — tool is in the catalog (Jira, Figma, Zeplin, Postgres, GitHub, Linear, Notion, Slack, Sentry)

```bash
# Team lead adds the tool
npx ai-gov mcp init --add github

# What happens:
#   → github entry added to .mcp.json (${GITHUB_TOKEN} placeholder)
#   → GITHUB_TOKEN line added to .env.mcp.example
#   → .mcp.json and .env.mcp.example updated

# Commit and push:
git add .mcp.json .env.mcp.example
git commit -m "chore: add GitHub MCP tool"
git push

# Each developer runs — only prompts for the NEW missing token:
npx ai-gov mcp onboard

#   ✓ ATLASSIAN_USER_EMAIL — already set
#   ✓ ATLASSIAN_API_TOKEN  — already set
#   ✓ FIGMA_ACCESS_TOKEN   — already set
#   ──── GitHub ─────────────────────────
#   ? Do you use GitHub? (Y/n): Y
#     Generate one: https://github.com/settings/personal-access-tokens
#   ? GitHub Token: [hidden ****]
```

### Case B — custom or internal tool not in the catalog

1. Manually add an entry to `.mcp.json`:

```json
"internal-api": {
  "type": "http",
  "url": "https://mcp.internal.yourcompany.com",
  "headers": {
    "Authorization": "Bearer ${INTERNAL_API_TOKEN}"
  },
  "timeout": 60000
}
```

2. Manually add to `.env.mcp.example`:

```bash
# ── Internal API ─────────────────────────────────
# Token URL: https://internal.yourcompany.com/settings/tokens
INTERNAL_API_TOKEN=
```

3. Commit both files. Developers copy `.env.mcp.example` → `.env.mcp` and fill in their token.

> `ai-gov mcp onboard` will not prompt for custom entries — developers set those manually from `.env.mcp.example`.

---

## Complete tool catalog

| Tool | Category | Transport | Personal vars | Token URL |
|------|----------|-----------|---------------|-----------|
| Jira | pm | stdio | `ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN` | https://id.atlassian.com/manage-profile/security/api-tokens |
| Figma | design | stdio | `FIGMA_ACCESS_TOKEN` | https://www.figma.com/settings |
| Zeplin | design | stdio | `ZEPLIN_ACCESS_TOKEN` | https://app.zeplin.io/profile/developer-tools |
| PostgreSQL | database | stdio | `DATABASE_URL` | — |
| GitHub | devops | http | `GITHUB_TOKEN` | https://github.com/settings/personal-access-tokens |
| Linear | pm | http | `LINEAR_API_KEY` | https://linear.app/settings/api |
| Notion | communication | http | OAuth (no token) | Run `/mcp` in Claude Code |
| Slack | communication | http | OAuth (no token) | Run `/mcp` in Claude Code |
| Sentry | devops | http | OAuth (no token) | Run `/mcp` in Claude Code |

**OAuth tools** (Notion, Slack, Sentry): no token is needed. After `mcp init` and `mcp onboard`, open Claude Code, type `/mcp`, and click the tool to authenticate via browser.

---

## Org-wide vs personal values

| Value | Who provides it | Stored in | Example |
|-------|----------------|-----------|---------|
| Atlassian site name | Team lead during `init` | `.mcp.json` as literal | `"accushield"` |
| Atlassian user email | Developer during `onboard` | `~/.config/ai-gov/.env.mcp.global` | `you@company.com` |
| Atlassian API token | Developer during `onboard` | `~/.config/ai-gov/.env.mcp.global` | `ATATT3x...` |
| Database URL | Developer during `onboard` | `.env.mcp` (project) | `postgresql://...` |

Two rules apply:
- If every developer in the org uses the same value → team lead sets it once as a literal in `.mcp.json`.
- If it's per-person or contains credentials → it's a `${VAR}` placeholder. Tokens shared across projects (Jira, Figma, GitHub) go in the global env file; tokens that differ per project (database URLs) go in the project `.env.mcp`.

---

## Working in a workspace (mono-repo / multi-project)

In a workspace where you have several projects (e.g. `frontend/`, `backend/`, `mobile/`), most tokens — your Jira credentials, Figma key, GitHub token — are the same across every project. Without workspace-aware scoping you'd be prompted for the same credentials on every clone.

### Two-level token storage

`ai-gov mcp` stores tokens in two places on each developer's machine:

| File | Location | Scope |
|------|----------|-------|
| `.env.mcp.global` | `~/.config/ai-gov/.env.mcp.global` | All projects — set once per machine |
| `.env.mcp` | Project root (gitignored) | This project only |

The `.envrc` that `mcp init` commits to each project loads both files in order — global first, then project (project values win on any conflict):

```bash
# .envrc — auto-generated by ai-gov mcp init
dotenv_if_exists ~/.config/ai-gov/.env.mcp.global
dotenv_if_exists .env.mcp
```

### Which tokens are global vs project-scoped

| Token | Scope | Rationale |
|-------|-------|-----------|
| `ATLASSIAN_USER_EMAIL` | global | Same email in every Jira project |
| `ATLASSIAN_API_TOKEN` | global | Same API key across all projects |
| `FIGMA_ACCESS_TOKEN` | global | Same Figma account |
| `ZEPLIN_ACCESS_TOKEN` | global | Same Zeplin account |
| `GITHUB_TOKEN` | global | Same GitHub account |
| `LINEAR_API_KEY` | global | Same Linear account |
| `DATABASE_URL` | **project** | Different DB per project/environment |

### Team lead: one `mcp init` per sub-project

Each project in the workspace gets its own `.mcp.json`. Tool selections can differ per project — a frontend project likely doesn't need PostgreSQL; a backend project likely doesn't need Figma.

```
workspace/
  frontend/       ← npx ai-gov mcp init  (selects: jira, figma, zeplin)
    .mcp.json
    .env.mcp.example
    .envrc

  backend/        ← npx ai-gov mcp init  (selects: jira, postgres)
    .mcp.json
    .env.mcp.example
    .envrc

  mobile/         ← npx ai-gov mcp init  (selects: jira, figma)
    .mcp.json
    .env.mcp.example
    .envrc
```

Each project's `.mcp.json` and `.env.mcp.example` are committed independently. Team leads can set different org-wide values per project (e.g. different Atlassian site names if projects span multiple Jira tenants).

### Developer: onboard once for global tokens

The first `mcp onboard` in any project sets all global-scoped tokens. Every subsequent project skips them and only asks for project-scoped tokens.

```
# ── First project (ever) ────────────────────────────────────────
cd workspace/frontend
npx ai-gov mcp onboard

  Found 3 tools in .mcp.json: jira, figma, zeplin

  ──── Jira (Atlassian) ────────────────────
  ? Do you use Jira? (Y/n): Y
  ? Email: srinu@accushield.com
  ? API Token: [hidden ****]
    ✓ Stored globally (~/.config/ai-gov/.env.mcp.global)
      This token will be reused automatically in all your projects.

  ──── Figma ───────────────────────────────
  ? Do you use Figma? (Y/n): Y
  ? Figma Token: [hidden ****]
    ✓ Stored globally (~/.config/ai-gov/.env.mcp.global)

  ──── Zeplin ──────────────────────────────
  ? Do you use Zeplin? (Y/n): n
    → Skipped.

  .env.mcp written  (0 project tokens, 2 global tokens set)


# ── Second project — global tokens already set ──────────────────
cd ../backend
npx ai-gov mcp onboard

  Found 2 tools in .mcp.json: jira, postgres

  ──── Jira (Atlassian) ────────────────────
  ✓ ATLASSIAN_USER_EMAIL — already set (global)
  ✓ ATLASSIAN_API_TOKEN  — already set (global)

  ──── PostgreSQL ──────────────────────────
  ? Do you use PostgreSQL? (Y/n): Y
  ? DATABASE_URL: postgresql://srinu:mypass@localhost:5432/backend_dev
    ✓ Stored in project .env.mcp

  .env.mcp written  (1 project token set, 2 global tokens reused)


# ── Third project — nothing new to configure ────────────────────
cd ../mobile
npx ai-gov mcp onboard

  Found 2 tools in .mcp.json: jira, figma

  ──── Jira (Atlassian) ────────────────────
  ✓ ATLASSIAN_USER_EMAIL — already set (global)
  ✓ ATLASSIAN_API_TOKEN  — already set (global)

  ──── Figma ───────────────────────────────
  ✓ FIGMA_ACCESS_TOKEN   — already set (global)

  All done. Nothing to set.
```

### Validating a workspace project

`mcp validate` reads the merged environment (global + project) and reports unified status. Run it from any project root:

```bash
cd backend
npx ai-gov mcp validate

  ✓ Jira (Atlassian)  — ATLASSIAN_USER_EMAIL (global), ATLASSIAN_API_TOKEN (global)
  ✓ PostgreSQL        — DATABASE_URL (project)

  2 of 2 tools ready.
```

### Workspace upgrade

`ai-gov workspace --upgrade` regenerates governance files across all sub-projects, including `.env.mcp.example` and `.envrc`. Token files are never touched by any upgrade — your `~/.config/ai-gov/.env.mcp.global` and each project's `.env.mcp` are yours alone.

---

## Summary of all commands

```bash
# Team lead
npx ai-gov mcp init                    # first-time project setup (interactive)
npx ai-gov mcp init --overwrite        # re-run init (e.g. after tool catalog update)
npx ai-gov mcp init --dry-run          # preview what would be generated (no files written)

# Developer
npx ai-gov mcp onboard                 # first-time personal token setup
npx ai-gov mcp onboard                 # re-run: only prompts for missing tokens
npx ai-gov mcp onboard --dry-run       # preview token setup (no files written)
npx ai-gov mcp update-token --tool jira  # update one tool's tokens
npx ai-gov mcp update-token            # update all tokens

# Validation
npx ai-gov mcp validate                # check tokens are set in current environment
npx ai-gov mcp validate --config-only  # CI: check .mcp.json is valid (no tokens needed)
npx ai-gov mcp list                    # show configured tools and their status
```

---

## Troubleshooting

**Claude Code says "environment variable not set"**

Your shell hasn't loaded `.env.mcp`. Either:
```bash
direnv allow          # if using direnv
# or
source .env.mcp       # one-off manual load
# or
# add the source line to ~/.zshrc and restart your shell
```

**Token prompt says "already set" but I want to change it**
```bash
npx ai-gov mcp update-token --tool jira
```

**I skipped Zeplin during onboard but now I need it**
```bash
npx ai-gov mcp onboard
# Will prompt for previously-skipped tools this time
```

**I committed `.env.mcp` by accident**

1. Remove it: `git rm --cached .env.mcp`
2. Rotate every token in the file immediately — treat them as compromised
3. Verify `.env.mcp` is in `.gitignore`
4. Run `npx ai-gov mcp onboard` to set new tokens

**A new developer joined — what do they do?**
```bash
git clone <repo>
npx ai-gov onboard         # sets up git hooks (existing command)
npx ai-gov mcp onboard     # sets up MCP tokens (new command)
```
