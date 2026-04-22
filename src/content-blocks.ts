import type { BaseProfile, ScanResult, ContentBlocks, Stack } from './types.js';

export function computeContentBlocks(
    stack: Stack, profile: BaseProfile, scan: ScanResult
): ContentBlocks {
    const lc = profile.layerNames.length;
    const ui = profile.layerNames[0];
    const data = profile.layerNames[lc - 1];
    const isBackend = stack === 'nodejs' || stack === 'python';

    const blocks: ContentBlocks = {
        keyPackages: buildKeyPackages(profile, scan),
        highRiskDisplay: buildHighRiskDisplay(scan),
        hardRules: buildHardRules(stack, profile, scan, isBackend, lc, ui, data),
        layerResps: buildLayerResps(profile, scan, isBackend, lc),
        diText: buildDIText(profile),
        typeNaming: buildTypeNaming(stack, profile, scan, isBackend, lc),
        testLayerList: buildTestLayerList(profile, lc),
        testLayers: buildTestLayers(stack, profile, isBackend, lc, ui),
        designFiles: buildDesignFiles(stack, profile, scan, isBackend, lc, ui),
        designLayerTable: buildDesignLayerTable(profile, scan, isBackend, lc),
        hardRulesCompliance: buildHardRulesCompliance(stack, profile, isBackend, lc, ui, data),
        taskDataPhase: buildTaskDataPhase(stack, profile, scan, isBackend, data),
        taskLogicPhase: buildTaskLogicPhase(profile, isBackend, lc),
        taskStatePhase: buildTaskStatePhase(stack, profile, isBackend, lc),
        taskUIPhase: buildTaskUIPhase(profile, isBackend),
        taskTestPhase: buildTaskTestPhase(stack, profile, isBackend, lc, ui),
        layerExecOrder: buildLayerExecOrder(stack, profile, isBackend, lc),
    };
    return blocks;
}

function buildKeyPackages(profile: BaseProfile, scan: ScanResult): string {
    const parts: string[] = [];
    const add = (val: string, label: string) => { if (val && val !== 'N/A') parts.push(`\`${val}\` (${label})`); };
    add(profile.stateFramework, 'state');
    add(profile.diFramework, 'DI');
    add(scan.detectedNetwork, 'HTTP');
    add(scan.detectedNetworkSwift, 'HTTP');
    add(scan.detectedRouter, 'nav');
    add(scan.detectedORM, 'DB');
    add(scan.detectedLocalDB, 'DB');
    add(scan.detectedLocalDBSwift, 'DB');
    add(scan.detectedTestFramework, 'test');
    add(scan.detectedI18N, 'i18n');
    add(scan.detectedCSSApproach, 'CSS');
    add(scan.detectedHTTPClient, 'HTTP client');
    add(scan.detectedQueue, 'queue');
    add(scan.detectedAuth, 'auth');
    add(scan.detectedDBDriver, 'DB driver');
    add(scan.detectedRealtime, 'real-time');
    add(scan.detectedScheduler, 'scheduler');
    add(scan.detectedUpload, 'upload');
    add(scan.detectedEmail, 'email');
    add(scan.detectedLogger, 'logging');
    add(scan.detectedValidationLib, 'validation');
    add(scan.detectedCloudProvider, 'cloud');
    if (scan.detectedSwagger) {
        const styleLabel = scan.detectedSwaggerStyle ? ` — ${scan.detectedSwaggerStyle}` : '';
        parts.push(`\`Swagger/OpenAPI\` (docs${styleLabel})`);
    }
    if (scan.detectedAPIType !== 'REST' && scan.detectedAPIType) parts.push(`\`${scan.detectedAPIType}\` (API type)`);
    return parts.join(' | ');
}

function buildHighRiskDisplay(scan: ScanResult): string {
    if (!scan.highRiskFiles.length) return '';
    return scan.highRiskFiles.map(f => `- \`${f}\``).join('\n');
}

function buildHardRules(
    stack: Stack, profile: BaseProfile, scan: ScanResult,
    isBackend: boolean, lc: number, ui: string, data: string
): string {
    let rules: string;
    if (isBackend) {
        let responseRule = '- **Never** return raw database objects in API responses — map to response schemas';
        if (stack === 'python') responseRule = '- **Never** return ORM model instances in API responses — map to Pydantic/DTO schemas';
        if (stack === 'nodejs' && scan.detectedSubtype === 'nestjs') responseRule = '- **Never** return ORM model instances in API responses — map to DTO classes';
        rules = `- **Never** skip architecture layers — \`${profile.layerFlow}\`
- **Never** write business logic in ${ui}s — routers are thin (validate, delegate, respond)
- **Never** query the database directly from ${ui}s — go through ${profile.layerNames[2] || 'Service'}
${responseRule}
- **Never** access tenant-scoped data without \`org_id\` filtering`;
    } else if (lc >= 4) {
        rules = `- **Never** skip architecture layers (e.g. ${ui} calling ${data} directly)
- **Never** write business logic in ${ui}s
- **Never** make direct API calls from ${profile.layerNames[1]} — use ${profile.layerNames[2]}
- **Never** return raw API/DTO objects from ${profile.layerNames[lc - 2]} — map to domain models`;
    } else {
        rules = `- **Never** skip layers — ${ui} must go through ${profile.layerNames[1]}
- **Never** write business logic in ${ui}s
- **Never** return raw API/DTO objects to the ${ui} layer`;
    }

    if (stack === 'flutter') {
        rules += '\n- **Never** use `setState` — all state is managed exclusively via Cubit';
    }

    // 200-line rule for frontend stacks
    if (['flutter', 'kotlin', 'react', 'angular'].includes(stack)) {
        const hints: Record<string, string> = {
            flutter: 'extract child widgets, move logic to Cubit/UseCase, split into sub-widget files',
            kotlin: 'extract @Composable sub-components, move state logic to ViewModel, split into smaller composables',
            react: 'extract sub-components, move logic to custom hooks, split into separate files',
            angular: 'extract child components, move logic to services, use directive composition',
        };
        rules += `\n- **Max 200 lines per file** — if a file exceeds 200 lines, decompose: ${hints[stack]}. Excludes: test files, generated files, config/theme files, barrel/index files`;
    }

    rules += `\n- **Never** leave TODO comments in production code
- A task is **not complete** without a test
- **When adding, modifying, or removing a hook** — update \`.claude/hooks/README.md\``;
    return rules;
}

function buildLayerResps(
    profile: BaseProfile, scan: ScanResult, isBackend: boolean, lc: number
): string {
    const layers = profile.layerNames;
    let resps = '';
    if (isBackend) {
        for (let i = 0; i < lc; i++) {
            const l = layers[i];
            if (i === 0) {
                resps += `\n### ${l} (API / Entry Point)\n- Receives HTTP requests; validates input via request schemas\n- Delegates to services; returns response schemas; no business logic`;
            } else if (i === lc - 1) {
                resps += `\n\n### ${l} (Data / Infrastructure)\n- Database engine, connection pool, session factory\n- External service clients (HTTP, blob storage, message queues)`;
            } else if (l === 'Depends' || l === 'Middleware') {
                resps += `\n\n### ${l} (Dependency Injection)\n- Auth extraction (JWT → user), DB session injection, RBAC checks\n- Tenant context, rate limiting, request-scoped dependencies`;
            } else if (l === 'Service') {
                resps += `\n\n### ${l} (Business Logic)\n- All business rules live here; receives DB session, operates on models\n- Returns domain objects; never exposes HTTP or framework concepts`;
            } else if (l === 'Model' || l === 'Repository') {
                // v14.2: For routes-models, Model layer has business logic + data access
                if (scan.detectedArchPattern === 'routes-models') {
                    resps += `\n\n### ${l} (Business Logic + Data Access)\n- Contains business rules AND database queries (combined in routes-models pattern)\n- ORM models, query logic, and domain operations live here`;
                } else {
                    resps += `\n\n### ${l} (Data Definition / ORM)\n- Database table definitions (ORM models); no business logic\n- Relationships, constraints, indexes defined here`;
                }
            } else {
                resps += `\n\n### ${l}\n- Intermediate layer — see architecture.md for specifics`;
            }
        }
    } else {
        for (let i = 0; i < lc; i++) {
            const l = layers[i];
            if (i === 0) {
                resps += `\n### ${l} (UI)\n- Renders UI; no business logic; no direct API calls\n- Dispatches user actions to ${layers[1]}`;
            } else if (i === lc - 1) {
                resps += `\n\n### ${l} (Data)\n- HTTP calls / local DB access; request+response DTOs defined here`;
            } else if (lc <= 3 || i === 1) {
                resps += `\n\n### ${l} (State / Business Logic)\n- Manages UI state using ${profile.stateFramework}\n- Contains business logic; returns domain models, never raw DTOs`;
            } else if (i === 2 && lc >= 4) {
                const svcDesc = scan.detectedServiceStyle === 'function'
                    ? 'One domain per module; plain exported functions'
                    : 'Single-purpose; one operation per class';
                const svcCoord = scan.detectedServiceStyle === 'function'
                    ? `Called by ${layers[1]}; calls ${layers[lc - 1]}`
                    : `Coordinates ${layers[1]} ↔ ${layers[lc - 2]}`;
                resps += `\n\n### ${l} (Business Logic)\n- ${svcDesc}\n- ${svcCoord}`;
            } else {
                resps += `\n\n### ${l} (Data Abstraction)\n- Abstracts data source; returns domain models only; handles error mapping`;
            }
        }
    }
    return resps;
}

function buildDIText(profile: BaseProfile): string {
    if (!profile.diFramework || profile.diFramework === 'N/A') return '';
    return `---\n\n## Dependency Injection\n- **${profile.diFramework}** — dependencies flow inward: ${profile.layerFlow}`;
}

function buildTypeNaming(
    stack: Stack, profile: BaseProfile, scan: ScanResult,
    isBackend: boolean, lc: number
): string {
    let table = `| Type | Pattern | Example |\n|------|---------|---------|`;
    if (isBackend) {
        if (stack === 'python') {
            table += `\n| Router module | \`${profile.featuresDir}<resource>.py\` | \`${profile.featuresDir}users.py\` |`;
            table += `\n| Service class | \`<Resource>Service\` | \`UserService\` |`;
            table += `\n| ORM Model | \`<Resource>\` (PascalCase) | \`User\`, \`Organization\` |`;
            table += `\n| Pydantic Schema | \`<Resource>Create / <Resource>Response\` | \`UserCreate\`, \`UserResponse\` |`;
        } else if (scan.detectedSubtype === 'nestjs') {
            table += `\n| Controller | \`<resource>.controller.ts\` | \`users.controller.ts\` |`;
            table += `\n| Service | \`<resource>.service.ts\` | \`users.service.ts\` |`;
            table += `\n| Repository | \`<resource>.repository.ts\` | \`users.repository.ts\` |`;
            table += `\n| DTO | \`<Resource>Dto\` | \`CreateUserDto\` |`;
            table += `\n| Entity / Model | \`<Resource>\` | \`User\` |`;
        } else if (scan.detectedArchPattern === 'layered' || scan.detectedArchPattern === 'controller-service') {
            table += `\n| Controller | \`<resource>Controller${profile.fileExt}\` | \`nftController${profile.fileExt}\` |`;
            table += `\n| Service | \`<resource>Service${profile.fileExt}\` | \`nftService${profile.fileExt}\` |`;
            table += `\n| Model | \`<resource>${profile.fileExt}\` | \`user${profile.fileExt}\` |`;
        } else {
            table += `\n| Route | \`<resource>routes${profile.fileExt}\` | \`userroutes${profile.fileExt}\` |`;
            table += `\n| Model | \`<resource>${profile.fileExt}\` | \`user${profile.fileExt}\` |`;
        }
    } else {
        const seen = new Set<string>();
        for (let i = 0; i < lc; i++) {
            const l = profile.layerNames[i];
            if (seen.has(l)) continue; seen.add(l);
            if (i === 0) {
                table += `\n| ${l} | \`Feature${profile.namingUISuffix}\` | \`Visit${profile.namingUISuffix}\` |`;
            } else {
                table += `\n| ${l} | \`Feature${l}\` | \`Visit${l}\` |`;
            }
        }
        table += `\n| Domain Model | \`Feature\` | \`Visit\` |`;
    }
    return table;
}

function buildTestLayerList(profile: BaseProfile, lc: number): string {
    const seen = new Set<string>();
    const tl: string[] = [];
    for (let i = 1; i < lc - 1; i++) {
        const l = profile.layerNames[i];
        if (seen.has(l)) continue; seen.add(l); tl.push(l);
    }
    if (tl.length === 0) return 'business logic layers';
    if (tl.length === 1) return tl[0];
    if (tl.length === 2) return `${tl[0]} and ${tl[1]}`;
    return tl.slice(0, -1).join(', ') + ', and ' + tl[tl.length - 1];
}

function buildTestLayers(
    stack: Stack, profile: BaseProfile, isBackend: boolean, lc: number, ui: string
): string {
    if (isBackend) {
        let t = '\n- Every service must have unit tests';
        t += stack === 'python' ? '\n- API endpoints must have integration tests (httpx / TestClient)'
            : '\n- API endpoints must have integration tests (supertest)';
        t += '\n- Auth + RBAC flows must have dedicated tests';
        return t;
    }
    let t = '';
    for (let i = 1; i < lc - 1; i++) t += `\n- Every ${profile.layerNames[i]} must have tests`;
    t += `\n- ${ui} tests for main screen`;
    return t;
}

function buildDesignFiles(
    stack: Stack, profile: BaseProfile, scan: ScanResult,
    isBackend: boolean, lc: number, ui: string
): string {
    let files = '';
    if (isBackend) {
        if (stack === 'python') {
            files += `\n| \`${profile.featuresDir}<resource>.py\` | Router | API endpoints |`;
            files += `\n| \`app/services/<resource>_service.py\` | Service | Business logic |`;
            files += `\n| \`app/models/<resource>.py\` | Model | ORM table definition |`;
            files += `\n| \`app/schemas/<resource>.py\` | Schema | Request/response validation |`;
            files += `\n| \`tests/integration/test_<resource>_api.py\` | Test | API integration tests |`;
            files += `\n| \`tests/unit/test_<resource>_service.py\` | Test | Service unit tests |`;
        } else if (scan.detectedSubtype === 'nestjs') {
            files += `\n| \`src/<resource>/<resource>.controller.ts\` | Controller | API endpoints |`;
            files += `\n| \`src/<resource>/<resource>.service.ts\` | Service | Business logic |`;
            files += `\n| \`src/<resource>/<resource>.repository.ts\` | Repository | Data access |`;
            files += `\n| \`src/<resource>/dto/<resource>.dto.ts\` | DTO | Request/response shapes |`;
        } else if (scan.detectedArchPattern === 'layered' || scan.detectedArchPattern === 'controller-service') {
            files += `\n| \`src/controller/<resource>Controller${profile.fileExt}\` | Controller | HTTP handlers |`;
            files += `\n| \`src/service/<resource>Service${profile.fileExt}\` | Service | Business logic |`;
        } else {
            files += `\n| \`src/routes/<resource>routes${profile.fileExt}\` | Route | HTTP handlers |`;
            files += `\n| \`src/models/<resource>${profile.fileExt}\` | Model | Business logic + data |`;
        }
    } else {
        const fsep = profile.namingFiles.includes('kebab') ? '-' : '_';
        const isPascal = profile.namingFiles.includes('PascalCase');
        const seen = new Set<string>();
        for (let i = lc - 1; i >= 1; i--) {
            const l = profile.layerNames[i];
            if (seen.has(l)) continue; seen.add(l);
            const ll = l.toLowerCase().replace(/[ /]/g, '-');
            const purpose = i === lc - 1 ? 'API calls / data access' : i === 1 ? 'State management' : 'Business logic';
            if (isPascal) {
                files += `\n| \`${profile.sourceDir}<feature>/<Name>${l}${profile.fileExt}\` | ${l} | ${purpose} |`;
            } else {
                files += `\n| \`${profile.sourceDir}<name>/<name>${fsep}${ll}${profile.fileExt}\` | ${l} | ${purpose} |`;
            }
        }
        const us = profile.namingUISuffix || ui;
        if (isPascal) {
            files += `\n| \`${profile.sourceDir}<feature>/ui/<Name>${us}${profile.fileExt}\` | ${ui} | UI screen |`;
        } else {
            files += `\n| \`${profile.sourceDir}<name>/ui/<name>${fsep}${us.toLowerCase()}${profile.fileExt}\` | ${ui} | UI screen |`;
        }
    }
    return files;
}

function buildDesignLayerTable(
    profile: BaseProfile, scan: ScanResult, isBackend: boolean, lc: number
): string {
    let table = '';
    const layers = profile.layerNames;
    for (let i = 0; i < lc; i++) {
        const l = layers[i];
        let role = 'Business logic';
        if (isBackend) {
            if (i === 0) role = 'HTTP request handling';
            else if (i === lc - 1) role = 'Database / infrastructure';
            else if (l === 'Depends' || l === 'Middleware') role = 'Dependency injection / auth';
            else if (l === 'Service') role = 'Business logic';
            else if (l === 'Model' || l === 'Repository') role = 'ORM / data definition';
        } else {
            if (i === 0) role = 'UI rendering';
            else if (i === lc - 1) role = 'Network / data access';
            else if (i === 1 && lc >= 4) role = 'State management';
        }
        table += `${table ? '\n' : ''}| **${l}** | ${role} | Yes / No |`;
    }
    if (isBackend) {
        table += `\n| **External Services** | ${scan.detectedCloudServices || 'External APIs'}, ${profile.localStorageName} | Yes / No |`;
    } else {
        table += `\n| **Local Data Source** | Local DB, ${profile.localStorageName} | Yes / No |`;
    }
    return table;
}

function buildHardRulesCompliance(
    stack: Stack, profile: BaseProfile, isBackend: boolean,
    lc: number, ui: string, data: string
): string {
    let rn = 0;
    let table: string;
    if (isBackend) {
        table = `| ${++rn} | No skipping layers (${ui} → … → ${data}) | Yes / No | |
| ${++rn} | No business logic in ${ui}s | Yes / No | |
| ${++rn} | No direct DB queries from ${ui}s | Yes / No | |
| ${++rn} | API responses use schemas, not ORM models | Yes / No | |
| ${++rn} | Tenant-scoped queries include org_id | Yes / No | |`;
    } else if (lc >= 4) {
        table = `| ${++rn} | No skipping layers (${ui} → … → ${data}) | Yes / No | |
| ${++rn} | No business logic in ${ui}s | Yes / No | |
| ${++rn} | ${profile.layerNames[1]} never calls API directly | Yes / No | |
| ${++rn} | ${profile.layerNames[lc - 2]} returns domain models, not DTOs | Yes / No | |`;
        if (stack === 'flutter') table += `\n| ${++rn} | No \`setState\` — state managed via Cubit only | Yes / No | |`;
    } else {
        table = `| ${++rn} | No skipping layers | Yes / No | |
| ${++rn} | No business logic in ${ui}s | Yes / No | |`;
    }
    if (['flutter', 'kotlin', 'react', 'angular'].includes(stack)) {
        table += `\n| ${++rn} | No file exceeds 200 lines (excl. tests/generated/config) | Yes / No | |`;
    }
    table += `\n| ${++rn} | No TODO in production code | Yes / No | |
| ${++rn} | Every task has a test | Yes / No | |`;
    return table;
}

function buildTaskDataPhase(
    stack: Stack, profile: BaseProfile, scan: ScanResult,
    isBackend: boolean, data: string
): string {
    if (isBackend) {
        if (stack === 'nodejs') {
            return `### Database:\n- [ ] **[S] [Model]** Define or update data model(s)\n- [ ] **[S] [Migration]** Create DB migration (if applicable)\n- [ ] **[S] [Schema]** Define request/response validation schemas\n\n### If External Service Integration:\n- [ ] **[M] [Integration]** Implement external service client\n- [ ] **[S] [Integration]** Add retry logic + error handling`;
        }
        return `### Database / ORM:\n- [ ] **[S] [Model]** Define or update ORM model(s) + relationships\n- [ ] **[S] [Migration]** Generate Alembic / DB migration\n- [ ] **[S] [Schema]** Define Pydantic request + response schemas\n\n### If External Service Integration:\n- [ ] **[M] [Integration]** Implement external service client\n- [ ] **[S] [Integration]** Add retry logic + error handling`;
    }
    return `### If Remote API — live:\n- [ ] **[S] [${data}]** Define request model\n- [ ] **[S] [${data}]** Define response model\n- [ ] **[M] [${data}]** Implement API service\n\n### If Remote API — contract available but not live:\n- [ ] **[S] [${data}]** Define models from sample JSON\n- [ ] **[M] [${data}]** Implement stubbed service\n- [ ] **[S] [${data}]** Wire real HTTP call when live _(deferred)_\n\n### If Local DB / ${profile.localStorageName}:\n- [ ] **[M] [Data]** Implement local data source\n\n### If In-Memory Only:\n- [ ] _No data layer tasks — skip to next phase_`;
}

function buildTaskLogicPhase(profile: BaseProfile, isBackend: boolean, lc: number): string {
    const logicLayer = lc >= 4 ? profile.layerNames[2] : profile.layerNames[1];
    if (isBackend) {
        return `### Business Logic:\n- [ ] **[M] [${logicLayer}]** Implement ${logicLayer} with business rules\n- [ ] **[S] [${logicLayer}]** Add tenant isolation (org_id scoping)`;
    }
    return `### Business Logic:\n- [ ] **[M] [${logicLayer}]** Implement business logic`;
}

function buildTaskStatePhase(
    stack: Stack, profile: BaseProfile, isBackend: boolean, lc: number
): string {
    const mid = profile.layerNames[1];
    if (isBackend) {
        if (stack === 'nodejs') return `- [ ] **[S] [Middleware]** Wire middleware (auth, DB connection, RBAC)\n- [ ] **[S] [Middleware]** Add permission/role checks`;
        return `- [ ] **[S] [Depends]** Wire dependencies (auth, DB session, RBAC)\n- [ ] **[S] [Depends]** Add permission check via \`require_permission()\``;
    }
    return `- [ ] **[S] [${mid}]** Define states\n- [ ] **[M] [${mid}]** Implement state management`;
}

function buildTaskUIPhase(profile: BaseProfile, isBackend: boolean): string {
    const ui = profile.layerNames[0];
    if (isBackend) return `- [ ] **[M] [${ui}]** Implement API endpoint(s)\n- [ ] **[S] [${ui}]** Register in router aggregator`;
    return `- [ ] **[M] [${ui}]** Build main screen\n- [ ] **[S] [Navigation]** Register route and navigation`;
}

function buildTaskTestPhase(
    stack: Stack, profile: BaseProfile, isBackend: boolean, lc: number, ui: string
): string {
    if (isBackend) {
        let t = '\n- [ ] **[M] [Test]** Unit tests for service layer';
        t += '\n- [ ] **[M] [Test]** Integration tests for API endpoint(s)';
        t += '\n- [ ] **[S] [Test]** RBAC / tenant isolation tests';
        return t;
    }
    let t = '';
    const seen = new Set<string>();
    for (let i = 1; i < lc - 1; i++) {
        const l = profile.layerNames[i];
        if (seen.has(l)) continue; seen.add(l);
        t += `\n- [ ] **[M] [Test]** Unit tests for ${l.toLowerCase()}`;
    }
    t += `\n- [ ] **[S] [Test]** ${ui} tests for main screen`;
    return t;
}

function buildLayerExecOrder(
    stack: Stack, profile: BaseProfile, isBackend: boolean, lc: number
): string {
    if (isBackend && stack === 'python') {
        return `1. Model layer   — ORM models + migration
2. Schema layer  — Pydantic request/response
3. Service layer — business logic
4. Depends layer — auth, RBAC, DB session
5. Router layer  — API endpoints
6. Tests         — unit (service), integration (API), RBAC`;
    }
    if (isBackend) {
        let order = '';
        let step = 1;
        for (let i = lc - 1; i >= 0; i--) {
            order += `${step}. ${profile.layerNames[i]} layer\n`;
            step++;
        }
        order += `${step}. Tests — unit + integration`;
        return order;
    }
    return `1. Data layer    — ${profile.layerNames[lc - 1]}
2. Logic layer   — ${profile.layerNames[1]}
3. State layer   — ${profile.layerNames[1]}
4. UI layer      — ${profile.layerNames[0]}
5. Navigation    — routes
6. Tests         — unit, widget/component, integration`;
}
