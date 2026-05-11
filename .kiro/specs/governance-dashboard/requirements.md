# Requirements Document

## Introduction

The AI Governance Dashboard provides centralized visibility into governance compliance across all projects using the ai-gov CLI. It consists of two deliverables: (1) a standalone Hub Server (`ai-governance-hub/`) with a REST API, SQLite database, and self-contained HTML dashboard deployed to Railway, and (2) modifications to the existing `ai-governance/` CLI to report telemetry events, generate pre-push hooks, write pre-commit logs, and update CI templates with hub-reporting steps.

## Glossary

- **Hub_Server**: The standalone Express.js server that receives, stores, and serves governance event data via REST API endpoints
- **Dashboard**: A single self-contained HTML file served by the Hub_Server that visualizes governance compliance data using Chart.js
- **Pre_Push_Hook_Generator**: A TypeScript module in the ai-governance CLI that generates a bash script to silently report metrics to the Hub_Server on git push
- **Pre_Commit_Logger**: The modification to the existing pre-commit hook generator that appends pass/fail entries to a local log file
- **CI_Reporter**: The additions to CI template generators that send PR compliance reports to the Hub_Server
- **Hub_Config_Reader**: A utility module that reads `.ai-gov/config.json` for hub connection settings
- **Event**: A JSON payload representing a governance action (push, commit check, CI report) sent to the Hub_Server
- **PR_Report**: A JSON payload containing PR-level compliance results sent from CI pipelines
- **Compliance_Score**: A numeric value (0–100) calculated as `compliance_pct * 0.6 + hook_health_pct * 0.4`
- **Deduplication_Key**: A composite key derived from event attributes used to prevent duplicate entries within a 5-minute window
- **Developer_Hash**: A SHA-256 hash of the developer's email address used to identify developers without exposing PII

---

## Requirements

### Requirement 1: Hub Server API — Event Ingestion

**User Story:** As a governance administrator, I want the Hub_Server to receive and store governance events from developer machines and CI pipelines, so that I can track compliance across all projects.

#### Acceptance Criteria

1. WHEN a POST request is received at `/api/events` with a valid Bearer token and a JSON body containing all required fields (project: 1-100 chars, developer_hash: exactly 64 lowercase hex chars) passing validation, THE Hub_Server SHALL store the event in the SQLite database and return HTTP 201 with a JSON response body containing the stored event's identifier and a received timestamp
2. WHEN a POST request is received at `/api/events` without a Bearer token or with an invalid Bearer token, THE Hub_Server SHALL reject the request with HTTP 401 before processing the payload
3. WHEN a POST request is received at `/api/events` with a request body exceeding 100KB, THE Hub_Server SHALL reject the request with HTTP 413
4. WHEN a POST request is received at `/api/events` with a dedup_key matching an event already stored whose push_ts falls within the same 5-minute window (computed as sha256(project + developer_hash + branch + floor(push_ts / 300))), THE Hub_Server SHALL return HTTP 200 without creating a duplicate entry
5. IF the request body fails input validation (missing required fields, fields exceeding defined length limits, or fields not matching their specified format), THEN THE Hub_Server SHALL return HTTP 400 with a JSON response body containing an error message that identifies which field(s) failed validation and the nature of the failure
6. THE Hub_Server SHALL use prepared statements for all database operations to prevent SQL injection
7. IF the database is unavailable or a write operation fails after successful validation, THEN THE Hub_Server SHALL return HTTP 503 and SHALL NOT acknowledge the event as stored
8. WHEN a POST request is received at `/api/events` with a Content-Type header other than `application/json`, THE Hub_Server SHALL reject the request with HTTP 415
9. WHEN a POST request to `/api/events` includes an `ai_usage` object, THE Hub_Server SHALL validate that: `ai_platform` is one of "claude-code", "kiro", "mixed", or "manual"; `commands_used` is an array of at most 20 items each no longer than 64 characters; and `active_hooks_count` is an integer between 0 and 999 inclusive; if any `ai_usage` field fails validation THE Hub_Server SHALL return HTTP 400 with a message identifying the failing field

### Requirement 2: Hub Server API — PR Report Ingestion

**User Story:** As a governance administrator, I want the Hub_Server to receive PR compliance reports from CI pipelines, so that I can track pull request governance across teams.

#### Acceptance Criteria

1. WHEN a valid POST request is received at `/api/pr-reports` with a valid Bearer token and a payload containing all required fields (project, developer_hash) with valid values, THE Hub_Server SHALL store the PR report in the SQLite database and return HTTP 201
2. WHEN a POST request is received at `/api/pr-reports` without a valid Bearer token, THE Hub_Server SHALL reject the request with HTTP 401
3. IF the PR report payload is missing required fields (project, developer_hash), THEN THE Hub_Server SHALL return HTTP 400 with an error message indicating which fields are missing
4. IF the PR report payload contains field values that violate format constraints (developer_hash is not exactly 64 hexadecimal characters, platform is not one of github|gitlab|bitbucket|unknown, compliance_pct is not a float between 0.0 and 100.0 inclusive, or violations is not an array of strings with a maximum of 50 items each no longer than 256 characters), THEN THE Hub_Server SHALL return HTTP 400 with an error message indicating the validation failure
5. WHEN a valid PR report payload omits optional fields, THE Hub_Server SHALL apply default values: team defaults to "ungrouped", platform defaults to "unknown"
6. THE Hub_Server SHALL use prepared statements for all PR report database operations to prevent SQL injection

### Requirement 3: Hub Server API — Report Retrieval

**User Story:** As a governance administrator, I want to retrieve aggregated compliance data from the Hub_Server, so that the Dashboard can visualize governance health.

#### Acceptance Criteria

1. WHEN a GET request is received at `/api/report`, THE Hub_Server SHALL return HTTP 200 with a JSON response containing aggregated compliance data including per-project scores, per-team scores, per-developer activity, violations, and alerts
2. WHEN a `period` query parameter is provided (7d, 30d, 90d, all), THE Hub_Server SHALL filter results to the specified time window; WHEN no `period` parameter is provided, THE Hub_Server SHALL default to 30d
3. IF a `period` query parameter value is not one of (7d, 30d, 90d, all), THEN THE Hub_Server SHALL return HTTP 400 with an error message indicating the valid period options
4. THE Hub_Server SHALL calculate the Compliance_Score for each project as `round(compliance_pct * 0.6 + hook_health_pct * 0.4)` where hook_health_pct is 100 if the project's hook version matches the latest known version, and 0 otherwise
5. THE Hub_Server SHALL assign a status to each team based on its Compliance_Score: "healthy" if score >= 90, "review" if score >= 70 and < 90, "needs_attention" if score < 70
6. THE Hub_Server SHALL calculate the trend for each violation type by comparing the count in the first half of the selected period to the count in the second half: "up" if second_half > first_half * 1.1, "down" if second_half < first_half * 0.9, "stable" otherwise
7. THE Hub_Server SHALL generate alerts with severity "warning" for projects with no events in the last 14 days (ungoverned project alert)
8. THE Hub_Server SHALL generate alerts with severity "info" for projects whose hook version is older than the latest known version (outdated hooks alert)
9. WHEN bypass events are detected within the selected period, THE Hub_Server SHALL generate alerts with severity "critical" for each project-developer combination that has bypass events

### Requirement 4: Hub Server — Authentication and Security

**User Story:** As a governance administrator, I want the Hub_Server to authenticate all write requests and protect against common attacks, so that only authorized sources can submit data.

#### Acceptance Criteria

1. THE Hub_Server SHALL authenticate write endpoints (POST) using Bearer token comparison with `crypto.timingSafeEqual` to prevent timing attacks
2. IF the `AI_GOV_SECRET` environment variable is not set AND the `NODE_ENV` environment variable is set to `development`, THEN THE Hub_Server SHALL allow all write requests without authentication (dev mode) and log a warning on startup
3. IF a client exceeds 120 write requests per minute from a single IP address, THEN THE Hub_Server SHALL reject subsequent write requests with HTTP 429 until the current 1-minute window resets
4. IF a client exceeds 300 read requests per minute from a single IP address, THEN THE Hub_Server SHALL reject subsequent read requests with HTTP 429 until the current 1-minute window resets
5. THE Hub_Server SHALL use helmet middleware to set security headers including X-Frame-Options, Content-Security-Policy, Strict-Transport-Security, and X-Content-Type-Options
6. IF a request payload exceeds 100KB, THEN THE Hub_Server SHALL reject the request with HTTP 413
7. THE Hub_Server SHALL sanitize all input string fields before storage by stripping HTML tags, removing null bytes, and trimming leading and trailing whitespace

### Requirement 5: Hub Server — Health Check and Data Retention

**User Story:** As a platform operator, I want the Hub_Server to expose a health endpoint and automatically manage data retention, so that I can monitor uptime and control storage growth.

#### Acceptance Criteria

1. WHEN a GET request is received at `/api/health` and the database is accessible, THE Hub_Server SHALL return HTTP 200 with a JSON body containing a status field set to "ok", an uptime field with server uptime in seconds, and a ts field with the current Unix timestamp
2. WHEN the Hub_Server starts and every 24 hours thereafter, THE Hub_Server SHALL delete records older than 90 days (based on the received_at column) from both the events table and the pr_reports table
3. IF the database file is inaccessible at startup, THEN THE Hub_Server SHALL log an error and exit with a non-zero status code
4. IF a GET request is received at `/api/health` and the database query fails, THEN THE Hub_Server SHALL return HTTP 503
5. WHEN the Hub_Server receives a SIGTERM or SIGINT signal, THE Hub_Server SHALL close the database connection and shut down the process

### Requirement 6: Dashboard — Visualization and Navigation

**User Story:** As a governance administrator, I want a web-based dashboard that visualizes compliance data across teams and projects, so that I can quickly identify governance gaps.

#### Acceptance Criteria

1. THE Dashboard SHALL be a single self-contained HTML file with inline CSS and JavaScript
2. THE Dashboard SHALL display 7 navigation tabs: Overview, Teams, Projects, Developers, AI Usage, Violations, and Alerts, with the Overview tab selected by default on initial load
3. THE Dashboard SHALL use Chart.js for rendering charts and graphs
4. IF Chart.js fails to load, THEN THE Dashboard SHALL display all chart and graph data in tabular format with equivalent data visibility
5. THE Dashboard SHALL provide a period selector with options: 7d, 30d, 90d, and All, with 30d selected by default
6. THE Dashboard SHALL support pagination with 20 rows per page, column sorting (ascending and descending), and text-based filtering on all data tables
7. THE Dashboard SHALL render without horizontal scrolling, without overlapping elements, and without text truncation below 4 characters on viewport widths from 320px to 2560px
8. WHEN the user selects a navigation tab, THE Dashboard SHALL update the URL hash to reflect the active tab (e.g., #teams, #projects) and restore the corresponding tab view when the page is loaded with that hash
9. THE Dashboard SHALL color-code compliance scores as green for scores greater than or equal to 90, amber for scores greater than or equal to 70 and less than 90, and red for scores less than 70

### Requirement 7: Dashboard — Data Refresh and Security

**User Story:** As a governance administrator, I want the Dashboard to auto-refresh data and protect against XSS, so that I always see current information safely.

#### Acceptance Criteria

1. THE Dashboard SHALL auto-refresh data from the `/api/report` endpoint every 5 minutes using a request timeout of 10 seconds per fetch attempt
2. WHEN a data fetch fails, THE Dashboard SHALL retry with exponential backoff starting at 30 seconds, doubling the interval on each consecutive failure, capping at 300 seconds, and resetting the retry delay to 30 seconds upon a successful fetch
3. THE Dashboard SHALL render all dynamic content using `textContent` or an escaping function that replaces the characters `<`, `>`, `&`, `"`, and `'` with their corresponding HTML entities to prevent XSS
4. IF a data fetch fails, THEN THE Dashboard SHALL continue displaying the previously fetched data and show a banner indicating how long ago the data was last successfully updated
5. WHEN the Dashboard re-renders chart components on data refresh, THE Dashboard SHALL destroy existing chart instances before creating new ones to prevent memory leaks
6. IF the Hub_Server is unreachable, THEN THE Dashboard SHALL display an error indicator within the Dashboard viewport that is visible without scrolling

### Requirement 8: Pre-Push Hook Generator

**User Story:** As a developer, I want a pre-push git hook that silently reports governance metrics to the Hub_Server on every push, so that compliance data is collected without disrupting my workflow.

#### Acceptance Criteria

1. THE Pre_Push_Hook_Generator SHALL produce a bash script starting with `#!/usr/bin/env bash` that executes on `git push` events
2. THE Pre_Push_Hook_Generator SHALL produce a script that always exits with code 0 regardless of reporting success or failure (never blocks push)
3. WHEN the generated script executes, THE script SHALL read `.ai-gov/config.json` for hub URL, project name, team name, and platform using jq (preferred) or python3 (fallback)
4. WHEN the generated script executes, THE script SHALL hash the developer email using SHA-256 (via sha256sum on Linux or shasum -a 256 on macOS) before including it in the payload
5. IF neither sha256sum nor shasum is available, THEN THE script SHALL use a padded "unknown0…" constant string (64 chars) as the Developer_Hash
6. WHEN the generated script executes, THE script SHALL calculate compliance percentage from the last 20 entries of `.ai-gov/usage-logs/precommit.log` as (passed_count / total_count) * 100
7. IF `.ai-gov/usage-logs/precommit.log` does not exist, THEN THE script SHALL default to compliance_pct=100 and violations=[]
8. WHEN the generated script executes, THE script SHALL send the event payload via curl in a background subshell with --max-time 5 and --connect-timeout 3
9. WHEN the environment variable `AI_GOV_TELEMETRY` is set to `off`, THE generated script SHALL skip all reporting and exit 0 immediately
10. THE Pre_Push_Hook_Generator SHALL be implemented as a new file at `src/generators/git-hooks/pre-push.ts` exporting a `generatePrePush(hookVersion: string)` function
11. WHEN processing refs from stdin, THE script SHALL skip delete pushes (LOCAL_SHA = all zeros) and handle new branches (REMOTE_SHA = all zeros) by counting reachable commits capped at 50
12. THE script SHALL compute a dedup_key as sha256(project + developer_hash + branch + floor(push_ts / 300)) to prevent duplicate events within a 5-minute window

### Requirement 9: Pre-Commit Log Writing

**User Story:** As a developer, I want the pre-commit hook to log pass/fail results locally, so that the pre-push hook can calculate compliance from recent commit history.

#### Acceptance Criteria

1. WHEN the pre-commit hook completes execution with no blocking errors (exit 0), THE Pre_Commit_Logger SHALL append a log entry in the format `<unix_timestamp>|pass|<ai_platform>|<command>` to `.ai-gov/usage-logs/precommit.log`, where `<unix_timestamp>` is the output of `date +%s`, `<ai_platform>` is "claude-code", "kiro", or "manual", and `<command>` is the AI command name or an empty string for manual commits
2. WHEN the pre-commit hook completes execution with one or more blocking errors (exit 1), THE Pre_Commit_Logger SHALL append a log entry in the format `<unix_timestamp>|fail|<ai_platform>|<command>` to `.ai-gov/usage-logs/precommit.log`, where `<unix_timestamp>` is the output of `date +%s`, `<ai_platform>` is "claude-code", "kiro", or "manual", and `<command>` is the AI command name or an empty string for manual commits
3. WHEN the log file contains more than 500 entries after appending, THE Pre_Commit_Logger SHALL rotate the log by writing the most recent 500 entries to a temporary file and replacing the original log file via move operation
4. THE Pre_Commit_Logger SHALL append `|| true` to all logging and rotation operations so that failures in log writing never alter the commit exit code or delay the commit operation
5. IF the `.ai-gov/usage-logs/` directory does not exist, THEN THE Pre_Commit_Logger SHALL create it using `mkdir -p` with `|| true` before writing the log entry
6. THE Pre_Commit_Logger SHALL execute its logging logic after all governance checks complete but before the hook's exit statements

### Requirement 10: CI Template Hub Reporting

**User Story:** As a governance administrator, I want CI pipelines to report PR compliance results to the Hub_Server, so that I can track governance at the pull request level across all projects.

#### Acceptance Criteria

1. WHEN the `AI_GOV_HUB` environment variable is set, THE CI_Reporter SHALL add a step that runs `ai-gov pr-check --format json` and sends the JSON output via curl to the Hub_Server's `/api/pr-reports` endpoint with a maximum timeout of 10 seconds
2. THE CI_Reporter SHALL append `|| true` to all curl commands so that hub reporting failures never fail the CI pipeline
3. THE CI_Reporter SHALL generate platform-specific hub reporting steps for GitHub Actions, GitLab CI, and Bitbucket Pipelines templates, each using the platform's native environment variable syntax for hub URL and authentication secret. The CI generator functions SHALL accept an optional `hubUrl?: string` parameter; WHEN `hubUrl` is provided, the hub reporting step SHALL be included in the generated template; WHEN `hubUrl` is not provided or is empty, the hub reporting step SHALL be omitted entirely from the generated template
4. WHEN the `AI_GOV_HUB` environment variable is not set, THE CI_Reporter SHALL omit the hub reporting step from the generated CI template entirely
5. THE CI_Reporter SHALL compute a Developer_Hash by applying SHA-256 to the platform-specific actor identifier (GitHub actor, GitLab user login, or Bitbucket PR author concatenated with the platform name) and include only the hash in the PR report payload
6. THE CI_Reporter SHALL include in the PR report payload only the fields required by the Hub_Server PR report endpoint (project, team, platform, result, and developer_hash) and SHALL NOT include diff content, file contents, or source code

### Requirement 11: Hub Configuration Utility

**User Story:** As a developer, I want a shared utility for reading hub configuration, so that all components (pre-push hook, CLI, CI) use consistent connection settings.

#### Acceptance Criteria

1. WHEN `readHubConfig(projectDir)` is called and the file at `<projectDir>/.ai-gov/config.json` exists and contains a valid JSON object, THE Hub_Config_Reader SHALL return a HubConfig object with fields: `hub` (string), `project` (string), `team` (string), and `platform` (string), using the values from the parsed JSON
2. IF a field is missing from the parsed JSON object, THEN THE Hub_Config_Reader SHALL use the following default values: `team` defaults to `'ungrouped'`, `project` defaults to the basename of `projectDir`, `platform` defaults to `'unknown'`, and `hub` defaults to `''` (empty string)
3. IF `.ai-gov/config.json` does not exist, contains unparseable JSON, or parses to a non-object value (e.g., array, string, number, null), THEN THE Hub_Config_Reader SHALL return null without throwing an error
4. THE Hub_Config_Reader SHALL export a `readHubConfig(projectDir: string)` function with return type `HubConfig | null` from a module at `src/utils/hub-config.ts`
5. THE Hub_Config_Reader SHALL construct the configuration file path by joining `projectDir`, `'.ai-gov'`, and `'config.json'` using platform-appropriate path resolution

### Requirement 12: CLI Transparency and Gitignore Management

**User Story:** As a developer, I want the CLI to disclose hub connectivity after initialization and manage gitignore entries, so that I understand what telemetry is collected and local logs are not committed.

#### Acceptance Criteria

1. WHEN `ai-gov init` completes and a hub configuration is detected in `.ai-gov/config.json`, THE CLI SHALL display a transparency disclosure message listing the hub URL and the specific data reported: commit count, compliance percentage, and violation counts
2. WHEN `ai-gov init` generates pre-commit log infrastructure, THE CLI SHALL append `.ai-gov/usage-logs/` to the project's `.gitignore` file if the entry does not already exist
3. THE transparency disclosure SHALL state that no source code or commit messages are sent to the hub
4. THE transparency disclosure SHALL state that developer emails are hashed before transmission
5. THE transparency disclosure SHALL include instructions to disable telemetry by setting the environment variable `AI_GOV_TELEMETRY=off`
6. IF no hub configuration is detected in `.ai-gov/config.json` when `ai-gov init` completes, THEN THE CLI SHALL not display the transparency disclosure message
7. IF the project's `.gitignore` file does not exist and no `.git` directory is present, THEN THE CLI SHALL skip the `.ai-gov/usage-logs/` gitignore entry without error

### Requirement 13: Privacy and Data Minimization

**User Story:** As a developer, I want assurance that my personal information is protected, so that I can trust the governance system with my workflow data.

#### Acceptance Criteria

1. THE Pre_Push_Hook_Generator SHALL ensure that no source code content, file paths, or code snippets are included in event payloads
2. THE Pre_Push_Hook_Generator SHALL ensure that no commit messages or diff content are included in event payloads
3. THE Pre_Push_Hook_Generator SHALL hash developer email addresses with SHA-256 before transmission, producing an irreversible Developer_Hash that replaces the raw email in all outbound payloads
4. THE Pre_Push_Hook_Generator SHALL construct event payloads containing only the following fields: project name, team, platform, developer_hash, hook_version, commit_count, compliance_pct, bypass flag, violation type names, branch name, push_ts, dedup_key, and ai_usage
5. WHILE the Hub_Server is running in production, THE Hub_Server SHALL accept connections only over HTTPS transport for all API endpoints
6. THE CI_Reporter SHALL not include diff content, file contents, or file paths in PR report payloads
7. IF the hub URL configured in `.ai-gov/config.json` does not use the HTTPS scheme, THEN THE Pre_Push_Hook_Generator SHALL skip transmission and log a warning to stderr

### Requirement 14: Hub Server Deployment

**User Story:** As a platform operator, I want the Hub_Server to be deployable to Railway with persistent storage, so that governance data survives container restarts.

#### Acceptance Criteria

1. THE Hub_Server SHALL store the SQLite database at the path specified by the `DB_PATH` environment variable, defaulting to `./data.db` when `DB_PATH` is not set
2. WHEN a GET request is received at `/api/health`, THE Hub_Server SHALL return HTTP 200 within 10 seconds of receiving the request
3. WHEN the Hub_Server starts, THE Hub_Server SHALL run idempotent database migrations using CREATE TABLE IF NOT EXISTS to create all required tables before accepting HTTP requests
4. THE Hub_Server SHALL read the `PORT` environment variable to determine the listening port (defaulting to 3000), the `DB_PATH` environment variable for the database file location (defaulting to `./data.db`), and the `AI_GOV_SECRET` environment variable for the Bearer token used to authenticate write requests
5. IF the `AI_GOV_SECRET` environment variable is not set AND the `NODE_ENV` environment variable is NOT set to `development`, THEN THE Hub_Server SHALL refuse to start and exit with a non-zero status code
6. WHEN the Hub_Server receives a SIGTERM or SIGINT signal, THE Hub_Server SHALL stop accepting new connections, complete in-flight requests, close the database connection, and exit within 5 seconds
7. WHEN the Hub_Server opens the SQLite database, THE Hub_Server SHALL enable WAL journal mode, set synchronous to NORMAL, and enable foreign key enforcement

### Requirement 15: AI Usage Telemetry — Data Collection

**User Story:** As a governance administrator, I want to track AI-assisted development activity across teams, so that I can measure AI tooling adoption and understand how developers use Claude Code commands and Kiro hooks.

#### Acceptance Criteria

1. WHEN the pre-commit hook executes, THE Pre_Commit_Logger SHALL detect whether the commit was AI-assisted by checking for the presence of `.claude/` session artifacts or AI-generated commit message markers (e.g., prefix patterns like "feat:", "fix:" from AI workflows)
2. WHEN an AI-assisted commit is detected, THE Pre_Commit_Logger SHALL append the AI platform identifier ("claude-code" or "kiro") and the command name (e.g., "new-feature", "fix", "refactor", "explore", "hotfix") to the log entry in the format `<timestamp>|<pass/fail>|<ai_platform>|<command>`
3. WHEN a non-AI-assisted commit is detected, THE Pre_Commit_Logger SHALL append the log entry in the format `<timestamp>|<pass/fail>|manual|` (empty command field)
4. THE Pre_Push_Hook_Generator SHALL read AI usage data from the precommit.log and include an `ai_usage` object in the event payload containing: `ai_assisted` (boolean), `ai_assisted_count` (integer count of AI-assisted commits in the push), `commands_used` (array of distinct command names used), `ai_platform` (string: "claude-code", "kiro", or "mixed"), and `active_hooks_count` (integer count of active governance hooks in the project)
5. THE Pre_Push_Hook_Generator SHALL detect active hooks by counting executable AI agent hook scripts in `.claude/hooks/` (Claude Code agent hooks, `.js` files) or `.kiro/hooks/` (Kiro hooks, `.kiro.hook` files) directories; git hook scripts in `.claude/git-hooks/` SHALL NOT be counted
6. THE event payload `ai_usage` object SHALL NOT include any prompt content, AI responses, generated code, or file contents — only command names and counts
7. WHEN the environment variable `AI_GOV_TELEMETRY` is set to `off`, THE Pre_Push_Hook_Generator SHALL skip all AI usage data collection along with the rest of telemetry reporting

### Requirement 16: AI Usage Telemetry — Dashboard Visualization

**User Story:** As a governance administrator, I want the Dashboard to display AI usage metrics alongside compliance data, so that I can track AI adoption trends and identify teams that could benefit from AI tooling.

#### Acceptance Criteria

1. THE Dashboard SHALL include an "AI Usage" navigation tab that displays AI-assisted development metrics
2. THE AI Usage tab SHALL display the following aggregate metrics: total AI-assisted commits (count and percentage of all commits), most-used AI commands (ranked list), AI platform distribution (claude-code vs kiro vs manual), and average hook coverage per project
3. THE AI Usage tab SHALL display a per-team breakdown showing: team name, AI adoption rate (% of commits that are AI-assisted), most-used command per team, and trend (up/down/stable compared to previous period)
4. THE AI Usage tab SHALL display a per-developer breakdown (using Developer_Hash) showing: commit count, AI-assisted count, AI adoption rate, and primary AI platform used
5. THE Hub_Server GET /api/report response SHALL include an `ai_usage` section containing aggregated AI telemetry data: total_ai_commits, ai_adoption_pct, commands_distribution (object mapping command names to counts), platform_distribution (object mapping platform names to counts), and per-team AI adoption rates
6. THE Hub_Server SHALL store the `ai_usage` object from event payloads in a new `ai_usage` TEXT column (JSON) in the events table
7. WHEN calculating AI adoption trends, THE Hub_Server SHALL compare AI adoption rates between the first half and second half of the selected period using the same trend logic as violation trends (up if second > first * 1.1, down if second < first * 0.9, stable otherwise)
8. THE Dashboard AI Usage tab SHALL include a line chart showing AI adoption rate over time (daily granularity) for the selected period
9. THE Hub_Server GET /api/report response SHALL include in the `ai_usage` section a `compliance_comparison` object containing `ai_pass_rate` (percentage of AI-assisted commits that passed pre-commit checks within the selected period) and `manual_pass_rate` (percentage of manual commits that passed pre-commit checks within the selected period); either value SHALL be null when no entries exist for that category in the selected period
