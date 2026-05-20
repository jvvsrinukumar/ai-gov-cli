# Knowledge Hub Guide
## Claude Code + Kiro — All 5 Phases + v20.3 Developer Onboarding

**Audience:** Developers, team leads
**Version:** v20.3.0 · **Date:** 2026-05-20
**Status:** Shipped — all phases active, zero-knowledge developer onboarding, automated knowledge freshness in PR check

---

## What's new since v17.2.0

**v19.0 (knowledge commands + ergonomics):**
- New read-only `/knowledge [scope]` command — viewer for developers who don't have write access.
- HTML export from `/tech-knowledge` and `/product-knowledge` with Mermaid diagrams.
- `merge=union` set on `knowledge/*.md` in `.gitattributes` — parallel team edits don't conflict.
- `/fix` and `/hotfix` now silently capture business rules into `knowledge/product-*.md` (in addition to `/new-feature` and `/edit-feature`).

**v19.1 (hardening):**
- **Pre-commit guard on `[CONFIRMED]`.** Removing a `[CONFIRMED]` line from `knowledge/*.md` is blocked at commit time. Bypass: `AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m '<message>'`. See section 11.
- **`/fix` DO-NOT-CAPTURE blocklist.** Default is now "no business rules extracted." Captures only when the root cause is a misunderstood requirement, an unenforced constraint, or a missing role check.
- **Mechanical drift detection.** Replaces fuzzy "many commits passed" with `git diff --stat OLD_HASH..HEAD` against covered paths. Threshold: > 10 files OR > 200 lines → flagged as significant drift.
- **Honest Mermaid wording.** HTML export now says "requires internet to render diagrams" — the export depends on the Mermaid CDN, it is not truly self-contained.
- **Dynamic onboard listing.** `npx ai-gov onboard` groups every `knowledge/*.md` file by prefix instead of hard-coding `tech-` and `product-`.

---

## Table of Contents

1. [What the Knowledge Hub Is](#1-what-the-knowledge-hub-is)
2. [The Confidence Model — INFERRED / CONFIRMED / STALE](#2-the-confidence-model)
3. [Phase 1 — Extract Knowledge On Demand](#3-phase-1--extract-knowledge-on-demand)
   - 3.1 [Claude Code: /tech-knowledge](#31-claude-code-tech-knowledge) *(v20.2: +8 backend sections, STEP 3.5, SQL export)*
   - 3.2 [Claude Code: /product-knowledge](#32-claude-code-product-knowledge) *(v20.2: +API Endpoint Catalog, Contribution Workflow)*
   - 3.3 [Claude Code: /knowledge (read-only viewer)](#33-claude-code-knowledge-read-only-viewer)
   - 3.4 [Kiro: Tech Knowledge workflow](#34-kiro-tech-knowledge-workflow) *(v20.2: backend sections included)*
   - 3.5 [Kiro: Product Knowledge workflow](#35-kiro-product-knowledge-workflow)
4. [Phase 2 — Context Builder (Read Before Acting)](#4-phase-2--context-builder)
5. [Phase 3 — Silent Capture (Write After Gate 1 or Fix)](#5-phase-3--silent-capture)
6. [Phase 4 — Drift Detection in /audit](#6-phase-4--drift-detection)
7. [Phase 5 — Conflict Detection](#7-phase-5--conflict-detection)
   - 7.1 [Claude Code: /detect-conflicts](#71-claude-code-detect-conflicts)
   - 7.2 [Kiro: Detect Conflicts workflow](#72-kiro-detect-conflicts-workflow)
8. [The knowledge/ Directory Layout](#8-the-knowledge-directory-layout)
9. [Team Workflow — Day-to-Day Usage](#9-team-workflow--day-to-day-usage) *(v20.2: correct order enforced)*
10. [Stack-Specific Examples](#10-stack-specific-examples)
11. [Pre-commit Guard & Bypass (v19.1)](#11-pre-commit-guard--bypass-v191)

---

## 1. What the Knowledge Hub Is

The Knowledge Hub is a persistent, git-committed intelligence layer that sits between your codebase and your AI agent. It solves a specific problem: **AI agents have no memory across sessions**. Every `/fix` or `/new-feature` starts from zero — the agent re-reads the same files, re-infers the same patterns, and sometimes draws different conclusions.

The Knowledge Hub breaks that reset cycle:

```
Team lead runs /tech-knowledge + /product-knowledge
    → AI reads codebase, writes knowledge/tech-auth.md + knowledge/product-auth.md
        → Team lead runs /audit (validates knowledge health before committing)
            → knowledge/ committed + pushed to git
                → Every /new-feature, /fix, /edit-feature reads knowledge/ first (automatic)
                    → Developer approves /new-feature Gate 1
                        → AI writes [CONFIRMED] entries silently to knowledge/product-auth.md
                            → Weekly /audit checks if knowledge still matches code
                                → /detect-conflicts surfaces contradictions across features
```

**What it is not:** This is not a documentation system. You are not writing docs. The AI extracts, you verify, git tracks history. Knowledge grows as a byproduct of normal work.

---

## 2. The Confidence Model

Every entry in every knowledge file carries one of three tags. This is the core contract.

| Tag | Meaning | Source | Trust level |
|-----|---------|--------|-------------|
| `[INFERRED]` | AI extracted from code — not human-verified | `/tech-knowledge`, `/product-knowledge` | **Still read and used by all commands.** Treated as a strong hint — AI verifies against actual code before acting. If code contradicts an `[INFERRED]` entry, the discrepancy is noted in the response. |
| `[CONFIRMED]` | Human-verified — explicitly approved | Gate 1 approval in `/new-feature` or `/edit-feature`, or manual edit | Trust fully. Never overwritten by AI. |
| `[UNKNOWN]` | Observable but not understood — requires human input | "Needs Clarification" section in extraction | Do not rely on — flag for team discussion. |

**All tags are read — the tag controls trust level, not whether the file is used.** A knowledge file with only `[INFERRED]` entries (e.g. immediately after bootstrapping, before any Gate 1 approvals) is still loaded by the preamble and provides valuable context. The AI treats `[INFERRED]` entries as educated guesses to verify, not facts to skip.

**Merge rules (enforced silently after Gate 1):**

- `[CONFIRMED]` entries are **never** overwritten by AI. Only a human can change them.
- An `[INFERRED]` entry that matches a requirement → upgraded to `[CONFIRMED]`.
- An `[INFERRED]` entry that requirements don't address → left unchanged.
- New entries from requirements not in the file → appended as `[CONFIRMED]`.

**Drift detection adds two more states** (Phase 4, reported in `/audit` only — not written to files):

| State | Meaning | Action |
|-------|---------|--------|
| `[STALE]` | Code contradicts the entry — the thing changed or was removed | Re-run `/tech-knowledge` or `/product-knowledge` |
| `[UNVERIFIABLE]` | No code found to verify the entry — may be deleted or moved | Human review required |

---

## 3. Phase 1 — Extract Knowledge On Demand

These are the write 
mands. You run them once to bootstrap knowledge for a feature or the whole project. Output is a markdown file in `knowledge/` — committed to git.

### 3.1 Claude Code: `/tech-knowledge`

**When:** Team lead runs it once at project bootstrap, and again whenever `/audit` reports stale entries or a significant structural change lands (new ORM, new layer, new auth approach). Developers never need to run it during normal sprint work.

**What it does:** Scans the live codebase and writes a committed knowledge file — the HOW file. It answers: *How is this codebase built? What patterns does it use? How do I run it locally? How do I connect to the database and write queries?*

For backend stacks (Node.js, Python, Java) it also runs **STEP 3.5** — scanning `.env.example`, manifest scripts, and ORM config files — to produce 8 additional developer-setup sections. The goal: a developer with zero backend experience should be able to read `knowledge/tech-overview.md` and go from `git clone` to a running server with a connected database, without asking anyone anything.

---

#### Usage

```
/tech-knowledge                 → knowledge/tech-overview.md   (whole project)
/tech-knowledge auth            → knowledge/tech-auth.md
/tech-knowledge payments        → knowledge/tech-payments.md
/tech-knowledge user auth       → knowledge/tech-user-auth.md  (spaces become hyphens)
```

---

#### Files generated

Every run of `/tech-knowledge` produces or offers:

| File | Always? | Description |
|------|---------|-------------|
| `knowledge/tech-[scope].md` | **Yes** | The main knowledge file — committed to git |
| `knowledge/tech-[scope].html` | Optional (say `html`) | HTML export with rendered Mermaid diagrams. **Not committed.** Requires internet. |
| `knowledge/db-schema-discovery.sql` | Optional (say `sql`, backend + DB only) | Ready-to-run discovery queries for the detected DB engine. **Committed to git.** |

---

#### All sections in the generated knowledge file

**Sections every stack gets:**

---

**`## Stack Primer`** *(backend stacks only)*

3-5 lines explaining what the framework is in plain English before anything else. A developer who has never seen NestJS, FastAPI, or Spring Boot reads this first and understands the request flow before looking at any code.

Examples:
- NestJS: *"Every feature is a Module. Services are injected via constructor. Controllers handle HTTP. Guards enforce auth. Dev command: `npm run start:dev`. Swagger at `/api`."*
- FastAPI: *"`Depends()` is the DI system — chain it for auth, DB sessions, validation. Pydantic validates all input/output. Swagger auto-generates at `/docs`."*
- Spring Boot: *"`@RestController` handles HTTP. `@Service` beans contain business logic. `./mvnw` is the Maven wrapper — no global Maven needed."*

---

**`## Layer Map`**

Every significant source file mapped to its architectural layer. One line per file.

```
Controller → src/auth/auth.controller.ts — HTTP endpoints, JWT guard [INFERRED]
Service    → src/auth/auth.service.ts — login, token generation [INFERRED]
Repository → src/auth/auth.repository.ts — user DB queries [INFERRED]
Entity     → src/auth/entities/user.entity.ts — users table mapping [INFERRED]
```

---

**`## Layer Flow Diagram`**

Mermaid graph showing how layers connect. Gives an instant visual of request flow.

```mermaid
graph LR
  Controller --> Service
  Service --> Repository
  Repository --> Entity
  Entity --> DB[(PostgreSQL)]
```

---

**`## Patterns in Use`**

| Pattern | Value | Confidence |
|---------|-------|------------|
| HTTP client | axios | [INFERRED] |
| ORM | TypeORM | [INFERRED] |
| DI | NestJS DI | [INFERRED] |
| Auth | Passport JWT | [INFERRED] |
| Error handling | HttpException + GlobalExceptionFilter | [INFERRED] |
| Naming (files) | kebab-case | [INFERRED] |

---

**`## File Inventory`**

Every significant file with layer, line count, and a brief note about what it does. Useful for finding where to make a change without reading all the code.

---

**`## Conventions`**

Naming rules, import order, folder structure patterns observed in the codebase.

---

**`## Needs Clarification`**

Things the AI observed but cannot understand from code alone. `[UNKNOWN]` entries are questions for the team — WHY decisions, hardcoded thresholds, architectural choices with no comments.

---

**Sections backend stacks additionally get** (Node.js, Python, Java — produced by STEP 3.5):

---

**`## First-Run Guide`**

Numbered steps from `git clone` to a running server. Steps 1-2 cover prerequisites inline — there is no separate prerequisites list.

Example (NestJS + PostgreSQL):
```
1. Check Node.js version: node --version — compare against .nvmrc
   Install correct version: nvm install 18.20.0 && nvm use
2. Install dependencies: npm install
3. Configure environment:
   cp .env.example .env
   Open .env and fill in real values (see Environment Variables below)
4. Create or connect to database:
   If local: createdb mydb (PostgreSQL CLI) — or create via pgAdmin/DBeaver
   If remote: team lead provides DB_HOST, DB_USER, DB_PASSWORD values
5. Run migrations: npm run migration:run
6. Seed test data: npm run seed (if available — or skip)
7. Start dev server: npm run start:dev
8. Verify: open http://localhost:3000/api — Swagger UI should appear
```

---

**`## Environment Variables`**

Table of every `.env` variable the project uses, scanned from `.env.example` (or derived from source code if `.env.example` doesn't exist).

**How STEP 3.5 scans for variables (in priority order):**
1. `.env.example` — read fully (committed template, safe to read)
2. `.env.template` or `.env.sample` — read fully
3. `.env` — read **variable names and comments only** — never record actual values
4. Source code fallback — scans for `process.env.VAR`, `os.getenv('VAR')`, Pydantic `BaseSettings` class fields, `@Value("${...}")` Spring annotations

Example output:

| Variable | Example Value | Required | Purpose |
|----------|--------------|----------|---------|
| DATABASE_URL | postgresql://user:pass@localhost:5432/mydb | yes | Primary DB connection string |
| DB_HOST | localhost | yes | DB hostname (alternative to DATABASE_URL) |
| DB_PORT | 5432 | yes | DB port |
| DB_NAME | myapp_dev | yes | Database name |
| DB_USER | postgres | yes | DB username |
| DB_PASSWORD | secret | yes | DB password |
| JWT_SECRET | change-me-32-chars-minimum | yes | JWT signing key |
| JWT_EXPIRES_IN | 7d | no | Token lifetime (default: 7d) |
| PORT | 3000 | no | HTTP server port |
| NODE_ENV | development | no | Controls error verbosity + ORM sync |
| LOG_LEVEL | debug | no | Logging verbosity |

> ⚠ Never commit `.env` — it contains real credentials. `.env.example` is the committed template.

---

**`## Developer Daily Commands`**

Every command a developer runs day-to-day, including the full migration workflow.

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Start dev server | `npm run start:dev` |
| Run all tests | `npm test` |
| Build | `npm run build` |
| Format code | `npx prettier --write` |
| Lint | `npx eslint .` |
| Create migration | `npm run migration:generate -- -n DescribeName` |
| Apply migrations | `npm run migration:run` |
| Rollback 1 step | `npm run migration:revert` |

**Migration workflow — when you change a DB schema:**
```
1. Edit the TypeORM entity (or SQLAlchemy model / Prisma schema)
2. Generate: npm run migration:generate -- -n AddUserPhoneField
3. Review the generated SQL in src/migrations/ — verify it does what you expect
4. Apply: npm run migration:run
5. Rollback if wrong: npm run migration:revert
6. Commit the migration file alongside the entity change
```

---

**`## Database`**

The most important section for backend developers. Covers everything needed to connect, explore, and query the database.

**What the section contains:**

```markdown
## Database [INFERRED]

| Property | Value | Confidence |
|----------|-------|------------|
| Engine | PostgreSQL 15 | [INFERRED] |
| ORM / driver | TypeORM | [INFERRED] |
| Connection var | DB_HOST + DB_PORT + DB_NAME + DB_USER + DB_PASSWORD | [INFERRED] |
| Migrations dir | src/migrations/ | [INFERRED] |
| Run migrations | npm run migration:run | [INFERRED] |
| Rollback | npm run migration:revert | [INFERRED] |

**Step 1 — get the connection details from .env**
Open your .env file. The values you need:
  DB_HOST=localhost      (or remote hostname from team lead)
  DB_PORT=5432
  DB_NAME=myapp_dev
  DB_USER=postgres
  DB_PASSWORD=yourpassword

**Step 2 — connect with any SQL client**

Works with: DBeaver, SQL Workbench/J, DataGrip, TablePlus, pgAdmin, Beekeeper Studio,
            HeidiSQL, Navicat, Azure Data Studio, or any other SQL client.

In your SQL client, create a new PostgreSQL connection:
  Connection type: PostgreSQL
  Host:     value of DB_HOST
  Port:     value of DB_PORT  (default: 5432)
  Database: value of DB_NAME
  Username: value of DB_USER
  Password: value of DB_PASSWORD

Or single-URL format (some clients accept this):
  postgresql://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME

**Step 3 — connect from terminal (alternative)**
  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME

MySQL equivalent:
  mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME

**Verify connection (paste into your SQL client or terminal):**
  SELECT 1;                          -- confirms connection works
  SELECT current_database();         -- confirms correct database
  SELECT version();                  -- shows DB version

**Explore tables:**
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' ORDER BY table_name;

**Migration history (TypeORM):**
  SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 20;
```

---

**`## Stack-Specific Notes`**

Per-framework gotchas that trip up beginners. Not obvious from reading code.

Examples:
- NestJS: *"Every feature must be in a Module or NestJS won't find it. Dev command is `npm run start:dev`, not `npm run dev`."*
- FastAPI: *"Activate virtual env before anything: `source venv/bin/activate`. `async def` routes are non-blocking; `def` routes run in a thread pool."*
- Express: *"Middleware order matters — `express.json()` must be before route handlers. Error middleware requires exactly 4 params `(err, req, res, next)`."*
- Spring Boot: *"Use `./mvnw` — no global Maven needed. Lombok `@Data` generates getters/setters at compile time — not visible in source."*

---

**`## API Access`**

Everything needed to actually call the API during development.

```markdown
## API Access [INFERRED]

Base URL (dev): http://localhost:3000
Auth mechanism: JWT Bearer token (Passport + passport-jwt detected)
API docs:       http://localhost:3000/api  (Swagger — via @nestjs/swagger)

**Get auth token (copy-paste this curl):**
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}'
→ Copy the "access_token" value from the JSON response

**Use the token in any request:**
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:3000/users/profile

**In Postman / Insomnia / Bruno:**
Add header: Authorization: Bearer YOUR_TOKEN_HERE

**No auth detected?**
Try hitting endpoints directly without a token — endpoints appear to be open.
```

---

**`## Logging & Debugging`**

```markdown
## Logging & Debugging [INFERRED]

Logs:      stdout (console) — or check if Logger writes to a file
Log level: LOG_LEVEL env var (set in .env) — default: info

**Attach debugger (VS Code):**
  NestJS:  npm run start:debug    ← starts with --inspect flag
  Express: node --inspect src/app.js

  Then in VS Code: Run > Start Debugging (needs launch.json — check .vscode/)

**Python FastAPI:**
  Add to .vscode/launch.json:
  { "module": "uvicorn", "args": ["app.main:app","--reload"], "justMyCode": false }

**Java Spring Boot:**
  mvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"
  Then attach remote debugger in IntelliJ/VS Code on port 5005

**Read logs when something breaks:**
  tail -f app.log           (if writing to file)
  docker logs -f container  (if running in Docker)
  kubectl logs -f pod-name  (if running in Kubernetes)
```

---

#### The optional SQL export — `knowledge/db-schema-discovery.sql`

When `/tech-knowledge` detects a database, STEP 5 offers a `sql` export option. This generates a **committed**, **project-aware** discovery file — not a generic cheatsheet.

**What makes it project-aware:**
- Header comment includes project name, detected engine, detected ORM, and DB host
- Migration history query (#15 for PostgreSQL) uses the **exact ORM-specific table name** — no guessing

| ORM detected | Migration history query uses |
|-------------|------------------------------|
| Prisma | `SELECT * FROM _prisma_migrations` |
| TypeORM | `SELECT * FROM typeorm_migrations` |
| Sequelize | `SELECT * FROM "SequelizeMeta"` |
| MikroORM | `SELECT * FROM mikro_orm_migrations` |
| Alembic (Python) | `SELECT * FROM alembic_version` |
| Flyway (Java) | `SELECT * FROM flyway_schema_history` |

**PostgreSQL discovery file — 15 queries:**

```sql
-- Generated for: myapp · Engine: PostgreSQL · ORM: TypeORM
-- Run in: DBeaver, SQL Workbench/J, DataGrip, pgAdmin, psql, or any SQL client

-- 1. All schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog','information_schema') ORDER BY schema_name;

-- 2. Tables + approximate row counts
SELECT schemaname, tablename, n_live_tup AS approx_rows
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- 3. All columns + types (replace 'public' with your schema)
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 4. Primary keys
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';

-- 5. Foreign keys (relationship map)
SELECT tc.table_name AS from_table, kcu.column_name AS from_col,
       ccu.table_name AS to_table, ccu.column_name AS to_col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';

-- 6. Indexes
SELECT indexname, tablename, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename;

-- 7. Enum types + values
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder;

-- 8. Views
SELECT table_name, view_definition FROM information_schema.views
WHERE table_schema = 'public';

-- 9. Functions / stored procedures
SELECT routine_name, routine_type FROM information_schema.routines
WHERE routine_schema = 'public';

-- 10. Triggers
SELECT trigger_name, event_object_table, action_timing
FROM information_schema.triggers WHERE trigger_schema = 'public';

-- 11. Multi-tenant tables (always filter by these columns)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('org_id','tenant_id','organization_id','workspace_id');

-- 12. Soft-delete tables (always add WHERE deleted_at IS NULL)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('deleted_at','is_deleted','archived_at');

-- 13. Table sizes on disk
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;

-- 14. Currently running queries (slow query investigation)
SELECT pid, now() - query_start AS duration, state, left(query,100) AS query_preview
FROM pg_stat_activity WHERE state != 'idle' AND query_start IS NOT NULL
ORDER BY duration DESC;

-- 15. Migration history (TypeORM detected)
SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 20;
```

**How to use the discovery file:**

1. Open your SQL client (DBeaver, SQL Workbench/J, DataGrip, TablePlus, pgAdmin, Beekeeper Studio, or any other)
2. Connect using the parameters from the Database section in `knowledge/tech-overview.md`
3. Open `knowledge/db-schema-discovery.sql`
4. Run queries 1-2 first to orient yourself (schemas, table list + row counts)
5. Run queries 3-5 to understand the data model (columns, PKs, FKs)
6. Run query 15 to check migration history

**Writing queries to debug issues:**

Once connected, here are the most useful queries for daily debugging:

```sql
-- Check if a record exists
SELECT * FROM users WHERE email = 'test@example.com';

-- See the last N records (most recently created)
SELECT * FROM orders ORDER BY created_at DESC LIMIT 20;

-- Check soft-deleted records (if the table has deleted_at)
SELECT * FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 10;

-- Find records in a specific status
SELECT * FROM payments WHERE status = 'PENDING' ORDER BY created_at DESC;

-- Check a relationship (JOIN)
SELECT u.email, p.amount, p.status
FROM users u
JOIN payments p ON p.user_id = u.id
WHERE u.email = 'test@example.com';

-- Count records by status (useful for understanding data distribution)
SELECT status, COUNT(*) FROM payments GROUP BY status ORDER BY COUNT DESC;

-- Check if an index exists on a column (use EXPLAIN if query is slow)
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';
-- If Seq Scan → no index on email, that's why it's slow
-- If Index Scan → index exists, query is efficient

-- See what a migration actually changed (TypeORM)
SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 5;

-- Rollback a test insert without committing
BEGIN;
INSERT INTO users (email, created_at) VALUES ('test@debug.com', NOW());
SELECT * FROM users WHERE email = 'test@debug.com'; -- verify
ROLLBACK; -- nothing persisted
```

**MongoDB equivalent (if project uses Mongoose):**

```js
// Run in mongosh or MongoDB Compass shell
db.users.findOne({ email: 'test@example.com' })
db.orders.find().sort({ createdAt: -1 }).limit(20)
db.payments.countDocuments({ status: 'PENDING' })
db.payments.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
```

---

#### Example session and output — complete

**Running `/tech-knowledge` on a NestJS + PostgreSQL project:**

```
You: /tech-knowledge

Claude: [reads src/, .env.example, package.json, datasource.ts]

━━━ TECH KNOWLEDGE WRITTEN ━━━

  File:             knowledge/tech-overview.md
  Git hash:         a3f8c12
  Scope:            whole project
  Layers mapped:    5
  Files inventoried:24
  Unknowns flagged: 2
  Dev quickstart:   yes — First-Run, Env Vars, Daily Commands, Database included
  Database:         yes — PostgreSQL + TypeORM (migration history: typeorm_migrations)
  Export:           none

  All new entries are [INFERRED]. Commit this file to git.
  Re-run /tech-knowledge when significant code changes occur.
  "Needs Clarification" items require human input — code cannot answer them.

Want an additional export? Reply with a format or skip:
  - html — HTML export — requires internet to render Mermaid diagrams
  - sql  — DB schema discovery queries for TypeORM — generates knowledge/db-schema-discovery.sql (committed to git)
  - skip or (no reply) — done

You: sql

Claude: knowledge/db-schema-discovery.sql written — 15 queries for PostgreSQL + TypeORM
        Commit alongside knowledge/tech-overview.md
```

---

### 3.2 Claude Code: `/product-knowledge`

**When:** At bootstrap (once, before any features exist). After that, product knowledge grows automatically via Gate 1 silent capture — no manual re-run needed per feature.

**What it does:** Reads the codebase and writes `knowledge/product-[scope].md` — the WHAT file. User flows, domain objects, permissions, business states. For backend stacks, also produces an API Endpoint Catalog and a Contribution Workflow section.

**Sections produced — all stacks:**

| Section | Purpose |
|---------|---------|
| User Flows | Step-by-step flows derived from routes/navigation + component names |
| Domain Objects | Entities/models with fields, business meaning, relationships |
| Domain Relationships | ER diagram (Mermaid) |
| Permissions & Roles | Who can do what — derived from guards/middleware |
| Business States | Status enums and state transitions |
| Needs Clarification | WHY questions code cannot answer |

**Additional sections for backend stacks only:**

| Section | Purpose |
|---------|---------|
| API Endpoint Catalog | One row per route: method, path, auth required, description |
| Contribution Workflow | Branch naming, code change, migration, lint, test, PR — how to contribute |

**Usage:**

```
/product-knowledge              → knowledge/product-overview.md
/product-knowledge auth         → knowledge/product-auth.md
/product-knowledge payments     → knowledge/product-payments.md
```

**Example session (NestJS project, `/product-knowledge payments`):**

```
You: /product-knowledge payments

Claude: [reads src/payments/payments.controller.ts, src/payments/payments.service.ts,
         src/payments/entities/payment.entity.ts, src/payments/dto/*.ts,
         src/payments/guards/PaymentOwnerGuard.ts]

━━━ PRODUCT KNOWLEDGE WRITTEN ━━━

  File: knowledge/product-payments.md
  Scope: payments
  User flows documented: 3
  Domain objects documented: 2
  Business states documented: 1
  Unknowns flagged: 3

  All entries are [INFERRED]. Review and promote to [CONFIRMED] as needed.
  "Needs Clarification" items are WHY questions — only humans can answer them.
```

**Output file — `knowledge/product-payments.md`:**

```markdown
# Product Knowledge — payments | Node.js / NestJS

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits will be overwritten on next run until Phase 3.

Generated: 2026-05-07

---

## User Flows

### Create Payment [INFERRED]
1. POST /payments with PaymentCreateDto
2. Service validates merchant ID exists
3. Stripe charge created via StripeService
4. Payment entity saved with status PENDING
5. Webhook from Stripe updates status to COMPLETED or FAILED
Entry point: `src/payments/payments.controller.ts:createPayment`

### Refund Payment [INFERRED]
1. POST /payments/:id/refund (owner or admin only)
2. Guard: PaymentOwnerGuard checks payment.userId === request.user.id
3. Stripe refund initiated
4. Payment status set to REFUNDED
Entry point: `src/payments/payments.controller.ts:refundPayment`

### List Payments [INFERRED]
1. GET /payments — returns paginated list
2. Filtered by userId from JWT
3. Admin can pass ?userId= to view any user's payments
Entry point: `src/payments/payments.controller.ts:findAll`

---

## Domain Objects

### Payment [INFERRED]
- **Fields:** id, userId, merchantId, amount, currency, status, stripeChargeId, createdAt, refundedAt
- **Business meaning:** A single charge from a user to a merchant
- **Relationships:** belongs to User, belongs to Merchant
- **Source:** `src/payments/entities/payment.entity.ts`

### PaymentCreateDto [INFERRED]
- **Fields:** merchantId (required), amount (required, min 50), currency (enum: USD/EUR/GBP), metadata (optional)
- **Business meaning:** Input validation for payment creation
- **Source:** `src/payments/dto/create-payment.dto.ts`

---

## Permissions & Roles

| Role | Can do | Cannot do | Source | Confidence |
|------|--------|-----------|--------|------------|
| user | Create payment, list own payments, refund own payments | View other users' payments | `PaymentOwnerGuard` | [INFERRED] |
| admin | All of the above + view any user's payments | N/A | `@Roles('admin')` decorator | [INFERRED] |

---

## Business States

### PaymentStatus [INFERRED]
- States: PENDING, COMPLETED, FAILED, REFUNDED
- Transitions: PENDING → COMPLETED (Stripe webhook), PENDING → FAILED (Stripe webhook), COMPLETED → REFUNDED (refund endpoint)
- Source: `src/payments/entities/payment.entity.ts`

---

## Needs Clarification

- Minimum payment amount is 50 (cents?) — is this a business rule or Stripe minimum? [UNKNOWN]
- REFUNDED payments can apparently be refunded again — is this intentional? [UNKNOWN]
- currency enum only has USD/EUR/GBP but Stripe supports more — intentional restriction? [UNKNOWN]

---

## API Endpoint Catalog [INFERRED]

*(Derived from controller/router files — one row per route)*

| Method | Path | Auth Required | Description |
|--------|------|--------------|-------------|
| GET | /payments | JWT required | List user's payments (paginated, filtered by userId from JWT) |
| POST | /payments | JWT required | Create payment — calls Stripe, saves as PENDING |
| POST | /payments/:id/refund | JWT required (owner or admin) | Initiate Stripe refund — sets status to REFUNDED |

---

## Contribution Workflow [INFERRED]

1. Branch: `[feature/description or fix/issue-id — from git history]`
2. Make code change
3. If DB schema changed: `npm run migration:generate -- -n Name` → review generated SQL → commit alongside code
4. Run linter: `npx eslint .`
5. Run tests: `npm test`
6. Commit + open PR
```

---

### 3.3 Claude Code: `/knowledge` (read-only viewer)

**When:** Any developer wants to see what knowledge already exists, without re-scanning code.

**What it does:** Reads and displays committed `knowledge/*.md` files. **Zero writes. Zero code scanning.** Available to everyone on the team — even developers who don't have permission to run `/tech-knowledge` or `/product-knowledge`.

**Usage:**

```
/knowledge              → list all knowledge files, then show overview files
/knowledge auth         → show knowledge/tech-auth.md + knowledge/product-auth.md
/knowledge tech         → show all knowledge/tech-*.md files
/knowledge product      → show all knowledge/product-*.md files
/knowledge all          → show every file in knowledge/
```

**Example session:**

```
You: /knowledge auth

Claude: ━━━ knowledge/tech-auth.md ━━━

  [contents shown verbatim]

  ━━━ knowledge/product-auth.md ━━━

  [contents shown verbatim]

  ━━━ CONTEXT LOADED ━━━
    Files shown: 2 (tech-auth.md, product-auth.md)
    [CONFIRMED] entries are human-verified. [INFERRED] entries are AI-extracted — verify before relying on them.
    Stale? Team lead re-runs /tech-knowledge or /product-knowledge when code changes significantly.
```

**When `knowledge/` doesn't exist:**

```
━━━ NO KNOWLEDGE BASE FOUND ━━━

  The knowledge/ directory does not exist in this project.

  Team lead: run /tech-knowledge and /product-knowledge, then commit and push.
  Developer: ask your team lead to generate and push knowledge files.
```

---

### 3.4 Kiro: Tech Knowledge Workflow

In Kiro, the same extraction runs as a **userTriggered workflow hook**. You trigger it from Kiro's workflow panel, not the terminal.

**Hook file:** `.kiro/hooks/workflow-tech-knowledge.kiro.hook`

**How it works differently from Claude Code:**
- Kiro asks for scope in STEP 0 (interactive) — Claude Code reads scope from `$ARGUMENTS` directly.
- The hook runs as a fresh `askAgent` session — no conversation history. Context comes from disk.
- Output file is identical: `knowledge/tech-[slug].md`.
- For backend stacks, STEP 1.5 instructs the agent to scan `.env.example`, manifest scripts, and DB config before writing — same as Claude Code's STEP 3.5.
- The hook prompt is **lightweight by design** — it references the output section names and instructs the agent to follow the full Claude Code structure, rather than duplicating all templates inline. This keeps hook prompt size controlled.

**Example Kiro session (NestJS backend):**

```
[User triggers "Tech Knowledge" workflow in Kiro panel]

Kiro: What scope should I map?
  — Leave empty for a whole-project overview
  — Name a feature (e.g. 'auth', 'payments')
  — Name a layer (e.g. 'services', 'data')

User: auth

Kiro: [reads codebase + .env.example + package.json scripts + datasource.ts]

  File: knowledge/tech-auth.md
  Layers mapped: 4
  Files inventoried: 9
  Unknowns flagged: 1
  Dev quickstart: yes (First-Run, Env Vars, Daily Commands, Database included)
  All entries [INFERRED] — review and promote to [CONFIRMED] as needed.
```

**Hook JSON structure (v20.2):**

```json
{
  "name": "Tech Knowledge",
  "version": "20.2.0",
  "description": "Extract technical knowledge from codebase — patterns, layers, conventions, dev setup",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "TECH KNOWLEDGE — Extract technical knowledge for Node.js (NestJS) (backend).\n\nSTEP 0: Ask scope...\nSTEP 1: Read source files...\nSTEP 1.5: Scan .env.example, package.json scripts, DB config (backend)...\nSTEP 2: Write knowledge file — Stack Primer, Layer Map, Patterns, File Inventory,\n        Conventions, First-Run Guide, Env Variables, Daily Commands, Database,\n        Stack-Specific Notes, API Access, Logging & Debugging, Needs Clarification\nSTEP 3: Optional export (html / sql) + report"
  }
}
```

---

### 3.5 Kiro: Product Knowledge Workflow

Identical pattern to Tech Knowledge. Hook: `.kiro/hooks/workflow-product-knowledge.kiro.hook`.

STEP 0 asks: *"What product area should I document?"*

Output: `knowledge/product-[slug].md` — same structure as Claude Code output, including API Endpoint Catalog and Contribution Workflow sections for backend stacks.

---

## 4. Phase 2 — Context Builder

**What:** Before acting on any `/new-feature`, `/edit-feature`, `/fix`, `/explore`, `/refactor`, or `/assess` command, the AI **automatically** reads the relevant knowledge file.

**You do nothing.** The preamble is injected into every command. It runs silently.

**The reading priority order:**

```
1. knowledge/tech-[slug].md       — HOW this area is built
2. knowledge/product-[slug].md    — WHAT this area does
3. knowledge/tech-overview.md     — fallback if no slug match
4. knowledge/product-overview.md  — fallback if no slug match
```

Slug is derived from `$ARGUMENTS`. `/fix auth login redirect` → slug `auth-login-redirect`.
If no match: skip silently. No error. The command proceeds as normal.

**Claude Code — injected preamble (visible in .claude/commands/*.md):**

```markdown
## KNOWLEDGE CONTEXT — Read Before Acting

If `knowledge/` exists at the project root:

1. Derive a slug from `$ARGUMENTS`: lowercase, spaces → hyphens, empty → `overview`
2. Read in this priority order — skip files that don't exist:
   - `knowledge/tech-[slug].md` — HOW this area is built
   - `knowledge/product-[slug].md` — WHAT this area does
   - `knowledge/tech-overview.md` — fallback if no slug match
   - `knowledge/product-overview.md` — fallback if no slug match
3. If `knowledge/` is absent or no files match: skip silently. Proceed as normal.

**Using knowledge:**
- `[CONFIRMED]` entries — human-verified. Trust them.
- `[INFERRED]` entries — AI-extracted. Use as starting point; verify against actual code.
- If code contradicts an `[INFERRED]` entry, note the discrepancy in your response.

Do not edit the knowledge file — drift detection is a separate concern.
```

**Kiro — equivalent preamble (inside workflow hook prompt strings):**

```
## KNOWLEDGE CONTEXT — Read Before Acting

After getting scope from the user, check knowledge/:
- Slug: lowercase scope, spaces → hyphens. Empty → "overview".
- Read if they exist: knowledge/tech-[slug].md, knowledge/product-[slug].md
- Fallbacks: knowledge/tech-overview.md, knowledge/product-overview.md
- [CONFIRMED]: trust. [INFERRED]: use as starting point, verify against code.
- If knowledge/ doesn't exist: skip silently, proceed with workflow.
```

**Commands affected:**

| Command | Claude Code | Kiro |
|---------|-------------|------|
| `/new-feature` | ✓ | ✓ `workflow-new-feature` |
| `/edit-feature` | ✓ | ✓ `workflow-edit-feature` |
| `/fix` | ✓ | ✓ `workflow-fix` |
| `/explore` | ✓ | ✓ `workflow-explore` |
| `/refactor` | ✓ | ✓ `workflow-refactor` |
| `/assess` | ✓ | — (no Kiro equivalent) |

---

## 5. Phase 3 — Silent Capture

**What:** When a developer approves Gate 1 in `/new-feature` or `/edit-feature` (or finishes a `/fix` / `/hotfix`), the AI **automatically** extracts product knowledge and writes entries to `knowledge/product-[slug].md` — with no developer action required.

| Source command | Confidence | Trigger |
|---|---|---|
| `/new-feature` | `[CONFIRMED]` | Gate 1 approval |
| `/edit-feature` | `[CONFIRMED]` (only on `<!-- NEW -->` / `<!-- CHANGED -->` items) | Gate 1 approval |
| `/fix`, `/hotfix` | `[INFERRED]` | After fix applied — only when the fix has business meaning |

**Gate 1** is the requirements review gate: the AI presents requirements, the developer says `ok` / `approved` / `yes` / `lgtm` / `proceed`.

**The only output from the AI after capture:**

```
↳ Knowledge captured: knowledge/product-payments.md (3 entries added, 1 upgraded)
```

Or if nothing extractable:

```
↳ Knowledge capture: no extractable entries in requirements.
```

Then the command proceeds directly to Gate 2 (spec review).

**Claude Code example — `/new-feature` silent capture:**

```
You: /new-feature add refund flow to payments

Claude: [reads codebase + knowledge/product-payments.md]

## Requirements

**Overview:** Add the ability for users to request refunds on completed payments
within 30 days of purchase. Refunds are subject to merchant approval.

**Acceptance Criteria:**
- User can request refund on any COMPLETED payment
- Refund request sets payment status to REFUND_REQUESTED
- Merchant receives notification (email) of refund request
- Merchant can approve or reject within 7 days
- If merchant approves: status → REFUNDED, Stripe refund initiated
- If merchant rejects or no response in 7 days: status → REFUND_REJECTED

...

[GATE 1] Do these requirements match your intent? (ok / edit)

You: ok

↳ Knowledge captured: knowledge/product-payments.md (2 entries added, 1 upgraded)

## Spec
...
```

**What was captured:**

```markdown
## Business States

### PaymentStatus [CONFIRMED]
- States: PENDING, COMPLETED, FAILED, REFUNDED, REFUND_REQUESTED, REFUND_REJECTED
- Transitions: COMPLETED → REFUND_REQUESTED (user request), REFUND_REQUESTED → REFUNDED (merchant approval),
  REFUND_REQUESTED → REFUND_REJECTED (merchant rejection or 7-day timeout)
- Source: Gate 1 approved requirements, 2026-05-07

## User Flows

### Request Refund [CONFIRMED]
1. User requests refund on a COMPLETED payment (within 30 days)
2. Payment status set to REFUND_REQUESTED
3. Merchant notified by email
4. Merchant approves or rejects within 7 days
5. On approval: REFUNDED + Stripe refund. On rejection/timeout: REFUND_REJECTED
```

Note the upgrades: `REFUNDED` was `[INFERRED]`. After Gate 1 approval confirming it, it becomes `[CONFIRMED]` — and two new states (`REFUND_REQUESTED`, `REFUND_REJECTED`) are added.

**`/edit-feature` difference:** Only extracts from lines marked `<!-- NEW -->` or `<!-- CHANGED: ... -->` in the diff view — does not re-capture existing unchanged requirements.

**`/fix` and `/hotfix` — DO-NOT-CAPTURE blocklist (v19.1):** Bug fixes do not always reveal business rules. The default after a fix is **"no business rules extracted."** Capture only happens when the root cause is a misunderstood requirement, an unenforced business constraint, or a missing role/permission check.

Explicit blocklist — never capture from these fix types:

- null/undefined check, off-by-one, typo, missing await, type coercion
- wrong import path, wrong constant value with no business meaning
- test-only change, log/format change, lint cleanup
- dependency upgrade, config tweak, build fix
- race condition fix with no domain-level implication

When a fix matches the blocklist, the AI outputs:

```
↳ Knowledge capture: fix was technical — no business rules extracted.
```

When a fix is captured (e.g. it enforced a missing role check), entries are tagged `[INFERRED]` with source `bug fix · /fix · [date]` and appended under a `## Business Rules` section.

**Kiro difference:** Same logic runs inside `workflow-new-feature.kiro.hook` and `workflow-edit-feature.kiro.hook` at the equivalent Gate 1 position.

---

## 6. Phase 4 — Drift Detection

**What:** `/audit` (and Kiro `workflow-audit`) includes a knowledge health check. It reads every entry in every knowledge file, finds the corresponding code, and classifies each entry as Current / [STALE] / [UNVERIFIABLE].

**This is read-only.** The audit does not modify knowledge files. It reports what is wrong.

**Mechanical drift check (v19.1):** In addition to entry-level classification, the audit now extracts the `Generated: ... (git: [OLD_HASH])` line from each knowledge file and runs:

```
git diff --stat OLD_HASH..HEAD -- [paths covered by this knowledge file]
```

If > 10 files changed OR > 200 lines added/removed in covered paths → the file is flagged as **"significant drift likely — [N] files changed, [N] lines delta since last generation."**

This replaces the prior fuzzy "many commits have passed" judgment with a concrete number. The same mechanical check now runs on every `/tech-knowledge` and `/product-knowledge` re-execution.

**Example audit output section:**

```
━━━ KNOWLEDGE HEALTH ━━━

  Files checked:    3
  Entries checked:  24

  ✓ Current:        21
  ⚠ Stale:          2
  ? Unverifiable:   1

  Stale entries (require action):
    knowledge/tech-auth.md → "Token stored in localStorage" [INFERRED]
      — code now uses httpOnly cookies (src/api/auth.ts:setTokenCookie)
    knowledge/product-payments.md → "PaymentStatus: PENDING, COMPLETED, FAILED, REFUNDED" [CONFIRMED]
      — REFUND_REQUESTED and REFUND_REJECTED missing from list

  Unverifiable entries (require human review):
    knowledge/tech-auth.md → "OTP expiry hardcoded to 300s" [UNKNOWN]
      — no code found at previously referenced location

  Recommended action:
    Run /tech-knowledge or /product-knowledge to regenerate stale files from current code.
    Or manually update the knowledge file and promote accurate entries to [CONFIRMED].
```

**When there is nothing to fix:**

```
━━━ KNOWLEDGE HEALTH ━━━

  Files checked: 3 · Entries checked: 24
  ✓ All 24 knowledge entries verified against current code.
```

**When knowledge/ doesn't exist yet:**

```
━━━ KNOWLEDGE HEALTH ━━━

  No knowledge/ directory found — skipping health check.
  Run /tech-knowledge or /product-knowledge to initialize.
```

**Responding to stale entries:**

| Action | When | How |
|--------|------|-----|
| Re-run `/tech-knowledge auth` | Stale `[INFERRED]` entries — code changed and re-generation will pick it up | Overwrites the whole file |
| Manually edit + promote | Stale `[CONFIRMED]` entries — human verification needed | Edit the file, change tag, commit |
| Re-run `/product-knowledge auth` | Stale product knowledge | Overwrites the whole file |

---

## 7. Phase 5 — Conflict Detection

**What:** Reads all `knowledge/product-*.md` files and surfaces contradicting business rules across features. Writes a decision inbox to `knowledge/conflicts/`. This is a team lead tool — the output is a set of decisions that need to be made.

### 7.1 Claude Code: `/detect-conflicts`

**Usage:**

```
/detect-conflicts                    → compare all knowledge/product-*.md files
/detect-conflicts auth payments      → compare only auth and payments
```

**Example — conflict between auth and payments:**

```
You: /detect-conflicts auth payments

Claude: [reads knowledge/product-auth.md, knowledge/product-payments.md]

━━━ CONFLICT DETECTION COMPLETE ━━━

  Files compared:    2
  Pairs checked:     1
  Conflicts found:   2
  Already resolved:  0 (skipped)

  Files written:     1
  knowledge/conflicts/auth-vs-payments.md

  Action required: Review knowledge/conflicts/ and resolve each open conflict.
  Conflicts marked [x] Resolved will not be re-raised on next run.
```

**Output — `knowledge/conflicts/auth-vs-payments.md`:**

```markdown
# Conflict Report: auth vs payments

> Team lead decision inbox. Mark each conflict resolved once a decision is made.
> Do not add secrets, PII, or credentials.

---

## Permission Conflict — Guest user access to payments

**auth** (`knowledge/product-auth.md`):
> "Guest users can browse product catalog and add to cart without login [CONFIRMED]"

**payments** (`knowledge/product-payments.md`):
> "All payment endpoints require authenticated user (JWT required) [INFERRED]"

**Why this conflicts:** Auth allows guest users, but payments requires login — a guest cannot complete checkout.
**Decision needed:** Should guest checkout be supported, or should cart require login before proceeding to payment?

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — [decision made] -->

---

## Business State Conflict — Order status enum

**auth** (`knowledge/product-auth.md`):
> "User account can be in states: ACTIVE, SUSPENDED, PENDING_VERIFICATION [CONFIRMED]"

**payments** (`knowledge/product-payments.md`):
> "Payment requires verified user (VERIFIED status) [INFERRED]"

**Why this conflicts:** Auth defines no VERIFIED state, but payments depends on one.
**Decision needed:** Is VERIFIED a separate account state, or is PENDING_VERIFICATION → ACTIVE the verification step?

Resolution: [ ] Unresolved
<!-- To resolve: change [ ] to [x] and add: [x] Resolved — Payment uses ACTIVE to mean verified. PENDING_VERIFICATION is pre-activation only. -->
```

**Resolving conflicts:** Edit the file and change `[ ] Unresolved` to `[x] Resolved — [decision]`. On the next run, resolved entries are skipped.

**Four conflict types detected:**

| Type | Example |
|------|---------|
| **Permission** | Same role, contradicting access to same resource |
| **Domain object** | Same entity, contradicting fields or business meaning |
| **Business state** | Same enum, different values or transitions |
| **Flow assumption** | Flow A assumes precondition that Flow B contradicts |

**Conservative threshold:** Only clear contradictions are flagged. Two files describing different aspects of the same entity is NOT a conflict. Different detail levels are NOT conflicts.

### 7.2 Kiro: Detect Conflicts Workflow

Hook: `.kiro/hooks/workflow-detect-conflicts.kiro.hook`

**How it differs from Claude Code:**
- STEP 0 asks for scope interactively: *"Which features should I compare?"*
- Leave empty → compare all. Name two or more → compare those.
- Single feature → error: "Conflict detection requires at least two features."

**Hook JSON structure:**

```json
{
  "name": "Detect Conflicts",
  "version": "17.2.0",
  "description": "Cross-feature conflict detection — surfaces contradicting business rules across knowledge files",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "DETECT CONFLICTS — Cross-feature conflict detection for React / TypeScript.\n..."
  }
}
```

---

## 8. The `knowledge/` Directory Layout

```
knowledge/
├── tech-overview.md          ← whole-project tech extraction
├── tech-auth.md              ← auth feature tech extraction
├── tech-payments.md          ← payments feature tech extraction
├── tech-auth.html            ← (optional) HTML export — gitignored
├── product-overview.md       ← whole-product extraction
├── product-auth.md           ← auth feature product extraction
├── product-payments.md       ← payments feature product extraction
└── conflicts/
    ├── auth-vs-payments.md   ← conflict report (alphabetical slug order)
    └── auth-vs-onboarding.md
```

**Rules:**
- `knowledge/` lives at the project root — not inside `.claude/` or `.kiro/`
- Committed to git — knowledge is part of the codebase, not ephemeral AI context
- No secrets, PII, or credentials — ever
- `conflicts/` subdirectory is created automatically by `/detect-conflicts`
- Tech and product files are overwritten on re-run (Phase 1). Conflict files are appended (Phase 5).

**git config (v19.0, written automatically by `npx ai-gov init`):**

```gitignore
# .gitignore
knowledge/*.html
```

```gitattributes
# .gitattributes
knowledge/*.md merge=union
```

`merge=union` means parallel additions from different branches are both kept on merge — no conflicts. HTML exports are local sharing artifacts only and are gitignored.

---

## 9. Team Workflow — Day-to-Day Usage

### Knowledge hub commands must run before /audit, and /audit must run before push

This is the enforced order. Running `/audit` before knowledge commands means no baseline to check drift against. Committing before `/audit` means potentially pushing stale or unverifiable entries that every `/new-feature` and `/fix` will read as fact.

```
/tech-knowledge → /product-knowledge → /audit → commit + push
```

---

**Project bootstrap (team lead, once):**

```bash
# Step 1 — Init governance
npx ai-gov init

# Step 2 — Generate knowledge (whole project first, then per feature area)
/tech-knowledge              # → knowledge/tech-overview.md
/product-knowledge           # → knowledge/product-overview.md

/tech-knowledge auth         # → knowledge/tech-auth.md
/product-knowledge auth      # → knowledge/product-auth.md
/tech-knowledge payments     # → knowledge/tech-payments.md
/product-knowledge payments  # → knowledge/product-payments.md

# Step 3 — Audit BEFORE committing
# /audit validates every knowledge entry against live code.
# If KNOWLEDGE HEALTH shows stale or unverifiable entries, fix them now —
# not after they are committed and read by the whole team.
/audit
# If entries flagged → re-run /tech-knowledge [scope] for flagged files → /audit again
# If KNOWLEDGE HEALTH = all current → proceed

# Step 4 — Only now commit and push
git add knowledge/ .claude/
git commit -m "chore: bootstrap governance + knowledge hub"
git push
```

---

**During a sprint (developer, recurring):**

```bash
# Knowledge is read automatically by /new-feature, /fix, /explore, etc.
# No developer action needed for Phase 2 to work.

# After Gate 1 approval in /new-feature or /edit-feature:
# ↳ Knowledge captured: knowledge/product-payments.md (2 entries added)
# Product knowledge is updated silently — no developer action needed.
# Tech knowledge does not need updating after a feature that follows existing patterns.
# Tech knowledge only needs re-running when a new architectural pattern is introduced.

# To browse existing knowledge without re-scanning code:
/knowledge auth
/knowledge product
/knowledge all
```

**Before each release (team lead):**

```bash
# Same order as bootstrap — always knowledge → audit → push

# 1. Re-run knowledge for any scopes that changed significantly this release
/tech-knowledge auth         # if auth layer was refactored
/product-knowledge payments  # if payment flows changed

# 2. Audit to validate health before tagging the release
/audit
# KNOWLEDGE HEALTH must show no stale/unverifiable entries before tagging

# 3. Commit refreshed knowledge files
git add knowledge/
git commit -m "chore(knowledge): refresh for vX.Y.Z release"
git push
```

**Resolving stale `[CONFIRMED]` entries (team lead):**

```bash
# Discovered by /audit knowledge health, or surfaced during regeneration.
# Step 1: re-run extraction to refresh the file with current code
/tech-knowledge auth

# Step 2: the regenerated file will retain the stale [CONFIRMED] under "Drift Detected"
# Step 3: edit the file — remove the now-incorrect [CONFIRMED] line manually
# Step 4: commit with the bypass (the guard would otherwise block the removal)
AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m "chore(auth): regenerate after token-storage refactor"
```

**Weekly audit (team lead):**

```bash
/audit
# Includes ━━━ KNOWLEDGE HEALTH ━━━ section automatically
# If stale entries found: re-run /tech-knowledge [scope] for flagged files, then commit
```

**After multiple features shipped (team lead, recurring):**

```bash
/detect-conflicts
# Generates knowledge/conflicts/ decision inbox
# Review, add decisions, commit the file
```

**When a developer changes a domain object:**

```bash
# 1. Code change committed
# 2. Next /audit will catch the stale entry
# 3. Re-run /tech-knowledge [scope] or /product-knowledge [scope]
# 4. [CONFIRMED] entries for that scope may need manual review
```

---

### When to re-run knowledge hub commands

| Trigger | Action |
|---------|--------|
| First time on a project | `/tech-knowledge` then `/product-knowledge` for whole project and each feature area |
| `/audit` reports stale entries | Re-run for that scope only — e.g. `/tech-knowledge auth` |
| Major refactor or new architectural pattern introduced | Re-run for the affected scope |
| New developer onboarding | Run `/knowledge all` (read-only viewer — no re-scan needed) |
| New feature area added | `/tech-knowledge [new-area]` + `/product-knowledge [new-area]` |
| Before every release | Re-run for changed scopes → `/audit` → commit → push |

**Never re-run knowledge hub commands just because time passed** — only re-run when `/audit` reports something stale, after a significant structural change, or as a release gate. They are cheap to read but expensive to regenerate.

**Product knowledge after Gate 1:** `/product-knowledge` only needs to be run at bootstrap. After that, every Gate 1 approval in `/new-feature` or `/edit-feature` silently captures and appends `[CONFIRMED]` entries automatically. Product knowledge grows as a byproduct of normal sprint work — no manual re-run needed per feature.

**Tech knowledge after code generation:** Tech knowledge only goes stale when something structural changes (new ORM, new layer, new architecture pattern). Routine features that follow existing patterns do not require a re-run — the steering files (`architecture.md`, `coding-standards.md`) cover the rules, and the existing `knowledge/tech-overview.md` covers the patterns already in place.

---

## 10. Stack-Specific Examples

### Angular

`/product-knowledge permissions` will:
- Read `services/`, `guards/`, `interceptors/`
- Derive permissions from `CanActivate` guards and `HttpInterceptor` role checks
- Map roles from service method signatures and `@angular/core` injection tokens

### React / TypeScript

`/product-knowledge auth` will:
- Read `hooks/`, `store/` or `context/`, `api/`
- Derive user flows from route definitions + page component names
- Derive permissions from route guards, auth hooks (`useAuth`, `usePermission`)
- Map domain objects from TypeScript interfaces and API response types

### Flutter

`/product-knowledge onboarding` will:
- Read Cubits/BLoCs (state + events), route guards, navigation config
- Derive flows from `GoRouter` or `NavigationStack` config + screen names
- Map roles from BLoC role checks, entity validators
- Domain objects from `freezed` models, entity classes

### Kotlin / Android

`/product-knowledge checkout` will:
- Read UseCases, ViewModels, repository interfaces, navigation graph, Hilt modules
- Derive flows from navigation graph + Fragment/Screen names
- Map permissions from use case preconditions, auth interceptors
- Domain objects from domain model classes, sealed classes

### Python / FastAPI

`/tech-knowledge api` will:
- Read `FastAPI` dependencies, service functions, middleware
- Map layers: router → service → repository → model
- Detect `Depends()` chains for DI pattern
- Domain objects from Pydantic schemas, SQLAlchemy models

### Java / Spring Boot

`/product-knowledge users` will:
- Read `@RestController` endpoints, `@Service` classes, `@PreAuthorize` annotations, `@Entity`
- Derive flows from controller endpoints + service method chains
- Map permissions from Spring Security config, `@PreAuthorize`, role enums
- Domain objects from `@Entity` classes, DTOs, enums

### Node.js / NestJS

`/product-knowledge payments` will:
- Read controllers, services, guards, interceptors, DTOs
- Derive flows from controller endpoints + service orchestration
- Map permissions from guards, `@Roles()`, `@UseGuards()` decorators
- Domain objects from entities, DTOs, enums

### Node.js (Express/Fastify/Hapi)

`/product-knowledge auth` will:
- Read route handlers, middleware, services, validators, ORM models
- Derive flows from route definitions + middleware chains
- Map permissions from auth middleware, role checks
- Domain objects from ORM models (Prisma, Mongoose, TypeORM), validation schemas

---

## Agent Comparison: Claude Code vs Kiro

| Aspect | Claude Code | Kiro |
|--------|-------------|------|
| **Trigger** | `/tech-knowledge [scope]` in terminal | "Tech Knowledge" workflow in Kiro panel |
| **Scope input** | From `$ARGUMENTS` directly | STEP 0 interactive question |
| **Output format** | Same `knowledge/*.md` files | Same `knowledge/*.md` files |
| **Preamble injection** | In `.claude/commands/*.md` | In workflow hook `then.prompt` |
| **Silent capture** | After Gate 1 in `/new-feature` | After Gate 1 in `workflow-new-feature` |
| **Conflict detection** | `/detect-conflicts [scope]` | "Detect Conflicts" workflow |
| **Hook file** | Not applicable (slash commands) | `.kiro/hooks/workflow-*.kiro.hook` |
| **Session type** | Inline in current Claude session | New `askAgent` session per workflow |

**The key difference:** Claude Code slash commands run in your current session — you see the AI's reasoning inline. Kiro workflow hooks spin up a fresh `askAgent` session — the prompt is fully self-contained, which is why Kiro hooks include `> This is a new session — you have no conversation history.` at the top.

Both agents produce identical output files. If your team uses both (e.g. Kiro for development, Claude Code for reviews), the `knowledge/` directory is shared — there is no duplication or conflict between the two.

---

## 11. Pre-commit Guard & Bypass (v19.1)

`[CONFIRMED]` entries are human-verified. A pre-commit hook now blocks any commit that **removes** a `[CONFIRMED]` line from a `knowledge/*.md` file.

**Why it blocks:**

```
  ⛔ Knowledge guard: 1 [CONFIRMED] entry/entries removed
    ✗ knowledge/product-auth.md: removed — - Users must verify email before login [CONFIRMED]

  [CONFIRMED] entries are human-verified — removal requires explicit override.
  To bypass: AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m 'your message'
```

**What is allowed without bypass:**

- Adding new `[CONFIRMED]` entries
- Modifying `[INFERRED]` entries (any direction)
- Adding new knowledge files (no `HEAD` version yet)
- Adding new sections, lines, anything that does not remove an existing `[CONFIRMED]` line

**When to bypass:**

Legitimate reasons to remove a `[CONFIRMED]` line:

- Regeneration via `/tech-knowledge` or `/product-knowledge` resolved drift and the `[CONFIRMED]` claim is now wrong
- Schema change made the entry obsolete (e.g. a field was removed from the domain object)
- Team decided to retire a feature

**How to bypass:**

```bash
AI_GOV_KNOWLEDGE_OVERRIDE=1 git commit -m "refactor(auth): regenerate after schema change"
```

The env var also accepts `true`, `TRUE`, or `True`. Any other value (or absence) means the guard runs normally.

> ⚠ The pre-commit hook runs **before** git writes the commit message, so a `Knowledge-override:` trailer cannot work. The env-var bypass is the only reliable mechanism at pre-commit time.

**Why an env var and not `--no-verify`:**

- `git commit --no-verify` disables **all** governance checks (secrets, file size, architecture, knowledge guard).
- `AI_GOV_KNOWLEDGE_OVERRIDE=1` disables **only** the knowledge guard — every other governance check still runs.

Prefer the targeted bypass.

---

## 12. Configuration Reference

| File | Purpose | Where |
|---|---|---|
| `.gitattributes` | `knowledge/*.md merge=union` | Project root |
| `.gitignore` | `knowledge/*.html` (local HTML exports) | Project root |
| `.claude/git-hooks/checks/knowledge-confirmed.sh` | The pre-commit guard | Generated by `ai-gov init --git-hooks` |
| `.claude/git-hooks/config.json` | Per-check enable/disable | Set `"pre-commit"."knowledge-confirmed".enabled = false` to disable the guard team-wide |
| `AI_GOV_KNOWLEDGE_OVERRIDE` | Env var bypass for the guard | Per-commit, by the developer |
