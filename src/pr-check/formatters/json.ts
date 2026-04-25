import type { CheckResult } from '../types.js';

export function formatJson(results: CheckResult[], changedFiles: string[]): string {
    const blockers = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const passed = results.filter(r => r.status === 'pass').length;

    const output = {
        summary: {
            changedFiles: changedFiles.length,
            blockers,
            warnings,
            passed,
            hasBlockers: blockers > 0,
        },
        checks: results,
        changedFiles,
    };

    return JSON.stringify(output, null, 2);
}
