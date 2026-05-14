# Design Document — MCP Governance + Jira Sync

## Overview

This design covers two tightly coupled features for the `ai-gov` CLI:

1. **MCP Governance** (`ai-gov mcp`) — A command group that manages MCP server token configuration across a team. Tokens are never committed to git. A two-level storage model (global `~/.config/ai-gov/.env.mcp.global` + project `.env.mcp`) eliminates redundant prompts when developers work across multiple projects.

2. **Jira Sync** (`/jira` command + Kiro hook) — Reads a spec's `tasks.md` with time estimates and creates Jira stories + sub-tasks via the Jira MCP server. A single shared prompt (`buildJiraSyncPrompt`) drives both Claude Code and Kiro agents identically.

Feature 2 depends on Feature 1 because Jira tokens must be configured before the sync command can call the Jira MCP server.

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| Two-level token storage (global + project) | A developer working on 5 projects shouldn't be prompted for Jira tokens 5 times — global tokens are set once |
| `Personal_Var.scope` field (`'global'` \| `'project'`) | Drives which file tokens are written to and read from |
| `.envrc` loads global first, then project | Project values can override global (e.g., bot account GITHUB_TOKEN) |
| Single `buildJiraSyncPrompt` function | Guarantees identical behavior across Claude Code and Kiro — one source of truth |
| Pure functions for catalog, buildMcpEntry, env parsing | Maximizes testability, no I/O side effects in core logic |
| `@inquirer/prompts` for interactive CLI | Already a project dependency, provides checkbox/password/confirm/input |
| `.jira` metadata file per spec | Enables re-run safety — tracks which sub-tasks already exist |

---

## Architecture

### High-Level System Diagram

```mermaid
graph TB
    subgraph CLI["ai-gov CLI (src/cli.ts)"]
        MCP_CMD["mcp command group"]
        INIT_CMD["init / upgrade commands"]
    end

    subgraph MCP_CORE["MCP Core (src/mcp/)"]
        TYPES["types.ts"]
        CATALOG["catalog.ts"]
        MCP_JSON["mcp-json.ts"]
        ENV_FILES["env-files.ts"]
        GLOBAL_ENV["global-env.ts"]
        GITIGNORE["gitignore.ts"]
    end

    subgraph COMMANDS["Commands (src/commands/)"]
        MCP_CMDS["mcp.ts<br/>init / onboard / validate / update-token"]
    end

    subgraph GENERATORS["Generators (src/generators/)"]
        TASK_EST["task-estimates.ts"]
        JIRA_PROMPT["jira-sync-prompt.ts"]
    end

    subgraph AGENTS["Agent Generators"]
        CC_JIRA["claude-code/commands/jira.ts"]
        KIRO_HOOK["kiro/hooks/workflow-jira-sync.ts"]
    end

    subgraph FILES_OUT["Generated Files"]
        MCP_JSON_FILE[".mcp.json"]
        ENV_EXAMPLE[".env.mcp.example"]
        ENVRC[".envrc"]
        GLOBAL_FILE["~/.config/ai-gov/.env.mcp.global"]
        PROJECT_ENV[".env.mcp"]
        JIRA_MD[".claude/commands/jira.md"]
        JIRA_HOOK[".kiro/hooks/workflow-jira-sync.kiro.hook"]
        TASK_EST_FILE["steering/task-estimates.md"]
    end

    MCP_CMD --> MCP_CMDS
    MCP_CMDS --> CATALOG
    MCP_CMDS --> MCP_JSON
    MCP_CMDS --> ENV_FILES
    MCP_CMDS --> GLOBAL_ENV
    MCP_CMDS --> GITIGNORE

    INIT_CMD --> CC_JIRA
    INIT_CMD --> KIRO_HOOK
    INIT_CMD --> TASK_EST

    CC_JIRA --> JIRA_PROMPT
    KIRO_HOOK --> JIRA_PROMPT

    MCP_CMDS --> MCP_JSON_FILE
    MCP_CMDS --> ENV_EXAMPLE
    MCP_CMDS --> ENVRC
    MCP_CMDS --> GLOBAL_FILE
    MCP_CMDS --> PROJECT_ENV

    CC_JIRA --> JIRA_MD
    KIRO_HOOK --> JIRA_HOOK
    TASK_EST --> TASK_EST_FILE
```

### Token Flow Diagram

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant CLI as ai-gov mcp
    participant Global as ~/.config/ai-gov/.env.mcp.global
    participant Project as .env.mcp
    participant Envrc as .envrc (direnv)
    participant MCP as MCP Server (Jira)

    Note over Dev,MCP: First project onboard
    Dev->>CLI: ai-gov mcp onboard
    CLI->>Global: Check ATLASSIAN_API_TOKEN
    Global-->>CLI: Not found
    CLI->>Dev: Prompt for Jira token
    Dev->>CLI: Enters token
    CLI->>Global: Write ATLASSIAN_API_TOKEN
    CLI->>Dev: Prompt for DATABASE_URL
    Dev->>CLI: Enters DB URL
    CLI->>Project: Write DATABASE_URL

    Note over Dev,MCP: Second project onboard
    Dev->>CLI: ai-gov mcp onboard
    CLI->>Global: Check ATLASSIAN_API_TOKEN
    Global-->>CLI: ✓ Already set
    CLI->>Dev: Show ✓ (no prompt)
    CLI->>Project: Check DATABASE_URL
    Project-->>CLI: Not found
    CLI->>Dev: Prompt for DATABASE_URL
    Dev->>CLI: Enters different DB URL
    CLI->>Project: Write DATABASE_URL

    Note over Dev,MCP: Runtime
    Envrc->>Global: dotenv_if_exists (load global)
    Envrc->>Project: dotenv_if_exists (load project, overrides)
    MCP->>Envrc: Read ATLASSIAN_API_TOKEN from env
```

---

## Components and Interfaces

### Module Dependency Graph

```mermaid
graph LR
    subgraph Phase1["Phase 1 — Pure Types & Data"]
        T[types.ts]
        C[catalog.ts]
        TE[task-estimates.ts]
    end

    subgraph Phase2["Phase 2 — Pure Utilities"]
        GE[global-env.ts]
        MJ[mcp-json.ts]
        EF[env-files.ts]
        GI[gitignore.ts]
        JP[jira-sync-prompt.ts]
    end

    subgraph Phase3["Phase 3 — Agent Generators"]
        CJ[commands/jira.ts]
        KH[hooks/workflow-jira-sync.ts]
    end

    subgraph Phase4["Phase 4 — Command Orchestrators"]
        MC[commands/mcp.ts]
    end

    C --> T
    MJ --> T
    MJ --> C
    EF --> T
    EF --> GE
    GE --> T
    CJ --> JP
    KH --> JP
    MC --> C
    MC --> MJ
    MC --> EF
    MC --> GE
    MC --> GI
```

### Interface Definitions

#### `src/mcp/types.ts`

```typescript
/** Scope determines where a personal variable is stored */
export type VarScope = 'global' | 'project';

/** Transport type for MCP server connection */
export type McpTransport = 'stdio' | 'http';

/** An organization-level variable (same for all team members) */
export interface OrgVar {
  name: string;        // e.g. "ATLASSIAN_SITE_NAME"
  prompt: string;      // e.g. "Atlassian site name (e.g. mycompany)"
}

/** A developer-specific secret variable */
export interface PersonalVar {
  name: string;        // e.g. "ATLASSIAN_API_TOKEN"
  prompt: string;      // e.g. "Jira API token"
  tokenUrl: string;    // e.g. "https://id.atlassian.net/manage-profile/security/api-tokens"
  scope: VarScope;     // 'global' or 'project'
  passAsArg?: boolean; // true for DATABASE_URL (passed in args, not env)
}

/** A single MCP tool definition in the catalog */
export interface McpToolDefinition {
  id: string;              // lowercase identifier, 1-20 chars (e.g. "jira")
  displayName: string;     // human-readable, 1-50 chars (e.g. "Jira")
  transport: McpTransport;
  package?: string;        // npm package for stdio tools
  url?: string;            // endpoint for http tools
  orgVars: OrgVar[];
  personalVars: PersonalVar[];
  oauthFlow: boolean;      // true for Notion, Slack, Sentry
}

/** A single server entry in .mcp.json */
export interface McpEntry {
  type: McpTransport;
  command?: string;        // "npx" for stdio
  args?: string[];         // package name + args for stdio, or passAsArg values
  url?: string;            // endpoint for http
  env?: Record<string, string>;     // ${VAR} placeholders or literal org values
  headers?: Record<string, string>; // e.g. Authorization header for GitHub
}

/** The full .mcp.json file shape */
export interface McpConfig {
  _aigov: {
    version: string;
    tools: string[];       // selected tool IDs
  };
  mcpServers: Record<string, McpEntry>;
}

/** Options for MCP commands */
export interface McpCommandOptions {
  dir: string;
  overwrite?: boolean;
  tool?: string;
}
```

#### `src/mcp/catalog.ts`

```typescript
import type { McpToolDefinition } from './types.js';

/** The complete MCP tool catalog — 9 tools, pure data */
export const MCP_CATALOG: McpToolDefinition[] = [/* ... */];

/** Look up a tool by ID. Throws if not found. */
export function getToolById(id: string): McpToolDefinition;

/** Get all non-OAuth tools (tools that need token prompts) */
export function getTokenTools(): McpToolDefinition[];

/** Get all tool IDs as a Set for validation */
export function getValidToolIds(): Set<string>;
```

#### `src/mcp/mcp-json.ts`

```typescript
import type { McpConfig, McpEntry, McpToolDefinition } from './types.js';

/**
 * Build a single MCP server entry from a tool definition and org var values.
 * Pure function — no I/O.
 *
 * @param tool - The tool definition from the catalog
 * @param orgValues - Map of org var names to their literal values
 * @returns The McpEntry for inclusion in .mcp.json
 * @throws If an orgValues key doesn't match the tool's defined org vars
 * @throws If tool ID is not recognized
 */
export function buildMcpEntry(tool: McpToolDefinition, orgValues?: Record<string, string>): McpEntry;

/** Read .mcp.json from a directory. Returns null if not found. */
export function readMcpConfig(dir: string): McpConfig | null;

/** Write .mcp.json to a directory. */
export function writeMcpConfig(dir: string, config: McpConfig): void;
```

#### `src/mcp/env-files.ts`

```typescript
import type { McpToolDefinition, VarScope } from './types.js';

/**
 * Generate .env.mcp.example content for selected tools.
 * Pure function — returns string content.
 */
export function generateEnvExample(selectedTools: McpToolDefinition[]): string;

/**
 * Generate .envrc content with two-level dotenv loading.
 * Pure function — returns string content.
 */
export function generateEnvrc(): string;

/**
 * Read an env file (KEY=VALUE format). Returns empty object if file doesn't exist.
 * Ignores comments (#) and blank lines. Splits only on first '='.
 */
export function readEnvFile(filePath: string): Record<string, string>;

/**
 * Write key-value pairs to an env file, grouped by tool with comment headers.
 */
export function writeEnvFile(filePath: string, vars: Record<string, string>, toolName?: string): void;

/**
 * Read merged environment: global file + project file.
 * Project values take precedence over global on conflict.
 */
export function readMergedEnv(projectDir: string): Record<string, string>;

/**
 * Write a variable to the correct scope file.
 * scope='global' → ~/.config/ai-gov/.env.mcp.global
 * scope='project' → <projectDir>/.env.mcp
 */
export function writeEnvVar(projectDir: string, scope: VarScope, key: string, value: string, toolName: string): void;
```

#### `src/mcp/global-env.ts`

```typescript
/**
 * Get the absolute path to the global env file.
 * Returns: ~/.config/ai-gov/.env.mcp.global (resolved against HOME)
 */
export function getGlobalEnvPath(): string;

/**
 * Read the global env file. Returns {} if file doesn't exist.
 */
export function readGlobalEnv(): Record<string, string>;

/**
 * Write/merge values into the global env file.
 * Additive: preserves existing keys not in the new set.
 * Creates ~/.config/ai-gov/ directory if needed.
 */
export function writeGlobalEnv(vars: Record<string, string>): void;

/**
 * Ensure the ~/.config/ai-gov/ directory exists.
 */
export function ensureGlobalEnvDir(): void;
```

#### `src/mcp/gitignore.ts`

```typescript
/**
 * Append .env.mcp to .gitignore if not already present.
 * Creates .gitignore if it doesn't exist.
 */
export function ensureMcpGitignore(dir: string): void;
```

#### `src/commands/mcp.ts`

```typescript
import type { McpCommandOptions } from '../mcp/types.js';

/**
 * Interactive init: tool selection → org var prompts → write .mcp.json, .env.mcp.example, .envrc, .gitignore
 */
export function runMcpInit(options: McpCommandOptions): Promise<void>;

/**
 * Interactive onboard: per-tool confirmation → scope-aware token prompts → write to correct file
 */
export function runMcpOnboard(options: McpCommandOptions): Promise<void>;

/**
 * Validate: merge global+project env → check all required vars → exit 0 or 1
 */
export function runMcpValidate(options: McpCommandOptions): Promise<void>;

/**
 * Update single tool's tokens: prompt → write to correct scope file
 */
export function runMcpUpdateToken(options: McpCommandOptions): Promise<void>;
```

#### `src/generators/task-estimates.ts`

```typescript
import type { GovernanceConfig } from '../types.js';

/**
 * Generate task-estimates steering file content.
 * Contains size-to-time mapping, format guide, and examples.
 * Same pattern as generateConstitution — pure function, no I/O.
 */
export function generateTaskEstimates(c: GovernanceConfig): string;
```

#### `src/generators/jira-sync-prompt.ts`

```typescript
import type { GovernanceConfig } from '../types.js';

/**
 * Build the shared Jira sync prompt content.
 * Single source of truth used by both Claude Code command and Kiro hook.
 * Contains the full workflow: discover specs → ticket ID → verify → create subtasks → update metadata.
 */
export function buildJiraSyncPrompt(c: GovernanceConfig): string;
```

#### `src/agents/claude-code/commands/jira.ts`

```typescript
import type { GovernanceConfig } from '../../../types.js';

/**
 * Generate the /jira slash command markdown.
 * Output: "# /jira\n\n" + buildJiraSyncPrompt(config)
 * Same pattern as generateBacklogCommand.
 */
export function generateJiraCommand(c: GovernanceConfig): string;
```

#### `src/agents/kiro/hooks/workflow-jira-sync.ts`

```typescript
import type { GovernanceConfig } from '../../../types.js';

/**
 * Generate the Kiro userTriggered hook JSON for Jira sync.
 * Output: JSON.stringify({ name, version, when, then }) + '\n'
 * Same pattern as generateWorkflowNewFeature.
 */
export function generateWorkflowJiraSync(c: GovernanceConfig): string;
```

---

## Data Models

### MCP Tool Catalog (static data)

| Tool | ID | Transport | Org Vars | Personal Vars | Scope | OAuth |
|------|----|-----------|----------|---------------|-------|-------|
| Jira | `jira` | stdio | `ATLASSIAN_SITE_NAME` | `ATLASSIAN_USER_EMAIL`, `ATLASSIAN_API_TOKEN` | global | No |
| Figma | `figma` | stdio | — | `FIGMA_ACCESS_TOKEN` | global | No |
| Zeplin | `zeplin` | stdio | — | `ZEPLIN_ACCESS_TOKEN` | global | No |
| PostgreSQL | `postgres` | stdio | — | `DATABASE_URL` (passAsArg) | project | No |
| GitHub | `github` | http | — | `GITHUB_TOKEN` | global | No |
| Linear | `linear` | http | — | `LINEAR_API_KEY` | global | No |
| Notion | `notion` | http | — | — | — | Yes |
| Slack | `slack` | http | — | — | — | Yes |
| Sentry | `sentry` | http | — | — | — | Yes |

### `.mcp.json` Schema

```json
{
  "_aigov": {
    "version": "18.0.0",
    "tools": ["jira", "figma", "postgres"]
  },
  "mcpServers": {
    "jira": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@aashari/mcp-server-atlassian-jira@3.3.0"],
      "env": {
        "ATLASSIAN_SITE_NAME": "mycompany",
        "ATLASSIAN_USER_EMAIL": "${ATLASSIAN_USER_EMAIL}",
        "ATLASSIAN_API_TOKEN": "${ATLASSIAN_API_TOKEN}"
      }
    },
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    },
    "notion": {
      "type": "http",
      "url": "https://mcp.notion.com/mcp"
    }
  }
}
```

### `.jira` Metadata File

```json
{
  "storyId": "PROJ-111",
  "subtasks": ["PROJ-112", "PROJ-113", "PROJ-114"]
}
```

Location: `.kiro/specs/<spec-name>/.jira` or `specs/<spec-name>/.jira`

### Environment File Formats

**`~/.config/ai-gov/.env.mcp.global`** (global tokens):
```bash
# Jira
ATLASSIAN_USER_EMAIL=dev@company.com
ATLASSIAN_API_TOKEN=ATATT3x...

# Figma
FIGMA_ACCESS_TOKEN=figd_...

# GitHub
GITHUB_TOKEN=ghp_...
```

**`.env.mcp`** (project tokens):
```bash
# PostgreSQL
DATABASE_URL=postgresql://dev:pass@localhost:5432/mydb
```

**`.envrc`** (committed, loads both):
```bash
# Load MCP tokens: shared first, then project-specific overrides
dotenv_if_exists ~/.config/ai-gov/.env.mcp.global
dotenv_if_exists .env.mcp
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Env File Round-Trip

*For any* set of valid key-value pairs (where keys match `[A-Z_][A-Z0-9_]*` and values do not contain newline characters), writing them with `writeEnvFile` then reading with `readEnvFile` SHALL produce an object containing all the original key-value pairs with identical values.

**Validates: Requirements 7.7, 8.7**

### Property 2: Env Merge Precedence

*For any* two env maps (global and project) where both contain the same key with different values, calling `readMergedEnv` SHALL return the project value for that key, and SHALL include all keys from both maps (union of keys).

**Validates: Requirements 7.8**

### Property 3: Global Env Additive Merge

*For any* two sets of key-value pairs A and B (with disjoint keys), calling `writeGlobalEnv(A)` followed by `writeGlobalEnv(B)` SHALL result in `readGlobalEnv()` returning an object containing all keys from both A and B with their respective values.

**Validates: Requirements 8.4, 8.8**

### Property 4: Invalid Tool ID Error

*For any* string that does not match one of the 9 valid tool identifiers in the catalog, calling `getToolById` or `buildMcpEntry` with that string SHALL throw an error indicating the tool is not recognized.

**Validates: Requirements 1.7, 2.9**

### Property 5: buildMcpEntry Variable Placement

*For any* tool with Org_Vars and any valid org var value string, `buildMcpEntry` SHALL produce an entry where org var values appear as literal strings (not wrapped in `${}`). *For any* tool with Personal_Vars, `buildMcpEntry` SHALL produce an entry containing `${VAR_NAME}` placeholder format for each personal var name.

**Validates: Requirements 2.1, 2.2**

### Property 6: generateTaskEstimates Structural Invariants

*For any* valid `GovernanceConfig` (across all supported stacks), `generateTaskEstimates` SHALL produce output that: (a) contains all four size categories ("Small", "Medium", "Large", "Very Large"), (b) contains the bracket format notation `[~`, (c) contains size markers `[S]`, `[M]`, `[L]`, (d) does not match template placeholder patterns (`_replace_`, `TODO:`, `FIXME:`, `XXX:`, `{{...}}`), and (e) has length greater than 500 characters.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

### Property 7: generateWorkflowJiraSync Valid Structure

*For any* valid `GovernanceConfig`, `generateWorkflowJiraSync` SHALL produce output that: (a) parses as valid JSON without error, (b) has `name === "Jira Sync"`, (c) has `when.type === "userTriggered"`, (d) has `then.type === "askAgent"`, (e) has a `version` field equal to `config.hookVersion`, and (f) has `then.prompt` containing the substrings `"jira_get"`, `".jira"`, `"storyId"`, and `"[~"`.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.6, 12.8**

### Property 8: Prompt Consistency Across Agents

*For any* valid `GovernanceConfig`, the output of `buildJiraSyncPrompt(config)` SHALL appear verbatim as a substring within `generateJiraCommand(config)`, AND SHALL appear verbatim as a substring within the parsed `then.prompt` field of `generateWorkflowJiraSync(config)`. Additionally, the key phrases `"jira_get"`, `".jira"`, `"storyId"`, and `"subtasks"` SHALL each be present in all three outputs.

**Validates: Requirements 16.1, 16.2, 16.3, 16.4, 11.2**

### Property 9: Jira Command is Stack-Agnostic

*For any* two valid `GovernanceConfig` objects that differ only in their `stack` field, `generateJiraCommand` SHALL produce identical output for both.

**Validates: Requirements 11.8**

---

## Error Handling

### MCP Commands

| Error Condition | Handling |
|----------------|----------|
| `.mcp.json` not found during onboard/validate | Exit code 1, message: "Run `ai-gov mcp init` first" |
| Tool ID not in catalog (update-token) | Exit code 1, list valid IDs |
| Empty/whitespace org var input during init | Re-prompt until non-blank value provided |
| Global env directory doesn't exist | Create `~/.config/ai-gov/` with `mkdirSync({ recursive: true })` |
| `.mcp.json` exists without `--overwrite` | Warn + confirm prompt; abort if declined |
| Zero tools selected during init | Info message, exit 0 without writing files |
| OAuth tool passed to update-token | Info message ("uses OAuth, no token needed"), exit 0 |
| Custom server entries in `.mcp.json` not in catalog | Skip silently during onboard; skip with warning during validate |

### Jira Sync (prompt-level error handling)

| Error Condition | Handling |
|----------------|----------|
| No spec directories with `tasks.md` found | Display error, exit workflow |
| `.jira` file contains invalid JSON | Display error ("metadata corrupt"), halt sync |
| `.jira` file missing `subtasks` array | Display error ("metadata corrupt"), halt sync |
| Jira ticket not found via `jira_get` | Offer: create new story / re-enter ID / cancel |
| Sub-task creation fails mid-batch | Already-created IDs preserved in `.jira` (append-after-each pattern) |

### Env File Parsing

| Error Condition | Handling |
|----------------|----------|
| File doesn't exist | Return `{}` (no error) |
| Line has no `=` character | Skip line silently |
| Line starts with `#` | Skip (comment) |
| Empty/whitespace-only line | Skip silently |
| Value contains `=` characters | Split only on first `=`, preserve remainder |

---

## Testing Strategy

### Testing Approach

This feature uses a **dual testing approach**:

1. **Property-based tests** (using `fast-check`) — Verify universal properties across randomly generated inputs. Each property test runs a minimum of 100 iterations.
2. **Example-based unit tests** (using `jest`) — Verify specific behaviors, edge cases, and integration points.

The project already has `fast-check` as a devDependency and uses `jest` as the test runner.

### Property-Based Tests

Each property test references its design document property with a tag comment:

```typescript
// Feature: mcp-jira-sync, Property 1: Env File Round-Trip
```

**Configuration**: Minimum 100 iterations per property (`{ numRuns: 100 }`).

**Test file**: `tests/mcp.test.ts` and `tests/jira.test.ts`

| Property | Generator Strategy |
|----------|-------------------|
| P1: Env round-trip | Generate random valid keys (`[A-Z_][A-Z0-9_]*`) and values (printable ASCII, no newlines) |
| P2: Env merge precedence | Generate two random env maps with overlapping keys |
| P3: Global env additive merge | Generate two random env maps with disjoint keys |
| P4: Invalid tool ID error | Generate random strings filtered to exclude the 9 valid IDs |
| P5: Variable placement | Iterate catalog tools with orgVars/personalVars, generate random org values |
| P6: Task estimates invariants | Generate random GovernanceConfig objects (varying stack field across all supported stacks) |
| P7: Workflow hook structure | Generate random GovernanceConfig objects |
| P8: Prompt consistency | Generate random GovernanceConfig objects, verify substring relationships |
| P9: Stack-agnostic command | Generate pairs of GovernanceConfig differing only in stack |

### Example-Based Unit Tests

**`tests/mcp.test.ts`**:
- Catalog integrity (9 tools, correct shapes, OAuth/stdio/http rules)
- `buildMcpEntry` specific outputs (Jira env, GitHub headers, PostgreSQL args, OAuth minimal)
- `generateEnvExample` content structure
- `readEnvFile` edge cases (non-existent file, comments, empty lines, embedded `=`)
- `getGlobalEnvPath` returns correct path
- `generateEnvrc` contains both dotenv_if_exists lines in correct order

**`tests/jira.test.ts`**:
- `generateTaskEstimates` smoke tests (specific content checks)
- `generateJiraCommand` starts with `# /jira`, contains key strings, no Kiro artifacts
- `generateWorkflowJiraSync` valid JSON, correct field values
- `buildJiraSyncPrompt` contains workflow steps (spec discovery, ticket ID, jira_get, metadata, phases)
- Shared prompt consistency (substring checks across all three functions)
- Integration: files generated on `ai-gov init` (using tmp directories)

### Integration Tests

- `runMcpInit` with mocked `@inquirer/prompts` — verify file creation
- `runMcpOnboard` scope-aware flow — verify global vs project file writes
- `runMcpValidate` exit codes — verify 0 when all set, 1 when missing
- `runMcpUpdateToken` scope routing — verify correct file updated
- Agent init/upgrade — verify jira.md, workflow-jira-sync.kiro.hook, task-estimates.md created

