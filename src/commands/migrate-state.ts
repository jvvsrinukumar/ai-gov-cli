/**
 * `ai-gov migrate-state` — produces .claude/governance-state.json
 * (or .kiro/governance-state.json) from existing v19 markdown artifacts.
 *
 * Idempotent and non-destructive: markdown source files are never modified.
 * Existing governance-state.json is overwritten only with --force.
 */
import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { detectAgent } from '../agents/detect-agent.js';
import { log } from '../utils/logger.js';
import { migrateToState } from '../utils/state-migration.js';
import { SCHEMA_FILENAME } from '../schemas/governance-state.schema.js';

interface MigrateOptions {
    dir: string;
    agent?: string;
    force?: boolean;
}

export async function runMigrateState(opts: MigrateOptions): Promise<void> {
    const { dir } = opts;
    const agent = detectAgent(dir, opts.agent);
    const govDir = agent === 'kiro' ? '.kiro' : '.claude';
    const outPath = join(dir, govDir, SCHEMA_FILENAME);

    log.header(`Migrate State (${agent})`);

    if (existsSync(outPath) && !opts.force) {
        log.warn(`${govDir}/${SCHEMA_FILENAME} already exists — pass --force to overwrite.`);
        process.exitCode = 1;
        return;
    }

    const projectName = readProjectName(dir);
    const stack = readStack(dir, govDir);
    const hookVersion = readHookVersion(dir, govDir);

    const result = migrateToState({
        projectDir: dir,
        agent,
        projectName,
        stack,
        hookVersion,
    });

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(result.state, null, 2) + '\n', 'utf-8');

    log.success(`Wrote ${govDir}/${SCHEMA_FILENAME}`);
    console.log('');
    console.log(`  Sources read:    ${result.sourcesRead.length ? result.sourcesRead.join(', ') : '(none)'}`);
    console.log(`  Sources absent:  ${result.sourcesAbsent.length ? result.sourcesAbsent.join(', ') : '(none)'}`);
    console.log(`  Audit runs:      ${result.state.auditRuns.length}`);
    console.log(`  Dead code:       ${result.state.deadCode.length}`);
    console.log(`  Dev actions:     ${result.state.developerActions.length}`);
    console.log(`  Parse gaps:      ${result.state.parseGaps.length}`);

    if (result.state.parseGaps.length > 0) {
        console.log('');
        log.info('Parse gaps (not blocking — manual review possible):');
        for (const g of result.state.parseGaps.slice(0, 5)) {
            console.log(`  · ${g.sourceFile} [${g.section}]: ${g.reason}`);
        }
        if (result.state.parseGaps.length > 5) {
            console.log(`  · ... ${result.state.parseGaps.length - 5} more (see ${govDir}/${SCHEMA_FILENAME})`);
        }
    }
}

// ─── Best-effort project metadata reads ──────────────────────────────────────

function readProjectName(dir: string): string {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
        try {
            const json = JSON.parse(readFileSync(pkg, 'utf-8')) as { name?: string };
            if (json.name) return json.name;
        } catch { /* fall through */ }
    }
    return dir.split('/').pop() || 'unknown';
}

function readStack(dir: string, govDir: string): string {
    const settings = join(dir, govDir, 'settings.json');
    if (existsSync(settings)) {
        try {
            const json = JSON.parse(readFileSync(settings, 'utf-8')) as { stack?: string };
            if (json.stack) return json.stack;
        } catch { /* ignore */ }
    }
    return 'unknown';
}

function readHookVersion(dir: string, govDir: string): string {
    const settings = join(dir, govDir, 'settings.json');
    if (existsSync(settings)) {
        try {
            const json = JSON.parse(readFileSync(settings, 'utf-8')) as { hookVersion?: string };
            if (json.hookVersion) return json.hookVersion;
        } catch { /* ignore */ }
    }
    return '0.0.0';
}
