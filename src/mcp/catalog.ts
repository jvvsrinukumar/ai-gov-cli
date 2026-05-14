import type { McpToolDefinition } from './types.js';

export const MCP_CATALOG: McpToolDefinition[] = [
  {
    id: 'jira',
    displayName: 'Jira',
    transport: 'stdio',
    npmPackage: '@aashari/mcp-server-atlassian-jira@3.3.0',
    orgVars: [
      { name: 'ATLASSIAN_SITE_NAME', description: 'Your Atlassian subdomain (e.g. mycompany)', example: 'mycompany' },
    ],
    personalVars: [
      { name: 'ATLASSIAN_USER_EMAIL', description: 'Your Atlassian account email', example: 'you@company.com', scope: 'global' },
      { name: 'ATLASSIAN_API_TOKEN', description: 'Atlassian API token from id.atlassian.com/manage-profile/security/api-tokens', example: 'ATATT3xFf...', scope: 'global' },
    ],
    isOAuth: false,
  },
  {
    id: 'figma',
    displayName: 'Figma',
    transport: 'stdio',
    npmPackage: 'figma-mcp@0.1.4',
    orgVars: [],
    personalVars: [
      { name: 'FIGMA_ACCESS_TOKEN', description: 'Figma personal access token', example: 'figd_...', scope: 'global' },
    ],
    isOAuth: false,
  },
  {
    id: 'zeplin',
    displayName: 'Zeplin',
    transport: 'stdio',
    npmPackage: '@zeplin/mcp@0.1.4',
    orgVars: [],
    personalVars: [
      { name: 'ZEPLIN_ACCESS_TOKEN', description: 'Zeplin personal access token', example: 'eyJh...', scope: 'global' },
    ],
    isOAuth: false,
  },
  {
    id: 'postgres',
    displayName: 'PostgreSQL',
    transport: 'stdio',
    npmPackage: '@modelcontextprotocol/server-postgres@0.6.2',
    orgVars: [],
    personalVars: [
      { name: 'DATABASE_URL', description: 'PostgreSQL connection string', example: 'postgresql://user:pass@localhost:5432/dbname', scope: 'project', passAsArg: true },
    ],
    isOAuth: false,
  },
  {
    id: 'github',
    displayName: 'GitHub',
    transport: 'http',
    url: 'https://api.githubcopilot.com/mcp/',
    orgVars: [],
    personalVars: [
      { name: 'GITHUB_TOKEN', description: 'GitHub personal access token or fine-grained token', example: 'ghp_...', scope: 'global' },
    ],
    isOAuth: false,
  },
  {
    id: 'linear',
    displayName: 'Linear',
    transport: 'http',
    url: 'https://mcp.linear.app/sse',
    orgVars: [],
    personalVars: [
      { name: 'LINEAR_API_KEY', description: 'Linear API key from linear.app/settings/api', example: 'lin_api_...', scope: 'global' },
    ],
    isOAuth: false,
  },
  {
    id: 'notion',
    displayName: 'Notion',
    transport: 'http',
    url: 'https://mcp.notion.com/mcp',
    orgVars: [],
    personalVars: [],
    isOAuth: true,
  },
  {
    id: 'slack',
    displayName: 'Slack',
    transport: 'http',
    url: 'https://mcp.slack.com/mcp',
    orgVars: [],
    personalVars: [],
    isOAuth: true,
  },
  {
    id: 'sentry',
    displayName: 'Sentry',
    transport: 'http',
    url: 'https://mcp.sentry.io/mcp',
    orgVars: [],
    personalVars: [],
    isOAuth: true,
  },
];

export function getToolById(id: string): McpToolDefinition {
  const tool = MCP_CATALOG.find(t => t.id === id);
  if (!tool) throw new Error(`Unknown MCP tool: "${id}". Valid IDs: ${getValidToolIds().size > 0 ? [...getValidToolIds()].join(', ') : 'none'}`);
  return tool;
}

export function getTokenTools(): McpToolDefinition[] {
  return MCP_CATALOG.filter(t => !t.isOAuth);
}

export function getValidToolIds(): Set<string> {
  return new Set(MCP_CATALOG.map(t => t.id));
}
