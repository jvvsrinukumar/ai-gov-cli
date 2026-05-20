import type { GovernanceConfig, Stack } from '../../../types.js';
import { KNOWLEDGE_HTML_CSS } from '../../../utils/knowledge-html-template.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function buildStackPrimer(stack: Stack, subtype: string): string {
  if (stack === 'python') {
    if (subtype === 'fastapi') return `## Stack Primer\n\nFastAPI is an async Python web framework. Routes are decorated functions (\`@router.get()\`, \`@router.post()\`). \`Depends()\` is the dependency injection system — chain it for auth, DB sessions, and validation. Pydantic models validate all input and output automatically. SQLAlchemy handles DB access. Alembic manages schema migrations. Swagger UI auto-generates at \`/docs\`.\n\nRequest flow: \`Router → Depends() chain → Service → SQLAlchemy → DB\`\n\n---\n\n`;
    if (subtype === 'django') return `## Stack Primer\n\nDjango is a batteries-included Python framework. Views handle HTTP. URLconf maps URLs to views. The built-in ORM handles DB access. Migrations via \`python manage.py\`. Settings loaded via \`DJANGO_SETTINGS_MODULE\` env var.\n\nRequest flow: \`URL → View → ORM → DB\`\n\n---\n\n`;
    if (subtype === 'flask') return `## Stack Primer\n\nFlask is a minimal Python web framework. Routes are decorated functions (\`@app.route()\`). Blueprints organize features. No DI — services are imported directly. SQLAlchemy is commonly paired via Flask-SQLAlchemy.\n\nRequest flow: \`Blueprint route → Handler → SQLAlchemy → DB\`\n\n---\n\n`;
    return `## Stack Primer\n\nPython backend. Routes handle HTTP requests. Business logic in services. Database access via ORM.\n\nRequest flow: \`Router → Service → ORM → DB\`\n\n---\n\n`;
  }
  if (stack === 'nodejs') {
    if (subtype === 'nestjs') return `## Stack Primer\n\nNestJS is a TypeScript framework. Every feature is a **Module** (\`@Module()\`). **Services** are \`@Injectable()\` — injected via constructor, never imported directly. **Controllers** handle HTTP (\`@Controller()\`, \`@Get()\`, \`@Post()\`). **Guards** enforce auth (\`@UseGuards()\`). **Pipes** validate. **Interceptors** transform responses.\n\nDev command: \`npm run start:dev\` (not \`npm run dev\`). Swagger at \`/api\` if \`@nestjs/swagger\` is installed.\n\nRequest flow: \`Controller → Guard → Pipe → Service → Repository → DB\`\n\n---\n\n`;
    if (subtype === 'express') return `## Stack Primer\n\nExpress is a minimal Node.js HTTP framework. Routes are handler functions. Middleware runs **top-to-bottom — order matters**. \`express.json()\` is required to parse JSON request bodies. Error-handling middleware uses exactly 4 params \`(err, req, res, next)\`.\n\nRequest flow: \`Router → Middleware chain → Handler → Model → DB\`\n\n---\n\n`;
    if (subtype === 'fastify') return `## Stack Primer\n\nFastify is a high-performance Node.js framework. Routes are registered via \`fastify.register()\`. Plugins are the extension mechanism. JSON Schema provides built-in request/response validation. Hooks intercept the request lifecycle.\n\nRequest flow: \`Plugin → Hook → Route handler → Service → DB\`\n\n---\n\n`;
    return `## Stack Primer\n\nNode.js backend. Routes handle HTTP requests. Middleware runs in registration order. Business logic in service modules. Database access via ORM or query builder.\n\nRequest flow: \`Router → Middleware → Handler → Service → DB\`\n\n---\n\n`;
  }
  if (stack === 'java') {
    return `## Stack Primer\n\nSpring Boot is a Java framework. \`@RestController\` classes handle HTTP — annotated \`@GetMapping\`, \`@PostMapping\`, etc. \`@Service\` beans contain business logic. \`@Repository\` beans handle DB access. Spring DI injects via constructor or \`@Autowired\`. Lombok \`@Data\` generates getters/setters at compile time. \`./mvnw\` is the Maven wrapper — use it instead of a global \`mvn\`.\n\nRequest flow: \`Controller → Service → Repository → JPA Entity → DB\`\n\n---\n\n`;
  }
  return '';
}

function buildMigrationBlock(orm: string, stack: Stack): string {
  if (stack === 'python') return `| Create migration | \`alembic revision --autogenerate -m "description"\` |\n| Apply migrations | \`alembic upgrade head\` |\n| Rollback 1 step  | \`alembic downgrade -1\` |`;
  if (stack === 'java') return `| Apply (Flyway)       | \`mvn flyway:migrate\` |\n| Rollback (Flyway)    | \`mvn flyway:undo\` |\n| Apply (Liquibase)    | \`mvn liquibase:update\` |\n| Rollback (Liquibase) | \`mvn liquibase:rollback\` |`;
  if (orm === 'Prisma') return `| Create migration     | \`npx prisma migrate dev --name description\` |\n| Apply migrations     | \`npx prisma migrate deploy\` |\n| Browse DB (built-in) | \`npx prisma studio\` |\n| Rollback             | Manual — revert migration files |`;
  if (orm === 'TypeORM') return `| Create migration | \`npm run migration:generate -- -n MigrationName\` |\n| Apply migrations | \`npm run migration:run\` |\n| Rollback 1 step  | \`npm run migration:revert\` |`;
  if (orm === 'Sequelize') return `| Create migration | \`npx sequelize-cli migration:generate --name name\` |\n| Apply migrations | \`npx sequelize-cli db:migrate\` |\n| Rollback 1 step  | \`npx sequelize-cli db:migrate:undo\` |`;
  if (orm === 'Drizzle') return `| Create migration | \`npx drizzle-kit generate\` |\n| Apply migrations | \`npx drizzle-kit push\` |\n| Rollback         | Manual — edit migration files |`;
  if (orm === 'MikroORM') return `| Create migration | \`npx mikro-orm migration:create\` |\n| Apply migrations | \`npx mikro-orm migration:up\` |\n| Rollback 1 step  | \`npx mikro-orm migration:down\` |`;
  if (orm === 'Mongoose') return `| Migrations | N/A — MongoDB is schema-less. Schema changes are applied in application code. |`;
  return `| Apply migrations | \`[check package.json scripts or Makefile for migration commands]\` |`;
}

function buildStackNotesBlock(stack: Stack, subtype: string): string {
  if (stack === 'nodejs' && subtype === 'nestjs') return `- Every feature must live in a **Module** — register it in \`@Module({ imports: [] })\` or NestJS won\\'t find it [INFERRED]\n- Never \`import\` a service directly — inject via constructor: \`constructor(private readonly svc: MyService) {}\` [INFERRED]\n- **Guards** run before the route handler — put auth checks there, not in the handler [INFERRED]\n- Dev start command is \`npm run start:dev\`, not \`npm run dev\` [INFERRED]\n- Swagger UI at \`/api\` — add \`@ApiProperty()\` to DTOs to populate it fully [INFERRED]`;
  if (stack === 'nodejs' && subtype === 'express') return `- Middleware order matters — \`app.use(express.json())\` must be registered **before** route handlers [INFERRED]\n- Error-handling middleware requires exactly 4 parameters: \`(err, req, res, next)\` [INFERRED]\n- \`req.body\` is \`undefined\` without \`express.json()\` or \`express.urlencoded()\` middleware [INFERRED]`;
  if (stack === 'nodejs' && subtype === 'fastify') return `- Routes must be wrapped in plugins via \`fastify.register()\` for encapsulation [INFERRED]\n- JSON Schema on route definitions enables automatic validation — no Joi or Zod needed by default [INFERRED]\n- Hooks run at specific lifecycle points: \`onRequest\`, \`preHandler\`, \`onSend\` [INFERRED]`;
  if (stack === 'python' && subtype === 'fastapi') return `- **Activate virtual env first** before any command: \`source venv/bin/activate\` (Windows: \`venv\\\\Scripts\\\\activate\`) [INFERRED]\n- \`async def\` routes are non-blocking — use for DB/HTTP calls. \`def\` routes run in a thread pool [INFERRED]\n- \`Depends()\` chains execute before the route — use for auth, DB session injection, validation [INFERRED]\n- Pydantic v1 and v2 have different syntax — run \`python -c "import pydantic; print(pydantic.__version__)"\` [INFERRED]\n- SQLAlchemy session is **request-scoped** — never store it as a module-level variable [INFERRED]\n- Swagger at \`/docs\`, ReDoc at \`/redoc\` — auto-generated and always up-to-date [INFERRED]`;
  if (stack === 'python' && subtype === 'django') return `- New apps must be added to \`INSTALLED_APPS\` in \`settings.py\` [INFERRED]\n- \`python manage.py shell\` opens a Python session with full Django context [INFERRED]\n- \`python manage.py collectstatic\` is required before deploying to production [INFERRED]`;
  if (stack === 'java') return `- Use \`./mvnw\` (Maven wrapper) — no global Maven installation needed [INFERRED]\n- Lombok \`@Data\` generates getters, setters, equals, hashCode at compile time — not in source [INFERRED]\n- Spring profiles: \`application-dev.yml\`, \`application-prod.yml\` — set via \`SPRING_PROFILES_ACTIVE\` env var [INFERRED]\n- Constructor injection is preferred over \`@Autowired\` field injection in Spring 5+ [INFERRED]`;
  return '';
}

export function buildDbDiscoverySql(orm: string, dbDriver: string, stack: Stack): string {
  const isMongo = orm === 'Mongoose' || dbDriver.includes('mongodb');
  const isRedis = dbDriver.includes('Redis') || dbDriver.includes('ioredis') || dbDriver.includes('redis');
  const isMysql = dbDriver.includes('mysql');
  const isSqlite = dbDriver.includes('sqlite');

  const migHistQuery =
    orm === 'Prisma' ? 'SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 20;' :
    orm === 'TypeORM' ? 'SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 20;' :
    orm === 'Sequelize' ? 'SELECT * FROM "SequelizeMeta" ORDER BY name DESC LIMIT 20;' :
    orm === 'MikroORM' ? 'SELECT * FROM mikro_orm_migrations ORDER BY executed_at DESC LIMIT 20;' :
    (stack === 'python') ? 'SELECT * FROM alembic_version;' :
    (stack === 'java') ? 'SELECT * FROM flyway_schema_history ORDER BY installed_on DESC LIMIT 20;' :
    `SELECT * FROM [migration_table] ORDER BY [timestamp_col] DESC LIMIT 20; -- check ORM docs for exact table name`;

  if (isMongo) {
    return `// MongoDB schema discovery — ORM: ${orm} · Driver: ${dbDriver}
// Run in: mongosh CLI, MongoDB Compass, NoSQLBooster, or any MongoDB client

show dbs;                                      // 1. All databases
db.getCollectionNames();                       // 2. All collections
db.your_collection.findOne();                  // 3. Sample document (replace collection name)
db.your_collection.getIndexes();              // 4. Indexes for a collection
db.your_collection.stats();                   // 5. Collection stats
db.stats();                                   // 6. Database stats
db.getCollectionNames().forEach(c => print(c, db[c].countDocuments())); // 7. Row counts
`;
  }

  if (isRedis) {
    return `#!/bin/bash
# Redis key exploration — Driver: ${dbDriver}
# Run via: redis-cli, RedisInsight, Medis, Another Redis Desktop Manager, or any Redis client

PING                          # 1. Verify connection
INFO keyspace                 # 2. Database info
INFO memory                   # 3. Memory usage
SCAN 0 COUNT 100              # 4. Scan keys (safer than KEYS * in production)
TYPE your_key_name            # 5. Key type
HGETALL your_hash_key         # 6. Hash contents
LRANGE your_list_key 0 -1     # 7. List contents
SMEMBERS your_set_key         # 8. Set members
TTL your_key_name             # 9. Time-to-live
`;
  }

  if (isSqlite) {
    return `-- SQLite schema discovery — Driver: ${dbDriver}
-- Run in: any SQL client (DB Browser for SQLite, DBeaver, DataGrip, etc.) or sqlite3 CLI

-- 1. All tables and views
SELECT name, type FROM sqlite_master WHERE type IN ('table','view') ORDER BY type, name;

-- 2. Full DDL for all tables
SELECT sql FROM sqlite_master WHERE type = 'table' ORDER BY name;

-- 3. Columns (replace your_table)
PRAGMA table_info(your_table);

-- 4. Foreign keys (replace your_table)
PRAGMA foreign_key_list(your_table);

-- 5. Indexes (replace your_table)
PRAGMA index_list(your_table);

-- 6. All indexes
SELECT * FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name;

-- 7. DB file info
PRAGMA database_list;
`;
  }

  if (isMysql) {
    return `-- MySQL / MariaDB schema discovery — Driver: ${dbDriver} · ORM: ${orm}
-- Run in: any SQL client (DBeaver, SQL Workbench/J, DataGrip, etc.) or mysql CLI

-- 1. Tables + row counts
SELECT table_name, table_rows AS approx_rows, table_type
FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_rows DESC;

-- 2. All columns + types
SELECT table_name, column_name, column_type, is_nullable, column_default, column_key
FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position;

-- 3. Foreign keys
SELECT kcu.table_name, kcu.column_name, kcu.referenced_table_name, kcu.referenced_column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name
WHERE kcu.table_schema = DATABASE() ORDER BY kcu.table_name;

-- 4. Indexes
SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns, non_unique
FROM information_schema.statistics WHERE table_schema = DATABASE()
GROUP BY table_name, index_name, non_unique ORDER BY table_name;

-- 5. ENUM columns
SELECT table_name, column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE() AND data_type = 'enum' ORDER BY table_name;

-- 6. Table sizes
SELECT table_name, ROUND((data_length + index_length)/1024/1024, 2) AS size_mb
FROM information_schema.tables WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;

-- 7. Migration history
${migHistQuery}
`;
  }

  // Default: PostgreSQL
  return `-- PostgreSQL schema discovery — Driver: ${dbDriver || 'pg'} · ORM: ${orm}
-- Replace 'public' with your schema name if different
-- Run in: any SQL client (DBeaver, SQL Workbench/J, DataGrip, pgAdmin, etc.) or psql CLI

-- 1. All schemas
SELECT schema_name FROM information_schema.schemata
WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name;

-- 2. Tables + approximate row counts
SELECT schemaname, tablename, n_live_tup AS approx_rows
FROM pg_stat_user_tables ORDER BY n_live_tup DESC;

-- 3. All columns + types
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;

-- 4. Primary keys
SELECT tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;

-- 5. Foreign keys (relationship map)
SELECT tc.table_name AS from_table, kcu.column_name AS from_col,
       ccu.table_name AS to_table, ccu.column_name AS to_col
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public' ORDER BY tc.table_name;

-- 6. Indexes
SELECT indexname, tablename, indexdef FROM pg_indexes
WHERE schemaname = 'public' ORDER BY tablename, indexname;

-- 7. Enum types + values
SELECT t.typname AS enum_name, e.enumlabel AS enum_value
FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' ORDER BY t.typname, e.enumsortorder;

-- 8. Views
SELECT table_name AS view_name, view_definition
FROM information_schema.views WHERE table_schema = 'public' ORDER BY table_name;

-- 9. Functions / stored procedures
SELECT routine_name, routine_type, data_type AS return_type
FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;

-- 10. Triggers
SELECT trigger_name, event_manipulation, event_object_table, action_timing
FROM information_schema.triggers WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 11. Multi-tenant tables (always filter by org_id / tenant_id)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('org_id','tenant_id','organization_id','company_id','workspace_id')
ORDER BY table_name;

-- 12. Soft-delete tables (always add WHERE deleted_at IS NULL)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('deleted_at','is_deleted','archived_at','deactivated_at')
ORDER BY table_name;

-- 13. Table sizes on disk
SELECT relname AS table_name,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
       pg_size_pretty(pg_relation_size(relid)) AS table_only,
       pg_size_pretty(pg_total_relation_size(relid) - pg_relation_size(relid)) AS indexes
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC;

-- 14. Currently running queries
SELECT pid, now() - query_start AS duration, state, left(query, 120) AS query_preview
FROM pg_stat_activity WHERE state != 'idle' AND query_start IS NOT NULL ORDER BY duration DESC;

-- 15. Migration history (${orm} detected)
${migHistQuery}
`;
}

// ── main command generator ────────────────────────────────────────────────────

export function generateTechKnowledgeCommand(c: GovernanceConfig): string {
  const { profile, scan } = c;
  const stackDisplay = profile.stackDisplay;
  const sourceDir = profile.sourceDir || 'src/';
  const featuresDir = profile.featuresDir || sourceDir;
  const layerFlow = profile.layerFlow;

  const detectedState = scan.detectedState || profile.stateFramework || 'not detected';
  const detectedDI = scan.detectedDI || profile.diFramework || 'not detected';
  const detectedHTTPClient = scan.detectedHTTPClient || 'not detected';
  const detectedORM = scan.detectedORM || 'not detected';

  const isBackend = c.isBackend;
  const installCmd = profile.installCmd;
  const runCmd = profile.runCmd;
  const testCmd = profile.testCmd;
  const buildCmd = profile.buildCmd;
  const formatCmd = profile.formatCmd;
  const analyzeCmd = profile.analyzeCmd;
  const detectedSubtype = scan.detectedSubtype || '';
  const detectedDBDriver = scan.detectedDBDriver || '';
  const detectedAuth = scan.detectedAuth || '';
  const detectedSwagger = scan.detectedSwagger;
  const detectedNodeVersion = scan.detectedNodeVersion || '';
  const hasDB = !!(detectedORM && detectedORM !== 'not detected') || !!detectedDBDriver;

  const stackPrimerBlock = isBackend ? buildStackPrimer(c.stack, detectedSubtype) : '';
  const migrationBlock = buildMigrationBlock(detectedORM, c.stack);
  const stackNotesContent = buildStackNotesBlock(c.stack, detectedSubtype);

  const backendScanStep = !isBackend ? '' : `
## STEP 3.5 — Scan Developer Environment

In addition to source code, read these files before writing the knowledge file:

**1. Manifest / scripts** (→ Developer Quickstart + Daily Commands):
- Node.js: \`package.json\` → \`scripts\` block and \`engines\` field
- Python: \`pyproject.toml\` (taskipy tasks), \`Makefile\`, or files in \`scripts/\`
- Java: \`Makefile\`, \`pom.xml\` lifecycle goals, \`build.gradle\` tasks

**2. Environment file** (→ Environment Variables) — check in order, use first found:
- \`.env.example\` → read fully (committed template — safe)
- \`.env.template\` → read fully
- \`.env.sample\`   → read fully
- \`.env\`          → read **variable names and comments ONLY** — never record actual credential values
- Fallback: scan source for \`process.env.VAR\`, \`os.getenv('VAR')\`, Pydantic \`BaseSettings\` fields, \`@Value("\${...}")\`

**3. Database config** (→ Database section):
- ORM config: \`ormconfig.ts\`, \`datasource.ts\`, \`database.py\`, \`settings.py\` (DATABASE block), \`application.yml\`
- DB_* or DATABASE_URL env vars in the env file
- Migration dir: \`migrations/\`, \`prisma/migrations/\`, \`alembic/versions/\`
- Seed scripts: any \`seed*\` file in \`src/database/\`, \`scripts/\`, or \`seeds/\`

---

`;

  const nodeVersionHint = (c.stack === 'nodejs' && detectedNodeVersion)
    ? `\n1. **Install correct Node.js version:** detected \`${detectedNodeVersion}\` — run \`nvm install ${detectedNodeVersion} && nvm use\` (reads \`.nvmrc\`)`
    : c.stack === 'nodejs' ? '\n1. **Check Node.js version:** `node --version` — compare against `.nvmrc` or `engines` in `package.json`' : '';

  const pythonVenvHint = c.stack === 'python'
    ? `\n   **Python: activate virtual env first:** \`python -m venv venv && source venv/bin/activate\` (Windows: \`venv\\\\Scripts\\\\activate\`)`
    : '';

  const swaggerUrlHint =
    (detectedSwagger && detectedSubtype === 'fastapi') ? `\`http://localhost:[PORT]/docs\` (Swagger) + \`/redoc\` (ReDoc)` :
    (detectedSwagger && detectedSubtype === 'nestjs') ? `\`http://localhost:[PORT]/api\` (via @nestjs/swagger)` :
    detectedSwagger ? `\`http://localhost:[PORT]/[swagger-path]\` (check app setup for exact path)` :
    'No Swagger/OpenAPI endpoint detected — check README or ask team lead';

  const authHint = detectedAuth || 'No auth detected — endpoints appear to be open';

  const migHistQuery =
    detectedORM === 'Prisma' ? 'SELECT * FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 20;' :
    detectedORM === 'TypeORM' ? 'SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 20;' :
    detectedORM === 'Sequelize' ? 'SELECT * FROM "SequelizeMeta" ORDER BY name DESC LIMIT 20;' :
    detectedORM === 'MikroORM' ? 'SELECT * FROM mikro_orm_migrations ORDER BY executed_at DESC LIMIT 20;' :
    (c.stack === 'python') ? 'SELECT * FROM alembic_version;' :
    (c.stack === 'java') ? 'SELECT * FROM flyway_schema_history ORDER BY installed_on DESC LIMIT 20;' :
    `SELECT * FROM [migration_table] ORDER BY [timestamp_col] DESC LIMIT 20;`;

  const debugBlock =
    c.stack === 'nodejs' ? `\`\`\`\nNestJS:   npm run start:debug\nExpress:  node --inspect src/app.js  (or: ts-node --inspect src/app.ts)\n\`\`\`` :
    c.stack === 'python' ? `\`\`\`json\n// .vscode/launch.json — add this configuration:\n{ "type":"debugpy","request":"launch","module":"uvicorn","args":["app.main:app","--reload"],"justMyCode":false }\n\`\`\`` :
    c.stack === 'java' ? `\`\`\`\nmvn spring-boot:run -Dspring-boot.run.jvmArguments="-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=n,address=5005"\n\`\`\`` :
    '`[check docs for debugger attach command]`';

  const databaseSection = !hasDB ? '' : `
---

## Database [INFERRED]

| Property | Value | Confidence |
|----------|-------|------------|
| Engine | [PostgreSQL / MySQL / MongoDB / SQLite / Redis / other — derive from env file] | [INFERRED] |
| ORM / driver | [${detectedORM !== 'not detected' ? detectedORM : detectedDBDriver || 'check datasource config'}] | [INFERRED] |
| Connection var | [DATABASE_URL — or — DB_HOST + DB_PORT + DB_NAME + DB_USER + DB_PASSWORD] | [INFERRED] |
| Migrations dir | [migrations/ or prisma/migrations/ or alembic/versions/ — check project] | [INFERRED] |
${migrationBlock}

**Connect with any SQL client** (DBeaver, SQL Workbench/J, DataGrip, TablePlus, pgAdmin, Beekeeper Studio, HeidiSQL, or any other):

\`\`\`
Host:     value of DB_HOST  (or parse from DATABASE_URL)
Port:     value of DB_PORT  (PostgreSQL default: 5432 · MySQL default: 3306)
Database: value of DB_NAME
Username: value of DB_USER
Password: value of DB_PASSWORD
\`\`\`

**Or connect from the terminal:**
\`\`\`bash
# PostgreSQL
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME

# MySQL / MariaDB
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p $DB_NAME

# SQLite
sqlite3 [path/to/database.db]
\`\`\`

**Verify connection (paste into your SQL client or terminal):**
\`\`\`sql
SELECT 1;
SELECT current_database();
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name LIMIT 30;
-- Migration history:
${migHistQuery}
\`\`\`

**Migration workflow:**
1. Edit the model/entity to reflect the schema change
2. Generate: [create migration command from Daily Commands above]
3. Review the generated SQL in the migrations directory
4. Apply: [apply migrations command]
5. Rollback if wrong: [rollback command]
`;

  const stackNotesSection = stackNotesContent ? `
---

## Stack-Specific Notes [INFERRED]

${stackNotesContent}
` : '';

  const backendOutputSections = !isBackend ? '' : `
---

## First-Run Guide [INFERRED]

Step-by-step from zero to a running server:
${nodeVersionHint}
1. **Install dependencies:**${pythonVenvHint}
   \`${installCmd}\`
2. **Configure environment:**
   \`cp .env.example .env\`  — then fill in real values (see Environment Variables below)
3. **Create or connect to database:** [if local — create DB using DB_NAME from \`.env\`; if remote — credentials already in \`.env\`]
4. **Run migrations:** [see Database section below${!hasDB ? ' — no DB detected' : ''}]
5. **Seed test data:** [seed command if present — or skip]
6. **Start dev server:** \`${runCmd}\`
7. **Verify:** open \`http://localhost:[PORT]/\`${detectedSwagger ? ' — or hit the API docs URL in API Access below' : ''}

---

## Environment Variables [INFERRED]

Scan source: [.env.example / .env names-only / derived from source — see STEP 3.5]

Never commit \`.env\` — it contains real credentials. \`.env.example\` is the safe template.

| Variable | Example Value | Required | Purpose |
|----------|--------------|----------|---------|
| [VAR_NAME] | [value from .env.example] | yes / no | [what it configures] |

How this project loads env vars: [dotenv / pydantic BaseSettings / @nestjs/config / Spring application.yml — determine in STEP 3.5]

---

## Developer Daily Commands [INFERRED]

| Task | Command |
|------|---------|
| Install deps | \`${installCmd}\` |
| Start dev server | \`${runCmd}\` |
| Run all tests | \`${testCmd}\` |
| Build | \`${buildCmd}\` |
| Format code | \`${formatCmd}\` |
| Lint | \`${analyzeCmd}\` |
${migrationBlock}
${databaseSection}${stackNotesSection}
---

## API Access [INFERRED]

Base URL (dev): \`http://localhost:[PORT]\`
Auth mechanism: ${authHint}
API docs: ${swaggerUrlHint}

${detectedAuth ? `**Get auth token (copy-paste):**
\`\`\`bash
curl -X POST http://localhost:[PORT]/[auth/login endpoint] \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"email":"user@example.com","password":"..."}'
# → copy the "access_token" from the response

# Use token in requests:
curl -H "Authorization: Bearer [TOKEN]" http://localhost:[PORT]/[endpoint]
\`\`\`` : `*(No auth detected — try hitting endpoints directly without a token)*`}

---

## Logging & Debugging [INFERRED]

Logs: [stdout (default) — or check if logger writes to file / cloud service: look at detectedLogger in Patterns]
Log level: [LOG_LEVEL env var — or check logger config file for default level]

**Attach debugger (VS Code):**
${debugBlock}

*(If \`.vscode/launch.json\` exists in repo: use Run > Start Debugging instead)*

`;

  const dbDiscoveryOfferText = (isBackend && hasDB) ? `
- \`sql\` — DB schema discovery queries for ${detectedORM !== 'not detected' ? detectedORM : detectedDBDriver || 'detected DB'} — generates \`knowledge/db-schema-discovery.sql\` (committed, ready to run in any SQL client or CLI)` : '';

  return `# /tech-knowledge — Extract Technical Knowledge (Read-Only)

**Stack:** ${stackDisplay}

> Reads the live codebase and writes a committed technical knowledge file.
> Output: \`knowledge/tech-[scope].md\` — committed to git as persistent AI context.
> Cheap to read (small file), expensive to regenerate (full code scan) — regenerate only when code changes significantly.
> All entries tagged [INFERRED] until a human promotes them to [CONFIRMED].

---

## EXECUTION RULES

1. **Read-only on source** — no source files modified. Only the knowledge file is written.
2. **Tag everything [INFERRED]** — nothing is confirmed until a human verifies.
3. **Never invent patterns** — only extract what is observable in code.
4. **Preserve [CONFIRMED] entries** — on re-run, never downgrade or overwrite a [CONFIRMED] entry. Flag drift instead.
5. **"Needs Clarification" is mandatory** — always include, never empty if there are unknowns.
6. **Do not judge** — observe and record. No recommendations, no quality scores.

---

## STEP 1 — Determine Scope

Scope comes from \`$ARGUMENTS\`:

| Input | Scope | Output file |
|-------|-------|-------------|
| *(empty)* | Whole-project overview | \`knowledge/tech-overview.md\` |
| \`auth\` | One feature, all layers | \`knowledge/tech-auth.md\` |
| \`services\` | One layer across features | \`knowledge/tech-services.md\` |
| \`state\` | One pattern/concern | \`knowledge/tech-state.md\` |

**Slugification:** lowercase, spaces → hyphens. "user auth" → \`knowledge/tech-user-auth.md\`.

If scope is empty: read entry points + one representative feature to map the whole project.
If scope names a feature: read all layers of that feature.
If scope names a layer or pattern: read that concern across the codebase.

---

## STEP 2 — Check for Existing File

Before reading any source code, check if \`knowledge/tech-[scope].md\` already exists.

**If it exists:**
- Read the file and extract all entries tagged \`[CONFIRMED]\` — these must be preserved exactly.
- Note the \`Generated:\` line — extract the git hash (the \`[OLD_HASH]\` value after "git:").
- Run: \`git diff --stat [OLD_HASH]..HEAD -- [source paths covered by this scope]\`
- If > 10 files changed OR > 200 lines added/removed in the diff stat → mark "significant drift likely — [N] files changed, [N] lines delta since last generation" in the output.
- If ≤ 10 files changed AND ≤ 200 lines delta → proceed as an incremental update.
- If the hash is the same as HEAD → file is current, proceed as incremental update.

**If it does not exist:** proceed as a first-time extraction.

---

## STEP 3 — Read Source Files

**Project context:**
- Source root: \`${sourceDir}\`
- Features directory: \`${featuresDir}\`
- Layer flow: \`${layerFlow}\`
- Init-detected state: ${detectedState}
- Init-detected DI: ${detectedDI}
- Init-detected HTTP client: ${detectedHTTPClient}
- Init-detected ORM: ${detectedORM}

Run: \`git rev-parse --short HEAD\` to get the current git hash. Store as **[GIT_HASH]**.

Read files relevant to the scope. Start at entry points, trace through layers.
Do NOT read the entire codebase — read enough to map the scope accurately.

---

${backendScanStep}## STEP 4 — Write Knowledge File

Create the \`knowledge/\` directory if it doesn't exist.

Write \`knowledge/tech-[scope].md\` with this exact structure:

\`\`\`markdown
# Tech Knowledge — [scope] | ${stackDisplay}

> ⚠ Auto-generated [INFERRED]. Do not add secrets, PII, or credentials.
> Manual edits to [CONFIRMED] entries are preserved on re-run.

Generated: [today's date] (git: [GIT_HASH])

---

${stackPrimerBlock}## Layer Map

[layer] → [file/dir] — [role] [INFERRED]
[layer] → [file/dir] — [role] [INFERRED]
...

---

## Layer Flow Diagram

\`\`\`mermaid
graph LR
  A[Entry / Controller] --> B[Service / Use Case]
  B --> C[Repository / Data Access]
  C --> D[(Database / External API)]
\`\`\`
(Replace node labels with actual layer names observed. Add edges for every import or call dependency. Label edges when the relationship type is notable, e.g. "calls", "injects", "reads".)

---

## Patterns in Use

| Pattern | Value | Confidence |
|---------|-------|------------|
| HTTP client | [observed or "not found"] | [INFERRED] |
| State management | [observed or "N/A"] | [INFERRED] |
| Data access | [ORM/driver/raw] | [INFERRED] |
| DI | [framework or "none"] | [INFERRED] |
| Naming (files) | [convention observed] | [INFERRED] |
| Naming (classes) | [convention observed] | [INFERRED] |
| Error handling | [pattern observed] | [INFERRED] |

---

## File Inventory

| File | Layer | Lines | Notes |
|------|-------|-------|-------|
| [path] | [layer] | [N] | [brief note] |
...

---

## Conventions

- [naming convention observed] [INFERRED]
- [import style observed] [INFERRED]
- [folder structure pattern] [INFERRED]
- [test file placement] [INFERRED]
...
${backendOutputSections}
---

## Drift Detected

*(Only present on re-run when existing [CONFIRMED] entries conflict with current code.)*

- [CONFIRMED entry text] — code now shows [what code shows instead] → REVIEW REQUIRED
...

*(If no drift: omit this section entirely.)*

---

## Needs Clarification

- [thing observed but not understood] [UNKNOWN]
- [architecture decision with no comments explaining why] [UNKNOWN]
- [pattern that seems inconsistent but might be intentional] [UNKNOWN]
...
\`\`\`

**Preservation rule:** If the file previously contained [CONFIRMED] entries, copy them verbatim into the new file. If code now contradicts a [CONFIRMED] entry, add it to "Drift Detected" — do NOT remove or overwrite the [CONFIRMED] entry itself. A human must resolve drift.

---

## STEP 5 — Optional Export

After writing the committed file, ask:

> The knowledge file has been written to \`knowledge/tech-[scope].md\` and is ready to commit.
> Want an additional export? Reply with a format or skip:
>
> - \`html\` — HTML export — requires internet to render Mermaid diagrams (good for sharing)${dbDiscoveryOfferText}
> - \`skip\` or *(no reply)* — done

**If html requested:** generate an HTML file at \`knowledge/tech-[scope].html\` using the shared page scaffold below.

**If sql requested** *(only when DB detected)*: generate \`knowledge/db-schema-discovery.sql\` (or \`.js\` for MongoDB, \`.sh\` for Redis) using \`buildDbDiscoverySql("${detectedORM}", "${detectedDBDriver}", "${c.stack}")\`. Commit this file — it is a permanent exploration tool for the project's specific DB engine and ORM.

**Page scaffold** (CSS + wrapper are shared across all knowledge exports):

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tech Knowledge — [scope] | ${stackDisplay}</title>
  <!-- Mermaid loaded from CDN — requires internet to render diagrams -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
${KNOWLEDGE_HTML_CSS}
  </style>
</head>
<body>
  <h1>Tech Knowledge — [scope] <span style="color:#6b7280;font-size:.9rem">| ${stackDisplay}</span></h1>
  <div class="meta">
    ⚠ Auto-generated [INFERRED]. Manual edits to [CONFIRMED] entries are preserved on re-run.<br>
    Generated: [today's date] (git: [GIT_HASH])
  </div>
\`\`\`

**Body sections** (specific to tech-knowledge — populate with observed values):

\`\`\`html
  <!-- If drift exists -->
  <div class="drift">
    ⚠ <strong>Drift Detected</strong> — the following [CONFIRMED] entries conflict with current code. Human review required before promoting or removing.<br>
    [drift items]
  </div>

  <h2>Layer Map</h2>
  <div class="layer-map">
    [layer] → [file/dir] — [role] <span class="tag-inferred">[INFERRED]</span><br>
    ...
  </div>

  <h2>Layer Flow Diagram</h2>
  <div class="mermaid">
graph LR
  A[Entry / Controller] --> B[Service / Use Case]
  B --> C[Repository / Data Access]
  C --> D[(Database / External API)]
  </div>

  <h2>Patterns in Use</h2>
  <table>
    <thead><tr><th>Pattern</th><th>Value</th><th>Confidence</th></tr></thead>
    <tbody>
      <!-- one row per pattern -->
    </tbody>
  </table>

  <h2>File Inventory</h2>
  <table>
    <thead><tr><th>File</th><th>Layer</th><th>Lines</th><th>Notes</th></tr></thead>
    <tbody>
      <!-- one row per file -->
    </tbody>
  </table>

  <h2>Conventions</h2>
  <ul>
    <!-- one <li> per convention -->
  </ul>

  <h2>Needs Clarification</h2>
  <ul>
    <!-- one <li> per unknown -->
  </ul>
\`\`\`

**Footer** (shared):

\`\`\`html
  <footer>Generated by /tech-knowledge · ${stackDisplay} · git: [GIT_HASH]</footer>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'neutral' });</script>
</body>
</html>
\`\`\`

Populate every placeholder with actual observed values before writing. HTML export is local only — do not commit it.

---

## STEP 6 — Confirm Output

After writing, report:

\`\`\`
━━━ TECH KNOWLEDGE WRITTEN ━━━

  File:            knowledge/tech-[scope].md
  Git hash:        [GIT_HASH]
  Scope:           [what was mapped]
  Layers mapped:   [N]
  Files read:      [N]
  Unknowns flagged:[N]
  Drift detected:  [N entries — or "none"]${isBackend ? `
  Dev quickstart:  yes — First-Run Guide, Env Vars, Daily Commands included
  Database:        ${hasDB ? 'yes — connection, migrations, SQL verification included' : 'n/a — no DB detected'}` : ''}
  Export:          [html written / sql written / none]

  All new entries are [INFERRED]. Commit this file to git.
  Re-run /tech-knowledge when significant code changes occur.
  "Needs Clarification" items require human input — code cannot answer them.
\`\`\`

---

## RULES

- Output goes in \`knowledge/\` at project root — not inside \`.claude/\`
- Create the \`knowledge/\` directory if it doesn't exist
- Commit the \`.md\` file — it is the AI context source for all other commands
- Do NOT commit the \`.html\` export — it is a local sharing artifact only
- DO commit the \`.sql\` / \`.js\` / \`.sh\` discovery file — it is a permanent project tool
- Do not read \`.claude/steering/\` as a source of truth — read actual code
- Do not copy from steering files — independently observe and record
- If a pattern was detected at init time but is not observable in code now, note the discrepancy
- Keep the file concise — this is a reference document, not a novel
- [CONFIRMED] entries are human-verified truth — never silently overwrite them
`;
}
