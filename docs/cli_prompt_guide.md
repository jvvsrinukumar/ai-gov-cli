# Prompt Guide — How to Talk to Claude Code with Governance

**v14.3:** CLAUDE.md is written as direct instructions to Claude. You don't need a long `## Governance:` section in every prompt. Just include the task type and Claude follows the workflow.

---

## The Basics

Every prompt needs one thing: `## Task Type:`. That's how Claude knows which workflow to follow.

```
## Task Type: New Feature
## Feature: user_profile

Build a user profile screen with name, avatar, email, edit capability.
```

Claude will automatically: classify → read steering files → check/create specs → fill them → show plan → STOP and wait → implement in phase order.

---

## All 5 Task Types — Copy-Paste Templates

### New Feature

```
## Task Type: New Feature
## Jira: TICKET-123
## Feature: user_profile

Build a user profile screen that displays name, avatar, and email,
with edit capability and form validation.

Acceptance criteria:
- [ ] Profile loads from /api/v1/users/me
- [ ] Edit form with validation (name required, email format)
- [ ] Success/error feedback after save
- [ ] Loading skeleton while fetching

API: GET /api/v1/users/me — fetch profile
API: PUT /api/v1/users/me — update profile
```

**What Claude does:** Creates specs → fills requirements + design + tasks → shows plan → STOPS → waits for "go ahead" → implements by phase → checklist.

### Edit Feature (Update Existing)

```
## Task Type: Edit Feature
## Jira: TICKET-456
## Feature: user_profile

Add password change functionality to the existing user_profile feature.

New acceptance criteria:
- [ ] "Change Password" button on profile screen
- [ ] Modal with current password, new password, confirm fields
- [ ] Password strength validation
```

**What Claude does:** Reads existing spec → updates requirements + design + tasks → shows what changed → STOPS → waits → implements only new tasks.

### Bug Fix

```
## Task Type: Bug Fix
## Jira: TICKET-789

Login button shows spinner indefinitely after valid credentials.
Console: "TypeError: Cannot read property 'token' of undefined"

Expected: Redirect to dashboard within 2 seconds.
Steps: 1. Go to /login  2. Enter valid credentials  3. Click Sign In  4. Spinner never stops
```

**What Claude does:** Reads file first → states root cause → proposes minimal fix → if >3 files, STOPS for confirmation → fixes only what's broken.

### Refactor

```
## Task Type: Refactor
## Jira: TICKET-321

Refactor auth module to replace direct API calls in ViewModel
with proper UseCase classes following the architecture layer flow.
```

**What Claude does:** Lists ALL affected files → STOPS for confirmation → refactors → verifies tests pass.

### Hotfix

```
## Task Type: Hotfix

Production: EU users getting 500 on /api/v1/payments since 2.3.1.
~2000 users affected. Error: "InvalidCurrencyException: EUR not in allowed list"
```

**What Claude does:** Fixes immediately → documents what changed and why → flags for review.

### Resume (Continue Previous Work)

```
## Task Type: New Feature (Resume)
## Feature: user_profile

Continue working on this feature.
```

**What Claude does:** Reads tasks.md → finds first unchecked task → shows progress → continues.

### Monorepo — Single Package

```
## Task Type: New Feature
## Feature: user-auth
## Package: @myapp/api-gateway

Build JWT auth middleware for the api-gateway package.
```

### Monorepo — Cross-Package

```
## Task Type: New Feature
## Feature: shared-auth
## Packages: @myapp/api-gateway, @myapp/user-service, @myapp/shared-types

Build shared authentication spanning multiple packages.
```

---

## When to Add `## Governance:` (Override Only)

You only need a governance section when you want behaviour **different** from the default:

```
## Governance:
- Skip spec creation — this is a throwaway prototype
- No tests needed
```

```
## Governance:
- Show me each file individually before writing
- Wait for approval on EACH file
```

---

## What Hooks Catch Automatically

| What Claude Tries | What Happens |
|-------------------|-------------|
| Write feature code without spec | BLOCKED — 5-step action plan |
| Write code with incomplete spec | BLOCKED — lists what's missing |
| Create 350-line component (frontend) | BLOCKED — must split |
| Create 250-line component (frontend) | WARNING — must refactor now |
| `git push --force` | BLOCKED |
| `npm install new-package` | BLOCKED |
| Embed AWS key in source | BLOCKED |
| Edit high-risk file | WARNING |

---

## Anti-Patterns — Don't Do This

**No task type:**
```
Add a profile page
```
Claude has no classification → skips governance entirely.

**Bug fix that's a feature:**
```
## Task Type: Bug Fix
The app doesn't have dark mode. Fix this.
```
"Doesn't have" isn't a bug. Use `## Task Type: New Feature`.

**Multiple types in one prompt:**
```
Fix the spinner, clean up auth, and add loading states.
```
That's 3 tasks (bug fix + refactor + feature). Send 3 separate prompts.

---

## Minimum Viable Prompt

These are the shortest prompts that still trigger full governance:

```
## Task Type: New Feature
## Feature: [name]
[what to build]
```

```
## Task Type: Bug Fix
[what's broken]
```

```
## Task Type: Refactor
[what to change]
```

```
## Task Type: Hotfix
[production issue]
```

```
## Task Type: Edit Feature
## Feature: [existing name]
[what to add/change]
```
