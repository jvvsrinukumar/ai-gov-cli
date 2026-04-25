import chalk from 'chalk';
import type { CheckResult } from '../types.js';

const STATUS_ICON: Record<string, string> = {
    pass: chalk.green('✅'),
    fail: chalk.red('❌'),
    warn: chalk.yellow('⚠️ '),
    skip: chalk.gray('⏭ '),
};

export function formatTerminal(results: CheckResult[], changedFiles: string[]): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(chalk.bold('  ════════════════════════════════════'));
    lines.push(chalk.bold('    Governance PR Check'));
    lines.push(chalk.bold('  ════════════════════════════════════'));
    lines.push(`  Changed files: ${changedFiles.length}`);
    lines.push('');

    for (const result of results) {
        const icon = STATUS_ICON[result.status] ?? '  ';
        lines.push(`  ${icon} ${chalk.bold(result.name)}: ${result.details}`);
        for (const item of result.items) {
            const prefix = item.severity === 'error' ? chalk.red('    →') : chalk.yellow('    →');
            lines.push(`${prefix} ${item.file}: ${item.message}`);
        }
    }

    lines.push('');
    const blockers = results.filter(r => r.status === 'fail').length;
    const warnings = results.filter(r => r.status === 'warn').length;
    const passed = results.filter(r => r.status === 'pass').length;

    if (blockers > 0) {
        lines.push(chalk.red(`  ❌ ${blockers} blocker(s), ${warnings} warning(s), ${passed} passed`));
    } else if (warnings > 0) {
        lines.push(chalk.yellow(`  ⚠️  ${warnings} warning(s), ${passed} passed — no blockers`));
    } else {
        lines.push(chalk.green(`  ✅ All ${passed} checks passed`));
    }
    lines.push('');

    return lines.join('\n');
}
