# Hooks — ai-gov

**Hook Version:** 15.2.0
Total: 12 scripts / 11 registrations (check-spec-exists.sh generated but not registered — spec-first opt-in)

| Hook | Trigger | Blocks? | Purpose |
|------|---------|:-------:|---------|
| `require-task-type.sh` | UserPromptSubmit | Warn (configurable) | Advise governance command when unclassified dev task detected |
| `protect-files.sh` | PreToolUse Edit\|Write\|Bash | Warn only | Warn on high-risk file edits |
| `check-secrets.sh` | PreToolUse Edit\|Write\|Bash | Yes | Block AWS keys, API tokens, passwords in source |
| `session-continuity.sh` | PreToolUse Edit\|Write\|Bash | No | Remind to resume from last task |
| `block-dangerous-commands.sh` | PreToolUse Edit\|Write\|Bash | Yes | Block force push, rm -rf, pkg install |
| `check-spec-exists.sh` | — (not registered) | — | Spec-first not active: no spec history found. To enable: create `specs/<feature>/` and re-run governance script |
| `format-code.sh` | PostToolUse Edit\|Write | No | No-op (no formatter configured) |
| `analyze-code.sh` | PostToolUse Edit\|Write | No | Run linter/analyzer |
| `check-feature-readme.sh` | PostToolUse Edit\|Write | No | Ensure README exists and is updated |
| `check-consistency.sh` | PostToolUse Edit\|Write | No | Check spec/code/README drift |
| `check-file-size.sh` | PostToolUse Edit\|Write | Warn/Block | No-op (not applicable for nodejs) |
| `post-task-checklist.sh` | Stop | No | End-of-task reminder |

## Windows Compatibility
All hook commands in settings.json use `bash "script.sh"` prefix instead of direct `.sh` execution.
This works on macOS, Linux, Windows Git Bash, and WSL2. No `chmod +x` required.

## v13/v14 Enhancements
- **Spec freshness** — `check-spec-exists.sh` warns when code >24h newer than spec or file count drifts from design.md
- **Hook versioning** — Each hook has `# HOOK_VERSION=X.Y.Z`. Run `--update-hooks` to update stale hooks only
- **Custom hooks** — Add to `.claude/custom-hooks.json` (never overwritten). Merged into `settings.json` on each run
- **require-task-type.sh** — UserPromptSubmit hook (v14.3+). Detects unclassified dev tasks and recommends the correct governance command (/new-feature, /fix, etc.). Default: warn mode. To switch to block mode: change `exit 0` to `exit 1` at the bottom of the script.
- **Governance commands** — 5 slash commands generated in `.claude/commands/`: `/new-feature` (plan mode + 3-gate spec), `/edit-feature`, `/fix`, `/refactor`, `/hotfix`

## Exit Codes
- `exit 0` — allow
- `exit 2` — block (PreToolUse only)
- JSON `additionalContext` — pass but feed warning to Claude

## Adding a Custom Hook
1. Create `.claude/hooks/<n>.sh` and `chmod +x`
2. Add entry to `.claude/custom-hooks.json` (survives re-runs)
3. Re-run governance script to merge into settings.json

## Updating Hooks
```bash
./ai_governance_v14.sh --update-hooks   # only stale hooks (version mismatch)
./ai_governance_v14.sh --overwrite       # overwrites everything
./ai_governance_v14.sh --dry-run         # shows diff of what would change
```
