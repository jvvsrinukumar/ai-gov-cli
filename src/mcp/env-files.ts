import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { McpToolDefinition } from './types.js';
import { getGlobalEnvPath } from './global-env.js';

export function readEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/** Write vars to an env file, preserving existing comments and line structure.
 *  Keys already in the file are updated in-place. New keys are appended at the end. */
export function writeEnvFile(
  filePath: string,
  vars: Record<string, string>,
  toolName?: string
): void {
  const incoming = { ...vars };
  const outputLines: string[] = [];

  if (existsSync(filePath)) {
    for (const line of readFileSync(filePath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      // Preserve comments and blank lines as-is
      if (!trimmed || trimmed.startsWith('#')) {
        outputLines.push(line);
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        outputLines.push(line);
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();
      if (key && key in incoming) {
        // Update existing key with new value
        outputLines.push(`${key}=${incoming[key]}`);
        delete incoming[key];
      } else {
        outputLines.push(line);
      }
    }
  }

  // Append any new keys not found in the existing file
  const newKeys = Object.keys(incoming);
  if (newKeys.length > 0) {
    if (outputLines.length > 0 && outputLines[outputLines.length - 1] !== '') {
      outputLines.push('');
    }
    if (toolName) outputLines.push(`# ${toolName}`);
    for (const key of newKeys) {
      outputLines.push(`${key}=${incoming[key]}`);
    }
  }

  // Ensure single trailing newline
  const content = outputLines.join('\n').replace(/\n+$/, '') + '\n';
  writeFileSync(filePath, content, 'utf-8');
}

export function readMergedEnv(projectDir: string, overrideHome?: string): Record<string, string> {
  const globalEnv = readEnvFile(getGlobalEnvPath(overrideHome));
  const projectEnv = readEnvFile(join(projectDir, '.env.mcp'));
  return { ...globalEnv, ...projectEnv };
}

export function generateEnvExample(selectedTools: McpToolDefinition[]): string {
  const lines: string[] = [
    '# .env.mcp — project-scoped MCP tokens',
    '# Copy to .env.mcp and fill in your values.',
    '# This file is gitignored — never commit real tokens.',
    '',
  ];
  for (const tool of selectedTools) {
    const projectVars = tool.personalVars.filter(v => v.scope === 'project');
    if (projectVars.length === 0) continue;
    lines.push(`# ${tool.displayName}`);
    for (const v of projectVars) {
      lines.push(`# ${v.description}`);
      lines.push(`${v.name}=${v.example}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function generateEnvrc(): string {
  return [
    '# Load global MCP tokens (set once per developer)',
    `dotenv_if_exists ~/.config/ai-gov/.env.mcp.global`,
    '',
    '# Load project-scoped MCP tokens (per-repo)',
    'dotenv_if_exists .env.mcp',
  ].join('\n') + '\n';
}
