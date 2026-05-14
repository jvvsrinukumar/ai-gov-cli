# Developer Commands: Token Consumption Guide
## Problems, Analysis & Solution Roadmap

**Audience:** ai-gov maintainers · Command template designers  
**Version:** 1.3  
**Date:** 2026-05-13

---

## Table of Contents

1. [Why Token Consumption Matters](#1-why-token-consumption-matters)
2. [How Commands Work — The Flow](#2-how-commands-work--the-flow)
3. [/new-feature — All 3 Cases](#3-new-feature--all-3-cases)
   - 3.1 Case 1: Raw Jira Ticket
   - 3.2 Case 2: Jira → ChatGPT → Prompt
   - 3.3 Case 3: Manual Prompt (+ Images for Frontend)
   - 3.4 Frontend vs Backend Difference (incl. backend image types)
   - 3.5 Token Summary
4. [/fix — All 3 Cases](#4-fix--all-3-cases)
   - 4.1 Case 1: Jira Bug Ticket
   - 4.2 Case 2: Jira → ChatGPT → Prompt
   - 4.3 Case 3: Manual Prompt
   - 4.4 Frontend vs Backend Difference
   - 4.5 Token Summary
5. [Other Daily Commands](#5-other-daily-commands)
   - 5.1 /edit-feature
   - 5.2 /hotfix
   - 5.3 /refactor
6. [Complete Problems Summary](#6-complete-problems-summary)
7. [Token Consumption Master Table](#7-token-consumption-master-table)
8. [Solutions Roadmap](#8-solutions-roadmap)

---

## 1. Why Token Consumption Matters

Every time a developer uses a command like `/new-feature` or `/fix`, Claude reads everything sent to it (input tokens) and writes a response (output tokens). You pay for both.

```
Token cost = Input tokens + Output tokens
           = (template + developer's text + images) + (Claude's response)
```

**Why developers waste tokens without knowing it:**

| Developer action | What they think they're sending | What Claude actually receives |
|---|---|---|
| Copy-paste Jira ticket | "My feature description" | Feature + Sprint + Reporter + Labels + Status + Fix Version + 10 other fields |
| Use ChatGPT to polish prompt | "A clean, structured prompt" | "Certainly! Here is a comprehensive, well-structured prompt..." + padding |
| Attach 3 Figma screenshots | "Design reference" | ~9,600 tokens of image data |
| No STOP gate in template | "Just the spec" | Spec + code + tests + explanation — Claude keeps going |

**A team of 10 developers using `/new-feature` 3× per week:**
```
Without optimisation: 10 × 3 × ~3,000 tokens = 90,000 tokens/week
With optimisation:    10 × 3 × ~600 tokens   = 18,000 tokens/week
Saving: ~72,000 tokens/week = 80% reduction
```

---

## 2. How Commands Work — The Flow

When a developer types `/new-feature <text>` in Claude Code:

```
Step 1:  Developer types  →  /new-feature [their input]
                                      ↓
Step 2:  Claude receives  →  [command template content]
                              + [developer's input as $ARGUMENTS]
                                      ↓
Step 3:  Claude processes →  reads both, generates response
                                      ↓
Step 4:  Claude writes    →  spec / fix / plan (output tokens)
                                      ↓
Step 5:  STOP gate        →  Claude pauses, waits for developer approval
                                      ↓
Step 6:  Developer says   →  "ok" / "approve" / adds more info
                                      ↓
                              (cycle repeats per approval gate)
```

**The command template is a `.md` file installed by `ai-gov init` in `.claude/commands/`.**  
Everything in that file is sent to Claude every single time the command is used.

**The `$ARGUMENTS` placeholder is replaced with whatever the developer typed after the command.**

---

## 3. /new-feature — All 3 Cases

### How `/new-feature` Works

```
/new-feature [developer input]
        ↓
Claude creates requirements.md → STOP → developer reviews/adds info
        ↓
Developer: "ok"
        ↓
Claude creates design.md → STOP → developer reviews
        ↓
Developer: "ok"
        ↓
Claude creates tasks.md → STOP → developer reviews
        ↓
Developer: "go ahead"
        ↓
Claude starts coding (Phase 1 only)
```

---

### 3.1 Case 1: Raw Jira Ticket

**What the developer does:**  
Opens Jira, copies the entire ticket, pastes it after `/new-feature`.

**Real example input:**
```
/new-feature APDB-13457
Description:
As a user, I would like the mobile app to help manage my 'state'
(signed in and signed out) as I travel from facility to facility

Business Rationale:
Accuracy on the sign in / sign out timing will support more accurate
time reporting for communities. It will enable Comm Admins to better
manage actual sign in / sign out times...

Requirements:
- Allow me to sign in only after I am confirmed to be signed out
- If I am identified to be signed in, do not allow me to change facility
- If I am signed in, only display the Sign Out button on the mobile
...

Acceptance Criteria:
- Select a community and sign in; user is not able to sign in again
- Upon sign out, the sign in button is reactivated
- The sign in and sign out buttons are never active at the same time

Priority: High
Story Points: 5
Sprint: Sprint 14
Reporter: john.doe@company.com
Assignee: jane.smith@company.com
Epic Link: APDB-100
Labels: mobile, state-management
Status: In Progress
Fix Version: 2.1.0
```

**Token breakdown:**
```
Command template:              ~100 tokens
Jira ticket (full):            ~280 tokens
  ├─ Useful signal:             ~180 tokens (requirements + AC)
  ├─ Business rationale:         ~60 tokens (context, semi-useful)
  └─ Junk (Sprint/Reporter etc): ~40 tokens (0% useful)
─────────────────────────────────────────────
Total input:                   ~380 tokens
Useful input:                  ~340 tokens (89% efficiency)
```

**Problems with raw Jira ticket:**

| Problem | What happens | Token impact |
|---|---|---|
| Missing technical context | Claude asks 3–4 questions (stack? API? auth method?) | +300 tokens in Q&A rounds |
| Jira metadata included | Sprint/Reporter/Labels sent but never used | ~40 tokens wasted per call |
| No UI description (frontend) | Claude guesses layout, developer corrects | +400 tokens rework |
| Business rationale is long | Claude reads it even if irrelevant to code | ~60 tokens wasted |

**What Claude produces:**

```
✓ Created specs/facility-sign-in-state/requirements.md

STOP — 4 questions before I can continue:
Q1: What stack? (Flutter / React Native / Swift / Kotlin)
Q2: How does mobile detect kiosk sign-in? (API poll / push notification)
Q3: What confirms "signed out"? (server response / local state)
Q4: Is visitor type an existing field or new?
```

**Best for:** Well-written Jira tickets with clear requirements and acceptance criteria.  
**Not good for:** Tickets with vague descriptions or no acceptance criteria.  
**Total tokens (full flow):** ~1,600 tokens

---

### 3.2 Case 2: Jira → ChatGPT → Prompt

**What the developer does:**  
Pastes Jira ticket into ChatGPT with "create a structured prompt for Claude from this ticket."  
Copies ChatGPT's output. Pastes after `/new-feature`.

**Real example — what ChatGPT gives back:**
```
Certainly! Here's a well-structured prompt for implementing this feature:

Please implement a comprehensive mobile state management system that 
enables users to seamlessly manage their sign-in and sign-out status 
as they travel between different facilities. This feature should provide 
an intuitive and user-friendly interface that accurately tracks user 
authentication state across multiple community locations.

Key requirements include:
1. A robust sign-in validation mechanism that prevents duplicate sign-ins
2. Dynamic button visibility that intelligently responds to the user's 
   current authentication state
3. Comprehensive facility association management that restricts changes 
   during active sign-in sessions
4. Seamless integration with the existing kiosk infrastructure to maintain 
   state consistency across platforms

Please ensure the implementation follows best practices, is scalable, 
maintainable, and adheres to the project's existing architectural patterns 
and coding standards throughout the entire codebase.
```

**Token breakdown:**
```
Command template:              ~100 tokens
ChatGPT output text:           ~220 tokens
  ├─ Useful signal:             ~30 tokens ("sign in/out state, buttons, facility lock")
  ├─ ChatGPT preamble:          ~15 tokens ("Certainly! Here's a well-structured...")
  └─ Padding/fluff:            ~175 tokens ("comprehensive", "seamless", "robust" etc.)
─────────────────────────────────────────────
Total input:                   ~320 tokens
Useful input:                  ~130 tokens (41% efficiency)
```

**Problems with ChatGPT-padded prompts:**

| Problem | What happens | Token impact |
|---|---|---|
| Vague language ("seamless", "comprehensive") | Claude cannot derive specific requirements | +500 tokens in Q&A |
| Specific Jira details lost | Acceptance criteria removed by ChatGPT | Claude rewrites generic spec |
| ChatGPT preamble | "Certainly! Here's a well-structured prompt" — pure noise | ~15 tokens wasted |
| No technical specifics | Fewer tokens in, but MORE questions out | Net higher cost |
| Generic spec produced | Developer has to correct multiple sections | +800 tokens rework |

**What Claude produces:**

```
✓ Created specs/facility-state/requirements.md

NOTE: Input was high-level — spec is generic. I need answers to 6 questions:
Q1: What stack? (Flutter / React Native / Swift / Kotlin)
Q2: Which specific buttons exist? Names?
Q3: What is the exact error when duplicate sign-in attempted?
Q4: How does kiosk-mobile sync work technically?
Q5: What does "visitor type" refer to in the app?
Q6: Are there specific UI states beyond signed-in / signed-out?
```

**6 questions instead of 4** — because ChatGPT stripped the specific details.  
Developer must now type answers that were already in the original Jira ticket.  
**Total tokens (full flow):** ~1,900 tokens — highest cost, lowest quality.

**Verdict:** ChatGPT-processed prompts are the worst option. They cost more and produce worse results than the original Jira ticket.

---

### 3.3 Case 3: Manual Prompt (+ Images for Frontend)

**What the developer does:**  
Understands the feature. Writes a concise, technical prompt. Attaches Figma screenshots or design images for frontend features.

**Real example — backend:**
```
/new-feature APDB-13457 — facility sign-in state management

Flutter app. User can only be signed into one facility at a time.

Rules:
- signed out → show Sign In button only
- signed in → show Sign Out button only, lock facility selector + visitor type
- kiosk sign-in detected via API poll on app open → mobile pre-selects that community

API: community response includes is_signed_in: bool, signed_in_facility_id: string
Confirmation of sign-out = server 200 response

Should behave same as existing resident/staff sign-in flow.
```

**Token breakdown (backend, no images):**
```
Command template:              ~100 tokens
Developer's clean text:         ~90 tokens
  └─ All signal, no noise:      ~90 tokens (100% efficiency)
─────────────────────────────────────────────
Total input:                   ~190 tokens
```

**Real example — frontend (same feature + design images):**
```
/new-feature APDB-13457 — facility sign-in state management

Flutter app. Sign in/out state drives button visibility on HomeScreen.
[attaches: home-screen-signed-in.png]
[attaches: home-screen-signed-out.png]
[attaches: sign-out-popup-design.png]
```

**Token breakdown (frontend with 3 images):**
```
Command template:              ~100 tokens
Developer's clean text:         ~50 tokens
Image 1 (HomeScreen signed in): ~3,200 tokens
Image 2 (HomeScreen signed out):~3,200 tokens
Image 3 (popup design):        ~2,400 tokens
─────────────────────────────────────────────
Total input:                  ~8,950 tokens
Questions asked:                1 (minor clarification)
```

**Problems with manual prompt + images:**

| Problem | What happens | Token impact |
|---|---|---|
| Images are large | Each screenshot = 2,400–4,000 tokens | 85% of total input |
| Multiple redundant screenshots | 3 images when 1 would do | 2× unnecessary image tokens |
| No structure in image | Blurry or partial screenshot | Claude asks questions anyway |

**What Claude produces (frontend with images):**

```
✓ Created specs/facility-sign-in-state/requirements.md

From images I can see:
- HomeScreen has two states (confirmed from Image 1 + 2)
- Button positions: Sign In (bottom-center), Sign Out (same position)
- Popup: modal with "Pending" warning + dismiss button
- Color scheme: blue primary, white background

STOP — Only 1 question:
Q1: Should Sign Out in popup be "Sign Out Anyway" or just "Sign Out"?
```

**Only 1 question** because images answered everything else.  
**Total tokens (full flow):** ~10,500 tokens — highest input, but best output quality and fastest to "go ahead."

---

### 3.4 Frontend vs Backend Difference for `/new-feature`

```
BACKEND needs:                    FRONTEND needs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ API endpoint + method           ✓ Screen name
✓ Request / response schema       ✓ Component layout
✓ DB tables affected              ✓ Navigation flow
✓ Auth requirements               ✓ Color / style specs
✓ Error cases                     ✓ Animation / timing
✗ UI images (not needed)          ✓ Images or wireframe
```

**Kotlin — frontend or backend?**

Kotlin is used for both Android apps (frontend) and Spring Boot servers (backend).  
`ai-gov` detects which type during `ai-gov init` by scanning project structure.

```
Kotlin Android (frontend):
  Has: AndroidManifest.xml, Activity/Fragment/Compose files
  Needs: Screen name, layout, navigation, API contracts as text
  Images: Acceptable for screen designs

Kotlin Spring Boot (backend):
  Has: @RestController, application.properties, pom.xml/build.gradle
  Needs: API endpoint, request/response schema, DB tables
  Images: Avoid UI images, paste JSON/SQL as text instead
```

**Recommended input per stack:**

| Stack | Type | Best input format | Avoid |
|---|---|---|---|
| Node.js / Python / Java | Backend | Technical text + API contract | Any images |
| Kotlin (Spring Boot) | Backend | Technical text + API contract | Any images |
| Kotlin (Android) | Frontend mobile | Text + screen desc + API contracts as text | Error screenshots |
| React / Next.js / Angular | Frontend web | Text + component desc + API contracts as text | 3+ redundant screenshots |
| Flutter | Frontend mobile | Text + screen desc + API contracts as text | Full Figma export |
| SwiftUI | Frontend mobile | Text + screen desc + API contracts as text | Blurry screenshots |

---

### Backend Developers and Images — What Still Applies

Backend developers do not need UI design images — but they often upload other types of images.  
These still cost the same tokens as frontend images.

**Types of images backend developers attach:**

| Image type | Token cost | Has cheaper alternative? | Alternative |
|---|---|---|---|
| Console / terminal error screenshot | ~1,600 tokens | Yes | Copy-paste error text (~20 tokens) |
| Postman / API response screenshot | ~1,600 tokens | Yes | Copy-paste JSON directly (~50–300 tokens) |
| Database ER diagram | ~2,400 tokens | Sometimes | Paste SQL schema or table names (~200 tokens) |
| Architecture / flow diagram | ~3,200 tokens | Rarely | Hard to describe in text — image acceptable |
| Sequence diagram | ~2,400 tokens | No | Relationships are visual — image is worth it |
| Confluence page screenshot | ~2,400 tokens | Yes | Copy-paste the relevant text (~100 tokens) |
| Network tab screenshot (browser DevTools) | ~1,600 tokens | Yes | Copy-paste request/response as text |

**Real examples:**

```
❌ Backend developer attaches screenshot of terminal error:
   NullPointerException screenshot = ~1,600 tokens

✓ Backend developer pastes error text:
   NullPointerException at AuthService.java:142
   caused by: user.role is null when JWT signing attempted
   = ~20 tokens

Saving: 98%
```

```
❌ Backend developer attaches Postman screenshot of API response:
   = ~1,600 tokens

✓ Backend developer pastes JSON:
   {"status": 401, "error": "Token expired", "code": "JWT_EXPIRED"}
   = ~25 tokens

Saving: 98%
```

```
✓ Backend developer attaches architecture diagram:
   Service A → Queue → Service B → DB (with retry arrows)
   = ~3,200 tokens — WORTH IT
   Hard to describe the flow accurately in text.
   Claude reads it once and understands the full integration.
```

**Backend golden rule for images:**
> If the content can be copy-pasted as text (error messages, JSON, SQL, stack traces) — always use text.  
> If the content shows relationships that are hard to describe (architecture, sequence, ER diagrams) — image is acceptable.

**Text wireframe alternative (saves ~3,000 tokens per screen):**
```
Instead of attaching a screenshot, write:

SCREEN: HomeScreen
[TOP]    Logo (center)
[MID]    Community name label
         Sign In button (blue, full-width) — visible when signed out
         Sign Out button (red, full-width) — visible when signed in
[BOTTOM] Community selector dropdown — disabled when signed in
```
Cost: ~60 tokens. Screenshot cost: ~3,200 tokens. Saving: **98%.**

---

### 3.5 Token Summary: `/new-feature`

| Case | Input tokens | Questions Claude asks | Total flow tokens | Spec quality |
|---|---|---|---|---|
| Raw Jira (backend) | ~380 | 4 | ~1,600 | Good |
| Raw Jira (frontend, no image) | ~380 | 5 | ~1,900 | Medium (no layout) |
| Raw Jira (frontend + 2 images) | ~7,000 | 2 | ~8,800 | Very good |
| Jira → ChatGPT (backend) | ~320 | 6 | ~1,900 | Poor |
| Jira → ChatGPT (frontend) | ~320 | 8 | ~2,400 | Poor |
| Manual text (backend) | ~190 | 1 | ~800 | Excellent |
| Manual text (frontend, no image) | ~200 | 3 | ~1,100 | Good |
| Manual text + text wireframe | ~260 | 1 | ~900 | Very good |
| Manual text + 1 image | ~3,400 | 1 | ~4,600 | Excellent |
| Manual text + 3 images | ~9,000 | 1 | ~10,500 | Excellent |

**Best value:** Manual text (backend) ~800 tokens  
**Best quality:** Manual text + images (frontend) ~10,500 tokens  
**Worst value:** Jira → ChatGPT — costs most for worst spec

---

## 4. /fix — All 3 Cases

### How `/fix` Works

```
/fix [developer input]
        ↓
Claude reads: error description + file/line if provided
        ↓
Claude finds the bug → writes minimal diff
        ↓
Output: changed lines only. No explanation unless behaviour changes.
        ↓
DONE — no approval gates (fix is fast, no spec needed)
```

**Key difference from `/new-feature`:** Fix is immediate — no STOP gates, no approval flow.  
The goal is the fastest possible token path to a correct diff.

---

### 4.1 Case 1: Jira Bug Ticket

**What the developer does:**  
Copies the bug report from Jira. Pastes after `/fix`.

**Real example input:**
```
/fix BUG-456

Summary: Login button not working on Android

Description:
Users report that clicking the login button on the Android app does nothing.
The issue was reported by 3 users on 2026-05-10.

Steps to Reproduce:
1. Open the Android app (version 2.1.4)
2. Navigate to the login screen
3. Enter valid email and password
4. Tap the "Login" button
5. Nothing happens — no navigation, no error message

Expected Behaviour: User is navigated to the dashboard
Actual Behaviour: Nothing happens, button appears to receive tap

Environment: Android 13, Pixel 6
Browser: N/A
Build: 2.1.4 (build 147)
Priority: High
Reporter: qa.team@company.com
Assignee: dev@company.com
Sprint: Sprint 14
Story Points: 2
```

**Token breakdown:**
```
Command template:               ~70 tokens
Jira bug ticket (full):        ~200 tokens
  ├─ Useful signal:              ~60 tokens (summary + steps + expected/actual)
  ├─ Environment info:           ~30 tokens (sometimes useful for platform bugs)
  └─ Junk (Reporter/Sprint etc): ~110 tokens (0% useful for fix)
─────────────────────────────────────────────
Total input:                   ~270 tokens
Useful input:                  ~160 tokens (59% efficiency)
```

**Problems with Jira bug tickets for `/fix`:**

| Problem | What happens | Token impact |
|---|---|---|
| No file path given | Claude must search entire codebase | +500 tokens reading files |
| No line number | Claude reads multiple candidates | +300 tokens |
| "Jira steps to reproduce" are UX steps not code steps | Claude reads them but can't use them | ~80 tokens wasted |
| Reporter/Sprint/Story Points | Zero relevance to fixing code | ~110 tokens wasted |
| No error message / stack trace | Claude guesses root cause | Often wrong, +600 tokens correction |

**What Claude produces:**

```
Reading LoginButton.tsx...
Reading LoginScreen.tsx...
Reading AuthBloc.dart...

Found likely cause: event not being dispatched from button tap.

Proposed fix:
- LoginButton.tsx line 45: onClick handler was wrapped in 
  conditional that always evaluates false

⚠ I found 3 possible locations. Which is correct?
  1. LoginButton.tsx:45 — onClick conditional
  2. AuthBloc.dart:112 — event listener not attached
  3. LoginScreen.tsx:88 — button widget missing onPressed
```

Claude had to read 3 files and still asks a question — because no file/line was given.

---

### 4.2 Case 2: Jira → ChatGPT → Fix Prompt

**What the developer does:**  
Pastes bug Jira into ChatGPT asking "create a fix prompt for Claude."  
ChatGPT gives verbose description. Developer pastes after `/fix`.

**What ChatGPT gives back:**
```
Please investigate and fix the login button functionality issue in 
the Android mobile application. The login button appears to be 
unresponsive when tapped by users, failing to trigger the expected 
navigation to the dashboard screen. This issue has been reported by 
multiple users and requires immediate attention.

Please examine the button's event handling, ensure the click listeners 
are properly attached, verify that the authentication flow is correctly 
wired, and implement a comprehensive fix that addresses the root cause 
while maintaining the existing architectural patterns and ensuring 
backward compatibility.
```

**Token breakdown:**
```
Command template:               ~70 tokens
ChatGPT output:                ~160 tokens
  ├─ Useful signal:              ~20 tokens ("login button not working, no navigation")
  └─ Padding:                   ~140 tokens ("comprehensive", "backward compatibility" etc.)
─────────────────────────────────────────────
Total input:                   ~230 tokens
Useful input:                   ~90 tokens (39% efficiency)
```

**Problems:**

| Problem | What happens | Token impact |
|---|---|---|
| Exact error / steps removed by ChatGPT | Claude has no starting point | +800 tokens searching |
| "Comprehensive fix" instruction | Claude refactors beyond the bug | Code bloat, review cost |
| "Maintain architectural patterns" vague | Claude second-guesses every line | Slower output |
| "Backward compatibility" | Claude adds unnecessary guards | More output tokens |

**Total tokens (full flow):** ~2,100 tokens — worst case for a fix.

---

### 4.3 Case 3: Manual Fix Prompt

**What the developer does:**  
Identifies the bug themselves. Writes a precise, targeted prompt.

**Good example — backend:**
```
/fix AuthService.ts:142 — login() returns undefined instead of 
JWT token when user.role is null. Null check missing before 
jwt.sign() call.
```

**Token breakdown:**
```
Command template:               ~70 tokens
Developer's precise text:       ~40 tokens
  └─ All signal, zero noise:    ~40 tokens (100% efficiency)
─────────────────────────────────────────────
Total input:                   ~110 tokens
```

**What Claude produces:**
```
AuthService.ts:142

- const token = jwt.sign({ userId: user.id, role: user.role }, secret);
+ const role = user.role ?? 'guest';
+ const token = jwt.sign({ userId: user.id, role }, secret);

Done. 2 lines changed.
```

**No questions. No searching. No rework.**  
**Total tokens (full flow):** ~200 tokens. Fastest possible.

**Good example — frontend with screenshot:**
```
/fix CommunityCard.tsx — overflow error on long community names
[attaches: overflow-screenshot.png]
```

Image shows exact component, exact overflow, exact location.  
Claude reads image (~2,400 tokens) → finds component → one-line fix.  
**Total tokens (full flow):** ~2,800 tokens. Worth it — no searching needed.

---

### 4.4 Frontend vs Backend Difference for `/fix`

```
BACKEND fix needs:                FRONTEND fix needs:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ File path + line number         ✓ Component name
✓ Exact error message             ✓ What looks wrong visually
✓ Stack trace (if available)      ✓ Screenshot of the bug
✗ NO screenshots                  ✓ Expected vs actual appearance
```

**Most valuable thing for a fast fix:**

```
Backend:  /fix <file>:<line> — <error message or what's wrong>
Frontend: /fix <ComponentName> — <what's wrong> [+ 1 screenshot if visual bug]
```

---

### 4.5 Token Summary: `/fix`

| Case | Input tokens | Files Claude reads | Total flow tokens | Fix quality |
|---|---|---|---|---|
| Jira bug ticket | ~270 | 2–4 files | ~1,200 | Usually correct |
| Jira → ChatGPT | ~230 | 3–5 files | ~2,100 | Often needs correction |
| Manual (backend, precise) | ~110 | 0 (direct to fix) | ~200 | Excellent |
| Manual (frontend, no image) | ~120 | 1–2 files | ~600 | Good |
| Manual (frontend + screenshot) | ~2,600 | 0 (image shows it) | ~2,900 | Excellent |

**Best case:** Manual with file + line number. Claude goes straight to the fix.  
**Worst case:** Jira → ChatGPT — Claude searches wrong files, needs correction round.

---

## 5. Other Daily Commands

### 5.1 /edit-feature

**Purpose:** Update an existing spec — when requirements change, design changes, or tasks need reordering.

**The problem:**  
Developers often re-paste the full original description when only one thing changed.  
Claude then compares the full old + new description, rewrites entire spec.

```
Developer types:                    What Claude receives:
/edit-feature "move QR code        Just the change description
to bottom of success screen"       + existing spec (read from disk)
                                   = SMALL input, TARGETED update ✓

vs.

/edit-feature "APDB-13457          Full Jira ticket AGAIN
[full Jira text again]             + existing spec
new requirement: QR code"          = LARGE input, Claude re-evaluates
                                     everything ✗
```

**Correct usage:**
```
/edit-feature <feature-slug> — <what changed only>

Example: /edit-feature facility-sign-in — add logout confirmation popup 
         before sign-out, needs "Are you sure?" with Yes/No buttons
```

**Problem: Full spec re-sent:** ~1,400 tokens  
**Correct: Change description only:** ~180 tokens  
**Saving: 87%**

---

### 5.2 /hotfix

**Purpose:** Critical production fix. Touch minimum files. Deploy fast.

**The problem:**  
When something is broken in production, developers over-explain context.  
Claude reads all the context, then asks clarifying questions — wasting time when speed is critical.

**What developers send:**
```
/hotfix The CVN badge printing is broken in production. We deployed 
v2.1.4 yesterday and since then every vendor who signs in gets two 
badges printed even when they haven't opted out of SMS. It started 
at 2 PM EST. We've had 50 complaints. The badge printer logic is 
somewhere in the signing flow. Badge printing should only trigger 
when opted_out_sms = true AND is_existing_visitor = false but now 
it's always printing the extra badge regardless.
```

**What Claude actually needs:**
```
/hotfix BadgePrintManager.kt — extra badge always printing.
Condition check: opted_out_sms AND !is_existing_visitor.
Currently printing for ALL vendors.
```

**Problem:** Developer's version = ~120 tokens, most is incident narrative.  
**Correct version:** ~45 tokens, pure signal.

**Hotfix golden rule:**  
> File + line + condition that's wrong. Nothing else.

---

### 5.3 /refactor

**Purpose:** Improve code quality without changing behaviour.

**The problem:**  
Developers paste the entire file they want refactored.  
Claude reads 500 lines when only 50 are in scope.

```
Developer sends:            What Claude needs:
/refactor                   /refactor AuthService.ts:signIn() method
[pastes entire             Extract JWT signing into separate  
AuthService.ts file        signToken() private method.
— 400 lines]
```

**Problem:** 400-line file = ~2,000 tokens of code Claude reads.  
But only the `signIn()` method (50 lines) is in scope = ~250 tokens needed.  
**Waste: 87%.**

**Refactor golden rule:**  
> Name the function/class/method. Not the file. Not the module.

```
✓ /refactor AuthService.ts:signIn() — extract JWT logic to signToken()
✗ /refactor AuthService.ts [pastes file]
✗ /refactor the auth module
```

---

## 6. Complete Problems Summary

### Problem 1: Junk Tokens (Jira metadata)

**What it is:** Jira tickets contain fields that are irrelevant to writing code.  
**Examples:** Sprint, Story Points, Reporter, Assignee, Epic Link, Labels, Status, Fix Version, Created date.  
**Token waste:** ~40–110 tokens per ticket.  
**Frequency:** Every time a developer copy-pastes from Jira.  
**Affects:** `/new-feature`, `/fix`, `/edit-feature`, `/hotfix`

**Critical clarification — the extraction instruction does NOT reduce input tokens:**

This is the most important point about Jira junk that developers misunderstand.

```
The extraction instruction in the command template says:
"Discard: Jira metadata (Sprint/Points/Reporter/Labels)"
                        ↓
What Claude does:
  READS all tokens including junk  ← you pay this cost regardless
  IGNORES junk when reasoning      ← this is what the instruction fixes
  ACTS only on useful parts        ← correct behaviour

What Claude does NOT do:
  Skip reading the junk            ← impossible, already sent and paid for
```

Think of it like handing someone a 10-page document and saying "only read pages 3 and 7."  
They still receive all 10 pages. You still paid to print all 10 pages.  
The instruction only changes their behaviour — not the cost of sending.

```
Jira metadata tokens — paid on every call regardless:
  Sprint: Sprint 14                ← 4 tokens. Paid. Ignored by Claude.
  Story Points: 5                  ← 4 tokens. Paid. Ignored by Claude.
  Reporter: john.doe@company.com   ← 8 tokens. Paid. Ignored by Claude.
  Assignee: jane@company.com       ← 7 tokens. Paid. Ignored by Claude.
  Epic Link: APDB-100              ← 5 tokens. Paid. Ignored by Claude.
  Labels: mobile, state-mgmt       ← 7 tokens. Paid. Ignored by Claude.
  Status: In Progress              ← 4 tokens. Paid. Ignored by Claude.
  Fix Version: 2.1.0               ← 5 tokens. Paid. Ignored by Claude.
  Created: 2024-01-15              ← 5 tokens. Paid. Ignored by Claude.
  ──────────────────────────────────────────────────────────────────
  Total junk paid per call:        ~49 tokens × every command usage
```

**What the extraction instruction actually fixes:**

| Without extraction instruction | With extraction instruction |
|---|---|
| Input: 380 tokens (junk included) | Input: 380 tokens (junk included) ← SAME COST |
| Claude asks about Sprint, Priority | Claude ignores Sprint, Priority |
| Claude references Reporter in output | Claude focuses only on requirements |
| Output includes wrong content | Output is correct |
| **Cost: high + wrong output** | **Cost: same input, correct output** |

**The only real solutions to reduce Jira input tokens:**

```
Option A — Developer strips manually (no tooling needed)
  Before pasting: delete Sprint/Reporter/Labels/Status/Fix Version
  Saving: ~50 tokens per call
  Effort: 30 seconds per developer per ticket

Option B — Jira URL instead of content (future ai-gov feature)
  /new-feature https://company.atlassian.net/browse/APDB-13457
  ai-gov calls Jira API → extracts only signal fields → sends ~150 tokens
  Saving: ~50% on Jira input
  Effort: Medium — requires Jira API integration in ai-gov CLI

Option C — CLI pre-processor (future ai-gov feature)
  Developer pastes full Jira text as normal.
  ai-gov strips known Jira metadata field patterns before sending to Claude.
  Saving: ~40–110 tokens per call automatically
  Effort: Low — regex strip of known field names in ai-gov source
```

---

### Problem 2: Padding Tokens (ChatGPT output)

**What it is:** ChatGPT adds preamble, hedging words, and generic best-practice language.  
**Examples:** "Certainly!", "comprehensive", "seamless", "maintain architectural patterns", "ensure backward compatibility"  
**Token waste:** 60–80% of the ChatGPT output is noise.  
**Frequency:** Developers who use ChatGPT to "improve" their prompts.  
**Affects:** All commands. Worst for `/new-feature` (creates vague specs).

---

### Problem 3: Image Tokens (Frontend AND Backend)

**What it is:** Images attached to commands are converted to tokens regardless of stack.  
**Cost:** ~1,600–4,000 tokens per image depending on dimensions.  
**When worthwhile:** When image contains information Claude would otherwise need to ask about.  
**When wasteful:** Any image where the content could be copy-pasted as text instead.  
**Affects:** `/new-feature`, `/fix`, `/edit-feature` — both frontend and backend developers

**Frontend images** (UI screens, Figma, components):
- Worth attaching when they show layout, component placement, colors
- Replace with text wireframe format to save ~3,000 tokens per screen

**Backend images** (errors, API responses, ER diagrams, architecture):
- Console errors, JSON responses, stack traces → always copy-paste as text (~98% saving)
- ER diagrams, sequence diagrams, architecture flows → image acceptable (hard to text-describe)
- Confluence screenshots, Postman screenshots → always copy-paste text instead

**Token cost by image type:**

| Image | Tokens | Text alternative | Alternative tokens | Use image? |
|---|---|---|---|---|
| UI screen design | ~3,200 | Text wireframe | ~60 | Only if complex |
| Console error | ~1,600 | Paste error text | ~20 | Never |
| API JSON response | ~1,600 | Paste JSON | ~50–300 | Never |
| ER diagram | ~2,400 | Paste SQL schema | ~200 | Sometimes |
| Architecture diagram | ~3,200 | Text description | ~150 | Yes — worth it |
| Sequence diagram | ~2,400 | Hard to describe | — | Yes — worth it |
| Bug screenshot (visual) | ~2,400 | Describe what's wrong | ~40 | Yes for visual bugs |
| Postman screenshot | ~1,600 | Paste request/response | ~100 | Never |

---

### Problem 4: Narration Tokens (Claude over-explaining)

**What it is:** Without a clear output contract, Claude narrates its thinking.  
**Examples:**  
- "I understand you want to build a login feature. Let me start by analysing..."  
- "Here's my plan: First I will create the requirements, then..."  
- "Based on the information provided, I believe the best approach would be..."  
**Token waste:** 100–300 tokens per response, pure output waste.  
**Root cause:** No output contract in the command template.  
**Affects:** All commands.

---

### Problem 5: Over-generation Tokens (No STOP gates)

**What it is:** Without STOP gates, Claude keeps going past what was asked.  
**Examples:**  
- `/new-feature` without STOP → Claude creates spec AND starts writing code  
- `/fix` without constraints → Claude fixes the bug AND refactors surrounding code  
- `/edit-feature` without constraints → Claude rewrites the entire spec  
**Token waste:** 500–3,000 tokens of unrequested output.  
**Root cause:** No STOP gate in the command template.  
**Affects:** All commands, especially `/new-feature` and `/fix`.

---

### Problem 6: Codebase Search Tokens (No file context)

**What it is:** When no file/line is given, Claude searches the codebase to find the relevant code.  
**Cost:** Claude reads 2–5 files = 500–2,500 extra input tokens per search.  
**When avoidable:** 90% of the time — developer already knows which file the bug is in.  
**Root cause:** Developers don't include file path in fix/hotfix prompts.  
**Affects:** `/fix`, `/hotfix`, `/refactor`

---

### Problem 7: Stack Mismatch (Wrong template for stack type)

**What it is:** Same command template used for backend and frontend. Frontend template asks for images; backend developer doesn't need images but template still mentions them (confusing).  
**Consequence:** Backend developers attach screenshots "just in case" = wasted tokens.  
**Root cause:** Single generic command template for all stacks.  
**Affects:** All commands — particularly `/new-feature`

---

## 7. Token Consumption Master Table

### `/new-feature` full comparison

| Input type | Stack | Images | Input tokens | Q&A rounds | Output tokens | Total | Quality |
|---|---|---|---|---|---|---|---|
| Raw Jira | Backend (Node/Python/Java/Kotlin-Spring) | None | ~380 | 1 round (4Q) | ~900 | ~1,600 | Good |
| Raw Jira | Backend | Architecture diagram | ~2,780 | 1 round (3Q) | ~900 | ~4,000 | Good |
| Raw Jira | Backend | Error screenshot (avoid — paste text) | ~1,980 | 1 round (4Q) | ~900 | ~3,200 | Wasted tokens |
| Raw Jira | Frontend Web (React/Angular) | None | ~380 | 2 rounds (5Q) | ~1,200 | ~1,900 | Medium |
| Raw Jira | Frontend Web + API contracts as text | None | ~450 | 1 round (1Q) | ~900 | ~1,500 | Good |
| Raw Jira | Frontend Mobile (Flutter/SwiftUI/Kotlin-Android) | 2 images | ~7,000 | 1 round (2Q) | ~1,100 | ~8,400 | Very good |
| Jira→ChatGPT | Backend | None | ~320 | 2 rounds (6Q) | ~1,300 | ~1,900 | Poor |
| Jira→ChatGPT | Frontend | None | ~320 | 3 rounds (8Q) | ~1,800 | ~2,400 | Poor |
| Manual text | Backend | None | ~190 | 0 rounds (1Q) | ~700 | ~800 | Excellent |
| Manual + API contracts as text | Backend | None | ~250 | 0 rounds (0Q) | ~700 | ~950 | Excellent |
| Manual + API contracts as text | Frontend Web | None | ~280 | 0 rounds (0Q) | ~800 | ~1,080 | Excellent |
| Manual + API contracts as text | Frontend Mobile | None | ~310 | 0 rounds (0Q) | ~800 | ~1,110 | Excellent |
| Manual + wireframe text | Frontend | None | ~260 | 0 rounds (1Q) | ~800 | ~900 | Very good |
| Manual + API contracts + 1 design image | Frontend Mobile | 1 | ~3,510 | 0 rounds (0Q) | ~900 | ~4,410 | Excellent |

---

### `/fix` full comparison

| Input type | Stack | Input tokens | Files searched | Output tokens | Total | Quality |
|---|---|---|---|---|---|---|
| Jira bug ticket | Backend | ~270 | 2–4 files | ~600 | ~1,200 | Good |
| Jira bug ticket + error screenshot (avoid) | Backend | ~1,870 | 0–1 files | ~300 | ~2,200 | Good (wasted) |
| Jira bug ticket + error text (correct) | Backend | ~290 | 0 files | ~200 | ~500 | Excellent |
| Jira bug ticket | Frontend | ~270 | 1–3 files | ~500 | ~900 | Good |
| Jira→ChatGPT | Backend | ~230 | 3–5 files | ~900 | ~2,100 | Poor |
| Jira→ChatGPT | Frontend | ~230 | 3–5 files | ~900 | ~2,100 | Poor |
| Manual (precise, file+line) | Backend | ~110 | 0 files | ~120 | ~200 | Excellent |
| Manual + error text | Backend | ~130 | 0 files | ~120 | ~250 | Excellent |
| Manual + error screenshot (avoid) | Backend | ~1,710 | 0 files | ~150 | ~1,900 | Excellent (wasted) |
| Manual (component) | Frontend | ~120 | 1 file | ~200 | ~400 | Very good |
| Manual + bug screenshot | Frontend | ~2,600 | 0 files | ~250 | ~2,900 | Excellent |

---

### Other commands

| Command | Best input | Typical tokens | Worst input | Worst tokens |
|---|---|---|---|---|
| `/edit-feature` | Change description only (~60 tokens) | ~500 | Re-paste full feature (~300 tokens) | ~2,800 |
| `/hotfix` | File + line + condition (~45 tokens) | ~300 | Incident narrative (~120 tokens) | ~1,800 |
| `/refactor` | Function name + goal (~40 tokens) | ~400 | Paste entire file (~2,000 tokens) | ~4,500 |

---

## 8. Solutions Roadmap

The following solutions address the 7 problems identified above.  
Listed in order of impact vs implementation effort.

---

### Solution 1 — Extraction Line in Every Template
**Addresses:** Problem 1 (Junk tokens), Problem 2 (Padding tokens)  
**Effort:** Very low — 1 line added to each command template  
**Saving:** ~40–200 tokens per call  

Add to every command template:
```
Extract signal only: feature/bug name, goal, acceptance criteria, file paths.
Discard: Jira metadata (Sprint/Points/Reporter/Labels), ChatGPT preamble, generic best-practice language.
```
This single instruction handles all Jira and ChatGPT inputs automatically.

---

### Solution 2 — Output Contracts in Every Template
**Addresses:** Problem 4 (Narration tokens)  
**Effort:** Very low — 1 line added per template  
**Saving:** 100–300 tokens per response  

```
/new-feature → "Output: file paths created + 3-line spec summary. Nothing else."
/fix         → "Output: changed lines only. One-line note only if behaviour changes."
/hotfix      → "Output: diff + commit message. No explanation."
/refactor    → "Output: diff only. Flag behaviour change BEFORE applying."
/edit-feature → "Output: unified diff per changed file. Do not reprint unchanged sections."
```

---

### Solution 3 — STOP Gates in `/new-feature` and `/edit-feature`
**Addresses:** Problem 5 (Over-generation tokens)  
**Effort:** Low — explicit STOP instructions in template  
**Saving:** 500–3,000 tokens per run  

```
STOP after requirements.md. Show spec. Wait for "ok".
STOP after design.md. Show design. Wait for "ok".
STOP after tasks.md. Show tasks. Wait for "go ahead".
Do NOT write code until developer says "go ahead".
```

---

### Solution 4 — Stack-Aware Command Templates
**Addresses:** Problem 7 (Stack mismatch)  
**Effort:** Medium — ai-gov generates different templates per stack  
**Saving:** Prevents wrong usage patterns  

```typescript
// ai-gov detects stack on init → generates matching template

Backend stacks (nodejs, python, java, kotlin-spring):
  Template asks for: API endpoint, request/response schema,
                     DB tables, auth, error cases.
  NO mention of images.
  Paste JSON/SQL as text — do not attach screenshots.

Frontend stacks (react, angular, next, flutter, swiftui, kotlin-android):
  Template asks for: screen name, component layout, navigation flow,
                     API contracts as text (URL + body + response).
  Offers text wireframe format as preferred option over screenshots.
  Accepts 1 design image for complex layouts.
  Paste API responses as JSON — do not attach Postman screenshots.
```

---

### Solution 5 — Text Wireframe Format (Frontend)
**Addresses:** Problem 3 (Image tokens) for frontend  
**Effort:** Zero — just teach developers the format  
**Saving:** ~3,000 tokens per screen vs screenshot  

Add to frontend templates:
```
For UI screens, describe layout instead of attaching images:

SCREEN: <ScreenName>
[TOP]    <header content>
[MID]    <main components>
[BOTTOM] <footer / action buttons>
Colors: <primary>, <background>

This costs ~60 tokens. A screenshot costs ~3,200 tokens.
```

---

### Solution 6 — Single `/help` Command with Interactive Selection
**Addresses:** Problems 1, 2, 3, 6 — education  
**Effort:** Low — one generated file installed by `ai-gov init`  
**Saving:** Compounds over time as developers learn correct input patterns  

---

#### Why single `/help` — not `--help` flag or separate help files

| Approach | Command list | Help tokens on every real call | Developer experience |
|---|---|---|---|
| Separate `/new-feature-help` files | 10 commands (cluttered) | 0 | Confusing — doubled list |
| `--help` flag in each template | 5 commands (clean) | ~200 (always loaded) | Natural but costs tokens |
| **Single `/help` command** | **6 commands (clean)** | **0** | **Best — one entry, interactive** |

---

#### What developer sees inside Claude Code

```
Developer types /  →  autocomplete shows:

  /new-feature
  /edit-feature
  /fix
  /hotfix
  /refactor
  /help          ← single entry for all guidance
```

---

#### How `/help` works

```
Developer types: /help
                    ↓
Claude shows menu — waits for selection:

  Which command do you need help with?

  1. /new-feature   — create a feature spec
  2. /edit-feature  — update an existing spec
  3. /fix           — fix a bug
  4. /hotfix        — critical production fix
  5. /refactor      — improve code, no behaviour change

  Type a number or command name.
                    ↓
Developer types: 1  (or "new-feature")
                    ↓
Claude shows the /new-feature guide for their stack
```

Also works with direct argument — skips menu entirely:
```
/help new-feature   → shows new-feature guide directly
/help fix           → shows fix guide directly
/help hotfix        → shows hotfix guide directly
```

---

#### Token cost

```
/new-feature login page      → loads new-feature.md only    = ~100 tokens
/help                        → loads help.md (~600 tokens)
                               only when developer asks for it

Real commands stay lean. Help tokens only paid when needed.
```

---

#### Content of `.claude/commands/help.md` (generated by `ai-gov init`)

This is the full content of the single help file — all good/bad examples per command per stack.

```markdown
If $ARGUMENTS is empty or "menu": show the selection menu below and wait.
If $ARGUMENTS matches a number or command name: show that command's guide directly.

---

MENU:
Which command do you need help with?
1. /new-feature   — create a feature spec
2. /edit-feature  — update an existing spec
3. /fix           — fix a bug
4. /hotfix        — critical production fix
5. /refactor      — improve code, no behaviour change

---

## 1. /new-feature

### Backend (Node.js / Python / Java / Kotlin Spring)

✓ GOOD — minimal clean prompt:
/new-feature POST /api/auth/login
  Body: {email, password}
  Response: {token: JWT, user: {id, name, role}}
  Error: 401 wrong creds | 404 not found
  DB: reads users, writes sessions

✓ GOOD — from Jira (strip metadata, keep signal):
/new-feature APDB-234 — CVN status tracking
  On vendor sign-in: write cvn_status="pending" to visit_logs
  Start timer: community.cvn_timeframe_hours
  API: PATCH /api/visits/:id/cvn-status

✗ BAD — full Jira paste (Sprint/Reporter waste tokens):
/new-feature APDB-234
  Priority: High | Sprint: Sprint 14 | Reporter: john@company.com ...

✗ BAD — ChatGPT padded (forces 6 questions):
/new-feature Please implement a comprehensive authentication system...

---

### Frontend Web (React / Angular / Next.js)
Include API contracts as text — never as Postman screenshots.

✓ GOOD — single API:
/new-feature LoginPage
  Form: email + password + Login button
  API: POST /api/auth/login
    Body: {"email":"string","password":"string"}
    200:  {"token":"jwt","user":{"id":1,"name":"string"}}
    401:  {"error":"Invalid credentials"}
  On success: store token in localStorage → redirect /dashboard
  On error: show "Invalid email or password" below form

✓ GOOD — multiple APIs:
/new-feature CVN Success Screen
  Triggered when care_visit_note_enabled = true
  APIs:
  1. GET /api/community/:id
     Response: {care_visit_note_enabled:bool, cvn_start_message:string,
                cvn_service_types:string[]}
  2. POST /api/visits/qr-entry
     Body: {resident_id:string[], qrcode:string, type:"VENDOR"}
     Response: {visit_id:number, cvn_status:"pending"}
  Changes: replace animation → QR code | timer 10s | message from cvn_start_message

✗ BAD — no API details (forces 4 questions):
/new-feature CVN success screen with QR code

✗ BAD — Postman screenshot instead of JSON:
/new-feature CVN feature [attaches postman-response.png]

---

### Frontend Mobile (Flutter / SwiftUI / Kotlin Android)
Include screen layout AND API contracts as text.

✓ GOOD — screen + single API:
/new-feature LoginScreen (Flutter)
  SCREEN: LoginScreen
  [TOP]    Logo
  [MID]    Email TextField, Password TextField (obscured)
           Login ElevatedButton (blue, full-width)
  [BOTTOM] Forgot password TextButton
  API: POST /v1/auth/login
    Body: {"email":"string","password":"string"}
    200:  {"token":"eyJ...","user":{"id":1,"role":"vendor"}}
    401:  {"error":"Invalid credentials"}
  On success: FlutterSecureStorage → push HomeScreen
  On error: SnackBar "Invalid email or password"

✓ GOOD — screen + multiple APIs:
/new-feature CVN Kiosk Flow (Kotlin Android) — APDB-13457
  SCREEN CHANGES:
  1. LastVisitInfoStartFragment — add cvn_start_message below resident list
     Show only when: resident selected + flag = true
  2. VendorQuestionFragment — SKIP when CVN + QR sign-in
     Auto-populate all resident IDs from qr_signin.visited_entities[]
  3. CompleteSignFragment — replace animation → QR code | timer 10s
  APIs:
  1. GET /v1/kiosk/community → care_visit_note_enabled, cvn_service_types[], cvn_start_message
  2. GET /v1/kiosk/qr_signin → visited_entities[{id, sugar_id, first_name}]
  3. POST /v1/kiosk/qr_event_entries → {resident_id:["uuid1","uuid2"], visited_entities:[]}

✗ BAD — no screen info, API as image:
/new-feature CVN kiosk feature [attaches API response screenshot]

---

## 2. /edit-feature

✓ GOOD — describe ONLY what changed:
/edit-feature facility-sign-in — add logout confirmation popup
  "Are you sure you want to sign out?" with Yes / No buttons

✗ BAD — re-paste full feature description:
/edit-feature [full Jira ticket again + original description]
  → Claude re-evaluates everything, rewrites unchanged sections
  → 87% more tokens for same result

---

## 3. /fix

### Backend (Node.js / Python / Java / Kotlin Spring)

✓ GOOD — file + line + error text:
/fix AuthService.java:142 — jwt.sign() throws NullPointerException
  java.lang.NullPointerException: user.role is null
  Fix: null check before jwt.sign() call

✓ GOOD — with stack trace (paste text, not screenshot):
/fix BadgePrintManager.kt:88 — extra badge always printing
  Condition: opted_out_sms && !is_existing_visitor
  is_existing_visitor check is inverted
  at BadgePrintManager.shouldPrintExtra(BadgePrintManager.kt:88)

✗ BAD — Jira paste:
/fix BUG-456 | Priority: High | Reporter: qa@company.com | Sprint: 14...

✗ BAD — error screenshot:
/fix login broken [attaches terminal-error.png]
  → paste the error text: 98% fewer tokens, same info

### Frontend Mobile (Flutter / SwiftUI / Kotlin Android)

✓ GOOD — visual bug + 1 screenshot:
/fix CommunityCard (Flutter) — name overflows on long text
  [attaches: overflow-screenshot.png]
  Expected: ellipsis | Actual: overflows card

✓ GOOD — API bug, paste response text:
/fix QrSignInUseCase.kt:112 — visited_entities always empty
  Code reads visit_info.resident_id[] but response has visited_entities[]
  "visited_entities":[{"id":191271,"sugar_id":"ab2a451a..."}]

✗ BAD — API response as screenshot:
/fix QR sign-in [attaches postman-screenshot.png]
  → paste JSON directly: 98% fewer tokens

### Frontend Web (React / Angular / Next.js)

✓ GOOD:
/fix LoginForm.tsx:45 — onClick not firing
  Button inside <form>, submit prevents default, e.preventDefault() missing

✓ GOOD — API bug, paste response:
/fix useAuth.ts:88 — token not stored after login
  Response: {"token":"eyJhb...","user":{"id":1}}
  Bug: code reads response.data.token but structure is response.token

✗ BAD:
/fix BUG-789 [full Jira ticket pasted]

---

## 4. /hotfix
Production is broken. File + condition only. Nothing else.

✓ GOOD — backend:
/hotfix CvnStatusService.java:203 — timer never starts
  care_visit_note_enabled uses = instead of ==

✓ GOOD — frontend mobile:
/hotfix BadgePrintManager.kt:88 — extra badge always printing
  !is_existing_visitor reads as is_existing_visitor (inverted)

✓ GOOD — frontend web:
/hotfix LoginPage.tsx — blank screen, console: "Cannot read properties of null (reading 'token')"
  response.data is null on 401

✗ BAD — incident narrative:
/hotfix Production is broken since yesterday. 50 complaints. Badge printing
  was fine before v2.1.4 but now every vendor gets extra badge...
  → 120 tokens of story, zero code context

---

## 5. /refactor
Name the function/method — not the file. Not the module.

✓ GOOD — backend:
/refactor AuthService.java:signIn() — extract JWT creation to signToken()
  Goal: single responsibility — signIn() orchestrates, signToken() handles JWT

✓ GOOD — frontend mobile:
/refactor SignInBloc.dart — split mapEventToState into per-event handlers
  Currently: one 120-line when() block
  Goal: SignInEvent, SignOutEvent, KioskSyncEvent as separate private methods

✓ GOOD — frontend web:
/refactor useAuth.ts:login() — extract API call to authApi.ts
  Currently: fetch() inside hook | Goal: hook calls service, matches project pattern

✗ BAD — paste entire file:
/refactor [pastes AuthService.java — 400 lines]
  → name the method, not the file

✗ BAD — scope too vague:
/refactor the auth module
  → Claude reads 8 files, rewrites things you didn't ask about
```

---

### Solution 7 — Image Preprocessing via Claude Haiku (Advanced)
**Addresses:** Problem 3 (Image tokens) — technical solution  
**Effort:** High — requires CLI changes in ai-gov  
**Saving:** ~85% reduction in image-related costs  

```
Current: developer attaches image (3,200 tokens) → sent to Sonnet/Opus
Proposed: ai-gov --preprocess-images flag
  → Intercepts image
  → Sends to Haiku with "describe this UI in structured text"
  → Haiku returns ~200 token text description
  → Text description sent to main command instead of image

Cost: 3,200 tokens (Haiku, cheap) + 200 tokens (Sonnet)
vs:   3,200 tokens (Sonnet, expensive)
Saving: ~85% on image portion of cost
```

---

### Solution Priority

| # | Solution | Impact | Effort | Build order |
|---|---|---|---|---|
| 1 | Extraction line in every template | High | Very low | **First** |
| 2 | Output contracts in every template | High | Very low | **First** |
| 3 | STOP gates in `/new-feature` + `/edit-feature` | High | Low | **First** |
| 4 | Stack-aware command templates | Medium | Medium | **Second** |
| 5 | Text wireframe format (frontend) | Medium | Zero | **First** |
| 6 | Single `/help` command with interactive selection | Medium | Low | **Second** |
| 7 | Image preprocessing via Claude Haiku | High | High | **Third** |

**Phase 1 (build now — 1 day):** Solutions 1, 2, 3, 5
```
Generate 5 command files: new-feature.md, edit-feature.md, fix.md, hotfix.md, refactor.md
Each with: extraction line + output contract + STOP gates where needed
Frontend templates include: text wireframe format guide
Covers Problems: 1 (partial), 2, 4, 5
Estimated saving: 60–80% immediately
```

**Phase 2 (next sprint):** Solutions 4, 6
```
Solution 4: Stack-aware templates — different new-feature.md per stack group
            (backend vs frontend-web vs frontend-mobile)
Solution 6: Single help.md command — installed by ai-gov init
            Developer types /help → interactive menu → stack-specific examples
Covers Problems: 6, 7
```

**Phase 3 (future):** Solution 7
```
Image preprocessing pipeline
ai-gov CLI intercepts images → sends to Haiku → Haiku returns text description
Text description forwarded to main command instead of raw image
Saving: ~85% on image token cost
Requires: Haiku API integration in ai-gov CLI
```

---

*This document is maintained by the ai-gov team. Update token estimates as Claude pricing changes.*  
*Last updated: 2026-05-13*
