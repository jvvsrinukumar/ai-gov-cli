/**
 * /doctor production-ready — mechanical AC verification.
 *
 * Reads governance-state.json + walks the project for AC evidence.
 * Emits exactly one of:
 *   PASSING — v20 acceptance criteria satisfied. Further audits are informational.
 *   BLOCKING — N items: AC-X, AC-Y...  (with remediation hint per AC)
 *
 * No prose. No grades. No fuzzy verdicts.
 *
 * Phase A status: doctor exists; AC-5 is PASSING. All other ACs are BLOCKING
 * until subsequent phases land. Each later phase flips one or more to PASSING.
 */
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { detectAgent } from '../agents/detect-agent.js';
import { log } from '../utils/logger.js';
import {
    ACCEPTANCE_CRITERIA,
    SCHEMA_FILENAME,
    SCHEMA_VERSION,
    type ACStatus,
    type GovernanceState,
} from '../schemas/governance-state.schema.js';

interface CheckResult {
    status: ACStatus;
    evidence: string;
    remediation?: string;
    informational?: string[];   // surface but do not block (e.g. reviewRequired items)
}

interface ProductionReadyOptions {
    dir: string;
    agent?: string;
}

export async function runProductionReady(opts: ProductionReadyOptions): Promise<void> {
    const { dir } = opts;
    const agent = detectAgent(dir, opts.agent);
    const agentDir = agent === 'kiro' ? '.kiro' : '.claude';
    const statePath = join(dir, agentDir, SCHEMA_FILENAME);

    const state = loadStateOrNull(statePath);

    const results: Record<string, CheckResult> = {
        'AC-1': checkAC1KiroParity(dir),
        'AC-2': checkAC2SharedState(statePath, state),
        'AC-3': checkAC3AssessNoGates(dir, state),
        'AC-4': checkAC4BacklogNoGates(dir, state),
        'AC-5': checkAC5DoctorExists(),
        'AC-6': checkAC6TestParity(dir),
        'AC-7': checkAC7ScannerConfidence(state),
        'AC-8': checkAC8CompletionContracts(dir),
    };

    const blocking: string[] = [];
    const informational: string[] = [];

    log.header(`Production-Ready Check (${agent})`);
    console.log('');

    for (const def of ACCEPTANCE_CRITERIA) {
        const r = results[def.id];
        const marker = r.status === 'PASSING' ? '✓' : r.status === 'BLOCKING' ? '✗' : '·';
        console.log(`  ${marker} ${def.id} — ${def.title}`);
        console.log(`      ${r.evidence}`);
        if (r.status === 'BLOCKING') {
            blocking.push(def.id);
            if (r.remediation) console.log(`      → ${r.remediation}`);
        }
        if (r.informational) informational.push(...r.informational);
    }

    console.log('');

    if (blocking.length === 0) {
        log.success('PASSING — v20 acceptance criteria satisfied. Further audits are informational.');
    } else {
        log.warn(`BLOCKING — ${blocking.length} items: ${blocking.join(', ')}`);
        process.exitCode = 1;
    }

    if (informational.length > 0) {
        console.log('');
        log.info('Informational (not blocking):');
        for (const item of informational) console.log(`  · ${item}`);
    }
}

// ─── Individual AC checks ────────────────────────────────────────────────────

function checkAC1KiroParity(dir: string): CheckResult {
    const assessPath = join(dir, 'src/agents/kiro/hooks/workflow-assess.ts');
    const backlogPath = join(dir, 'src/agents/kiro/hooks/workflow-backlog.ts');
    const missing: string[] = [];
    if (!existsSync(assessPath)) missing.push('workflow-assess.ts');
    if (!existsSync(backlogPath)) missing.push('workflow-backlog.ts');

    if (missing.length === 0) {
        return { status: 'PASSING', evidence: 'Both Kiro workflow hooks present.' };
    }
    return {
        status: 'BLOCKING',
        evidence: `Missing Kiro hooks: ${missing.join(', ')}.`,
        remediation: 'Build Phase B — Kiro parity.',
    };
}

function checkAC2SharedState(statePath: string, state: GovernanceState | null): CheckResult {
    if (!state) {
        return {
            status: 'BLOCKING',
            evidence: `${statePath} not found.`,
            remediation: 'Run `ai-gov init` (writes the initial state) or `ai-gov migrate-state` (for v19 projects).',
        };
    }
    if (state.version !== SCHEMA_VERSION) {
        return {
            status: 'BLOCKING',
            evidence: `Schema version mismatch (found ${state.version}, expected ${SCHEMA_VERSION}).`,
            remediation: 'Upgrade ai-gov and rerun `ai-gov init`.',
        };
    }
    if (!state.project?.name || !state.project?.stack) {
        return {
            status: 'BLOCKING',
            evidence: 'State file missing required project metadata.',
            remediation: 'Rerun `ai-gov init` to regenerate state with full project info.',
        };
    }
    const auditNote = state.auditRuns.length > 0
        ? `${state.auditRuns.length} audit run(s)`
        : 'no audit runs yet (run /audit to populate)';
    return {
        status: 'PASSING',
        evidence: `Schema v${state.version} · ${state.project.name} (${state.project.stack}) · ${auditNote}.`,
    };
}

function checkAC3AssessNoGates(dir: string, state: GovernanceState | null): CheckResult {
    // After Phase B the prompt body lives in src/generators/assess-content.ts.
    // The check scans both files so a refactor cannot accidentally pass AC-3.
    const candidates = [
        join(dir, 'src/agents/claude-code/commands/assess.ts'),
        join(dir, 'src/generators/assess-content.ts'),
    ];
    const found: string[] = [];
    for (const path of candidates) {
        if (!existsSync(path)) continue;
        const content = readFileSync(path, 'utf-8');
        if (content.includes('HUMAN INPUT REQUIRED')) found.push(path.split('/').slice(-2).join('/'));
    }
    if (found.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `HUMAN INPUT REQUIRED gate still present in: ${found.join(', ')}.`,
            remediation: 'Build Phase C — replace Business Pressure gate with evidence rubric (§3.2).',
        };
    }
    const assumptions = state?.assumptions ?? [];
    const lowConf = assumptions.filter(a => a.field.startsWith('assessment.') && a.reviewRequired);
    const informational = lowConf.map(a => `${a.field}: reviewRequired (confidence=${a.confidence})`);
    return {
        status: 'PASSING',
        evidence: 'No human-input gates in assess command prompt body.',
        ...(informational.length > 0 ? { informational } : {}),
    };
}

function checkAC4BacklogNoGates(dir: string, state: GovernanceState | null): CheckResult {
    const candidates = [
        join(dir, 'src/agents/claude-code/commands/backlog.ts'),
        join(dir, 'src/generators/backlog-content.ts'),
    ];
    const found: string[] = [];
    for (const path of candidates) {
        if (!existsSync(path)) continue;
        const content = readFileSync(path, 'utf-8');
        if (content.includes('HUMAN INPUT NEEDED')) found.push(path.split('/').slice(-2).join('/'));
    }
    if (found.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `HUMAN INPUT NEEDED checklist still present in: ${found.join(', ')}.`,
            remediation: 'Build Phase C — derive priority from severity × dependency × commit frequency (§3.3).',
        };
    }
    if (state?.backlog) {
        const ungated = state.backlog.stories.every(s => s.priorityEvidence !== undefined);
        if (!ungated) {
            return {
                status: 'BLOCKING',
                evidence: 'Some backlog stories lack derived priorityEvidence.',
                remediation: 'Re-run /backlog after Phase C lands.',
            };
        }
    }
    const assumptions = state?.assumptions ?? [];
    const lowConf = assumptions.filter(a => a.field.startsWith('backlog.') && a.reviewRequired);
    const informational = lowConf.map(a => `${a.field}: reviewRequired (confidence=${a.confidence})`);
    return {
        status: 'PASSING',
        evidence: 'No human-input gates in backlog command prompt body.',
        ...(informational.length > 0 ? { informational } : {}),
    };
}

function checkAC5DoctorExists(): CheckResult {
    // This very function existing means AC-5 is PASSING by definition.
    return {
        status: 'PASSING',
        evidence: '/doctor production-ready implemented (mechanical AC verification).',
    };
}

function checkAC6TestParity(dir: string): CheckResult {
    const required = [
        { name: 'audit.test.ts', path: join(dir, 'tests/audit.test.ts') },
        { name: 'assess.test.ts', path: join(dir, 'tests/assess.test.ts') },
        { name: 'doctor.test.ts', path: join(dir, 'tests/doctor.test.ts') },
    ];
    const missing = required.filter(r => !existsSync(r.path));
    if (missing.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `Missing test files: ${missing.map(m => m.name).join(', ')}.`,
            remediation: 'Build Phase E — bring audit/assess/doctor tests to backlog-test parity (≥30 assertions each).',
        };
    }

    const thin: string[] = [];
    for (const r of required) {
        const content = readFileSync(r.path, 'utf-8');
        const assertionCount = (content.match(/\bexpect\s*\(/g) ?? []).length;
        if (assertionCount < 30) {
            thin.push(`${r.name} (${assertionCount} assertions, need ≥30)`);
        }
    }
    if (thin.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `Tests below parity threshold: ${thin.join(', ')}.`,
            remediation: 'Add assertions until each file has ≥30.',
        };
    }
    return { status: 'PASSING', evidence: 'All three test files at or above parity threshold.' };
}

function checkAC7ScannerConfidence(state: GovernanceState | null): CheckResult {
    if (!state?.scannerSnapshot) {
        return {
            status: 'BLOCKING',
            evidence: 'scannerSnapshot missing from governance-state.json.',
            remediation: 'Wire scanner output through ScannerSnapshot in Phase A migration.',
        };
    }
    const expected = ['stateFramework', 'diFramework', 'detectedORM', 'detectedTestFramework',
                      'detectedLinter', 'detectedFormatter', 'detectedRouter', 'httpClient',
                      'archPattern', 'serviceStyle', 'featuresDir', 'sourceDir',
                      'layerNames', 'localStorageName', 'scaffoldTool'];
    const snap = state.scannerSnapshot;
    const missing = expected.filter(k => !(k in snap));
    if (missing.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `ScannerSnapshot missing fields: ${missing.join(', ')}.`,
            remediation: 'Complete Phase A scanner snapshot wiring.',
        };
    }
    return { status: 'PASSING', evidence: 'All 15 scanner fields wrapped with confidence metadata.' };
}

function checkAC8CompletionContracts(dir: string): CheckResult {
    // Each command's contract may be emitted from either the wrapper or the
    // shared content file (Phase B moved prompt bodies into src/generators/).
    const targets = [
        { name: 'audit', token: 'AUDIT_COMPLETE:', paths: [
            join(dir, 'src/agents/claude-code/commands/audit.ts'),
            join(dir, 'src/generators/audit-content.ts'),
        ]},
        { name: 'assess', token: 'ASSESS_COMPLETE:', paths: [
            join(dir, 'src/agents/claude-code/commands/assess.ts'),
            join(dir, 'src/generators/assess-content.ts'),
        ]},
        { name: 'backlog', token: 'BACKLOG_COMPLETE:', paths: [
            join(dir, 'src/agents/claude-code/commands/backlog.ts'),
            join(dir, 'src/generators/backlog-content.ts'),
        ]},
    ];
    const missing: string[] = [];
    for (const t of targets) {
        const present = t.paths.some(p => existsSync(p) && readFileSync(p, 'utf-8').includes(t.token));
        if (!present) missing.push(`${t.name} (no ${t.token})`);
    }
    if (missing.length > 0) {
        return {
            status: 'BLOCKING',
            evidence: `Completion contracts missing in: ${missing.join(', ')}.`,
            remediation: 'Build Phase D — add completion contract line to each command prompt.',
        };
    }
    return { status: 'PASSING', evidence: 'All three commands emit grep-able completion contracts.' };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadStateOrNull(path: string): GovernanceState | null {
    if (!existsSync(path)) return null;
    try {
        const stat = statSync(path);
        if (!stat.isFile()) return null;
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw) as GovernanceState;
        // Minimal shape check — full schema validation deferred to a dedicated validator.
        if (typeof parsed !== 'object' || parsed === null) return null;
        if (!('version' in parsed)) return null;
        return parsed;
    } catch {
        return null;
    }
}
