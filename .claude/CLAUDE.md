# CLAUDE.md — You MUST follow these rules

> **You are Claude Code working on ai-gov.**
> **These are your operating rules. Follow them exactly. Do not skip steps.**
> **If a hook blocks you, follow its instructions — do not work around it.**

**App:** ai-gov
**Package:** `ai-gov`
**Stack:** Node.js

---

## Commands
| Action | Command |
|--------|---------|
| Install | `npm install` |
| Run     | `npm run dev` |
| Build   | `npm run build` |
| Analyze | `npx eslint src/` |
| Test    | `npm test` |
| Clean   | `rm -rf node_modules && npm install` |

### High-Risk Files (confirm before editing)
- `config.ts`

### Key Packages (do not add/remove without approval)
`jest` (test)

---

## When You Receive ANY Task — Do This First

### 1. State the task type out loud
| Type | When the user says |
|------|---------|
| **New Feature** | "create", "add feature", "build X" |
| **Edit Feature** | "update feature", "add X to Y", "extend", "modify feature", "enhance" |
| **Bug Fix**     | "fix", "broken", "not working" |
| **Refactor**    | "refactor", "clean up", "reorganise" |
| **Hotfix**      | "urgent", "prod issue", "critical" |

Say: "This is a [type] task." Then proceed to step 2.

### 2. Read these steering files BEFORE doing anything
| File | Feature | Edit Feature | Bug Fix | Refactor | Hotfix |
|------|:-------:|:------------:|:-------:|:--------:|:------:|
| `architecture.md`       | ✓ | ✓ | ✓ | ✓ | ✓ |
| `coding-standards.md`   | ✓ | ✓ | ✓ | ✓ | — |
| `spec-first-workflow.md` | opt-in | — | — | — | — | (spec-first not yet active — no spec history found)
| `feature-readme.md`     | ✓ | ✓ | if editing feature | if editing feature | — |
| `ai-usage-policy.md`    | ✓ | ✓ | — | if >5 files | — |

Do NOT write any code until you have read the required files.

### 3. Follow the workflow for that task type

**New Feature — you MUST do ALL of these in order:**
1. (Spec-first not enforced — no existing specs. To opt in: create `specs/<feature>/` using `cp -r specs/_template specs/<feature>`)
2. Fill `requirements.md` — replace every `_replace_` placeholder, write real user stories with Given/When/Then, select data source
3. Fill `design.md` — fill hard rules compliance table (Yes/No in every cell), list actual files you will create
4. Fill `tasks.md` — write phased tasks with `[S]` `[M]` `[L]` size estimates
5. Show the user your filled spec files and your implementation plan
6. **STOP. Wait for the user to say "go ahead" or confirm. Do NOT write code until they confirm.**
7. Implement in tasks.md phase order: Data → Logic → State → UI → Tests
8. Check off tasks in tasks.md as you complete them
9. After finishing: list files, update tasks.md, confirm architecture, summarise, flag risks, confirm tests

**Edit Feature (update/extend existing feature) — you MUST do ALL of these in order:**
1. Read the EXISTING spec: `specs/<feature>/requirements.md` → `design.md` → `tasks.md`
2. Read the feature README at `src/<feature>/README.md`
3. UPDATE `requirements.md` — add new user stories, update data source if changed
4. UPDATE `design.md` — add new files to file list, re-check hard rules compliance table
5. UPDATE `tasks.md` — add new tasks to existing phases (append, don't replace completed tasks)
6. Show the user what changed in each spec file
7. **STOP. Wait for the user to confirm the spec changes before writing any code.**
8. Implement only the NEW/CHANGED tasks (do not redo completed work)
9. Update tasks.md checkboxes and feature README as you go
10. After finishing: list files, summarise changes, flag risks

**Bug Fix — do this:**
1. Read the broken file BEFORE changing anything
2. State the root cause in 1-2 sentences
3. Propose the minimal fix (fewest files possible)
4. If fix touches more than 3 files → STOP and wait for user confirmation
5. Do NOT refactor surrounding code — fix only what is broken
6. After fixing: list files modified, summarise the fix, flag if high-risk files were touched

**Refactor — do this:**
1. List ALL files that will be affected
2. For each file state: what changes, which layer
3. STOP and wait for user confirmation
4. After refactoring: confirm all tests pass, list files, flag risks

**Hotfix — do this:**
1. Fix immediately — no plan needed
2. After fixing: state what changed and why
3. Flag for post-fix review

---

## While Coding — Rules You Must Not Break

- Never skip a layer — `Route → Model`
- Never put business logic in Routes
- Follow naming from `coding-standards.md`
- **Keep every file under 200 lines.**
- If a hook gives you a warning, you MUST act on it immediately
- If a hook blocks you, follow its instructions exactly

---

## Hard Rules
- **Never** skip architecture layers — `Route → Model`
- **Never** write business logic in Routes — routers are thin (validate, delegate, respond)
- **Never** query the database directly from Routes — go through Service
- **Never** return raw database objects in API responses — map to response schemas
- **Never** access tenant-scoped data without `org_id` filtering
- **Never** leave TODO comments in production code
- A task is **not complete** without a test
- **When adding, modifying, or removing a hook** — update `.claude/hooks/README.md`
