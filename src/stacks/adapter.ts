import type { Stack, Agent, ScanResult } from '../types.js';

export interface ScaffoldContext {
    // Common — always present (set by orchestrator)
    appName: string;       // snake_case (flutter) or kebab-case (next)
    displayName: string;   // Human-readable, e.g. "AccuShield"
    outputDir: string;     // Absolute path to parent directory
    projectDir: string;    // outputDir + '/' + appName

    // Governance — always present
    agent: Agent;
    gitHooks: boolean;
    ci: 'github' | 'gitlab' | 'bitbucket' | 'none';

    // Stack-specific — each adapter adds its own keys
    [key: string]: unknown;
}

export interface StackAdapter {
    readonly id: Stack;
    readonly displayName: string;
    readonly nameHint: string;

    /** Validate an app name for this stack. Returns true on success or an error string. */
    validateName(name: string): string | true;
    runPrompts(base: ScaffoldContext): Promise<ScaffoldContext>;
    scaffold(ctx: ScaffoldContext): Promise<void>;
    scanHints(ctx: ScaffoldContext): Partial<ScanResult>;
    postSetup(ctx: ScaffoldContext): Promise<void>;
}

export type ScaffoldScanHints = Partial<ScanResult>;
