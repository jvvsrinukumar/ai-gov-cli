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

    // v14.2: API documentation guidance adapted to detected swagger style
    let apiDocsSection = '';
    if (s.detectedSwagger && s.detectedSwaggerStyle) {
        const sections: Record<string, string> = {
            decorators: `---\n\n## API Documentation — Decorator-Based (@nestjs/swagger)\n- All DTOs must have \`@ApiProperty()\` decorators on every field\n- All controllers must have \`@ApiTags()\` decorator\n- Use \`@ApiOperation()\`, \`@ApiResponse()\` on endpoints\n- Swagger UI available at \`/docs\` (or configured path)\n`,
            jsdoc: `---\n\n## API Documentation — JSDoc (swagger-jsdoc)\n- Document endpoints with \`@openapi\` / \`@swagger\` JSDoc comments above route handlers\n- Do NOT use \`@ApiProperty()\` decorators — this project uses JSDoc comments, not NestJS decorators\n- Schema definitions go in JSDoc \`components.schemas\` blocks or inline \`@swagger\` tags\n- Swagger UI served via swagger-ui-express at configured path\n`,
            tsoa: `---\n\n## API Documentation — TSOA\n- Controllers use TSOA decorators (\`@Route\`, \`@Get\`, \`@Post\`, etc.)\n- Request/response types are inferred from TypeScript interfaces — no manual schema needed\n- Run \`npx tsoa spec\` to regenerate swagger.json after controller changes\n- Do NOT edit generated swagger.json directly\n`,
            'fastify-schema': `---\n\n## API Documentation — Fastify JSON Schema\n- Define request/response schemas as JSON Schema objects in route options\n- Use \`schema: { body, querystring, params, response }\` on route definitions\n- Swagger auto-generated from route schemas by @fastify/swagger\n`,
            manual: `---\n\n## API Documentation — Static OpenAPI Spec\n- OpenAPI spec maintained as a static YAML/JSON file\n- Update the spec file manually when endpoints change\n- Do NOT use decorator-based documentation — this project uses a static spec\n`,
            'static-file': `---\n\n## API Documentation — Static OpenAPI Spec\n- OpenAPI spec maintained as a static YAML/JSON file\n- Update the spec file manually when endpoints change\n`,
        };
        apiDocsSection = sections[s.detectedSwaggerStyle] || '';
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
${apiDocsSection}
`;
}
