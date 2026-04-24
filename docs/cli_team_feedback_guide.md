# Team Feedback Guide — Collecting Real Developer Feedback

## When to Collect

| Timing | What to Ask | Why |
|--------|-----------|-----|
| After 1 week | Is it blocking you? What's confusing? | Catch setup issues early |
| After 1 month | Is it helping? What do you skip? | Understand adoption vs resistance |
| After 1 quarter | Has code quality changed? | Measure real impact |

---

## The 30 Questions

### Does It Actually Run? (Questions 1-6)

These catch silent failures — the biggest risk is developers thinking governance is active when hooks aren't firing.

1. What operating system are you using? (macOS / Linux / Windows WSL2 / Windows Git Bash)
2. When you run `claude`, do you see hook status messages like "Checking file protection..." appear? (Always / Sometimes / Never / Not sure)
3. Have you seen any hook errors? If yes, paste the exact error.
4. Does auto-formatting run after you edit a file? (Yes / No / I disabled it)
5. Does the linter run after edits? (Yes / No / Not sure)
6. Run `jq --version` and paste the output. *(If blank, zero hooks are running.)*

### Does It Change Behaviour? (Questions 7-12)

7. When you start a new feature, does Claude create spec files before writing code? (Always / Usually / Sometimes / Never)
8. Does Claude show you a plan and wait for confirmation before coding? (Always / Usually / Sometimes / Never)
9. Have you been blocked by "No spec exists"? What did you do? (Created spec / Asked Claude / Found workaround / Gave up)
10. Do you write `## Task Type:` in your prompts? (Always / Sometimes / Never / Didn't know about it)
11. Do you include `## Feature:` name? (Always / Sometimes / Never)
12. Does Claude give you a summary of files changed and tests when it finishes? (Always / Usually / Rarely / Never)

### Does It Help or Hinder? (Questions 13-18)

13. "The governance framework makes my work more productive." (Strongly agree → Strongly disagree)
14. "The spec-first workflow slows me down for small tasks." (Strongly agree → Strongly disagree)
15. Has the framework caught a real mistake? (Yes — describe / No / Not sure)
16. Has it blocked you when it shouldn't have? (Yes — describe / No)
17. Time saved per week? (2+ hours / ~1 hour / No difference / Costs ~1 hour / Costs 2+ hours)
18. Time spent working around it per week? (Zero / Under 30 min / 30-60 min / Over 1 hour)

### What Would You Change? (Questions 19-24)

19. Most useful hook? (Spec gate / Dangerous command blocker / Auto-format / Auto-lint / Session continuity / File size / Check-secrets / Post-task checklist / None)
20. Most annoying hook? (Same list)
21. If you could change ONE thing, what would it be? *(Free text)*
22. Are there rules that don't match your project? Which ones?
23. Do you read the steering files yourself, or rely on Claude reading them? (I read them / Claude reads them / Neither / Didn't know they existed)
24. Would you use this on your next project? (Definitely / Probably / Unsure / Probably not / Definitely not)

### Code Quality (Questions 25-30 — For Tech Leads)

25. Last 10 PRs with AI code — how many follow the architecture? (Count: _/10)
26. How many files exceed 200 lines (frontend)?
27. How many features have complete specs?
28. How many features have a README?
29. What percentage of services have unit tests?
30. Has architectural consistency improved since adoption?

---

## Quick Audit Script

Run this monthly for hard numbers:

```bash
echo "=== Files over 200 lines ==="
find src/ lib/ app/ -name "*.dart" -o -name "*.tsx" -o -name "*.kt" -o -name "*.ts" -o -name "*.py" 2>/dev/null | while read f; do
  lines=$(wc -l < "$f" 2>/dev/null | tr -d ' ')
  [ "$lines" -gt 200 ] && echo "  $lines  $f"
done | sort -rn

echo ""
echo "=== Spec completeness ==="
for d in specs/*/; do
  [ "$d" = "specs/_template/" ] && continue
  fn=$(basename "$d")
  req="✗"; des="✗"; tsk="✗"
  [ -f "$d/requirements.md" ] && ! grep -q "_replace_" "$d/requirements.md" && req="✓"
  [ -f "$d/design.md" ] && des="✓"
  [ -f "$d/tasks.md" ] && grep -q '^\- \[' "$d/tasks.md" && tsk="✓"
  echo "  $req $des $tsk  $fn"
done
```

---

## Red Flags

| Signal | What It Means | Action |
|--------|-------------|--------|
| "I never see hook messages" | jq not installed or settings.json broken | Check `jq --version` |
| "Claude just starts coding" | CLAUDE.md not being read | Check `.claude/CLAUDE.md` exists |
| "I write code elsewhere to avoid the hook" | Hook path matching too narrow | Audit FEATURES_DIR |
| "Everyone answers 'Never' to Q10" | Team doesn't know the prompt format | 15-min training + share prompt guide |
| "Most useful = None" | Framework isn't providing value | Re-evaluate if project is a fit |
| "Costs me 2+ hours" | Net negative | Identify which hooks cause friction |
