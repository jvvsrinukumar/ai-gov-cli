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

    return `# Coding Standards — ${p.stackDisplay}

## Naming
- **Classes:** ${p.namingClasses}
- **Methods/Variables:** ${p.namingMethods}
- **Constants:** ${p.namingConstants}
- **Files:** ${p.namingFiles}

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
`;
}
