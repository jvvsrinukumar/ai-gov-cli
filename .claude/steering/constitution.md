# Constitution — ai-gov

> **These rules are ABSOLUTE. You must never violate them.**
> **Priority: constitution.md > CLAUDE.md > steering files > specs**

## Hard Rules — You Must Obey These
- **Never** skip architecture layers — `Route → Model`
- **Never** write business logic in Routes — routers are thin (validate, delegate, respond)
- **Never** query the database directly from Routes — go through Service
- **Never** return raw database objects in API responses — map to response schemas
- **Never** access tenant-scoped data without `org_id` filtering
- **Never** leave TODO comments in production code
- A task is **not complete** without a test
- **When adding, modifying, or removing a hook** — update `.claude/hooks/README.md`

## Architecture Invariants — Never Deviate
**Layer flow:** Route → Model

### Route (API / Entry Point)
- Receives HTTP requests; validates input via request schemas
- Delegates to services; returns response schemas; no business logic

### Model (Data / Infrastructure)
- Database engine, connection pool, session factory
- External service clients (HTTP, blob storage, message queues)

## High-Risk Files — Confirm Before Editing
- `config.ts`
