import chalk from 'chalk';

export const log = {
    detected: (msg: string) => console.log(`  ${chalk.green('+')} ${msg}`),
    scanning: (msg: string) => console.log(`  ${chalk.cyan('~')} ${msg}`),
    created: (rel: string) => console.log(`  ${chalk.green('Created')}: ${rel}`),
    updated: (rel: string, from: string, to: string) =>
        console.log(`  ${chalk.green('Updated')}: ${rel} (${from} → ${to})`),
    current: (rel: string, ver: string) =>
        console.log(`  ${chalk.green('Current')}: ${rel} (v${ver})`),
    approved: (rel: string) => console.log(`  ${chalk.green('Updated')}: ${rel} (approved)`),
    skipped: (rel: string) => console.log(`  ${chalk.yellow('Skipped')}: ${rel}`),
    kept: (rel: string) => console.log(`  ${chalk.green('Kept')}: ${rel}`),
    merged: (msg: string) => console.log(`  ${chalk.green('Merged')}: ${msg}`),
    dryNew: (rel: string, lines: number) =>
        console.log(`  ${chalk.cyan('[dry-run]')} ${rel} (new file, ${lines} lines)`),
    dryNoChange: (rel: string) =>
        console.log(`  ${chalk.green('[dry-run]')} ${rel} (no changes)`),
    dryUpdate: (rel: string) =>
        console.log(`  ${chalk.yellow('[dry-run]')} ${rel} (would update)`),
    warn: (msg: string) => console.log(`  ${chalk.yellow('⚠')} ${msg}`),
    error: (msg: string) => console.error(chalk.red(msg)),
    info: (msg: string) => console.log(chalk.cyan(msg)),
    bold: (msg: string) => console.log(chalk.bold(msg)),
    header: (msg: string) => {
        console.log('');
        console.log(chalk.bold('============================================'));
        console.log(chalk.bold(` ${msg}`));
        console.log(chalk.bold('============================================'));
        console.log('');
    },
    section: (msg: string) => console.log(chalk.bold(msg)),
    success: (msg: string) => console.log(chalk.green(msg)),
};
