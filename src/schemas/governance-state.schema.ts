/**
 * Canonical state shared by /audit, /assess, /backlog, /doctor.
 *
 * Source of truth for governance state going forward (v20+).
 * Markdown files (.claude/audit-report.md, dead-code.md, developer-actions.md,
 * docs/assessment/*.md, docs/backlog/*.md) become rendered views over this JSON.
 *
 * Phase A scope:
 *   - Schema + TS types defined here.
 *   - Doctor production-ready reads it.
 *   - Audit/assess/backlog migration to read/write happens in subsequent commits.
 *
 * Schema version: 1.
 */

export const SCHEMA_VERSION = 1 as const;

export const SCHEMA_FILENAME = 'governance-state.json';

// ─── TypeScript types ────────────────────────────────────────────────────────

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';
export type EvidenceSource = 'manifest' | 'file-pattern' | 'heuristic' | 'user-input' | 'git-log';

export interface ConfidenceField<T = string> {
    value: T | null;
    confidence: Confidence;
    source: EvidenceSource;
}

/**
 * Scanner snapshot — only the 15 fields audit actually compares against.
 * Other ScanResult fields stay flat strings in their existing types. This
 * narrow wrapping is the Phase A scope (per v20 plan §3.1).
 */
export interface ScannerSnapshot {
    stateFramework: ConfidenceField;
    diFramework: ConfidenceField;
    detectedORM: ConfidenceField;
    detectedTestFramework: ConfidenceField;
    detectedLinter: ConfidenceField;
    detectedFormatter: ConfidenceField;
    detectedRouter: ConfidenceField;
    httpClient: ConfidenceField;
    archPattern: ConfidenceField;
    serviceStyle: ConfidenceField;
    featuresDir: ConfidenceField;
    sourceDir: ConfidenceField;
    layerNames: ConfidenceField<string[]>;
    localStorageName: ConfidenceField;
    scaffoldTool: ConfidenceField;
}

export interface Assumption {
    field: string;          // e.g. "assessment.businessPressure"
    inferredValue: unknown;
    evidence: string[];     // signals that fired
    confidence: Confidence;
    reviewRequired: boolean;
    timestamp: string;
}

export interface ParseGap {
    sourceFile: string;     // e.g. ".claude/audit-report.md"
    section: string;        // e.g. "Run 3 scorecard"
    reason: string;
    rawContent?: string;    // optional snippet for human review
}

export interface AuditRun {
    runNumber: number;
    date: string;
    scores: {
        governanceFiles: number;
        governanceAccuracy: number;
        steeringCoverage: number;
        testCoverage: number;           // informational only (per v20 plan §D)
        deadFileRisk: number;
        overall: number;
    };
    verdict: 'ALIGNED' | 'UPDATED' | 'ACTION_NEEDED';
    gapsFixed: number;
    gapsRemaining: number;
    persistFilesWritten: number;        // out of 3
    stepsCompleted: number;             // out of 12
    completionContract: string;         // e.g. "AUDIT_COMPLETE: persist-files=3/3 steps=12/12"
}

export interface DeadCodeEntry {
    id: number;
    path: string;
    reasonFlagged: string;
    firstDetected: string;
    status: 'PENDING' | 'DELETED' | 'KEPT';
    resolvedDate?: string;
    keptReason?: string;
}

export interface DeveloperAction {
    id: number;
    type: 'auto' | 'decision';
    action: string;
    whyItMatters: string;
    added: string;
    status: 'OPEN' | 'DONE' | 'DEFERRED';
    resolvedDate?: string;
    deferredReason?: string;
}

export interface AssessmentScore {
    score: 1 | 2 | 3 | 4;
    evidence: string;
}

export interface AssessmentState {
    date: string;
    recommendation: 'Rewrite' | 'Refactor' | 'Strangler Fig' | 'Leave It';
    confidence: Confidence;
    scoring: {
        testCoverage: AssessmentScore;
        architecture: AssessmentScore;
        dependencyHealth: AssessmentScore;
        teamKnowledge: AssessmentScore;
        businessPressure: AssessmentScore;
        codebaseScope: AssessmentScore;
        stability: AssessmentScore;
    };
    measurements: {
        totalSourceFiles: number;
        filesOver300Lines: number;
        filesOver500Lines: number;
        testCoverageScenario: 'A' | 'B' | 'C';
        testCoveragePercent: number;
        circularDependencies: number;
        outdatedDependencies: number;
        eolDependencies: number;
        hubFiles: number;
        orphanFiles: number;
        activeContributors: number;
        totalContributors: number;
    };
    debtPatternsDetected: string[];     // names of patterns found
    documents: string[];                // paths to docs/assessment/*.md
}

export interface BacklogStory {
    id: string;                          // e.g. "BACK-01"
    feature: string;
    sourceModule: string;
    debtItems: number[];                 // refs to assessment debt inventory
    phase: number;
    parallelSafe: boolean;
    dependsOn: string[];                 // story IDs
    priority: 'P1' | 'P2' | 'P3';
    priorityEvidence: {
        debtSeverityScore: number;
        dependencyCountScore: number;
        commitFrequencyScore: number;
        composite: number;
    };
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'SKIP';
}

export interface BacklogState {
    date: string;
    stories: BacklogStory[];
    skipList: { path: string; reason: string; source: 'dead-code' | 'developer-actions-kept' }[];
}

export type ACStatus = 'PASSING' | 'BLOCKING' | 'NOT_APPLICABLE';

export interface AcceptanceCriterion {
    id: string;                          // "AC-1" ... "AC-8"
    title: string;
    status: ACStatus;
    evidence: string;                    // why it's PASSING or BLOCKING
    lastChecked: string;
}

export interface GovernanceState {
    version: typeof SCHEMA_VERSION;
    project: {
        name: string;
        stack: string;
        hookVersion: string;
        agent: 'claude-code' | 'kiro';
    };
    lastUpdated: string;
    scannerSnapshot?: ScannerSnapshot;
    auditRuns: AuditRun[];
    deadCode: DeadCodeEntry[];
    developerActions: DeveloperAction[];
    assessment?: AssessmentState;
    backlog?: BacklogState;
    assumptions: Assumption[];
    parseGaps: ParseGap[];
    acceptanceCriteria: Record<string, AcceptanceCriterion>;
}

// ─── JSON Schema (Draft 07) ──────────────────────────────────────────────────

export const GOVERNANCE_STATE_SCHEMA = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'https://github.com/jvvsrinukumar/ai-gov-cli/schemas/governance-state-v1.json',
    title: 'Governance State',
    description: 'Canonical state shared by /audit, /assess, /backlog, /doctor',
    type: 'object',
    required: ['version', 'project', 'lastUpdated', 'auditRuns', 'deadCode',
               'developerActions', 'assumptions', 'parseGaps', 'acceptanceCriteria'],
    additionalProperties: false,
    properties: {
        version: { const: SCHEMA_VERSION },
        project: {
            type: 'object',
            required: ['name', 'stack', 'hookVersion', 'agent'],
            properties: {
                name: { type: 'string' },
                stack: { type: 'string' },
                hookVersion: { type: 'string' },
                agent: { enum: ['claude-code', 'kiro'] },
            },
        },
        lastUpdated: { type: 'string', format: 'date-time' },
        scannerSnapshot: { $ref: '#/definitions/scannerSnapshot' },
        auditRuns: { type: 'array', items: { $ref: '#/definitions/auditRun' } },
        deadCode: { type: 'array', items: { $ref: '#/definitions/deadCodeEntry' } },
        developerActions: { type: 'array', items: { $ref: '#/definitions/developerAction' } },
        assessment: { $ref: '#/definitions/assessment' },
        backlog: { $ref: '#/definitions/backlog' },
        assumptions: { type: 'array', items: { $ref: '#/definitions/assumption' } },
        parseGaps: { type: 'array', items: { $ref: '#/definitions/parseGap' } },
        acceptanceCriteria: {
            type: 'object',
            additionalProperties: { $ref: '#/definitions/acceptanceCriterion' },
        },
    },
    definitions: {
        confidenceField: {
            type: 'object',
            required: ['value', 'confidence', 'source'],
            properties: {
                value: { type: ['string', 'array', 'null'] },
                confidence: { enum: ['high', 'medium', 'low', 'unknown'] },
                source: { enum: ['manifest', 'file-pattern', 'heuristic', 'user-input', 'git-log'] },
            },
        },
        scannerSnapshot: {
            type: 'object',
            additionalProperties: false,
            properties: {
                stateFramework: { $ref: '#/definitions/confidenceField' },
                diFramework: { $ref: '#/definitions/confidenceField' },
                detectedORM: { $ref: '#/definitions/confidenceField' },
                detectedTestFramework: { $ref: '#/definitions/confidenceField' },
                detectedLinter: { $ref: '#/definitions/confidenceField' },
                detectedFormatter: { $ref: '#/definitions/confidenceField' },
                detectedRouter: { $ref: '#/definitions/confidenceField' },
                httpClient: { $ref: '#/definitions/confidenceField' },
                archPattern: { $ref: '#/definitions/confidenceField' },
                serviceStyle: { $ref: '#/definitions/confidenceField' },
                featuresDir: { $ref: '#/definitions/confidenceField' },
                sourceDir: { $ref: '#/definitions/confidenceField' },
                layerNames: { $ref: '#/definitions/confidenceField' },
                localStorageName: { $ref: '#/definitions/confidenceField' },
                scaffoldTool: { $ref: '#/definitions/confidenceField' },
            },
        },
        auditRun: {
            type: 'object',
            required: ['runNumber', 'date', 'scores', 'verdict', 'persistFilesWritten',
                       'stepsCompleted', 'completionContract'],
            properties: {
                runNumber: { type: 'integer', minimum: 1 },
                date: { type: 'string' },
                scores: {
                    type: 'object',
                    required: ['governanceFiles', 'governanceAccuracy', 'steeringCoverage',
                               'testCoverage', 'deadFileRisk', 'overall'],
                    properties: {
                        governanceFiles: { type: 'integer', minimum: 0, maximum: 100 },
                        governanceAccuracy: { type: 'integer', minimum: 0, maximum: 100 },
                        steeringCoverage: { type: 'integer', minimum: 0, maximum: 100 },
                        testCoverage: { type: 'integer', minimum: 0, maximum: 100 },
                        deadFileRisk: { type: 'integer', minimum: 0, maximum: 100 },
                        overall: { type: 'integer', minimum: 0, maximum: 100 },
                    },
                },
                verdict: { enum: ['ALIGNED', 'UPDATED', 'ACTION_NEEDED'] },
                gapsFixed: { type: 'integer', minimum: 0 },
                gapsRemaining: { type: 'integer', minimum: 0 },
                persistFilesWritten: { type: 'integer', minimum: 0, maximum: 3 },
                stepsCompleted: { type: 'integer', minimum: 0, maximum: 12 },
                completionContract: { type: 'string' },
            },
        },
        deadCodeEntry: {
            type: 'object',
            required: ['id', 'path', 'reasonFlagged', 'firstDetected', 'status'],
            properties: {
                id: { type: 'integer', minimum: 1 },
                path: { type: 'string' },
                reasonFlagged: { type: 'string' },
                firstDetected: { type: 'string' },
                status: { enum: ['PENDING', 'DELETED', 'KEPT'] },
                resolvedDate: { type: 'string' },
                keptReason: { type: 'string' },
            },
        },
        developerAction: {
            type: 'object',
            required: ['id', 'type', 'action', 'whyItMatters', 'added', 'status'],
            properties: {
                id: { type: 'integer', minimum: 1 },
                type: { enum: ['auto', 'decision'] },
                action: { type: 'string' },
                whyItMatters: { type: 'string' },
                added: { type: 'string' },
                status: { enum: ['OPEN', 'DONE', 'DEFERRED'] },
                resolvedDate: { type: 'string' },
                deferredReason: { type: 'string' },
            },
        },
        assessmentScore: {
            type: 'object',
            required: ['score', 'evidence'],
            properties: {
                score: { type: 'integer', minimum: 1, maximum: 4 },
                evidence: { type: 'string' },
            },
        },
        assessment: {
            type: 'object',
            required: ['date', 'recommendation', 'confidence', 'scoring', 'measurements'],
            properties: {
                date: { type: 'string' },
                recommendation: { enum: ['Rewrite', 'Refactor', 'Strangler Fig', 'Leave It'] },
                confidence: { enum: ['high', 'medium', 'low', 'unknown'] },
                scoring: {
                    type: 'object',
                    required: ['testCoverage', 'architecture', 'dependencyHealth',
                               'teamKnowledge', 'businessPressure', 'codebaseScope', 'stability'],
                    properties: {
                        testCoverage: { $ref: '#/definitions/assessmentScore' },
                        architecture: { $ref: '#/definitions/assessmentScore' },
                        dependencyHealth: { $ref: '#/definitions/assessmentScore' },
                        teamKnowledge: { $ref: '#/definitions/assessmentScore' },
                        businessPressure: { $ref: '#/definitions/assessmentScore' },
                        codebaseScope: { $ref: '#/definitions/assessmentScore' },
                        stability: { $ref: '#/definitions/assessmentScore' },
                    },
                },
                measurements: { type: 'object' },
                debtPatternsDetected: { type: 'array', items: { type: 'string' } },
                documents: { type: 'array', items: { type: 'string' } },
            },
        },
        backlog: {
            type: 'object',
            required: ['date', 'stories', 'skipList'],
            properties: {
                date: { type: 'string' },
                stories: { type: 'array', items: { $ref: '#/definitions/backlogStory' } },
                skipList: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['path', 'reason', 'source'],
                        properties: {
                            path: { type: 'string' },
                            reason: { type: 'string' },
                            source: { enum: ['dead-code', 'developer-actions-kept'] },
                        },
                    },
                },
            },
        },
        backlogStory: {
            type: 'object',
            required: ['id', 'feature', 'sourceModule', 'phase', 'priority',
                       'priorityEvidence', 'status'],
            properties: {
                id: { type: 'string', pattern: '^(BACK|FRONT)-[0-9]+$' },
                feature: { type: 'string' },
                sourceModule: { type: 'string' },
                debtItems: { type: 'array', items: { type: 'integer' } },
                phase: { type: 'integer', minimum: 1 },
                parallelSafe: { type: 'boolean' },
                dependsOn: { type: 'array', items: { type: 'string' } },
                priority: { enum: ['P1', 'P2', 'P3'] },
                priorityEvidence: {
                    type: 'object',
                    required: ['debtSeverityScore', 'dependencyCountScore',
                               'commitFrequencyScore', 'composite'],
                    properties: {
                        debtSeverityScore: { type: 'number' },
                        dependencyCountScore: { type: 'number' },
                        commitFrequencyScore: { type: 'number' },
                        composite: { type: 'number' },
                    },
                },
                status: { enum: ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'SKIP'] },
            },
        },
        assumption: {
            type: 'object',
            required: ['field', 'inferredValue', 'evidence', 'confidence',
                       'reviewRequired', 'timestamp'],
            properties: {
                field: { type: 'string' },
                inferredValue: {},
                evidence: { type: 'array', items: { type: 'string' } },
                confidence: { enum: ['high', 'medium', 'low', 'unknown'] },
                reviewRequired: { type: 'boolean' },
                timestamp: { type: 'string' },
            },
        },
        parseGap: {
            type: 'object',
            required: ['sourceFile', 'section', 'reason'],
            properties: {
                sourceFile: { type: 'string' },
                section: { type: 'string' },
                reason: { type: 'string' },
                rawContent: { type: 'string' },
            },
        },
        acceptanceCriterion: {
            type: 'object',
            required: ['id', 'title', 'status', 'evidence', 'lastChecked'],
            properties: {
                id: { type: 'string', pattern: '^AC-[1-8]$' },
                title: { type: 'string' },
                status: { enum: ['PASSING', 'BLOCKING', 'NOT_APPLICABLE'] },
                evidence: { type: 'string' },
                lastChecked: { type: 'string' },
            },
        },
    },
} as const;

// ─── Acceptance criteria definitions ─────────────────────────────────────────

export interface ACDefinition {
    id: string;
    title: string;
    description: string;
}

export const ACCEPTANCE_CRITERIA: ACDefinition[] = [
    {
        id: 'AC-1',
        title: 'Kiro parity for assess + backlog',
        description: 'workflow-assess.ts and workflow-backlog.ts exist under src/agents/kiro/hooks/ and are registered.',
    },
    {
        id: 'AC-2',
        title: 'Shared governance-state.json',
        description: 'Audit, assess, backlog read/write a single state file conforming to schema v1.',
    },
    {
        id: 'AC-3',
        title: '/assess runs with zero human-input gates',
        description: 'Business Pressure inferred from evidence rubric; assumptions[] logs every inference.',
    },
    {
        id: 'AC-4',
        title: '/backlog runs with zero human-input gates',
        description: 'Story priority derived from severity × dependency × commit frequency; reads developer-actions; skip-list fixed.',
    },
    {
        id: 'AC-5',
        title: '/doctor production-ready emits mechanical verdict',
        description: 'Single command returns PASSING or BLOCKING:[list] with no prose verdict.',
    },
    {
        id: 'AC-6',
        title: 'Generator tests at parity',
        description: 'Audit, assess, doctor each have ≥30 test assertions paralleling backlog.test.ts.',
    },
    {
        id: 'AC-7',
        title: 'Scanner confidence wrapper on 15 fields + --rescan',
        description: 'ScannerSnapshot fields carry value/confidence/source; --rescan consumes audit-emitted deltas.',
    },
    {
        id: 'AC-8',
        title: 'Completion contracts on every command',
        description: 'Audit, assess, backlog each emit a grep-able completion line the runner validates.',
    },
];
