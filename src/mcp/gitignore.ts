import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const GITIGNORE_ENTRIES = ['.env.mcp'];

export function ensureMcpGitignore(dir: string): void {
  const filePath = join(dir, '.gitignore');
  try {
    if (!existsSync(filePath)) {
      writeFileSync(filePath, GITIGNORE_ENTRIES.join('\n') + '\n', 'utf-8');
      return;
    }
    const content = readFileSync(filePath, 'utf-8');
    const missing = GITIGNORE_ENTRIES.filter(entry => {
      const lines = content.split('\n').map(l => l.trim());
      return !lines.includes(entry);
    });
    if (missing.length > 0) {
      const suffix = content.endsWith('\n') ? '' : '\n';
      appendFileSync(filePath, suffix + missing.join('\n') + '\n', 'utf-8');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot update .gitignore at ${filePath}: ${msg}. Check that the file is writable.`);
  }
}
