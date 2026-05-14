import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { McpConfig, McpEntry, McpToolDefinition } from './types.js';
import { VERSION } from '../constants.js';

const MCP_JSON_FILE = '.mcp.json';

export function buildMcpEntry(
  tool: McpToolDefinition,
  orgValues: Record<string, string> = {}
): McpEntry {
  if (tool.transport === 'stdio') {
    const pkg = tool.npmPackage!;
    const passAsArgVar = tool.personalVars.find(v => v.passAsArg);
    const args = passAsArgVar
      ? ['-y', pkg, `\${${passAsArgVar.name}}`]
      : ['-y', pkg];

    const envVars: Record<string, string> = {};
    for (const orgVar of tool.orgVars) {
      envVars[orgVar.name] = orgValues[orgVar.name] ?? orgVar.example;
    }
    for (const personalVar of tool.personalVars) {
      if (!personalVar.passAsArg) {
        envVars[personalVar.name] = `\${${personalVar.name}}`;
      }
    }

    const entry: McpEntry = { type: 'stdio', command: 'npx', args };
    if (Object.keys(envVars).length > 0) entry.env = envVars;
    return entry;
  }

  // http transport
  const entry: McpEntry = { type: 'http', url: tool.url! };
  if (!tool.isOAuth && tool.personalVars.length > 0) {
    const headers: Record<string, string> = {};
    for (const v of tool.personalVars) {
      headers['Authorization'] = `Bearer \${${v.name}}`;
    }
    entry.headers = headers;
  }
  return entry;
}

export function readMcpConfig(dir: string): McpConfig | null {
  const filePath = join(dir, MCP_JSON_FILE);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as McpConfig;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ai-gov] Warning: .mcp.json is corrupt and could not be parsed (${msg}). Run \`ai-gov mcp init\` to regenerate it.`);
    return null;
  }
}

export function writeMcpConfig(dir: string, config: McpConfig): void {
  writeFileSync(join(dir, MCP_JSON_FILE), JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function buildMcpConfig(
  selectedTools: McpToolDefinition[],
  orgValuesByTool: Record<string, Record<string, string>> = {}
): McpConfig {
  const mcpServers: Record<string, McpEntry> = {};
  for (const tool of selectedTools) {
    mcpServers[tool.id] = buildMcpEntry(tool, orgValuesByTool[tool.id] ?? {});
  }
  return {
    _aigov: { version: VERSION, tools: selectedTools.map(t => t.id) },
    mcpServers,
  };
}
