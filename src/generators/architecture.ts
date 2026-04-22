import type { GovernanceConfig } from '../types.js';

export function generateArchitecture(c: GovernanceConfig): string {
    const p = c.profile, s = c.scan, b = c.blocks;
    const scaffoldSection = s.scaffoldTool ? `---\n\n## Scaffold — ${s.scaffoldTool}\n\`\`\`bash\n${s.scaffoldCmdFeature}\n\`\`\`\n` : '';
    const codegenSection = p.codegenCmd ? `---\n\n## Code Generation\nExtensions: \`${p.generatedExts}\`\n\`\`\`bash\n${p.codegenCmd}\n\`\`\`\n**Never edit generated files.** Edit source and regenerate.\n` : '';
    const mixedArchSection = s.mixedArch ? `\n> **${s.mixedArchNote}**\n` : '';

    let structBlock: string;
    if (c.isBackend && c.stack === 'python') {
        structBlock = `\`\`\`\n${p.featuresDir.replace('app/', '')}  # Routers\napp/\n├── ${p.featuresDir.replace('app/', '')}  # Routers — one file per resource\n├── core/          # Security, middleware, exceptions\n├── db/            # Engine, session, base mixins\n├── models/        # SQLAlchemy ORM models\n├── schemas/       # Pydantic request/response schemas\n├── services/      # Business logic\n└── integrations/  # External service clients\n\`\`\``;
    } else if (c.isBackend && s.detectedSubtype === 'nestjs') {
        structBlock = `\`\`\`\n${p.sourceDir}<resource>/\n├── <resource>.controller.ts\n├── <resource>.service.ts\n├── <resource>.repository.ts\n├── dto/\n└── <resource>.module.ts\n\`\`\``;
    } else if (c.isBackend) {
        structBlock = `\`\`\`\n${p.sourceDir}\n├── controller/    # HTTP handlers\n├── service/       # Business logic\n├── models/        # Data models\n└── config/        # Configuration\n\`\`\``;
    } else {
        structBlock = `\`\`\`\n${p.sourceDir}<feature>/\n├── data/          # DataSource, DTOs, API service\n├── domain/        # Domain models, UseCase interfaces\n├── presentation/  # ${p.layerUI}s / ${p.layerState}\n└── README.md\n\`\`\``;
    }

    return `# Architecture — ${p.stackDisplay}
${mixedArchSection}
## Layer Flow
\`\`\`
${p.layerFlow}
\`\`\`
${b.layerResps}

${b.diText}

---

## Project Structure
${structBlock}

${scaffoldSection}
${codegenSection}
---

## State Pattern
${p.statePattern}

---

## General Rules
- Never skip a layer
- Never expose raw DTOs to ${p.layerNames[0]} layer
- Dependencies flow inward: ${p.layerFlow}
`;
}
