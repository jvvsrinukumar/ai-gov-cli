import type { GovernanceConfig } from '../types.js';

function buildTestConventions(stack: string, subtype: string): string {
    switch (stack) {
        case 'kotlin':
            return `\n### Testing Conventions — Kotlin / Android\n- Use MockK: \`mockk<T>(relaxed=true)\` for lenient mocks; \`every { }\` / \`verify { }\` for strict\n- Coroutines: \`coEvery { }\` / \`coVerify { }\`; wrap tests in \`runTest { }\` with \`StandardTestDispatcher\`\n- Method names use backtick strings: \`\`\`fun \`should return user when id is valid\`() { }\`\`\`\n- Structure: Given / When / Then comments inside test body`;
        case 'nodejs':
            if (subtype === 'nestjs') return `\n### Testing Conventions — Node.js / NestJS\n- Use Jest with \`@nestjs/testing\` \`TestingModule\`: \`Test.createTestingModule({ providers: [...] }).compile()\`\n- Unit tests: \`jest.fn()\` for dependencies; inject via \`module.get<T>()\`\n- E2E tests: \`supertest\` against the NestJS app; use \`app.init()\` in \`beforeAll\`\n- Arrange / Act / Assert structure`;
            return `\n### Testing Conventions — Node.js\n- Use Jest: \`describe\` / \`it\`; \`jest.mock()\` at module level; \`jest.spyOn()\` for method-level spies\n- \`beforeEach\` for setup; \`afterEach\` for cleanup\n- HTTP routes: \`supertest\` against the Express/Fastify app instance`;
        case 'react':
        case 'next':
            return `\n### Testing Conventions — React\n- Use React Testing Library: \`render\`, \`screen\`, \`userEvent\` — never query by implementation detail\n- Custom hooks: \`renderHook\` + \`act()\` for state updates\n- No Enzyme; no snapshot tests for behaviour (snapshots only for styled components)\n- Arrange / Act / Assert structure`;
        case 'python':
            return `\n### Testing Conventions — Python / pytest\n- Use \`@pytest.fixture\` for shared setup; \`conftest.py\` for cross-module fixtures\n- Async tests: \`@pytest.mark.asyncio\`; FastAPI: \`httpx.AsyncClient\` with \`ASGITransport\`\n- Mock with \`unittest.mock.patch\` or \`pytest-mock\`'s \`mocker.patch\`\n- Name: \`test_<action>_when_<condition>_should_<result>\``;
        case 'java':
            return `\n### Testing Conventions — Java / JUnit 5\n- \`@ExtendWith(MockitoExtension.class)\` for unit tests; \`@Mock\` / \`@InjectMocks\`\n- \`@SpringBootTest\` + \`@AutoConfigureMockMvc\` for integration; \`MockMvc\` for controller tests\n- \`@DataJpaTest\` with in-memory H2 for repository tests\n- Arrange / Act / Assert; test method: \`should_ReturnUser_When_IdIsValid()\``;
        case 'angular':
            return `\n### Testing Conventions — Angular\n- Use \`TestBed.configureTestingModule\` with \`HttpClientTestingModule\` for services that call HTTP\n- \`ComponentFixture\` + \`fixture.detectChanges()\` for component tests\n- Jasmine or Jest; \`spyOn\` for method mocking`;
        case 'flutter':
            return `\n### Testing Conventions — Flutter\n- Unit: \`flutter_test\`; BLoC/Cubit: \`bloc_test\` with \`blocTest<>(...)\`\n- Widget: \`WidgetTester\`, \`pump()\` / \`pumpWidget()\`, \`find.byType()\`\n- Mocking: \`mockito\` with \`@GenerateMocks\`; run \`flutter pub run build_runner build\` after annotation changes`;
        case 'swiftui':
            return `\n### Testing Conventions — SwiftUI / XCTest\n- \`@MainActor\` on UI test classes; \`async/await\` with \`XCTestExpectation\` for async flows\n- \`XCTAssertEqual\`, \`XCTAssertNil\`, \`XCTAssertThrowsError\` for assertions\n- Test ViewModel in isolation; inject dependencies via protocol`;
        default:
            return '';
    }
}

export function generateCodingStandards(c: GovernanceConfig): string {
    const p = c.profile, b = c.blocks;
    const testConventions = buildTestConventions(c.stack, c.scan.detectedSubtype || '');
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
${b.testLayers}${testConventions}

## Imports
${p.importStyle}
${zoneRulesSection}`;
}
