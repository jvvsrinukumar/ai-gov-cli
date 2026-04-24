import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, relative } from 'path';
import type { ConflictMode } from '../types.js';
import { log } from './logger.js';

export interface WriteOptions {
    overwrite: boolean;
    dryRun: boolean;
    updateHooks: boolean;
    hookVersion: string;
    projectDir: string;
    conflictMode?: ConflictMode;
    onConflict?: (rel: string) => boolean;
}

export function safeWrite(filePath: string, content: string, opts: WriteOptions): boolean {
    mkdirSync(dirname(filePath), { recursive: true });
    const rel = relative(opts.projectDir, filePath);

    if (opts.dryRun) {
        if (existsSync(filePath)) {
            const existing = readFileSync(filePath, 'utf-8');
            if (existing === content) {
                log.dryNoChange(rel);
            } else {
                log.dryUpdate(rel);
            }
        } else {
            const lines = content.split('\n').length;
            log.dryNew(rel, lines);
        }
        return false;
    }

    if (existsSync(filePath) && !opts.overwrite) {
        const mode = opts.conflictMode ?? 'keep';

        // ask mode: prompt developer for each file whose content actually changed
        if (mode === 'ask' && opts.onConflict) {
            const existing = readFileSync(filePath, 'utf-8');
            if (existing === content) return false;  // identical — no conflict, no prompt
            if (opts.onConflict(rel)) {
                writeFileSync(filePath, content);
                log.approved(rel);
                return true;
            }
            log.kept(rel);
            return false;
        }

        // keep mode (default): hook versioning then skip
        if (opts.updateHooks && filePath.endsWith('.sh')) {
            const existing = readFileSync(filePath, 'utf-8');
            const match = existing.match(/# HOOK_VERSION=(\S+)/);
            if (match && match[1] !== opts.hookVersion) {
                writeFileSync(filePath, content);
                log.updated(rel, match[1], opts.hookVersion);
                return true;
            }
            log.current(rel, match?.[1] ?? 'unknown');
            return false;
        }
        log.skipped(rel);
        return false;
    }

    writeFileSync(filePath, content);
    log.created(rel);
    return true;
}
