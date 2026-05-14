/** Two-level token scope: global (per-developer machine) vs project (per-repo) */
export type VarScope = 'global' | 'project';

/** Transport protocol for an MCP server entry */
export type McpTransport = 'stdio' | 'http';

/** An org-level variable baked as a literal value into .mcp.json */
export interface OrgVar {
  name: string;
  description: string;
  example: string;
}

/** A personal token variable stored in an env file (never in .mcp.json) */
export interface PersonalVar {
  name: string;
  description: string;
  example: string;
  scope: VarScope;
  /** If true, this var is passed as a CLI arg to the server process, not as env */
  passAsArg?: boolean;
}

/** Full definition of one MCP tool in the catalog */
export interface McpToolDefinition {
  id: string;
  displayName: string;
  transport: McpTransport;
  /** npm package name for stdio tools (used in npx args) */
  npmPackage?: string;
  /** Base URL for http tools */
  url?: string;
  orgVars: OrgVar[];
  personalVars: PersonalVar[];
  /** OAuth tools require no token prompts — user authenticates via browser */
  isOAuth: boolean;
}

/** A single server entry in .mcp.json mcpServers map */
export interface McpEntry {
  type: McpTransport;
  /** stdio only */
  command?: string;
  /** stdio only */
  args?: string[];
  /** stdio only — env vars for the server process */
  env?: Record<string, string>;
  /** http only */
  url?: string;
  /** http only — request headers */
  headers?: Record<string, string>;
}

/** Full .mcp.json file structure */
export interface McpConfig {
  _aigov: {
    version: string;
    tools: string[];
  };
  mcpServers: Record<string, McpEntry>;
}

/** Options passed to mcp subcommands */
export interface McpCommandOptions {
  dir: string;
  overwrite?: boolean;
  tool?: string;
}
