# docs/ — Documentation Index

**Current version:** 17.1.6 · **Updated:** 2026-05-11

All documentation files in this directory, with status and description.

---

## Current (v17.1.6)

| File | Audience | Description |
|------|----------|-------------|
| [`complete_usage_guide.md`](./complete_usage_guide.md) | All | **Comprehensive reference.** Full walkthrough — prerequisites, Layer 1/2/3 setup, daily workflow, CLI reference, troubleshooting |
| [`claude_code_setup_guide.md`](./claude_code_setup_guide.md) | Claude Code teams | **Claude Code setup** — `ai-gov init`, output structure, bash hooks, slash commands, enforcement model |
| [`kiro_setup_guide.md`](./kiro_setup_guide.md) | Kiro teams | **Kiro setup** — `--agent kiro`, output structure, JSON hooks, workflow shortcuts, enforcement model |
| [`workspace_setup_guide.md`](./workspace_setup_guide.md) | Team leads | Multi-project workspace setup, mono-repo vs multi-repo detection, workspace hooks |
| [`cli_workspace_commands.md`](./cli_workspace_commands.md) | Developers | `workspace`, `workspace --upgrade`, monorepo vs multi-repo diagrams, FAQ |
| [`cli_developer_commands.md`](./cli_developer_commands.md) | Developers | Daily developer commands reference — slash commands, plan mode, task workflow |
| [`upgrade_guide.md`](./upgrade_guide.md) | Team leads | `ai-gov upgrade` command — what is preserved vs regenerated, step-by-step, `--force` strategy |
| [`runtime_requirements.md`](./runtime_requirements.md) | DevOps / CI | python3 and jq requirements per OS, Docker best practices, fallback logic, doctor output |
| [`branching_and_ci_setup_guide.md`](./branching_and_ci_setup_guide.md) | Team leads | Git branching strategy, CI/CD pipeline setup, multi-platform PR checks, team announcement templates |
| [`workspace_governance_guide.md`](./workspace_governance_guide.md) | Team leads | Governance across multiple repos and stacks, cross-team enforcement patterns |
| [`knowledge_hub_proposal.md`](./knowledge_hub_proposal.md) | Product | Proposal for centralised knowledge hub feature (not yet implemented) |
| [`governance-dashboard-plan.md`](./governance-dashboard-plan.md) | CEO / Engineering Leads | **Dashboard plan** — resources needed, architecture, implementation phases, cost, timeline, developer impact |

---

## Quick navigation

**I am a new developer joining a governed project:**
→ Run `curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash`
→ Or: `npx ai-gov onboard`

**I am a team lead setting up governance for the first time:**
→ [`claude_code_setup_guide.md`](./claude_code_setup_guide.md) (Claude Code)
→ [`kiro_setup_guide.md`](./kiro_setup_guide.md) (Kiro)

**I am setting up a multi-project workspace:**
→ [`workspace_setup_guide.md`](./workspace_setup_guide.md)

**I need to upgrade an existing project to v17.1.6:**
→ [`upgrade_guide.md`](./upgrade_guide.md)

**My CI pipeline is failing on runtime checks:**
→ [`runtime_requirements.md`](./runtime_requirements.md)

**I want to understand what changed in this version:**
→ Root [`CHANGELOG.md`](../CHANGELOG.md)
