import type { GovernanceConfig } from '../types.js';

export function generateArchitecture(c: GovernanceConfig): string {
    const p = c.profile, s = c.scan, b = c.blocks;
    const scaffoldSection = s.scaffoldTool ? `---\n\n## Scaffold — ${s.scaffoldTool}\n\`\`\`bash\n${s.scaffoldCmdFeature}\n\`\`\`\n` : '';
    const codegenSection = p.codegenCmd ? `---\n\n## Code Generation\nExtensions: \`${p.generatedExts}\`\n\`\`\`bash\n${p.codegenCmd}\n\`\`\`\n**Never edit generated files.** Edit source and regenerate.\n` : '';
    const mixedArchSection = s.mixedArch ? `\n> **${s.mixedArchNote}**\n` : '';

    // Legacy zone section — emitted when scanner detects dual-mode or legacy-only zones
    const legacyZoneSection = s.hasLegacyZones ? (() => {
        const legacyRows = s.legacyZones.map(z => `| \`${z}\` | Legacy pattern — match existing code style when working here |`).join('\n');
        const cleanRows = s.cleanZones.length
            ? s.cleanZones.map(z => `| \`${z}\` | Clean architecture — follow the layer flow above |`).join('\n')
            : '';
        const table = [legacyRows, cleanRows].filter(Boolean).join('\n');
        return `\n---\n\n## Zone Rules — Dual-Mode Project\n\n> **${s.legacyZoneNote}**\n\n| Zone | Rule |\n|------|------|\n${table}\n\n**Hard rules:**\n- Match the zone's existing patterns. Do NOT refactor legacy code as a side effect of a bug fix or feature.\n- New features go in the clean zone (${s.cleanZones[0] || 'new code'}). Never add new features to legacy zones.\n- If asked to fix a bug in a legacy zone, fix only the bug — no layer extractions, no pattern upgrades.\n`;
    })() : '';

    let structBlock: string;
    if (c.isBackend && c.stack === 'python') {
        structBlock = `\`\`\`\n${p.featuresDir.replace('app/', '')}  # Routers\napp/\n├── ${p.featuresDir.replace('app/', '')}  # Routers — one file per resource\n├── core/          # Security, middleware, exceptions\n├── db/            # Engine, session, base mixins\n├── models/        # SQLAlchemy ORM models\n├── schemas/       # Pydantic request/response schemas\n├── services/      # Business logic\n└── integrations/  # External service clients\n\`\`\``;
    } else if (c.isBackend && c.stack === 'java') {
        if (s.detectedOSGi) {
            structBlock = `\`\`\`\n<module>/\n├── src/main/java/<pkg>/\n│   ├── internal/      # Bundle-private implementation\n│   └── <api>/         # Exported API interfaces\n├── src/main/resources/\n│   └── OSGI-INF/      # OSGi component descriptors\n└── pom.xml            # Bundle manifest via bnd-maven-plugin\n\`\`\``;
        } else {
            structBlock = `\`\`\`\n${p.sourceDir}<pkg>/\n├── controller/    # @RestController — HTTP handlers\n├── service/       # @Service — business logic\n├── repository/    # @Repository — data access (Spring Data)\n├── model/         # @Entity — JPA entities\n├── dto/           # Request/response DTOs\n├── config/        # @Configuration — beans, security, etc.\n└── exception/     # @ControllerAdvice — global error handling\n\`\`\``;
        }
    } else if (c.isBackend && s.detectedSubtype === 'nestjs') {
        structBlock = `\`\`\`\n${p.sourceDir}<resource>/\n├── <resource>.controller.ts\n├── <resource>.service.ts\n├── <resource>.repository.ts\n├── dto/\n└── <resource>.module.ts\n\`\`\``;
    } else if (c.isBackend) {
        const arch = s.detectedArchPattern || '';
        if (arch === 'routes-models' && !s.mixedArch) {
            structBlock = `\`\`\`\n${p.sourceDir}\n├── routes/        # Route handlers\n├── models/        # Business logic + data access\n└── config/        # Configuration\n\`\`\``;
        } else if (arch === 'routes-only' && !s.mixedArch) {
            structBlock = `\`\`\`\n${p.sourceDir}\n├── routes/        # Route handlers\n└── config/        # Configuration\n\`\`\``;
        } else if (s.mixedArch) {
            structBlock = `\`\`\`\n${p.sourceDir}\n├── routes/        # Legacy: route handlers (dominant)\n├── models/        # Legacy: business logic + data\n├── controller/    # New: thin HTTP handlers\n├── service/       # New: business logic\n└── config/        # Configuration\n\`\`\``;
        } else {
            structBlock = `\`\`\`\n${p.sourceDir}\n├── controller/    # HTTP handlers\n├── service/       # Business logic\n├── models/        # Data models\n└── config/        # Configuration\n\`\`\``;
        }
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
            springdoc: `---\n\n## API Documentation — springdoc-openapi\n- Annotate controllers with \`@Tag\`, \`@Operation\`, \`@ApiResponse\`\n- Annotate DTOs with \`@Schema\` for field descriptions\n- Swagger UI available at \`/swagger-ui.html\` (or configured path)\n- OpenAPI spec auto-generated at \`/v3/api-docs\`\n`,
            springfox: `---\n\n## API Documentation — Springfox\n- Annotate controllers with \`@Api\`, \`@ApiOperation\`, \`@ApiResponse\`\n- Annotate models with \`@ApiModel\`, \`@ApiModelProperty\`\n- Swagger UI available at \`/swagger-ui/\`\n- Note: Springfox is legacy — consider migrating to springdoc-openapi\n`,
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
${apiDocsSection}${legacyZoneSection}
`;
}
