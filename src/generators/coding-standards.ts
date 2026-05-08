import type { GovernanceConfig } from '../types.js';

export function generateCodingStandards(c: GovernanceConfig): string {
    const p = c.profile, b = c.blocks;
    let fileSizeSection = '';
    if (['flutter', 'kotlin', 'react', 'angular'].includes(c.stack)) {
        const tables: Record<string, string> = {
            flutter: `| Widget file > 200 lines | Extract child widgets into separate files |\n| Cubit/Notifier > 200 lines | Split into multiple use cases |\n| Repository > 200 lines | Split by domain entity |`,
            kotlin: `| Screen/Composable > 200 lines | Extract @Composable sub-components |\n| ViewModel > 200 lines | Extract use cases |\n| Repository > 200 lines | Split by entity |`,
            react: `| Component > 200 lines | Extract sub-components; move logic to custom hooks |\n| Custom hook > 200 lines | Split into smaller hooks |\n| Service/API file > 200 lines | Split by resource |`,
            angular: `| Component > 200 lines | Extract child components |\n| Service > 200 lines | Split into focused services |\n| Template > 200 lines | Extract into child components |`,
        };
        fileSizeSection = `\n## File Size — 200-Line Maximum\nEvery source file must stay under **200 lines**.\n\n### How to Decompose\n| When | Action |\n|------|--------|\n${tables[c.stack]}\n\n### Excluded from 200-Line Rule\n- Test files\n- Generated files (\`${p.generatedPatterns || '*.generated.*'}\`)\n- Configuration files\n- Barrel/index files\n- Type definition files`;
    }

    // Zone-specific rules for dual-mode / legacy projects
    const s = c.scan;
    const zoneRulesSection = s.hasLegacyZones && s.legacyZones.length ? (() => {
        const legacyList = s.legacyZones.map(z => `- \`${z}\``).join('\n');
        const cleanList  = s.cleanZones.length
            ? s.cleanZones.map(z => `- \`${z}\``).join('\n')
            : '- *(none yet — all code is legacy)*';
        return `\n## Zone Rules — Dual-Mode Project\n\n### Legacy zones (match existing style):\n${legacyList}\n\nWhen working in a legacy zone:\n- Use the patterns already present in that zone. Do not introduce new abstractions.\n- Keep business logic where it currently lives (even if that breaks the clean arch layer flow).\n- Bug fixes only — no refactoring.\n\n### Clean zones (follow layer flow):\n${cleanList}\n\nWhen working in a clean zone:\n- Strictly follow the layer flow: \`${p.layerFlow}\`\n- Never put business logic in \`${p.layerUI}\` layer.\n- All new features must start here.\n`;
    })() : '';

    return `# Coding Standards — ${p.stackDisplay}

## Naming
- **Classes:** ${p.namingClasses}
- **Methods/Variables:** ${p.namingMethods}
- **Constants:** ${p.namingConstants}
- **Files:** ${p.namingFiles}

> See \`naming-conventions.md\` for full file naming patterns by layer and directory conventions.

## Type Naming
${b.typeNaming}

## State Pattern
${p.statePattern}

## Error Handling
${p.errorPattern}
${fileSizeSection}

## Comments
- No inline "what" comments — code is self-documenting
- Only "why" comments for non-obvious reasons
- No TODO in production — create a ${c.project.ticketSystem} ticket

## Testing
${b.testLayers}

## Imports
${p.importStyle}
${zoneRulesSection}`;
}
