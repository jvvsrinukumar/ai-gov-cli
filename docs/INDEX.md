# docs/ — Documentation Index

**Current version:** 18.0.0 · **Updated:** 2026-05-14

All documentation files in this directory, with status and description.

---

## Current (v18.0.0)

| File | Audience | Description |
|------|----------|-------------|
| [`complete_usage_guide.md`](./complete_usage_guide.md) | All | **Comprehensive reference.** Full walkthrough — prerequisites, Layer 1/2/3 setup, daily workflow, CLI reference, troubleshooting |
| [`claude_code_setup_guide.md`](./claude_code_setup_guide.md) | Claude Code teams | **Claude Code setup** — `ai-gov init`, output structure, bash hooks, slash commands, enforcement model |
| [`kiro_setup_guide.md`](./kiro_setup_guide.md) | Kiro teams | **Kiro setup** — `--agent kiro`, output structure, JSON hooks, workflow shortcuts, enforcement model |
| [`workspace_setup_guide.md`](./workspace_setup_guide.md) | Team leads | Multi-project workspace setup, mono-repo vs multi-repo detection, workspace hooks, upgrade mode |
| [`cli_workspace_commands.md`](./cli_workspace_commands.md) | Developers | `workspace`, `workspace --upgrade`, monorepo vs multi-repo diagrams, FAQ |
| [`cli_developer_commands.md`](./cli_developer_commands.md) | Developers | Daily developer commands reference — slash commands, plan mode, task workflow |
| [`upgrade_guide.md`](./upgrade_guide.md) | Team leads | `ai-gov upgrade` command — what is preserved vs regenerated, step-by-step, `--force` strategy |
| [`runtime_requirements.md`](./runtime_requirements.md) | DevOps / CI | python3 and jq requirements per OS, Docker best practices, fallback logic, doctor output |
| [`branching_and_ci_setup_guide.md`](./branching_and_ci_setup_guide.md) | Team leads | Git branching strategy, CI/CD pipeline setup, multi-platform PR checks, team announcement templates |
| [`workspace_governance_guide.md`](./workspace_governance_guide.md) | Team leads | Governance across multiple repos and stacks, cross-team enforcement patterns |
| [`mcp-governance-guide.md`](./mcp-governance-guide.md) | Team leads + Developers | **MCP tool governance** — `ai-gov mcp init/onboard/validate`, token management, adding new tools, full terminal walkthroughs |
| [`team-upgrade-checklist.md`](./team-upgrade-checklist.md) | All developers | **Share with team on every release** — upgrade CLI globally, check version, upgrade project governance, workspace upgrade, MCP refresh |
| [`flutter-gradle-migration.md`](./flutter-gradle-migration.md) | Flutter developers | **Android Gradle migration** — declarative plugins block, version matrix, error→fix mapping, how `ai-gov init` prevents this |

---

## Quick navigation

**I am a new developer joining a governed project:**
→ Run `npx ai-gov onboard` then `npx ai-gov mcp onboard`
→ See: [`claude_code_setup_guide.md`](./claude_code_setup_guide.md) or [`kiro_setup_guide.md`](./kiro_setup_guide.md)
→ See: [`mcp-governance-guide.md`](./mcp-governance-guide.md) for MCP tokens

**I am a team lead setting up governance for the first time:**
→ [`claude_code_setup_guide.md`](./claude_code_setup_guide.md) (Claude Code)
→ [`kiro_setup_guide.md`](./kiro_setup_guide.md) (Kiro)

**I am setting up a multi-project workspace:**
→ [`workspace_setup_guide.md`](./workspace_setup_guide.md)

**I need to upgrade the CLI and projects to v18.0.0:**
→ [`team-upgrade-checklist.md`](./team-upgrade-checklist.md) ← share this with your team
→ [`upgrade_guide.md`](./upgrade_guide.md) ← detailed reference

**My CI pipeline is failing on runtime checks:**
→ [`runtime_requirements.md`](./runtime_requirements.md)

**My Flutter Android build is failing with Gradle / AGP errors:**
→ [`flutter-gradle-migration.md`](./flutter-gradle-migration.md)

**I want to understand what changed in this version:**
→ Root [`CHANGELOG.md`](../CHANGELOG.md)
