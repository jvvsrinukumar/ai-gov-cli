# /hotfix — Production Hotfix (Plan Mode · Emergency Diagnosis Gate)

**Stack:** Node.js

> Fast diagnosis in plan mode. One lightweight gate before the fix is applied.
> The gate is a diagnosis display — not a planning session.
> It exists to prevent applying a wrong diagnosis, not to slow you down.

---

## STEP 1 — Enter Plan Mode

Call `EnterPlanMode` immediately. Read fast — max 5 files.

---

## STEP 2 — Diagnose (in plan mode — max 60 seconds of reading)

Read the minimum files needed:
- The error message or stack trace from `$ARGUMENTS`
- The file most likely responsible

Do not read tangential files. Do not explore the full codebase.

Then output:

```
━━━ EMERGENCY DIAGNOSIS ━━━
  Issue:      [what is broken in production]
  Root cause: [one sentence]
  Fix:        [exactly what to change — file + line]
  Risk:       [low / medium / high — will this affect other flows?]

This is a diagnosis display — not a planning session.
Say apply to proceed immediately.
Wrong type? Redirect:
  /fix       — if this is not a live production emergency
  /refactor  — if fixing requires structural changes (>5 files)
  stop       — reclassify
```

**DO NOT apply the fix until the developer says apply.**

---

## STEP 3 — Apply Fix (after gate)

Call `ExitPlanMode`. Apply the minimal change immediately.

Minimum change: change only what is broken. Do not clean up, refactor, or improve surrounding code.

If the fix requires more than 5 files: stop — this is not a hotfix. Reclassify as `/refactor`.

---

## STEP 4 — Verify

```bash
npm test
```

If no tests cover this area:
> "No existing tests cover this code path. Manual verification needed: [steps]"

---

## STEP 5 — Post-Fix Summary (REQUIRED — always output this block)

```
━━━ HOTFIX SUMMARY — Requires Review ━━━
  Issue:       [production problem from $ARGUMENTS]
  Root cause:  [what was wrong]
  Fix applied: [file + line changed]
  Risk:        [side effects or related paths to monitor]
  Tests:       [what tests ran / what is missing]
  Follow-up:
    [ ] Code review before next release
    [ ] Add test coverage for this scenario
    [ ] Monitor [specific metric or log] after deploy
    [ ] Flag for: [team member or channel]
```

---

## RULES

- `EnterPlanMode` immediately — even in emergencies, prevent applying a wrong diagnosis
- Max 5 files read — do not explore beyond the immediate issue
- Minimum change — do not improve anything beyond the broken behaviour
- Post-fix summary block is never optional
- If the fix requires more than 5 files: not a hotfix — stop and reclassify
