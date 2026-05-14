# Requirements Document

## Introduction

The MCP Governance + Jira Sync feature provides two tightly coupled capabilities for the `ai-gov` CLI. Feature 1 (`ai-gov mcp`) governs how MCP server tokens are managed across a team — ensuring no tokens are committed to git while each developer configures their own credentials locally. Tokens are scoped as either "global" (stored once in `~/.config/ai-gov/.env.mcp.global` and shared across all projects) or "project" (stored in `.env.mcp` per project root), eliminating redundant prompts when a developer works across multiple projects. Feature 2 (`/jira` command + Kiro hook) reads a spec's `tasks.md` with time estimates and creates Jira stories and sub-tasks via the Jira MCP server. Feature 2 depends on Feature 1 because Jira tokens must be securely configured before the sync command can call the Jira MCP server. Both features target Claude Code and Kiro agents.

## Glossary

- **MCP_Governance**: The `ai-gov mcp` command group that manages MCP server token configuration across a team without committing secrets to version control.
- **Tool_Catalog**: A static array of 9 supported MCP tool definitions (Jira, Figma, Zeplin, PostgreSQL, GitHub, Linear, Notion, Slack, Sentry) with their transport, variable, scope, and OAuth metadata.
- **Org_Var**: A shared environment variable whose value is the same for all team members (e.g., `ATLASSIAN_SITE_NAME`) and is baked as a literal in `.mcp.json`.
- **Personal_Var**: A developer-specific secret environment variable (e.g., `ATLASSIAN_API_TOKEN`) referenced as a `${VAR}` placeholder in `.mcp.json`. Each Personal_Var has a `scope` field set to either `'global'` (stored in Global_Env_Mcp, shared across all projects) or `'project'` (stored in Env_Mcp, per-project).
- **MCP_Config**: The `.mcp.json` file containing MCP server entries with transport configuration, environment variable placeholders, and connection details.
- **Env_Mcp**: The `.env.mcp` file in the project root containing project-scoped developer-specific secret values (e.g., `DATABASE_URL`), excluded from version control via `.gitignore`.
- **Global_Env_Mcp**: The `~/.config/ai-gov/.env.mcp.global` file containing global-scoped developer tokens (e.g., `ATLASSIAN_API_TOKEN`, `GITHUB_TOKEN`) that are shared across all projects. Set once per developer, loaded automatically in every project via `.envrc`.
- **Env_Example**: The `.env.mcp.example` file containing empty variable templates with documentation comments, committed to version control as a reference.
- **Envrc**: The `.envrc` file used by direnv to load environment variables. Contains two `dotenv_if_exists` lines: the Global_Env_Mcp path first, then the project Env_Mcp path, so that project values can override global values.
- **OAuth_Tool**: An MCP tool (Notion, Slack, Sentry) that authenticates via browser-based OAuth flow and requires no token prompts during onboarding.
- **Jira_Sync**: The feature that reads spec files and creates Jira stories and sub-tasks via the Jira MCP server, triggered by the `/jira` slash command (Claude Code) or a userTriggered hook (Kiro).
- **Jira_Metadata**: The `.jira` JSON file stored per spec directory, tracking the story ID and array of created sub-task IDs for re-run safety.
- **Phase**: A numbered section in `tasks.md` (denoted by `## Phase N` headings) grouping related implementation tasks.
- **Time_Estimate**: A bracketed duration label in task titles (e.g., `[~10min]`, `[~2h]`) indicating estimated implementation time.
- **Shared_Prompt**: The `buildJiraSyncPrompt` function that produces the single source of truth prompt content used by both the Claude Code `/jira` command and the Kiro userTriggered hook.

## Requirements

### Requirement 1: MCP Tool Catalog

**User Story:** As a framework maintainer, I want a centralized catalog of supported MCP tools with their configuration metadata, so that all MCP commands operate from a single source of truth.

#### Acceptance Criteria

1. THE Tool_Catalog SHALL contain exactly 9 tool definitions: Jira, Figma, Zeplin, PostgreSQL, GitHub, Linear, Notion, Slack, and Sentry.
2. THE Tool_Catalog SHALL define for each tool: a unique string identifier (lowercase, alphanumeric, 1–20 characters), a display name (1–50 characters), a transport type (one of "stdio" or "http"), an array of zero or more Org_Var definitions each containing a variable name and a user-facing prompt string, an array of zero or more Personal_Var definitions each containing a variable name, a user-facing prompt string, a token URL string, and a scope field (one of "global" or "project"), and an OAuth flag (boolean, default false).
3. IF a tool has `oauthFlow` set to true, THEN THE Tool_Catalog SHALL define an empty Personal_Var array for that tool.
4. IF a tool uses stdio transport, THEN THE Tool_Catalog SHALL define a `package` field containing the npm package name for the MCP server.
5. IF a tool uses http transport and does not have `oauthFlow` set to true, THEN THE Tool_Catalog SHALL define a `url` field containing the server endpoint.
6. THE Tool_Catalog SHALL define PostgreSQL's `DATABASE_URL` variable with a `passAsArg` flag set to true, indicating the value is passed as a command argument rather than an environment variable.
7. IF a consumer queries the Tool_Catalog with a tool identifier that does not match any of the 9 defined tools, THEN THE Tool_Catalog SHALL return an error indicating the tool identifier is not recognized.
8. THE Tool_Catalog SHALL define Jira, Figma, Zeplin, GitHub, and Linear Personal_Vars with scope set to "global", and PostgreSQL Personal_Vars with scope set to "project".

### Requirement 2: MCP Config Generation

**User Story:** As a developer, I want `.mcp.json` entries generated correctly from the catalog, so that MCP servers can resolve credentials at runtime without exposing secrets.

#### Acceptance Criteria

1. WHEN `buildMcpEntry` is called for a tool with Org_Vars, THE MCP_Governance SHALL insert each Org_Var value as a string literal (not a placeholder) in the generated server entry's `env` object.
2. WHEN `buildMcpEntry` is called for a tool with Personal_Vars, THE MCP_Governance SHALL reference each Personal_Var name using the format `${VAR_NAME}` as a placeholder value in the generated server entry.
3. WHEN `buildMcpEntry` is called for a stdio tool, THE MCP_Governance SHALL produce an entry with `type: "stdio"`, a `command` field set to `"npx"`, and an `args` array containing at minimum the package name from the catalog definition.
4. WHEN `buildMcpEntry` is called for an http tool, THE MCP_Governance SHALL produce an entry with `type: "http"` and a `url` field set to the URL from the catalog definition.
5. WHEN `buildMcpEntry` is called for GitHub, THE MCP_Governance SHALL include an `Authorization` header with value `Bearer ${GITHUB_TOKEN}`.
6. WHEN `buildMcpEntry` is called for PostgreSQL, THE MCP_Governance SHALL include `DATABASE_URL` in the `args` array rather than in the `env` object.
7. IF `buildMcpEntry` receives an Org_Var key that does not exist in the tool's catalog definition, THEN THE MCP_Governance SHALL throw an error indicating the invalid key name.
8. WHEN `buildMcpEntry` is called for an OAuth tool (a tool with no Personal_Vars and no Org_Vars), THE MCP_Governance SHALL produce an entry with `type: "http"` and a `url` field, with no `env` object and no `headers` object.
9. IF `buildMcpEntry` receives a tool ID that does not exist in the MCP catalog, THEN THE MCP_Governance SHALL throw an error indicating the unrecognized tool ID.

### Requirement 3: MCP Init Command

**User Story:** As a team lead, I want to run `ai-gov mcp init` once per project to set up the MCP configuration scaffold, so that developers can onboard their tokens against a known structure.

#### Acceptance Criteria

1. WHEN `ai-gov mcp init` is run, THE MCP_Governance SHALL present an interactive checkbox prompt listing all 9 tools from the Tool_Catalog by display name and category label.
2. WHEN tools are selected, THE MCP_Governance SHALL prompt for each selected tool's Org_Var values (if any) using an input prompt that rejects empty or whitespace-only input and re-prompts until a non-blank value is provided.
3. WHEN tool selection and Org_Var collection are complete, THE MCP_Governance SHALL write a `.mcp.json` file containing an `_aigov` metadata object (with version and selected tool IDs) and a `mcpServers` object with entries for all selected tools, where Org_Var values are stored as literals and Personal_Var values are stored as `${VAR_NAME}` placeholder strings.
4. WHEN tool selection is complete, THE MCP_Governance SHALL write a `.env.mcp.example` file listing one empty assignment line per Personal_Var for each non-OAuth selected tool, with a comment block per tool documenting the token acquisition URL.
5. WHEN tool selection is complete, THE MCP_Governance SHALL write a `.envrc` file containing two `dotenv_if_exists` lines: the first loading `~/.config/ai-gov/.env.mcp.global` (global tokens) and the second loading `.env.mcp` (project tokens), in that order so that project values can override global values.
6. WHEN tool selection is complete, THE MCP_Governance SHALL append `.env.mcp` to the project's `.gitignore` file if not already present, creating the `.gitignore` file if it does not exist.
7. WHEN OAuth_Tools are selected, THE MCP_Governance SHALL include their server entries in `.mcp.json` without generating any Personal_Var lines in `.env.mcp.example`.
8. IF `.mcp.json` already exists and the `--overwrite` flag is not provided, THEN THE MCP_Governance SHALL display a warning and prompt for confirmation before overwriting.
9. IF the user declines the overwrite confirmation, THEN THE MCP_Governance SHALL abort without modifying any files.
10. IF the user selects zero tools from the checkbox prompt, THEN THE MCP_Governance SHALL display an informational message indicating no tools were selected and exit without writing any files.
11. WHEN `ai-gov mcp init` completes successfully, THE MCP_Governance SHALL print a summary listing the files created and the recommended next steps (review, git add, commit, push, and instruct developers to run `mcp onboard`).

### Requirement 4: MCP Onboard Command

**User Story:** As a developer joining a project, I want to run `ai-gov mcp onboard` to set my personal tokens for all configured MCP tools, so that I can use MCP servers locally without being re-prompted for tokens I've already set globally.

#### Acceptance Criteria

1. WHEN `ai-gov mcp onboard` is run, THE MCP_Governance SHALL read the existing `.mcp.json` to determine which tools listed in the `mcpServers` section match entries in the Tool_Catalog.
2. WHEN tools are identified, THE MCP_Governance SHALL prompt the developer with a confirmation prompt per tool (e.g., "Do you use [tool]?") and, for each confirmed tool, prompt for each Personal_Var value using password-masked input; if the developer declines a tool, THE MCP_Governance SHALL skip that tool and display a message indicating the tool will not be available.
3. WHEN a Personal_Var has scope "global", THE MCP_Governance SHALL check the Global_Env_Mcp file first; if the variable is already set in the global file, THE MCP_Governance SHALL display a checkmark indicator and skip prompting for that variable.
4. WHEN a Personal_Var has scope "project", THE MCP_Governance SHALL check the project Env_Mcp file; if the variable is already set in the project file, THE MCP_Governance SHALL display a checkmark indicator and skip prompting for that variable.
5. WHEN global-scoped tokens are collected, THE MCP_Governance SHALL write those values to the Global_Env_Mcp file (`~/.config/ai-gov/.env.mcp.global`) using KEY=VALUE format with comment headers grouping variables by tool.
6. WHEN project-scoped tokens are collected, THE MCP_Governance SHALL write those values to the project Env_Mcp file (`.env.mcp`) using KEY=VALUE format with comment headers grouping variables by tool.
7. WHEN a developer runs `ai-gov mcp onboard` on a second project, THE MCP_Governance SHALL detect global-scoped tokens already set in Global_Env_Mcp and display them with a checkmark indicator without re-prompting, while still prompting for project-scoped tokens that are not set in the new project's Env_Mcp.
8. WHEN a developer runs `ai-gov mcp onboard` a second time on the same project, THE MCP_Governance SHALL display already-set tokens (from both Global_Env_Mcp and Env_Mcp) with a checkmark indicator and skip prompting for those variables unless the developer selects a re-enter option when prompted; previously skipped tools SHALL be re-offered for configuration.
9. WHEN OAuth_Tools are encountered during onboarding, THE MCP_Governance SHALL skip them without prompting and display a message indicating they authenticate via browser.
10. WHEN custom server entries exist in `.mcp.json` that are not in the Tool_Catalog, THE MCP_Governance SHALL leave those entries untouched and not prompt for their configuration.
11. IF `.mcp.json` does not exist in the project directory or contains no `mcpServers` section, THEN THE MCP_Governance SHALL exit with a non-zero exit code and display an error message indicating that `ai-gov mcp init` must be run first.
12. WHEN onboarding completes, THE MCP_Governance SHALL display a summary showing the count of tools configured, the count of tools skipped, and instructions for loading tokens into the shell.

### Requirement 5: MCP Validate Command

**User Story:** As a developer or CI pipeline, I want to run `ai-gov mcp validate` to verify all required environment variables are set across both global and project env files, so that MCP servers will function correctly at runtime.

#### Acceptance Criteria

1. WHEN `ai-gov mcp validate` is run, THE MCP_Governance SHALL read the `.mcp.json` file in the target directory and check that every Personal_Var for every configured tool is defined and non-empty by merging values from both the Global_Env_Mcp file and the project Env_Mcp file (with project values taking precedence over global values on conflict).
2. WHEN all required variables for all configured tools are present and non-empty in the merged environment, THE MCP_Governance SHALL exit with code 0 and display a per-tool summary indicating each tool's validation status.
3. IF one or more required variables are missing or empty in the merged environment, THEN THE MCP_Governance SHALL exit with code 1 and display the names of all missing variables grouped by tool name, indicating whether each missing variable is expected in the global file or the project file based on its scope.
4. IF no `.mcp.json` file exists in the target directory, THEN THE MCP_Governance SHALL exit with code 1 and display an error message indicating that no MCP configuration was found.
5. WHEN validating, THE MCP_Governance SHALL skip OAuth_Tools (tools with no Personal_Vars, such as Notion, Slack, and Sentry) entirely and not report them as failures.
6. IF a tool referenced in `.mcp.json` is not found in the Tool_Catalog, THEN THE MCP_Governance SHALL skip that tool with a warning message and continue validating remaining tools without affecting the exit code of otherwise-passing validations.

### Requirement 6: MCP Update-Token Command

**User Story:** As a developer, I want to update a single tool's tokens without re-running the full onboard flow, so that I can quickly fix expired credentials with values written to the correct scope file.

#### Acceptance Criteria

1. WHEN `ai-gov mcp update-token --tool <id>` is run and the tool exists in the Tool_Catalog and has Personal_Var values, THE MCP_Governance SHALL prompt the developer for each of the specified tool's Personal_Var values, pre-indicating current values as set without revealing them, and exit with code 0 after all values are collected.
2. WHEN new values are provided for a tool whose Personal_Vars have scope "global", THE MCP_Governance SHALL update only the specified tool's entries in the Global_Env_Mcp file (`~/.config/ai-gov/.env.mcp.global`), preserving all other tool entries and comment headers unchanged.
3. WHEN new values are provided for a tool whose Personal_Vars have scope "project", THE MCP_Governance SHALL update only the specified tool's entries in the project Env_Mcp file (`.env.mcp`), preserving all other tool entries and comment headers unchanged.
4. IF the specified tool identifier does not match any tool in the Tool_Catalog, THEN THE MCP_Governance SHALL display an error message listing valid tool identifiers and exit with code 1.
5. IF the specified tool is an OAuth_Tool, THEN THE MCP_Governance SHALL display a message indicating the tool uses OAuth and does not require token updates, and exit with code 0 without prompting.
6. IF the target env file (Global_Env_Mcp for global-scoped tools, or Env_Mcp for project-scoped tools) does not exist when the command is run, THEN THE MCP_Governance SHALL create the file and write the new values to it.

### Requirement 7: Environment File Management

**User Story:** As a developer, I want `.env.mcp` and global env files to be read and written reliably with proper formatting and merge behavior, so that token values are preserved correctly across operations and projects.

#### Acceptance Criteria

1. WHEN `readEnvMcp` is called on a non-existent file, THE MCP_Governance SHALL return an empty object without throwing an error.
2. WHEN `readEnvMcp` is called on a file containing `KEY=value` lines, THE MCP_Governance SHALL return an object mapping each key to its value as strings.
3. WHEN `readEnvMcp` encounters comment lines starting with `#`, THE MCP_Governance SHALL ignore those lines and not include them in the returned object.
4. WHEN `readEnvMcp` encounters a value containing `=` characters, THE MCP_Governance SHALL split only on the first `=` and preserve the remainder as the value (e.g., `DB_URL=postgres://host?opt=1` yields key `DB_URL` with value `postgres://host?opt=1`).
5. WHEN `readEnvMcp` encounters empty lines or lines containing only whitespace, THE MCP_Governance SHALL skip those lines without error.
6. WHEN `writeEnvMcp` is called, THE MCP_Governance SHALL group variables by tool with comment headers in the format `# [Tool Display Name]` identifying each tool section, separated by blank lines.
7. FOR ALL valid key-value pairs where keys match `[A-Z_][A-Z0-9_]*` and values do not contain newline characters, writing with `writeEnvMcp` then reading with `readEnvMcp` SHALL produce an equivalent object (round-trip property).
8. WHEN `readEnvMcp` is called with merge mode enabled, THE MCP_Governance SHALL read both the Global_Env_Mcp file and the project Env_Mcp file, merging them into a single object where project values take precedence over global values on key conflict.
9. WHEN `writeEnvMcp` is called with scope "global", THE MCP_Governance SHALL write to the Global_Env_Mcp file path (`~/.config/ai-gov/.env.mcp.global`), creating the directory `~/.config/ai-gov/` if it does not exist.
10. WHEN `writeEnvMcp` is called with scope "project", THE MCP_Governance SHALL write to the Env_Mcp file (`.env.mcp`) in the specified project directory.

### Requirement 8: Global Environment File Management

**User Story:** As a developer working across multiple projects, I want a dedicated global environment file module that manages user-level tokens in `~/.config/ai-gov/.env.mcp.global`, so that I set tokens once and they are available in every project without re-prompting.

#### Acceptance Criteria

1. WHEN `getGlobalEnvPath` is called, THE MCP_Governance SHALL return the absolute path `~/.config/ai-gov/.env.mcp.global` resolved against the current user's home directory.
2. WHEN `readGlobalEnv` is called and the Global_Env_Mcp file does not exist, THE MCP_Governance SHALL return an empty object without throwing an error.
3. WHEN `readGlobalEnv` is called and the Global_Env_Mcp file exists, THE MCP_Governance SHALL parse it using the same KEY=VALUE format as `readEnvMcp` and return an object mapping each key to its value.
4. WHEN `writeGlobalEnv` is called with a set of key-value pairs, THE MCP_Governance SHALL merge the provided values with existing values in the Global_Env_Mcp file (preserving keys not present in the new set) and write the merged result back to the file.
5. WHEN `writeGlobalEnv` is called and the directory `~/.config/ai-gov/` does not exist, THE MCP_Governance SHALL create the directory (including parent directories) before writing the file.
6. WHEN `ensureGlobalEnvDir` is called, THE MCP_Governance SHALL create the `~/.config/ai-gov/` directory if it does not already exist, and take no action if it already exists.
7. FOR ALL valid key-value pairs where keys match `[A-Z_][A-Z0-9_]*` and values do not contain newline characters, calling `writeGlobalEnv` then `readGlobalEnv` SHALL produce an object containing all written key-value pairs (round-trip property).
8. WHEN `writeGlobalEnv` is called multiple times with different key sets, THE MCP_Governance SHALL preserve keys from prior writes that are not overwritten by subsequent writes (additive merge behavior).

### Requirement 9: Task Estimates Steering File Generation

**User Story:** As a developer, I want a task-estimates steering file generated during `ai-gov init`, so that AI agents produce time estimates in a consistent format when creating task lists.

#### Acceptance Criteria

1. WHEN `generateTaskEstimates` is called with a GovernanceConfig, THE generator SHALL return steering file content containing a size-to-time mapping guide listing all four categories: Small (minutes-scale tasks), Medium (under 1 hour), Large (1–4 hours), and Very Large (half-day or more).
2. THE generated content SHALL include the bracket format notation `[~Xmin]` or `[~Xh]` as the required estimate label format, and SHALL include the short-form size markers `[S]`, `[M]`, `[L]` within the mapping guide.
3. THE generated content SHALL include at least one example task title per size category demonstrating the estimate format (e.g., `"Add string resources [~10min]"`).
4. THE generated content SHALL NOT contain template placeholder patterns (strings matching `_replace_`, `TODO:`, `FIXME:`, `XXX:`, or `{{...}}` patterns).
5. THE generated content SHALL have a length greater than 500 characters.
6. WHEN `generateTaskEstimates` is called with different stack configurations, THE generator SHALL produce valid output for all supported stacks containing the same structural elements (size categories, format notation, and examples).

### Requirement 10: Jira Sync Shared Prompt

**User Story:** As a framework maintainer, I want a single `buildJiraSyncPrompt` function that produces the prompt content for both Claude Code and Kiro, so that the Jira sync workflow logic is maintained in one place.

#### Acceptance Criteria

1. THE Shared_Prompt SHALL instruct the agent to scan the `.kiro/specs/` and `specs/` directories for subdirectories containing a `tasks.md` file, and present discovered specs as a numbered table with columns for spec name, task count (number of `- [ ]` lines), and total estimate (sum of `[~Xmin]` and `[~Xh]` values).
2. WHEN only one spec is discovered, THE Shared_Prompt SHALL instruct the agent to select it automatically without prompting.
3. THE Shared_Prompt SHALL instruct the agent to prompt for a Jira ticket ID (e.g., `PROJECT-123`) or offer to create a new story.
4. THE Shared_Prompt SHALL instruct the agent to verify the ticket exists via the `jira_get` MCP tool call.
5. THE Shared_Prompt SHALL instruct the agent to read the Jira_Metadata file to determine which sub-tasks have already been created.
6. THE Shared_Prompt SHALL instruct the agent to present phases as a checkbox selection, marking phases whose tasks are all already tracked in the Jira_Metadata `subtasks` array as completed and non-selectable.
7. THE Shared_Prompt SHALL instruct the agent to create sub-tasks with the title format `"[task description] [~Xmin]"` (or `[~Xh]` for hour-based estimates) and the parent set to the story ticket ID.
8. THE Shared_Prompt SHALL instruct the agent to update the Jira_Metadata file by appending new sub-task IDs to the `subtasks` array without removing existing entries.
9. THE Shared_Prompt SHALL instruct the agent to offer an optional comment step after sub-task creation.
10. WHEN a ticket is not found, THE Shared_Prompt SHALL instruct the agent to offer creating a new story from `requirements.md` (title from first `#` heading, description from acceptance criteria section), or to re-prompt for a different ticket ID, or to cancel and exit the workflow.
11. IF no spec directories containing `tasks.md` are discovered, THEN THE Shared_Prompt SHALL instruct the agent to display an error message indicating no specs with tasks were found and exit the workflow without prompting for a ticket ID.
12. THE Shared_Prompt SHALL reference the Jira_Metadata file format as `{"storyId": "<ID>", "subtasks": ["<ID>", ...]}`.

### Requirement 11: Claude Code Jira Command Generation

**User Story:** As a Claude Code user, I want a `/jira` slash command generated during `ai-gov init`, so that I can trigger Jira sync from within Claude Code.

#### Acceptance Criteria

1. WHEN `generateJiraCommand` is called with a `GovernanceConfig` parameter, THE generator SHALL return a markdown string whose first line is exactly `# /jira`.
2. THE generated command content SHALL contain the complete string output of `buildJiraSyncPrompt(config)` as a substring following the command heading.
3. THE generated command content SHALL contain the literal string `jira_get` (the MCP tool call name).
4. THE generated command content SHALL contain the literal string `.jira` (the metadata file reference).
5. THE generated command content SHALL contain the literal strings `storyId` and `subtasks` (the metadata fields).
6. THE generated command content SHALL contain the literal string `[~` (the estimate format pattern).
7. THE generated command content SHALL NOT contain the string `"when":` and SHALL NOT contain the string `"userTriggered"` (Kiro hook JSON artifacts).
8. WHEN `generateJiraCommand` is called with different stack configurations (e.g., flutter vs nodejs), THE generator SHALL return identical output regardless of stack, since the command content is agent-agnostic.

### Requirement 12: Kiro Jira Sync Hook Generation

**User Story:** As a Kiro user, I want a userTriggered hook for Jira sync generated during `ai-gov init`, so that I can trigger Jira sync from the Kiro hooks panel.

#### Acceptance Criteria

1. WHEN `generateWorkflowJiraSync` is called with a valid `GovernanceConfig`, THE generator SHALL return a string that parses as valid JSON via `JSON.parse` without throwing an error.
2. THE generated JSON SHALL have a `name` field set to the string `"Jira Sync"`.
3. THE generated JSON SHALL have a `when` object with a `type` field set to the string `"userTriggered"`.
4. THE generated JSON SHALL have a `then` object with a `type` field set to the string `"askAgent"`.
5. THE generated JSON `then.prompt` field SHALL contain the exact string returned by `buildJiraSyncPrompt` called with the same `GovernanceConfig` argument.
6. THE generated JSON `then.prompt` field SHALL contain each of the following substrings: `jira_get`, `.jira`, `storyId`, and `[~`.
7. WHEN `generateAllKiroHooks` is called, THE system SHALL write the output of `generateWorkflowJiraSync` to a file named `workflow-jira-sync.kiro.hook` in the `.kiro/hooks/` directory.
8. THE generated JSON SHALL include a `version` field whose value equals the `hookVersion` property from the provided `GovernanceConfig`.

### Requirement 13: Jira Sync Re-Run Safety

**User Story:** As a developer, I want subsequent runs of `/jira` on the same spec to only create tasks that haven't been created yet, so that I don't get duplicate sub-tasks in Jira.

#### Acceptance Criteria

1. WHEN the Jira_Metadata file exists for a spec, THE Shared_Prompt SHALL instruct the agent to read it, parse the JSON, and identify already-created sub-task IDs from the `subtasks` array.
2. IF the Jira_Metadata file exists but contains invalid JSON or is missing the `subtasks` array, THEN THE Shared_Prompt SHALL instruct the agent to display an error message indicating the metadata file is corrupt and halt the sync without creating any sub-tasks.
3. WHEN presenting phases for selection, THE Shared_Prompt SHALL instruct the agent to mark phases whose tasks are all already tracked in the Jira_Metadata as completed and non-selectable, and to present phases with a mix of created and uncreated tasks as partially completed and selectable for the remaining uncreated tasks only.
4. WHEN sub-tasks are created, THE Shared_Prompt SHALL instruct the agent to append each new sub-task ID to the existing `subtasks` array in the Jira_Metadata file immediately after each individual sub-task is successfully created, without removing existing entries, so that already-created IDs are preserved even if a subsequent creation fails.
5. WHEN the Jira_Metadata file does not exist, THE Shared_Prompt SHALL instruct the agent to create it after the first successful story or sub-task creation, initializing it with a JSON object containing `storyId` set to the parent story ticket ID and `subtasks` set to an array of the newly created sub-task IDs.

### Requirement 14: Agent Integration — File Generation

**User Story:** As a developer, I want the Jira sync and task estimates files generated automatically during `ai-gov init` and `ai-gov upgrade`, so that both agents are ready to use without manual setup.

#### Acceptance Criteria

1. WHEN `ai-gov init --agent claude-code` is run, THE CLI SHALL generate `.claude/commands/jira.md` containing the exact output of `generateJiraCommand(config)`.
2. WHEN `ai-gov init --agent claude-code` is run, THE CLI SHALL generate `.claude/steering/task-estimates.md` containing the exact output of `generateTaskEstimates(config)`.
3. WHEN `ai-gov init --agent kiro` is run, THE CLI SHALL generate a `.kiro/hooks/workflow-jira-sync.kiro.hook` file containing valid JSON with `when.type` set to `"userTriggered"` and `then.type` set to `"askAgent"`.
4. WHEN `ai-gov init --agent kiro` is run, THE CLI SHALL generate `.kiro/steering/task-estimates.md` containing the task estimates steering content wrapped with YAML front-matter delimiters (`---` on the first and last lines of the front-matter block).
5. WHEN `ai-gov upgrade` is run for Claude Code, THE CLI SHALL regenerate `jira.md` and `task-estimates.md` with the latest content from their respective generator functions.
6. WHEN `ai-gov upgrade` is run for Kiro, THE CLI SHALL regenerate `workflow-jira-sync.kiro.hook` and `task-estimates.md` with the latest content from their respective generator functions.

### Requirement 15: CLI Registration for MCP Commands

**User Story:** As a developer, I want `ai-gov mcp` registered as a CLI command group with init, onboard, validate, and update-token subcommands, so that I can manage MCP tokens from the terminal.

#### Acceptance Criteria

1. THE CLI SHALL register `mcp` as a command group under the root `ai-gov` program with the description "MCP server governance — configure team tools without committing tokens".
2. THE CLI SHALL register `mcp init` with a `--dir` option (default: current working directory) and an `--overwrite` flag (default: false).
3. THE CLI SHALL register `mcp onboard` with a `--dir` option (default: current working directory).
4. THE CLI SHALL register `mcp validate` with a `--dir` option (default: current working directory).
5. THE CLI SHALL register `mcp update-token` with a required `--tool <id>` option (where `<id>` must match a tool identifier from the MCP catalog, e.g. "jira", "figma", "postgres") and a `--dir` option (default: current working directory).
6. IF `mcp update-token` is called without the `--tool` option, THEN THE CLI SHALL display an error message indicating the option is required and exit with code 1.
7. IF `mcp update-token` is called with a `--tool` value that does not match any tool identifier in the MCP catalog, THEN THE CLI SHALL display an error message indicating the tool is not recognized, list the valid tool identifiers, and exit with code 1.
8. WHEN `ai-gov mcp --help` is invoked, THEN THE CLI SHALL display a list of all four subcommands (init, onboard, validate, update-token) with a one-line description for each.

### Requirement 16: Prompt Consistency Across Agents

**User Story:** As a framework maintainer, I want the Jira sync prompt to be identical in both Claude Code and Kiro outputs, so that behavior is consistent regardless of which agent the developer uses.

#### Acceptance Criteria

1. WHEN `buildJiraSyncPrompt` and `generateJiraCommand` are called with the same `GovernanceConfig`, THE output of `buildJiraSyncPrompt` SHALL appear verbatim as a substring within the output of `generateJiraCommand` without trimming, escaping, or other transformation.
2. WHEN `buildJiraSyncPrompt` and `generateWorkflowJiraSync` are called with the same `GovernanceConfig`, THE output of `buildJiraSyncPrompt` SHALL appear verbatim as a substring within the parsed `then.prompt` field of the JSON produced by `generateWorkflowJiraSync`.
3. THE key workflow phrases `"jira_get"`, `".jira"`, `"storyId"`, and `"subtasks"` SHALL each be present as substrings in all three outputs: `buildJiraSyncPrompt`, `generateJiraCommand`, and `generateWorkflowJiraSync` (with `generateWorkflowJiraSync` checked via its parsed `then.prompt` field).
4. FOR ANY valid `GovernanceConfig` input, the substring relationships defined in criteria 1 and 2 SHALL hold (the consistency is config-agnostic).
