import { existsSync, readdirSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import type { GovernanceConfig } from '../types.js';
import { safeWrite, type WriteOptions } from '../utils/safe-write.js';
import { log } from '../utils/logger.js';

export function generateMonorepoGovernance(c: GovernanceConfig, opts: WriteOptions, steeringDir?: string): void {
    if (!c.scan.detectedMonorepo) return;
    log.section('Monorepo:');

    const packages = discoverPackages(c);
    if (!packages.length) {
        log.warn('Monorepo detected but no packages found — skipping per-package governance');
        return;
    }
    log.detected(`Monorepo packages: ${packages.join(', ')}`);

    const pkgRows = packages.map(p => `| \`${p}\` | _describe_ | _layer flow_ |`).join('\n');

    // Use agent-aware default path when steeringDir is not explicitly provided
    const agentDirName = c.agent === 'kiro' ? '.kiro' : '.claude';
    const outDir = steeringDir ?? join(c.projectDir, agentDirName, 'steering');

    safeWrite(join(outDir, 'monorepo.md'), `# Monorepo Governance — ${c.project.appName}

**Tool:** ${c.scan.detectedMonorepo}
**Packages:** ${packages.length}

## Package Registry
| Package | Description | Layer Flow |
|---------|-------------|------------|
${pkgRows}

## Rules
1. **Scope awareness** — Before editing, identify which package the file belongs to
2. **Cross-package imports** — Never import directly from another package's \`src/\` internal files
3. **Per-package specs** — Each package has its own \`specs/\` directory
4. **Shared specs** — Cross-package features use root \`specs/\` directory
5. **Independent testing** — Run tests per-package: \`cd packages/<pkg> && ${c.profile.testCmd}\`
6. **Dependency changes** — Adding a dependency to one package requires checking if it should be in root vs package-level
`, opts);

    // Create per-package spec directories
    for (const pkg of packages) {
        let pkgBase = '';
        for (const dir of ['packages', 'apps', 'services', 'libs']) {
            if (existsSync(join(c.projectDir, dir, pkg))) { pkgBase = `${dir}/${pkg}`; break; }
        }
        if (!pkgBase) continue;
        const tmplDir = join(c.projectDir, pkgBase, 'specs', '_template');
        if (!existsSync(tmplDir)) {
            if (opts.dryRun) {
                log.dryNew(`${pkgBase}/specs/_template/`, 0);
            } else {
                mkdirSync(tmplDir, { recursive: true });
                for (const tmpl of ['requirements.md', 'design.md', 'tasks.md']) {
                    const src = join(c.projectDir, 'specs', '_template', tmpl);
                    if (existsSync(src)) copyFileSync(src, join(tmplDir, tmpl));
                }
                log.created(`${pkgBase}/specs/_template/ (copied from root)`);
            }
        }
    }
}

function discoverPackages(c: GovernanceConfig): string[] {
    const packages: string[] = [];
    const dirs = ['packages', 'apps', 'services', 'libs'];
    for (const dir of dirs) {
        const full = join(c.projectDir, dir);
        if (!existsSync(full)) continue;
        for (const entry of readdirSync(full, { withFileTypes: true })) {
            if (entry.isDirectory() && existsSync(join(full, entry.name, 'package.json'))) {
                packages.push(entry.name);
            }
        }
    }
    return packages;
}
