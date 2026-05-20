import type { GovernanceConfig } from '../types.js';
import { generateNamingConventions } from './naming-conventions.js';

function generateArchLayersBlock(c: GovernanceConfig): string {
    const s = c.scan;

    if (c.isBackend) {
        if (s.detectedSubtype === 'nestjs') {
            return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: controller | paths: *.controller.ts, controller/
arch-layer: service | paths: *.service.ts, service/
arch-layer: data | paths: *.repository.ts, repository/, db/

arch-rule: controller | cannot-import | data | Route through service layer
arch-rule: data | cannot-import | controller | Circular dependency
`;
        }
        if (c.stack === 'python') {
            return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: router | paths: routers/, api/, routes/, views/
arch-layer: service | paths: services/
arch-layer: data | paths: models/, db/, repository/, crud/

arch-rule: router | cannot-import | data | Route through service layer
arch-rule: data | cannot-import | router | Circular dependency
`;
        }
        if (c.stack === 'java' && !s.detectedOSGi) {
            return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: controller | paths: controller/
arch-layer: service | paths: service/
arch-layer: data | paths: repository/, dao/, model/

arch-rule: controller | cannot-import | data | Route through service layer
arch-rule: data | cannot-import | controller | Circular dependency
`;
        }
        if (c.stack === 'nodejs') {
            const arch = s.detectedArchPattern || '';
            if (arch === 'routes-only') {
                return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: router | paths: routes/, controllers/, api/

`;
            }
            return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: router | paths: routes/, controllers/, api/
arch-layer: service | paths: services/, handlers/
arch-layer: data | paths: models/, repository/, dao/, db/

arch-rule: router | cannot-import | data | Route through service layer
arch-rule: data | cannot-import | router | Circular dependency
`;
        }
        // Generic backend fallback
        return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: router | paths: routes/, controllers/, api/
arch-layer: service | paths: services/
arch-layer: data | paths: models/, repository/, db/

arch-rule: router | cannot-import | data | Route through service layer
arch-rule: data | cannot-import | router | Circular dependency
`;
    }

    // Frontend / mobile stacks
    if (c.stack === 'react') {
        return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: ui | paths: components/, pages/, app/, views/, screens/
arch-layer: state | paths: store/, redux/, slices/, hooks/, context/
arch-layer: data | paths: services/, api/, repositories/

arch-rule: ui | cannot-import | data | Route through hooks/services
arch-rule: data | cannot-import | ui | Circular dependency
arch-rule: ui | no-network | Use service/API layer
`;
    }
    if (c.stack === 'angular') {
        return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: ui | paths: components/, pages/, views/
arch-layer: state | paths: store/, effects/, reducers/, facades/
arch-layer: data | paths: services/, api/, repositories/

arch-rule: ui | cannot-import | data | Route through services/facades
arch-rule: data | cannot-import | ui | Circular dependency
arch-rule: ui | no-network | Use service layer
`;
    }
    if (c.stack === 'kotlin') {
        return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: ui | paths: ui/, presentation/, fragment/, activity/, screens/
arch-layer: domain | paths: domain/, usecase/, interactor/
arch-layer: data | paths: data/, repository/, datasource/, remote/

arch-rule: ui | cannot-import | data | Route through ViewModel/UseCase
arch-rule: data | cannot-import | ui | Circular dependency
arch-rule: ui | no-network | Use repository/service layer
arch-rule: domain | no-framework | Domain must remain framework-agnostic
`;
    }
    if (c.stack === 'swiftui') {
        return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: ui | paths: Views/, Screens/
arch-layer: domain | paths: ViewModels/, Domain/, UseCases/
arch-layer: data | paths: Repositories/, Services/, Data/

arch-rule: ui | cannot-import | data | Route through ViewModel
arch-rule: data | cannot-import | ui | Circular dependency
arch-rule: ui | no-network | Use repository/service layer
arch-rule: domain | no-framework | Domain must remain framework-agnostic
`;
    }
    // Flutter and generic mobile/frontend
    return `
---

## Hook Data — Architecture Layers
<!-- parsed by git-hooks/checks/architecture.sh — do not rename this section -->
arch-layer: ui | paths: presentation/, screens/, widgets/, components/, pages/, views/
arch-layer: domain | paths: domain/, usecase/, interactor/
arch-layer: data | paths: data/, repository/, datasource/, remote/, local/

arch-rule: ui | cannot-import | data | Route through UseCase/ViewModel/BLoC
arch-rule: data | cannot-import | ui | Circular dependency
arch-rule: ui | no-network | Use repository/service layer
arch-rule: domain | no-framework | Domain must remain framework-agnostic
`;
}

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

    // External services + data layer (backend stacks only)
    const externalServicesSection = c.isBackend ? buildExternalServicesSection(c) : '';
    const dataLayerSection = buildDataLayerSection(c);
    // Naming conventions absorbed (previously separate naming-conventions.md)
    const namingSection = `\n---\n\n${generateNamingConventions(c)}`;

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
${apiDocsSection}${legacyZoneSection}${generateArchLayersBlock(c)}${externalServicesSection}${dataLayerSection}${namingSection}`;
}

function buildExternalServicesSection(c: GovernanceConfig): string {
    const s = c.scan;
    const lines: string[] = [];
    if (s.detectedORM && s.detectedORM !== 'not detected')
        lines.push(`- **DB (${s.detectedORM}):** all access via repository layer — never raw queries in controllers`);
    if (s.detectedDBDriver)
        lines.push(`- **DB driver (${s.detectedDBDriver}):** always wrapped by repository; no driver calls in services`);
    if (s.detectedAuth)
        lines.push(`- **Auth (${s.detectedAuth}):** never replicate auth logic in app code — delegate to auth layer`);
    if (s.detectedQueue)
        lines.push(`- **Queue (${s.detectedQueue}):** all async work via queue — never block request thread`);
    if (s.detectedRealtime)
        lines.push(`- **Realtime (${s.detectedRealtime}):** event emission only from service layer, not controllers`);
    lines.push(`- **External APIs:** document each in \`.kiro/notes/\` or \`.claude/notes/\` and reference from system-context`);
    return `\n---\n\n## External Service Boundaries\n${lines.join('\n')}\n`;
}

function buildDataLayerSection(c: GovernanceConfig): string {
    const orm = c.scan.detectedORM || '';
    let content = '';
    if (orm === 'Prisma') {
        content = `- \`schema.prisma\` is the single source of truth — never edit generated migration files manually\n- Run \`npx prisma migrate dev\` for schema changes; commit migration alongside code`;
    } else if (orm === 'TypeORM') {
        content = `- \`@Entity\`/\`@Column\` decorators define schema — always use migrations for schema changes\n- Never use \`synchronize: true\` in production`;
    } else if (orm === 'Sequelize') {
        content = `- Migrations live in \`migrations/\` — never modify applied migrations\n- Use \`sequelize-cli migration:generate\` for all schema changes`;
    } else if (orm === 'Drizzle') {
        content = `- Schema defined in TypeScript — run \`drizzle-kit generate\` for migrations\n- Never edit generated SQL files manually`;
    } else if (orm === 'SQLAlchemy') {
        content = `- Base models live in \`models/\` — Alembic manages all schema changes\n- Run \`alembic revision --autogenerate\`, review SQL, then \`alembic upgrade head\``;
    } else if (c.stack === 'java') {
        content = `- \`@Entity\` + \`@Repository\` (Spring Data) — never use \`EntityManager\` directly in services\n- Flyway/Liquibase manages all schema changes — no manual DDL`;
    } else if (c.stack === 'kotlin') {
        content = `- Room: \`@Entity\`/\`@Dao\`/\`@Database\` — use \`Flow<T>\` for reactive queries\n- Increment \`version\` in \`@Database\` and provide \`Migration\` objects for every schema change`;
    } else {
        content = `- [Team: document ORM/schema approach, migration tool, and rules here]`;
    }
    if (!content) return '';
    return `\n---\n\n## Data Layer Patterns\n${content}\n`;
}
