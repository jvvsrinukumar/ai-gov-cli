import { readHubConfig } from './hub-config.js';
import { log } from './logger.js';

export function displayTransparencyDisclosure(projectDir: string): void {
    const hubConfig = readHubConfig(projectDir);
    if (!hubConfig || !hubConfig.hub) return;

    console.log('');
    log.section('  Hub Telemetry Disclosure');
    console.log('');
    console.log(`  Hub URL: ${hubConfig.hub}`);
    console.log('');
    console.log('  Data reported on git push:');
    console.log('    • Commit count');
    console.log('    • Compliance percentage');
    console.log('    • Violation counts');
    console.log('');
    console.log('  Privacy:');
    console.log('    • No source code or commit messages are sent');
    console.log('    • Developer emails are hashed (SHA-256) before transmission');
    console.log('');
    console.log('  To disable telemetry:');
    console.log('    export AI_GOV_TELEMETRY=off');
    console.log('');
}
