# Implementation Plan: MCP Governance + Jira Sync

## Overview

This plan implements two tightly coupled features: MCP Governance (`ai-gov mcp` command group for team-wide MCP token management) and Jira Sync (`/jira` command + Kiro hook for creating Jira stories/sub-tasks from spec task lists). The build follows a strict dependency order — pure types first, then utilities, then generators, then orchestrators, then wiring into existing files, and finally tests.

## Tasks

- [x] 1. Set up pure types and data layer
  - [x] 1.1 Create `src/mcp/types.ts` with all MCP type definitions
    - Define `VarScope`, `McpTransport` type aliases
    - Define `OrgVar`, `PersonalVar`, `McpToolDefinition`, `McpEntry`, `McpConfig`, `McpCommandOptions` interfaces
    - Ensure `PersonalVar` includes `scope: VarScope` and optional `passAsArg?: boolean`
    - Export all types (pure types, no runtime logic)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8_

  - [x] 1.2 Create `src/mcp/catalog.ts` with the full MCP tool catalog
    - Import types from `./types.js`
    - Define `MCP_CATALOG` array with all 9 tool definitions (Jira, Figma, Zeplin, PostgreSQL, GitHub, Linear, Notion, Slack, Sentry)
    - Implement `getToolById(id: string): McpToolDefinition` — throws if not found
    - Implement `getTokenTools(): McpToolDefinition[]` — returns non-OAuth tools
    - Implement `getValidToolIds(): Set<string>` — returns all valid IDs
    - Ensure OAuth tools have empty `personalVars` arrays, stdio tools have `package`, http non-OAuth tools have `url`
    - PostgreSQL `DATABASE_URL` must have `passAsArg: true` and `scope: 'project'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 1.3 Create `src/generators/task-estimates.ts`
    - Import `GovernanceConfig` from `../types.js`
    - Implement `generateTaskEstimates(c: GovernanceConfig): string`
    - Output must contain all four size categories (Small, Medium, Large, Very Large)
    - Include bracket format notation `[~Xmin]` / `[~Xh]` and size markers `[S]`, `[M]`, `[L]`
    - Include at least one example task title per size category
    - No template placeholders (`_replace_`, `TODO:`, `FIXME:`, `XXX:`, `{{...}}`)
    - Output length > 500 characters
    - Stack-agnostic structural elements
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 2. Implement pure utility functions
  - [x] 2.1 Create `src/mcp/global-env.ts`
    - Implement `getGlobalEnvPath(): string` — returns `~/.config/ai-gov/.env.mcp.global` resolved against HOME
    - Implement `readGlobalEnv(): Record<string, string>` — returns `{}` if file doesn't exist
    - Implement `writeGlobalEnv(vars: Record<string, string>): void` — additive merge with existing values
    - Implement `ensureGlobalEnvDir(): void` — creates `~/.config/ai-gov/` with `mkdirSync({ recursive: true })`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 2.2 Create `src/mcp/mcp-json.ts`
    - Import types from `./types.js` and catalog functions from `./catalog.js`
    - Implement `buildMcpEntry(tool: McpToolDefinition, orgValues?: Record<string, string>): McpEntry`
      - Org vars as literals, personal vars as `${VAR_NAME}` placeholders
      - stdio: `type: "stdio"`, `command: "npx"`, `args: [package]`
      - http: `type: "http"`, `url` from catalog
      - GitHub: `Authorization: "Bearer ${GITHUB_TOKEN}"` header
      - PostgreSQL: `DATABASE_URL` in args, not env
      - OAuth: minimal entry with type + url, no env/headers
      - Throw on invalid org var key or unrecognized tool ID
    - Implement `readMcpConfig(dir: string): McpConfig | null`
    - Implement `writeMcpConfig(dir: string, config: McpConfig): void`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [x] 2.3 Create `src/mcp/env-files.ts`
    - Import types from `./types.js` and `getGlobalEnvPath` from `./global-env.js`
    - Implement `generateEnvExample(selectedTools: McpToolDefinition[]): string` — template with token URLs
    - Implement `generateEnvrc(): string` — two `dotenv_if_exists` lines (global first, project second)
    - Implement `readEnvFile(filePath: string): Record<string, string>` — handles comments, blank lines, embedded `=`
    - Implement `writeEnvFile(filePath, vars, toolName?)` — grouped by tool with comment headers
    - Implement `readMergedEnv(projectDir: string): Record<string, string>` — global + project, project wins
    - Implement `writeEnvVar(projectDir, scope, key, value, toolName)` — routes to correct file
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10_

  - [x] 2.4 Create `src/mcp/gitignore.ts`
    - Implement `ensureMcpGitignore(dir: string): void`
    - Append `.env.mcp` to `.gitignore` if not already present
    - Create `.gitignore` if it doesn't exist
    - _Requirements: 3.6_

  - [x] 2.5 Create `src/generators/jira-sync-prompt.ts`
    - Import `GovernanceConfig` from `../types.js`
    - Implement `buildJiraSyncPrompt(c: GovernanceConfig): string`
    - Include full workflow: spec discovery, ticket ID prompt, jira_get verification, .jira metadata handling, phase selection, sub-task creation with `[~Xmin]` format, metadata update, optional comment
    - Reference `.jira` metadata format `{"storyId": "<ID>", "subtasks": ["<ID>", ...]}`
    - Include error handling instructions (no specs found, ticket not found, corrupt metadata)
    - Must contain key phrases: `jira_get`, `.jira`, `storyId`, `subtasks`, `[~`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 10.12, 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 3. Checkpoint — Ensure types and utilities compile
  - All modules compile and import correctly.

- [x] 4. Implement agent generators
  - [x] 4.1 Create `src/agents/claude-code/commands/jira.ts`
    - Import `GovernanceConfig` from `../../../types.js`
    - Import `buildJiraSyncPrompt` from `../../../generators/jira-sync-prompt.js`
    - Implement `generateJiraCommand(c: GovernanceConfig): string`
    - Output: `"# /jira\n\n" + buildJiraSyncPrompt(c)`
    - Must NOT contain Kiro hook JSON artifacts (`"when":`, `"userTriggered"`)
    - Same pattern as existing `generateBacklogCommand`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x] 4.2 Create `src/agents/kiro/hooks/workflow-jira-sync.ts`
    - Import `GovernanceConfig` from `../../../types.js`
    - Import `buildJiraSyncPrompt` from `../../../generators/jira-sync-prompt.js`
    - Implement `generateWorkflowJiraSync(c: GovernanceConfig): string`
    - Output: `JSON.stringify({ name: "Jira Sync", version: c.hookVersion, when: { type: "userTriggered" }, then: { type: "askAgent", prompt: buildJiraSyncPrompt(c) } }) + '\n'`
    - Must parse as valid JSON
    - Same pattern as existing `generateWorkflowNewFeature`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 5. Implement command orchestrators
  - [x] 5.1 Create `src/commands/mcp.ts`
    - Import all MCP modules and `@inquirer/prompts` (checkbox, password, confirm, input)
    - Implement `runMcpInit(options: McpCommandOptions): Promise<void>`
      - Interactive checkbox for tool selection from catalog
      - Org var prompts (reject empty/whitespace, re-prompt)
      - Write `.mcp.json`, `.env.mcp.example`, `.envrc`, update `.gitignore`
      - Handle `--overwrite` flag and zero-selection case
      - Print summary with next steps
    - Implement `runMcpOnboard(options: McpCommandOptions): Promise<void>`
      - Read `.mcp.json`, match tools to catalog
      - Per-tool confirm → scope-aware token prompts (skip already-set with ✓)
      - Write global-scoped to `~/.config/ai-gov/.env.mcp.global`, project-scoped to `.env.mcp`
      - Skip OAuth tools, skip custom entries, handle missing `.mcp.json`
    - Implement `runMcpValidate(options: McpCommandOptions): Promise<void>`
      - Merge global + project env, check all personal vars for configured tools
      - Exit 0 if all set, exit 1 with missing var names grouped by tool
      - Skip OAuth tools, warn on unknown tools
    - Implement `runMcpUpdateToken(options: McpCommandOptions): Promise<void>`
      - Validate tool ID, prompt for personal vars, write to correct scope file
      - Handle OAuth tools (info message, exit 0), unknown tools (error, exit 1)
    - _Requirements: 3.1–3.11, 4.1–4.12, 5.1–5.6, 6.1–6.6, 15.1–15.8_

- [x] 6. Wire into existing files
  - [x] 6.1 Modify `src/agents/kiro/hooks/index.ts`
    - Add import for `generateWorkflowJiraSync` from `./workflow-jira-sync.js`
    - Add `w('workflow-jira-sync.kiro.hook', generateWorkflowJiraSync(config));` in the userTriggered section after `workflow-edit-feature`
    - _Requirements: 12.7, 14.3_

  - [x] 6.2 Modify `src/agents/claude-code/index.ts`
    - Add imports for `generateTaskEstimates` and `generateJiraCommand`
    - In `generateClaudeCode()`: add `safeWrite` for `.claude/steering/task-estimates.md` and `.claude/commands/jira.md`
    - In `upgradeClaudeCode()`: add same writes for upgrade path
    - _Requirements: 14.1, 14.2, 14.5_

  - [x] 6.3 Modify `src/agents/kiro/index.ts`
    - Add import for `generateTaskEstimates`
    - In `generateKiro()`: add `safeWrite` for `.kiro/steering/task-estimates.md` wrapped with front-matter
    - In `upgradeKiro()`: add same write in force block
    - _Requirements: 14.4, 14.6_

  - [x] 6.4 Modify `src/cli.ts`
    - Import `runMcpInit`, `runMcpOnboard`, `runMcpValidate`, `runMcpUpdateToken` from `./commands/mcp.js`
    - Register `mcp` command group with description
    - Register `init`, `onboard`, `validate`, `update-token` subcommands with options
    - `update-token` requires `--tool <id>` option
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

- [x] 7. Checkpoint — Ensure project builds and existing tests pass
  - Project builds successfully. All existing tests pass.

- [x] 8. Implement MCP tests
  - [x] 8.1 Create `tests/mcp.test.ts` — catalog and buildMcpEntry unit tests
    - Suite: Catalog integrity (9 tools, correct shapes, OAuth/stdio/http rules)
    - Suite: `buildMcpEntry` specific outputs (Jira env, GitHub headers, PostgreSQL args, OAuth minimal, error cases)
    - Suite: `generateEnvExample` content structure
    - Suite: `generateEnvrc` two-level loading
    - _Requirements: 1.1–1.8, 2.1–2.9_

  - [x] 8.2 Add env file unit tests to `tests/mcp.test.ts`
    - Suite: `readEnvFile` edge cases (non-existent file, comments, empty lines, embedded `=`)
    - Suite: `writeEnvFile` then `readEnvFile` round-trip
    - Suite: `getGlobalEnvPath` returns correct path
    - Suite: `readGlobalEnv`/`writeGlobalEnv` with tmp HOME dir
    - Suite: `readMergedEnv` precedence (project overrides global)
    - _Requirements: 7.1–7.10, 8.1–8.8_

  - [x]* 8.3 Write property test: Env File Round-Trip (Property 1)
    - **Property 1: Env File Round-Trip**
    - Generate random valid keys (`[A-Z_][A-Z0-9_]*`) and values (printable ASCII, no newlines)
    - Assert: `writeEnvFile` then `readEnvFile` produces object containing all original key-value pairs
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 7.7, 8.7**

  - [x]* 8.4 Write property test: Env Merge Precedence (Property 2)
    - **Property 2: Env Merge Precedence**
    - Generate two random env maps with overlapping keys
    - Assert: `readMergedEnv` returns project value for shared keys, union of all keys
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 7.8**

  - [x]* 8.5 Write property test: Global Env Additive Merge (Property 3)
    - **Property 3: Global Env Additive Merge**
    - Generate two random env maps with disjoint keys
    - Assert: `writeGlobalEnv(A)` then `writeGlobalEnv(B)` → `readGlobalEnv()` contains all keys from A and B
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 8.4, 8.8**

  - [x]* 8.6 Write property test: Invalid Tool ID Error (Property 4)
    - **Property 4: Invalid Tool ID Error**
    - Generate random strings filtered to exclude the 9 valid tool IDs
    - Assert: `getToolById` throws error indicating tool not recognized
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 1.7, 2.9**

  - [x]* 8.7 Write property test: buildMcpEntry Variable Placement (Property 5)
    - **Property 5: buildMcpEntry Variable Placement**
    - Iterate catalog tools with orgVars/personalVars, generate random org values
    - Assert: org var values appear as literals (not `${}`), personal vars appear as `${VAR_NAME}` placeholders
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 2.1, 2.2**

- [x] 9. Implement Jira sync tests
  - [x] 9.1 Create `tests/jira.test.ts` — generator unit tests
    - Suite: `generateTaskEstimates` smoke tests (size categories, format notation, no placeholders, length)
    - Suite: `generateJiraCommand` (starts with `# /jira`, contains key strings, no Kiro artifacts, stack-agnostic)
    - Suite: `generateWorkflowJiraSync` (valid JSON, correct field values, version field)
    - Suite: `buildJiraSyncPrompt` (workflow steps, key phrases)
    - Suite: Shared prompt consistency (substring checks across all three functions)
    - _Requirements: 9.1–9.6, 10.1–10.12, 11.1–11.8, 12.1–12.8, 16.1–16.4_

  - [x]* 9.2 Write property test: Task Estimates Structural Invariants (Property 6)
    - **Property 6: generateTaskEstimates Structural Invariants**
    - Generate random `GovernanceConfig` objects (varying stack across all supported stacks)
    - Assert: output contains all four size categories, bracket format `[~`, size markers `[S]`/`[M]`/`[L]`, no template placeholders, length > 500
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

  - [x]* 9.3 Write property test: Workflow Hook Valid Structure (Property 7)
    - **Property 7: generateWorkflowJiraSync Valid Structure**
    - Generate random `GovernanceConfig` objects
    - Assert: output parses as valid JSON, `name === "Jira Sync"`, `when.type === "userTriggered"`, `then.type === "askAgent"`, `version === config.hookVersion`, `then.prompt` contains `"jira_get"`, `".jira"`, `"storyId"`, `"[~"`
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.8**

  - [x]* 9.4 Write property test: Prompt Consistency Across Agents (Property 8)
    - **Property 8: Prompt Consistency Across Agents**
    - Generate random `GovernanceConfig` objects
    - Assert: `buildJiraSyncPrompt(config)` appears verbatim in `generateJiraCommand(config)` and in parsed `then.prompt` of `generateWorkflowJiraSync(config)`
    - Assert: key phrases `"jira_get"`, `".jira"`, `"storyId"`, `"subtasks"` present in all three
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 16.1, 16.2, 16.3, 16.4**

  - [x]* 9.5 Write property test: Jira Command is Stack-Agnostic (Property 9)
    - **Property 9: Jira Command is Stack-Agnostic**
    - Generate pairs of `GovernanceConfig` objects differing only in `stack` field
    - Assert: `generateJiraCommand` produces identical output for both
    - Minimum 100 iterations with `fast-check`
    - **Validates: Requirements 11.8**

- [x] 10. Final checkpoint — All tests pass
  - All implementation complete. Tests passing.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (9 properties total)
- Unit tests validate specific behaviors, edge cases, and integration points
- The project uses TypeScript with ESM modules (`.js` extensions in imports)
- Test runner is Jest (`jest.config.cjs`), property testing uses `fast-check` (already a devDependency)
- Follow existing patterns: generators return strings, hooks return JSON strings via `JSON.stringify`
- `@inquirer/prompts` is used for interactive CLI prompts (checkbox, password, confirm, input)

## Code Review Findings

After reviewing the implemented code against the requirements and design:

### Implementation Notes

1. **`src/commands/mcp.ts`** uses `readTTYLine` (synchronous TTY prompts) instead of `@inquirer/prompts` as specified in the design. This is consistent with the rest of the codebase (e.g., `claude-code/index.ts` uses the same pattern). The design should be updated to reflect this — the implementation is correct.

2. **`src/generators/jira-sync-prompt.ts`** references `jira_create` and `jira_add_comment` instead of the `jira_get` + generic Jira MCP calls described in requirements. The prompt correctly uses `jira_get` for verification (Step 3) and `jira_create` for creation (Step 5). The requirements reference `jira_get` which is present.

3. **`src/agents/kiro/hooks/workflow-jira-sync.ts`** uses `JSON.stringify(obj, null, 2)` (pretty-printed) matching the pattern in `workflow-new-feature.ts`. The design said `JSON.stringify(obj)` (compact) — the implementation follows the existing codebase pattern, which is correct.

4. **`src/generators/task-estimates.ts`** uses `_c` (unused parameter) — this is intentional as the function is stack-agnostic per Requirement 9.6 / 11.8, but accepts the config for API consistency with other generators.

5. **All wiring is complete** — `src/agents/claude-code/index.ts`, `src/agents/kiro/index.ts`, `src/agents/kiro/hooks/index.ts`, and `src/cli.ts` all have the necessary imports and registrations.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.5"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["5.1"] },
    { "id": 6, "tasks": ["6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["8.1", "9.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "9.2", "9.3", "9.4", "9.5"] }
  ]
}
```
