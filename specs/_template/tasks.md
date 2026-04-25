# Tasks — [Feature Name]

## Status Guide
| Marker | Meaning |
|--------|---------|
| `- [ ]` | Pending |
| `- [x]` | Done |
| `⚠️ BLOCKED:` | Cannot proceed |
| `_(deferred)_` | Deferred |

## Size Guide: S < 30min · M 30min–2h · L 2h+

---

## Phase 1 — Setup
- [ ] **[S]** Generate scaffold
- [ ] **[S]** Define domain model(s)

## Phase 2 — Data Layer
### Database:
- [ ] **[S] [Model]** Define or update data model(s)
- [ ] **[S] [Migration]** Create DB migration (if applicable)
- [ ] **[S] [Schema]** Define request/response validation schemas

### If External Service Integration:
- [ ] **[M] [Integration]** Implement external service client
- [ ] **[S] [Integration]** Add retry logic + error handling

## Phase 3 — Business Logic
### Business Logic:
- [ ] **[M] [Model]** Implement Model with business rules
- [ ] **[S] [Model]** Add tenant isolation (org_id scoping)

## Phase 4 — State
- [ ] **[S] [Middleware]** Wire middleware (auth, DB connection, RBAC)
- [ ] **[S] [Middleware]** Add permission/role checks

## Phase 5 — API Layer
- [ ] **[M] [Route]** Implement API endpoint(s)
- [ ] **[S] [Route]** Register in router aggregator

## Phase 6 — Tests

- [ ] **[M] [Test]** Unit tests for service layer
- [ ] **[M] [Test]** Integration tests for API endpoint(s)
- [ ] **[S] [Test]** RBAC / tenant isolation tests

## Phase 7 — Wrap-Up
- [ ] **[S]** Post-task checklist (.claude/CLAUDE.md)
- [ ] **[S]** Update feature README

---
## Blockers
| Blocker | Affects | Waiting On |
|---------|---------|-----------|
| _none_ | — | — |
