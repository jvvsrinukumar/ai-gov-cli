/**
 * `ai-gov rescan` — re-runs the project scanner and updates the ScannerSnapshot
 * in governance-state.json without touching any steering files, hooks, or specs.
 *
 * Use when: ORM changed, dependencies upgraded, architecture refactored,
 * or any tooling change that would affect scanner detection.
 * Does NOT re-generate steering files — run `ai-gov upgrade --force` for that.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { Stack } from '../types.js';
import { createDefaultScanResult } from '../types.js';
import { detectStack } from '../detect-stack.js';
import { loadBaseProfile } from '../profiles.js';
import { scanProject } from '../scanners/index.js';
import { scanResultToSnapshot } from '../utils/scanner-snapshot.js';
import { detectAgent } from '../agents/detect-agent.js';
import { log } from '../utils/logger.js';
import { SCHEMA_FILENAME } from '../schemas/governance-state.schema.js';

export interface RescanOptions {
    dir: string;
    stack?: string;
    agent?: string;
}

export function runRescan(opts: RescanOptions): void {
    const projectDir = resolve(opts.dir);
    const agent = detectAgent(projectDir, opts.agent);
    const govDir = agent === 'kiro' ? '.kiro' : '.claude';
    const statePath = join(projectDir, govDir, SCHEMA_FILENAME);

    log.header('Rescan — Update Scanner Snapshot');

    if (!existsSync(statePath)) {
        log.error(`${govDir}/${SCHEMA_FILENAME} not found — run ai-gov init first.`);
        process.exit(1);
    }

    log.bold('--- Scanning project ---');
    const stack = detectStack(projectDir, opts.stack) as Stack;
    const profile = loadBaseProfile(stack);
    const scan = createDefaultScanResult();
    scanProject(stack, projectDir, profile, scan);

    const freshSnapshot = scanResultToSnapshot(scan, profile);

    let existing: Record<string, unknown>;
    try {
        existing = JSON.parse(readFileSync(statePath, 'utf-8')) as Record<string, unknown>;
    } catch {
        log.error(`Could not parse ${govDir}/${SCHEMA_FILENAME} — file may be corrupted. Run ai-gov init to regenerate.`);
        process.exit(1);
    }

    existing['scannerSnapshot'] = freshSnapshot;
    existing['lastUpdated'] = new Date().toISOString();

    writeFileSync(statePath, JSON.stringify(existing, null, 2) + '\n', 'utf-8');

    log.success(`Updated scannerSnapshot in ${govDir}/${SCHEMA_FILENAME}`);
    log.info(`Stack: ${profile.stackDisplay} · 15 scanner fields refreshed`);
    console.log('');
    console.log('  Steering files: unchanged');
    console.log('  Specs:          unchanged');
    console.log('  Hooks:          unchanged');
    console.log('');
    console.log('  Run ai-gov doctor to verify updated snapshot.');
}
