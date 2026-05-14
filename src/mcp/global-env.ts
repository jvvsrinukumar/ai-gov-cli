import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { readEnvFile } from './env-files.js';

function getGlobalDir(overrideHome?: string): string {
  return join(overrideHome ?? homedir(), '.config', 'ai-gov');
}

/** Returns the absolute path to ~/.config/ai-gov/.env.mcp.global.
 *  Pass `overrideHome` in tests to redirect to a temp directory. */
export function getGlobalEnvPath(overrideHome?: string): string {
  return join(getGlobalDir(overrideHome), '.env.mcp.global');
}

export function ensureGlobalEnvDir(overrideHome?: string): void {
  const dir = getGlobalDir(overrideHome);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot create ${dir}: ${msg}. Check that the directory is writable.`);
    }
  }
}

export function readGlobalEnv(overrideHome?: string): Record<string, string> {
  const path = getGlobalEnvPath(overrideHome);
  if (!existsSync(path)) return {};
  return readEnvFile(path);
}

export function writeGlobalEnv(vars: Record<string, string>, overrideHome?: string): void {
  const dir = getGlobalDir(overrideHome);
  const path = join(dir, '.env.mcp.global');
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const existing = readGlobalEnv(overrideHome);
    const merged = { ...existing, ...vars };
    const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
    writeFileSync(path, lines.join('\n') + '\n', 'utf-8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot write global MCP tokens to ${path}: ${msg}. Check that ${dir} is writable.`);
  }
}
