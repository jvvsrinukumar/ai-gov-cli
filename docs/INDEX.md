# docs/ — Documentation Index

**Current version:** 16.0.0 · **Updated:** 2026-05-01

All documentation files in this directory, with status and description.

---

## Current (v16.0.0)

| File | Audience | Description |
|------|----------|-------------|
| [`complete_usage_guide.md`](./complete_usage_guide.md) | All | **Start here.** Full walkthrough — prerequisites, Layer 1/2/3 setup, daily workflow, CLI reference, troubleshooting |
| [`workspace_setup_guide.md`](./workspace_setup_guide.md) | Team leads | Multi-project workspace setup, mono-repo vs multi-repo detection, workspace hooks |
| [`cli_workspace_commands.md`](./cli_workspace_commands.md) | Developers | `workspace`, `workspace --upgrade`, monorepo vs multi-repo diagrams, FAQ |
| [`upgrade_guide.md`](./upgrade_guide.md) | Team leads | `ai-gov upgrade` command — what is preserved vs regenerated, step-by-step, `--force` strategy |
| [`runtime_requirements.md`](./runtime_requirements.md) | DevOps / CI | python3 and jq requirements per OS, Docker best practices, fallback logic, doctor output |
| [`branching_and_ci_setup_guide.md`](./branching_and_ci_setup_guide.md) | Team leads | Git branching strategy, CI/CD pipeline setup, multi-platform PR checks, team announcement templates |
| [`workspace_governance_guide.md`](./workspace_governance_guide.md) | Team leads | Governance across multiple repos and stacks, cross-team enforcement patterns |
| [`cli_CHANGELOG.md`](./cli_CHANGELOG.md) | All | Version history — all notable changes from v14.3.0 through v16.0.0 |
| [`cli_developer_commands.md`](./cli_developer_commands.md) | Developers | Daily developer commands reference — slash commands, plan mode, task workflow |
| [`knowledge_hub_proposal.md`](./knowledge_hub_proposal.md) | Product | Proposal for centralised knowledge hub feature (not yet implemented) |

---

## Deprecated

These files are kept for reference but contain outdated information. **Do not use for new setups.**

| File | Version | Superseded by |
|------|---------|---------------|
| [`cli_deep_dive.md`](./cli_deep_dive.md) | v14.3.0 | [`complete_usage_guide.md`](./complete_usage_guide.md) |
| [`cli_governance_commands.md`](./cli_governance_commands.md) | v15.0.0 | [`cli_workspace_commands.md`](./cli_workspace_commands.md) |
| [`cli_setup_guide.md`](./cli_setup_guide.md) | v15.x | [`complete_usage_guide.md`](./complete_usage_guide.md) |
| [`cli_README.md`](./cli_README.md) | v16.0.0 | Root [`README.md`](../README.md) — duplicate, kept for links |

---

## Quick navigation

**I am a new developer joining a governed project:**
→ Run `curl -s https://raw.githubusercontent.com/jvvsrinukumar/ai-gov-cli/main/onboard.sh | bash`
→ Or: `npx ai-gov onboard`

**I am a team lead setting up governance for the first time:**
→ [`complete_usage_guide.md`](./complete_usage_guide.md)

**I am setting up a multi-project workspace:**
→ [`workspace_setup_guide.md`](./workspace_setup_guide.md)

**I need to upgrade an existing project to v16.0.0:**
→ [`upgrade_guide.md`](./upgrade_guide.md)

**My CI pipeline is failing on runtime checks:**
→ [`runtime_requirements.md`](./runtime_requirements.md)

**I want to understand what changed in this version:**
→ [`cli_CHANGELOG.md`](./cli_CHANGELOG.md)
