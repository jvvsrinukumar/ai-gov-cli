# Implementation Plan: Governance Dashboard

## Overview

This plan implements the Governance Dashboard feature in two deliverables: (1) a standalone Hub Server (`ai-governance-hub/`) with REST API, SQLite database, and self-contained HTML dashboard, and (2) modifications to the existing `ai-governance/` CLI for telemetry reporting, pre-push hook generation, pre-commit logging, CI template updates, and hub configuration utilities. All code is TypeScript with Express.js on the server side.

## Tasks

- [x] 1. Set up Hub Server project structure and dependencies
  - [x] 1.1 Initialize `ai-governance-hub/` project with package.json, tsconfig.json, .env.example, Procfile, and directory structure
    - Create `ai-governance-hub/` as a sibling directory to `ai-governance/`
    - Initialize package.json with dependencies: express, better-sqlite3, helmet, express-rate-limit, compression
    - Add devDependencies: typescript, @types/express, @types/better-sqlite3, @types/compression, fast-check, jest, ts-jest, @types/jest
    - Create tsconfig.json targeting ES2020 with outDir: dist
    - Create .env.example with PORT, DB_PATH, AI_GOV_SECRET placeholders
    - Create Procfile with `web: node dist/server.js`
    - Create .gitignore (node_modules, dist, data.db)
    - _Requirements: 14.1, 14.4_

  - [x] 1.2 Implement database connection module (`src/db/index.ts`)
    - Open SQLite at DB_PATH (default `./data.db`)
    - Enable WAL journal mode, synchronous=NORMAL, foreign_keys=ON
    - Export `openDatabase(dbPath: string)` and `closeDatabase(db: Database)` functions
    - _Requirements: 14.7, 14.1_

  - [x] 1.3 Implement database migrations (`src/db/migrations.ts`)
    - Create events table with all columns using CREATE TABLE IF NOT EXISTS
    - Create pr_reports table with all columns using CREATE TABLE IF NOT EXISTS
    - Create all indexes (idx_events_project, idx_events_received_at, idx_events_dedup_key, idx_events_team, idx_pr_reports_project, idx_pr_reports_received_at)
    - Export `runMigrations(db: Database)` function
    - _Requirements: 14.3_

  - [x] 1.4 Implement data retention module (`src/db/retention.ts`)
    - Delete records older than 90 days from events and pr_reports tables based on received_at column
    - Export `runRetention(db: Database)` and `scheduleRetention(db: Database)` functions
    - Schedule runs at startup and every 24 hours
    - _Requirements: 5.2_

- [x] 2. Implement Hub Server middleware
  - [x] 2.1 Implement authentication middleware (`src/middleware/auth.ts`)
    - Use `crypto.timingSafeEqual` for constant-time Bearer token comparison
    - If AI_GOV_SECRET is not set AND NODE_ENV is 'development': allow all requests (dev mode) and log a startup warning; enforcement of the no-secret-without-dev-mode rule is handled in task 7.1, not here
    - Return HTTP 401 for invalid/missing tokens on POST routes
    - _Requirements: 4.1, 4.2, 1.2, 2.2_

  - [x] 2.2 Write property test for authentication (Property 2)
    - **Property 2: Authentication rejects all invalid tokens**
    - **Validates: Requirements 1.2, 2.2**

  - [x] 2.3 Implement validation and sanitization middleware (`src/middleware/validate.ts`)
    - Validate event payloads: project (1-100 chars), developer_hash (64 lowercase hex), violations (max 50 items, each max 256 chars), compliance_pct (0-100)
    - Validate PR report payloads: project (required), developer_hash (64 hex), platform (github|gitlab|bitbucket|unknown), compliance_pct (0-100), violations (max 50, each max 256)
    - Implement `sanitizeString()`: strip HTML tags, remove null bytes, trim whitespace
    - Return HTTP 400 with field-specific error messages on validation failure
    - Export `validateEvent`, `validatePRReport`, `sanitizeString`
    - _Requirements: 1.5, 2.3, 2.4, 4.7_

  - [x] 2.4 Write property test for input validation (Property 1)
    - **Property 1: Input validation rejects invalid payloads with field-specific errors**
    - **Validates: Requirements 1.5, 2.3, 2.4**

  - [x] 2.5 Write property test for sanitization (Property 4)
    - **Property 4: Input sanitization strips HTML tags, null bytes, and trims whitespace**
    - **Validates: Requirements 4.7**

- [x] 3. Implement Hub Server routes — Event Ingestion
  - [x] 3.1 Implement POST /api/events route (`src/routes/events.ts`)
    - Store validated event in SQLite using prepared statements
    - Implement deduplication: check dedup_key within 5-minute window, return 200 if duplicate
    - Apply default values for optional fields (team: "ungrouped", platform: "unknown")
    - Return 201 with event id and received_at on success
    - Return 503 on database failure
    - Check Content-Type is application/json, return 415 otherwise
    - Enforce 100KB body limit, return 413 if exceeded
    - _Requirements: 1.1, 1.3, 1.4, 1.6, 1.7, 1.8_

  - [x] 3.2 Write property test for deduplication (Property 3)
    - **Property 3: Deduplication prevents duplicate events within 5-minute window**
    - **Validates: Requirements 1.4**

  - [x] 3.3 Write property test for dedup key computation (Property 16)
    - **Property 16: Dedup key computation is deterministic**
    - **Validates: Requirements 8.12**

- [x] 4. Implement Hub Server routes — PR Report Ingestion
  - [x] 4.1 Implement POST /api/pr-reports route (`src/routes/pr-reports.ts`)
    - Store validated PR report in SQLite using prepared statements
    - Apply default values (team: "ungrouped", platform: "unknown")
    - Return 201 on success, 400 on validation failure, 401 on auth failure, 503 on DB failure
    - _Requirements: 2.1, 2.5, 2.6_

- [x] 5. Implement Hub Server routes — Report Retrieval
  - [x] 5.1 Implement GET /api/report route (`src/routes/report.ts`)
    - Accept `period` query parameter (7d, 30d, 90d, all), default to 30d
    - Return 400 for invalid period values
    - Filter events and pr_reports by received_at within the selected time window
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 Implement scoring utilities (`src/utils/score.ts`)
    - Calculate Compliance_Score: `round(compliance_pct * 0.6 + hook_health_pct * 0.4)`
    - Assign team status: "healthy" (>=90), "review" (>=70, <90), "needs_attention" (<70)
    - Calculate violation trends: compare first half vs second half counts ("up" if second > first*1.1, "down" if second < first*0.9, "stable" otherwise)
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 5.3 Write property test for compliance score calculation (Property 5)
    - **Property 5: Compliance score calculation**
    - **Validates: Requirements 3.4**

  - [x] 5.4 Write property test for team status assignment (Property 6)
    - **Property 6: Team status assignment from compliance score**
    - **Validates: Requirements 3.5**

  - [x] 5.5 Write property test for trend calculation (Property 7)
    - **Property 7: Trend calculation from period halves**
    - **Validates: Requirements 3.6**

  - [ ] 5.6 Write property test for time-period filtering (Property 8)
    - **Property 8: Time-period filtering returns only events within window**
    - **Validates: Requirements 3.2**

  - [x] 5.7 Implement alert generation in report route
    - Generate "warning" alerts for projects with no events in last 14 days
    - Generate "info" alerts for projects with outdated hook versions
    - Generate "critical" alerts for bypass events per project-developer combination
    - _Requirements: 3.7, 3.8, 3.9_

- [x] 6. Implement Hub Server routes — Health Check
  - [x] 6.1 Implement GET /api/health route (`src/routes/health.ts`)
    - Return 200 with status: "ok", uptime (seconds), ts (Unix timestamp) when DB is accessible
    - Return 503 when database query fails
    - _Requirements: 5.1, 5.4, 14.2_

- [x] 7. Implement Hub Server entry point and wiring
  - [x] 7.1 Implement server.ts with middleware stack and graceful shutdown
    - Load environment variables (PORT, DB_PATH, AI_GOV_SECRET, NODE_ENV)
    - If AI_GOV_SECRET not set AND NODE_ENV != 'development': exit non-zero with error message
    - If AI_GOV_SECRET not set AND NODE_ENV == 'development': log warning, run in open mode (no auth)
    - Initialize database with migrations before accepting requests
    - Configure middleware: helmet, compression, express-rate-limit (120 writes/min, 300 reads/min per IP), JSON body parser (100KB limit)
    - Mount all routes
    - Handle SIGTERM/SIGINT: stop accepting connections, complete in-flight, close DB, exit within 5s
    - Schedule retention cleanup
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 5.5, 14.4, 14.5, 14.6_

  - [x] 7.2 Write property test for migration idempotency (Property 21)
    - **Property 21: Database migrations are idempotent**
    - **Validates: Requirements 14.3**

- [x] 8. Checkpoint — Hub Server core complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement Dashboard
  - [x] 9.1 Create self-contained dashboard HTML file (`public/dashboard.html`)
    - Single HTML file with inline CSS and JavaScript
    - Include Chart.js via CDN with tabular fallback if Chart.js fails to load
    - Implement 7 navigation tabs: Overview, Teams, Projects, Developers, AI Usage, Violations, Alerts (Overview default)
    - Implement period selector (7d, 30d, 90d, All) with 30d default
    - Implement pagination (20 rows/page), column sorting, text-based filtering on all tables
    - Color-code compliance scores: green (>=90), amber (>=70, <90), red (<70)
    - Support URL hash navigation (#teams, #projects, #ai-usage, etc.)
    - Responsive layout: no horizontal scroll, no overlapping, no truncation below 4 chars (320px-2560px)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 9.2 Implement dashboard data refresh and security
    - Auto-refresh from `/api/report` every 5 minutes with 10s request timeout
    - Exponential backoff on failure: 30s → 60s → 120s → 240s → 300s (cap), reset on success
    - Render all dynamic content using textContent or escaping function (replace <, >, &, ", ' with HTML entities)
    - Show stale data with "last updated X ago" banner on fetch failure
    - Destroy existing chart instances before creating new ones on refresh
    - Show error indicator visible without scrolling when hub is unreachable
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 9.3 Write property test for XSS escaping (Property 20)
    - **Property 20: HTML entity escaping prevents XSS**
    - **Validates: Requirements 7.3**

  - [x] 9.4 Write property test for exponential backoff (Property 19)
    - **Property 19: Exponential backoff retry logic**
    - **Validates: Requirements 7.2**

- [x] 10. Checkpoint — Hub Server and Dashboard complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Hub Configuration Utility
  - [x] 11.1 Create hub config reader (`src/utils/hub-config.ts` in ai-governance/)
    - Export `HubConfig` interface with fields: hub, project, team, platform
    - Export `readHubConfig(projectDir: string): HubConfig | null`
    - Read `<projectDir>/.ai-gov/config.json` using platform-appropriate path resolution
    - Apply defaults for missing fields: team="ungrouped", project=basename(projectDir), platform="unknown", hub=""
    - Return null (without throwing) if file doesn't exist, contains unparseable JSON, or parses to non-object
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 11.2 Write property test for hub config parsing (Property 9)
    - **Property 9: Hub config parsing applies correct defaults for missing fields**
    - **Validates: Requirements 11.1, 11.2**

  - [x] 11.3 Write property test for invalid config handling (Property 10)
    - **Property 10: Invalid or missing config returns null without throwing**
    - **Validates: Requirements 11.3**

- [x] 12. Implement Pre-Push Hook Generator
  - [x] 12.1 Create pre-push hook generator (`src/generators/git-hooks/pre-push.ts` in ai-governance/)
    - Export `generatePrePush(hookVersion: string): string`
    - Generate bash script starting with `#!/usr/bin/env bash`
    - Check AI_GOV_TELEMETRY != "off" (skip all reporting if off)
    - Read .ai-gov/config.json using jq (preferred) or python3 (fallback)
    - Validate hub URL is HTTPS (skip and warn to stderr if not)
    - Hash developer email with SHA-256 (sha256sum on Linux, shasum -a 256 on macOS, "unknown0..." fallback)
    - Calculate compliance_pct from last 20 precommit.log entries (default 100 if missing)
    - Process refs from stdin: skip delete pushes, handle new branches (cap at 50 commits)
    - Compute dedup_key as sha256(project + developer_hash + branch + floor(push_ts / 300))
    - Send payload via background curl (--max-time 5, --connect-timeout 3)
    - Always exit 0 regardless of any errors
    - Payload contains ONLY allowed fields (no source code, file paths, commit messages, diffs)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 13.1, 13.2, 13.3, 13.4, 13.7_

  - [x] 12.2 Write property test for SHA-256 hashing (Property 11)
    - **Property 11: SHA-256 hashing produces consistent 64-character lowercase hex**
    - **Validates: Requirements 8.4, 13.3**

  - [x] 12.3 Write property test for compliance percentage calculation (Property 12)
    - **Property 12: Compliance percentage calculation from log entries**
    - **Validates: Requirements 8.6**

  - [x] 12.4 Write property test for pre-push never blocks (Property 15)
    - **Property 15: Pre-push script never blocks push**
    - **Validates: Requirements 8.2**

  - [x] 12.5 Write property test for payload field constraints (Property 17)
    - **Property 17: Event payloads contain only allowed fields**
    - **Validates: Requirements 13.1, 13.2, 13.4**

  - [x] 12.6 Write property test for non-HTTPS URL handling (Property 18)
    - **Property 18: Non-HTTPS hub URLs skip transmission**
    - **Validates: Requirements 13.7**

- [x] 13. Implement Pre-Commit Log Writing
  - [x] 13.1 Modify pre-commit hook generator (`src/generators/git-hooks/pre-commit.ts` in ai-governance/)
    - After all governance checks complete, before exit statements:
    - Add `mkdir -p .ai-gov/usage-logs/ || true`
    - Append `<timestamp>|pass|manual|` on exit 0, `<timestamp>|fail|manual|` on exit 1 as the baseline 4-field format; the ai_platform field defaults to "manual" and command field defaults to "" at this stage — AI detection logic is added in task 18.1 and replaces these defaults
    - Implement log rotation: if > 500 entries, keep most recent 500 via temp file and mv
    - All operations suffixed with `|| true` (never alter commit exit code)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 13.2 Write property test for log rotation (Property 13)
    - **Property 13: Log rotation preserves most recent 500 entries**
    - **Validates: Requirements 9.3**

  - [x] 13.3 Write property test for log entry format (Property 14)
    - **Property 14: Log entry format consistency**
    - **Validates: Requirements 9.1, 9.2**

- [x] 14. Implement CI Template Hub Reporting
  - [x] 14.1 Update GitHub Actions template (`src/generators/ci/github.ts`)
    - Add optional `hubUrl` parameter to generator function
    - Add hub reporting step ONLY when hubUrl is provided
    - Run `ai-gov pr-check --format json` and send output to hub /api/pr-reports
    - Use `${{ secrets.AI_GOV_SECRET }}` for auth
    - Compute developer_hash from `${{ github.actor }}`
    - Suffix curl with `|| true`
    - Include only required fields (no diff content, file contents, source code)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 14.2 Update GitLab CI template (`src/generators/ci/gitlab.ts`)
    - Add optional `hubUrl` parameter to generator function
    - Add hub reporting step ONLY when hubUrl is provided
    - Use $AI_GOV_SECRET for auth
    - Compute developer_hash from $GITLAB_USER_LOGIN
    - Suffix curl with `|| true`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 14.3 Update Bitbucket Pipelines template (`src/generators/ci/bitbucket.ts`)
    - Add optional `hubUrl` parameter to generator function
    - Add hub reporting step ONLY when hubUrl is provided
    - Use $AI_GOV_SECRET for auth
    - Compute developer_hash from $BITBUCKET_PR_AUTHOR + "bitbucket"
    - Suffix curl with `|| true`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 14.4 Write unit tests for CI template hub reporting
    - Test GitHub, GitLab, Bitbucket templates generate correct hub reporting steps
    - Test templates omit hub reporting when AI_GOV_HUB is not set
    - Test developer_hash computation uses correct platform-specific actor
    - _Requirements: 10.3, 10.5_

  - [x] 14.5 Update `src/commands/init-ci.ts` to pass hubUrl to CI generator functions
    - Call `readHubConfig(projectDir)` to retrieve hub configuration after governance generation
    - Pass `{ hubUrl: cfg?.hub }` to `generateGithubCI()` and `generateBitbucketCI()` calls
    - Pass `{ hubUrl: cfg?.hub, existingContent }` to `generateGitlabCI()` (preserving existing content parameter in the new options object shape)
    - When cfg is null or hub is empty, pass no hubUrl so hub reporting step is omitted entirely
    - _Requirements: 10.3, 10.4_

- [x] 15. Checkpoint — CLI generators complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement CLI Updates
  - [x] 16.1 Update CLI init command for transparency disclosure and gitignore
    - After governance generation, call `readHubConfig()` to check for hub config
    - If hub config exists, display transparency disclosure message listing hub URL and data reported (commit count, compliance percentage, violation counts)
    - State no source code or commit messages are sent
    - State developer emails are hashed before transmission
    - Include instructions to disable telemetry (AI_GOV_TELEMETRY=off)
    - If no hub config, skip disclosure
    - Append `.ai-gov/usage-logs/` to .gitignore if not already present
    - Skip gitignore entry if no .gitignore and no .git directory
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 16.2 Write unit tests for CLI transparency disclosure
    - Test disclosure is shown when hub config exists
    - Test disclosure is not shown when hub config is missing
    - Test gitignore entry is appended correctly
    - Test gitignore is skipped when no .git directory
    - _Requirements: 12.1, 12.6, 12.7_

- [ ] 17. Integration wiring and final verification
  - [ ] 17.1 Wire dashboard serving in Hub Server
    - Serve `public/dashboard.html` at GET `/` in server.ts
    - Ensure static file serving is configured after security middleware
    - _Requirements: 6.1_

  - [ ]* 17.2 Write integration tests for Hub Server lifecycle
    - Test full request lifecycle: POST event → GET report → verify aggregation
    - Test database retention: seed old records → trigger cleanup → verify deletion
    - Test graceful shutdown: send SIGTERM → verify DB closed within 5s
    - _Requirements: 1.1, 3.1, 5.2, 5.5_

- [x] 18. Implement AI Usage Telemetry — Data Collection
  - [x] 18.1 Extend pre-commit log format for AI detection (`src/generators/git-hooks/pre-commit.ts`)
    - Detect AI platform by checking for `.claude/` session artifacts in the repo
    - Detect AI command name from session metadata or commit context markers
    - For Kiro: check for `.kiro/` workspace markers
    - Extend log entry format to `<timestamp>|<pass/fail>|<ai_platform>|<command>`
    - Default to "manual" with empty command when no AI markers detected
    - All detection logic suffixed with `|| true` (never block commits)
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 18.2 Extend pre-push hook to collect AI usage data (`src/generators/git-hooks/pre-push.ts`)
    - Parse extended precommit.log entries to extract AI platform and command fields (field index 2 and 3 from pipe-delimited lines)
    - When parsing log entries, treat a missing or empty ai_platform field (entries written before task 18.1 upgrade in 2-field format) as "manual" and treat a missing command field as empty string for backward compatibility
    - Count AI-assisted commits (entries where platform != "manual")
    - Collect distinct command names used
    - Determine primary AI platform ("claude-code", "kiro", or "mixed" if both present)
    - Count active AI agent hooks by listing `.js` files in `.claude/hooks/` and `.kiro.hook` files in `.kiro/hooks/`; do NOT count git hook scripts in `.claude/git-hooks/`
    - Build `ai_usage` JSON object and include in event payload
    - Ensure ai_usage contains ONLY allowed fields (no prompts, responses, code, or file contents)
    - _Requirements: 15.4, 15.5, 15.6, 15.7_

  - [x] 18.3 Write property test for AI usage detection (Property 22)
    - **Property 22: AI usage detection from log entries**
    - **Validates: Requirements 15.4**

  - [x] 18.4 Write property test for AI usage payload constraints (Property 23)
    - **Property 23: AI usage payload contains no content**
    - **Validates: Requirements 15.6**

- [~] 19. Implement AI Usage Telemetry — Hub Server and Dashboard
  - [x] 19.1 Extend Hub Server to store and aggregate AI usage data
    - Add `ai_usage` TEXT column (JSON) to events table migration
    - Extend event validation to accept optional ai_usage object (validate ai_platform enum, commands_used max 20 items each max 64 chars, active_hooks_count 0-999)
    - Extend GET /api/report to aggregate AI usage: total_ai_commits, ai_adoption_pct, commands_distribution, platform_distribution, per-team AI adoption rates
    - Calculate AI adoption trend using same logic as violation trends
    - Include compliance_comparison in ai_usage report section: ai_pass_rate and manual_pass_rate (null when no entries for category)
    - _Requirements: 1.9, 16.5, 16.6, 16.7, 16.9_
    - **Status: Complete in ai-governance-hub/ (src/routes/report.ts aggregates ai_usage; validation in middleware/validate.ts)**

  - [~] 19.2 Implement AI Usage dashboard tab (`public/dashboard.html`)
    - Add "AI Usage" tab to navigation (7 tabs total)
    - Display aggregate metrics: total AI-assisted commits, AI adoption %, most-used commands, platform distribution
    - Display per-team breakdown: team name, AI adoption rate, top command, trend arrow
    - Display per-developer breakdown: developer hash, commit count, AI-assisted count, adoption rate, primary platform
    - Add AI adoption rate line chart (daily granularity) for selected period
    - Support URL hash #ai-usage
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.8_
    - **Status: UI tab present and data binding wired; chart rendering pending**

  - [ ]* 19.3 Write property test for AI adoption trend calculation (Property 24)
    - **Property 24: AI adoption trend calculation**
    - **Validates: Requirements 16.7**

  - [ ]* 19.4 Write unit tests for AI usage aggregation
    - Test commands_distribution counts correctly
    - Test platform_distribution counts correctly
    - Test per-team AI adoption rate calculation
    - Test trend calculation with various data distributions
    - _Requirements: 16.5, 16.7_

  - [x] 19.5 Extend report aggregation to compute compliance_comparison
    - Query events table within selected period: count entries where ai_platform != "manual" with "pass" status and total AI-assisted entries
    - Query events table within selected period: count entries where ai_platform == "manual" with "pass" status and total manual entries
    - Set ai_pass_rate to null when total AI-assisted entries is 0; set manual_pass_rate to null when total manual entries is 0
    - Include compliance_comparison object in the ai_usage section of GET /api/report response
    - _Requirements: 16.9_
    - **Status: Complete in ai-governance-hub/ (compliance_comparison computed and included in /api/report response)**

  - [ ]* 19.6 Write property test for AI vs manual compliance rate (Property 25)
    - **Property 25: AI vs manual compliance rate calculation**
    - **Validates: Requirements 16.9**

- [ ] 20. Final checkpoint — All components integrated including AI telemetry
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The Hub Server (`ai-governance-hub/`) is a sibling project to `ai-governance/`
- All hub server code uses TypeScript with Express.js and better-sqlite3
- All CLI code uses TypeScript matching the existing project conventions
- fast-check is used for property-based testing in both projects

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "11.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "11.2", "11.3"] },
    { "id": 3, "tasks": ["2.1", "2.3"] },
    { "id": 4, "tasks": ["2.2", "2.4", "2.5"] },
    { "id": 5, "tasks": ["3.1", "4.1", "6.1"] },
    { "id": 6, "tasks": ["3.2", "3.3", "5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3", "5.4", "5.5", "5.6", "5.7"] },
    { "id": 8, "tasks": ["7.1"] },
    { "id": 9, "tasks": ["7.2", "9.1"] },
    { "id": 10, "tasks": ["9.2"] },
    { "id": 11, "tasks": ["9.3", "9.4", "17.1"] },
    { "id": 12, "tasks": ["12.1", "13.1"] },
    { "id": 13, "tasks": ["12.2", "12.3", "12.4", "12.5", "12.6", "13.2", "13.3"] },
    { "id": 14, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 15, "tasks": ["14.4", "14.5", "16.1"] },
    { "id": 16, "tasks": ["16.2", "17.2"] },
    { "id": 17, "tasks": ["18.1", "18.2"] },
    { "id": 18, "tasks": ["18.3", "18.4", "19.1"] },
    { "id": 19, "tasks": ["19.2", "19.5"] },
    { "id": 20, "tasks": ["19.3", "19.4", "19.6"] }
  ]
}
```
