# AI Usage Policy — ai-gov

## Prerequisites
- A Jira ticket must exist
- For new features: spec folder `specs/<feature>/` must exist
- Read architecture.md and coding-standards.md before every task

## New Feature Rules
1. Spec must exist and be complete
2. State full plan — every file, layer, dependencies
3. Wait for developer confirmation
4. Follow `Route → Model`
5. Tests required for business logic layers

## Bug Fix Rules
1. Identify root cause before writing fix
2. **Minimal change** — fix only what is broken
3. Do not refactor surrounding code
4. Confirm fix does not break related functionality

## Forbidden Actions
1. **Never** add or remove packages without approval
2. **Never** modify high-risk files without understanding full impact:
- `config.ts`
3. **Never** force-push or rewrite git history
4. **Never** delete/rename files without confirming they are unused
5. **Never** modify files outside task scope

## Testing Policy
- New features: tests for business logic layers — no exceptions
- Bug fixes: regression test recommended; if skipped, flag as risk
- Run tests: `npm test`
- Run analysis: `npx eslint src/`

## PR Checklist
- [ ] Claude Code was used
- [ ] Change type: Feature / Edit Feature / Bug Fix / Refactor / Hotfix
- [ ] Files created/modified listed
- [ ] Architecture compliance confirmed
- [ ] Tests written (or reason explained)
- [ ] Developer reviewed all AI-generated code
