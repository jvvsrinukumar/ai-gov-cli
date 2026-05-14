/**
 * Stack-specific audit content helpers.
 * Shared between the Claude Code /audit command and the Kiro workflow-audit hook.
 */
import type { GovernanceConfig } from '../types.js';

export function getObservationQuestions(c: GovernanceConfig): string {
  const { profile } = c;
  const sourceDir = profile.sourceDir || 'src/';
  const featuresDir = profile.featuresDir || sourceDir;

  switch (c.stack) {
    case 'flutter': return `
For each directory that exists under \`lib/\`, read 15-25 \`.dart\` files and answer:

**HTTP / Network**
- What HTTP client is actually imported? (dio, chopper, http package, custom wrapper?)
- Is HTTP called from Widget files directly, or through a service/repository layer?

**State management**
- What state approach is actually used? (setState, BLoC, Cubit, Riverpod, Provider, GetX?)
- Is the same approach used consistently, or do different directories use different approaches?

**Data flow**
- Trace one real request from the UI to the data source. What classes/files does it pass through?
- Does a Repository interface exist? Is there a UseCase layer? Or does UI call data sources directly?

**Models / Serialization**
- What serialization approach is used? (BuiltValue, freezed, json_serializable, manual, dart_mappable?)
- Are models in a shared folder or co-located with features?

**Navigation / Routing**
- What navigation approach is used? (go_router, auto_route, Navigator.push/pushNamed, or custom?)
- Are routes defined centrally (router file) or inline at the call site?

**Error handling**
- How are errors propagated? (Either/Result type, custom exception classes, error states in BLoC/Cubit, try/catch inline?)

**Naming and conventions**
- What suffix do Widget files use? (Screen, Page, View, Widget?)
- What naming convention for files? (snake_case, camelCase?)
- Do feature folders have consistent internal structure?

**Per directory — record as facts:**
\`\`\`
lib/features/    [N] files — imports: [list], patterns: [describe what you see]
lib/screens/     [N] files — imports: [list], patterns: [describe what you see]
lib/models/      [N] files — type: [BuiltValue/freezed/plain/mixed]
lib/services/    [N] files — role: [describe what these files do]
lib/core/        [N] files — role: [describe]
[any other dirs] [N] files — role: [describe]
\`\`\``;

    case 'react': return `
For each directory that exists under \`src/\` (or project root for Next.js), read 15-25 source files and answer:

**Next.js / Framework (answer this first — it changes everything)**
- Is this a Next.js project? Check for \`next.config.js/ts\` at root.
- If Next.js: is there an \`app/\` directory with \`page.tsx\` files (App Router) or a \`pages/\` directory (Pages Router)? Both?
- If App Router: which components have \`'use client'\` at the top? Which have no directive (Server Components)?
- If both \`app/\` and \`pages/\` exist: migration in progress — two zones with different rules.
- If not Next.js: note the actual framework (Vite, CRA, Remix, etc.)

**Component style**
- Are components written as classes (\`extends Component\`) or functions (\`const X = () =>\`)?
- Is the same style used everywhere, or mixed across directories?

**Data fetching**
- Where does data fetching happen? Inside components? In custom hooks? In a service/api layer?
- What library is used? (React Query, SWR, axios directly, fetch, custom hook?)
- If App Router: is data fetching in Server Components (\`async function Page()\`) or client-side hooks?

**State management**
- What state approach is actually used? (useState, Redux Toolkit, Zustand, Jotai, Context, React Query?)
- If Redux: read the slice files — are all slices actually imported and used, or are some defined but never called?
- If Zustand: are all stores imported somewhere, or are any stores defined but unused?
- Is state global, feature-level, or component-level?

**Data flow**
- Trace one real data fetch. Where does the request originate and what files does it pass through?
- Is there a separation between API call layer and component layer?

**Naming and conventions**
- What naming convention for components? (PascalCase files, index.ts barrel exports, feature folders?)
- What file structure exists per feature?

**Per directory — record as facts:**
\`\`\`
app/              [N] files — router: App Router, Server/Client ratio: [X server / Y client]
pages/            [N] files — router: Pages Router (note if migration in progress)
src/features/     [N] files — patterns: [describe]
src/components/   [N] files — patterns: [describe]
src/hooks/        [N] files — patterns: [describe]
[any other dirs]  [N] files — patterns: [describe]
\`\`\``;

    case 'angular': return `
For each significant directory under \`src/app/\` (or \`libs/\` if Nx), read 15-25 files and answer:

**Angular version and workspace (answer this first)**
- What Angular version is in \`package.json\`? (14 / 15 / 16 / 17+ — Signals only available 17+)
- Is there a \`nx.json\` or \`libs/\` directory at the project root? If yes: this is an Nx workspace — features live in \`libs/\`, not \`src/app/features/\`
- If Nx: list all apps in \`apps/\` and library packages in \`libs/\` — note each library's purpose

**Structure type**
- Is \`app.module.ts\` present? Is \`app.config.ts\` present? Both? Neither?
- Are components standalone or NgModule-declared?

**Lazy loading**
- Are routes using \`loadChildren: () => import(...)\` or \`loadComponent: () => import(...)\`?
- Which feature modules/components are lazy-loaded? Map route path → module file.

**HTTP and services**
- Is \`HttpClient\` injected in components directly, or only in service files?
- What happens in \`ngOnInit\`? Direct subscribe with logic, or delegation to service?
- Are HTTP interceptors registered? List them from \`provideHttpClient(withInterceptors([...]))\` or \`HTTP_INTERCEPTORS\` providers.

**State management**
- What state approach is used? (NgRx, NGXS, Akita, simple service + BehaviorSubject, Signals?)
- If Signals: are they used with \`effect()\` and \`computed()\` or just as primitive \`signal()\` holders?
- Is the same approach used across all features or is it mixed?

**Data flow**
- Trace one real data flow. Which files are involved from user action to API response?
- Are there separate service, facade, or store classes, or does the component do everything?

**Naming and conventions**
- What naming pattern for feature folders? What file naming conventions?

**Per directory — record as facts:**
\`\`\`
src/app/features/   [N] components — standalone: [yes/no], patterns: [describe]
src/app/core/       [N] files — role: [describe]
src/app/shared/     [N] files — role: [describe]
libs/ (if Nx)       [N] libraries — names: [list each]
[any other dirs]    [N] files — patterns: [describe]
\`\`\``;

    case 'nodejs': return `
For each significant directory under \`${sourceDir}\`, read 15-25 files and answer:

**Monorepo check (do this first)**
- Is there a \`package.json\` with \`workspaces\`, a \`turbo.json\`, or \`nx.json\` at the root?
- If monorepo: list each package/app under \`packages/\`, \`apps/\`, or \`services/\`. Note which package this audit focuses on.
- If monorepo: note the package manager used (npm workspaces, pnpm, Yarn Berry?)

**Layer structure**
- What directories exist? (routes/, controllers/, services/, repositories/, modules/, handlers/)
- Is there a clear separation between HTTP handling, business logic, and data access?

**Middleware chain**
- What middleware is registered globally in \`app.ts\`/\`server.ts\`? (auth, rate limiting, logging, CORS, error handler)
- Is auth middleware applied globally or per-route?
- Where is the global error handler defined? Does it exist?

**Data access**
- What ORM/query tool is actually used? (Prisma, TypeORM, Drizzle, Knex, raw SQL, Mongoose?)
- Where are ORM calls made? In route handlers, in services, in repositories, or mixed?

**Validation**
- Where is request validation done? (middleware, DTOs with class-validator, inline in handler, Zod schema?)

**Error handling pattern**
- How are errors returned? (throw + global handler, explicit \`res.status()\`, Result type, custom ApiError class?)
- Is the same error pattern used consistently or mixed across files?

**Data flow**
- Trace one real API request from route definition to database call. List every file/class it passes through.

**NestJS specifics (if NestJS)**
- What modules exist? Are controllers thin (delegate to service) or fat (contain logic)?
- Is dependency injection used consistently?

**Module format**
- ESM or CJS? Check \`tsconfig.json\` \`module\` field and \`package.json\` \`type\` field.

**Naming and conventions**
- What file naming convention? (kebab-case.service.ts, camelCase, feature folders?)

**Per directory — record as facts:**
*(If monorepo: use the audited package root, not the repo root)*
\`\`\`
${sourceDir}routes/      [N] files — patterns: [describe]
${sourceDir}controllers/ [N] files — patterns: [describe]
${sourceDir}services/    [N] files — patterns: [describe]
[any other dirs]         [N] files — patterns: [describe]
\`\`\``;

    case 'python': return `
For each significant directory under \`${sourceDir}\`, read 15-25 files and answer:

**Framework (answer this first — changes what to look for)**
- What framework is actually used? (FastAPI, Django, Flask, Starlette, Litestar?)
- If Django: views/viewsets replace routers — observation questions below adapt accordingly

**Layer structure**
- What directories exist? (routers/, api/, views/, viewsets/, services/, repositories/, crud/, models/, schemas/)
- Is there a clear separation between HTTP routing, business logic, and database access?

**Data access**
- What ORM/query tool is actually used? (SQLAlchemy, SQLModel, Django ORM, Tortoise, Beanie, raw SQL?)
- Where are ORM calls made? In router/view functions directly, in service functions, or in repository functions?

**Service injection pattern**
- FastAPI: How are services injected? Through \`Depends()\`, instantiated at module level, or created inside each function?
- Django: Are services plain classes instantiated in views, or does the project use signals/middleware?
- Flask: Are services accessed via \`g\`, \`current_app.extensions\`, or instantiated inline?

**Schemas and validation**
- Are Pydantic schemas used consistently for both request bodies and response models? Or are raw dicts passed?
- Are request schemas and response schemas the same class or separate?

**Data flow**
- Trace one real endpoint: from route decorator to database call. List every function it passes through.

**Per directory — record as facts:**
*(FastAPI/Flask: use structure below. Django: substitute \`apps/<name>/views.py\` etc.)*
\`\`\`
${featuresDir}     [N] files — patterns: [describe]
services/          [N] files — patterns: [describe, or "absent — logic in routers/views"]
repositories/      [N] files — patterns: [describe, or "absent — ORM called directly"]
tasks/ or workers/ [N] files — patterns: [describe, or "absent"]
[any other dirs]   [N] files — patterns: [describe]
\`\`\``;

    case 'kotlin': return `
For each significant directory under \`app/src/main/\`, read 15-25 files and answer:

**UI approach (answer this first — it changes everything)**
- Is the UI written in Jetpack Compose (\`@Composable\` functions) or XML layouts (\`.xml\` files in \`res/layout/\`)?
- Are both present in the project? If so, which directories use which approach?
- If both: this is a migration in progress — Zone Rules will be needed (Compose zone vs XML zone)

**Kotlin Multiplatform (KMP) check**
- Is there a \`commonMain/\`, \`androidMain/\`, \`iosMain/\` source structure?
- If KMP: list which modules are in \`commonMain/\` (shared) vs platform-specific

**Layer structure**
- What layers actually exist? (domain/, data/, presentation/, or flat feature packages?)
- Is there a UseCase/Interactor layer, or do ViewModels call repositories directly?

**Data access**
- What data access approach is used? (Room, Retrofit, Ktor client, Firebase, both, custom?)
- Where are data access calls made? In ViewModel, UseCase, or Repository?

**State management**
- What state approach is used? (LiveData, StateFlow, both mixed, Compose \`mutableStateOf\`?)
- Is UI state expressed as sealed classes (\`UiState.Loading/Success/Error\`) or raw data types?

**Dependency injection**
- What DI approach is used? (Hilt, Koin, Dagger, manual?)

**Data flow**
- Trace one real user action from Composable/Fragment to data source. List every class it passes through.

**Per directory — record as facts:**
\`\`\`
.../features/   [N] feature packages — UI: [Compose/XML/mixed], patterns: [describe]
.../domain/     [N] files — contains: [describe]
.../data/       [N] files — contains: [describe]
.../ui/         [N] files — UI: [Compose/XML], contains: [describe]
\`\`\``;

    case 'swiftui': return `
For each significant directory under \`Sources/\`, read 15-20 files and answer:

**Layer structure**
- What layers/directories exist? (Features/, Views/, ViewModels/, Services/, Stores?)
- Is there a ViewModel layer, or do Views manage state directly?

**Data and networking**
- What networking approach is used? (URLSession, Alamofire, custom client?)
- Where are network calls made? Inside Views, in ViewModels, in Service classes?

**State management**
- What state approach is used? (ObservableObject/@Published, TCA Store/Reducer, @Observable, SwiftData?)

**Data flow**
- Trace one real user action from View to network call. List every file/class it passes through.

**Per directory — record as facts:**
\`\`\`
Sources/.../Features/   [N] features — patterns: [describe]
Sources/.../Views/      [N] files — patterns: [describe]
Sources/.../ViewModels/ [N] files — patterns: [describe]
[any other dirs]        [N] files — patterns: [describe]
\`\`\``;

    case 'java': return c.scan.detectedOSGi ? `
For each module directory that exists, read 15–25 \`.java\` files and answer:

**Build system and module structure (answer this first)**
- Is this Maven or Gradle? Count \`pom.xml\` or \`build.gradle\` files to determine number of modules.
- What Java version is configured? Are preview features (\`--enable-preview\`) in use?
- List every module directory and its apparent role (UI bundle, API bundle, codec bundle, launcher, etc.)

**OSGi bundle structure**
- Does each module have an \`OSGI-INF/\` directory with Declarative Services XML (\`*.xml\` component descriptors)?
- Does \`pom.xml\` use \`bnd-maven-plugin\` or \`maven-bundle-plugin\` to generate \`MANIFEST.MF\`?
- Are Java annotations used for DS components (\`@Component\`, \`@Reference\` from \`org.osgi.service.component.annotations\`)?
- What packages are exported by each bundle? (check \`Export-Package\` in bnd instructions or \`MANIFEST.MF\`)
- Is there an API bundle defining interfaces, and an impl bundle providing the DS component?

**Service registration and injection**
- How are services registered: via Declarative Services XML, \`@Component\` annotations, or programmatic \`BundleContext.registerService()\`?
- How are service references injected: \`@Reference\` fields, setter methods, or \`BundleContext.getServiceReference()\`?
- Are there \`BundleActivator\` classes? In which modules? What do they do?
- Do DS components have \`activate()\`/\`deactivate()\` lifecycle methods?

**UI layer (if desktop application)**
- Is the UI built with Swing, JavaFX, or Eclipse SWT/RCP?
- Are UI panels/windows registered as OSGi services or started from a BundleActivator?
- Is there a \`plugin.xml\` or Eclipse 4 model (\`Application.e4xmi\`) for RCP contributions?
- What Look & Feel library is used (FlatLaF, Nimbus, native)?

**Data flow**
- Trace one real operation from UI entry point to data source. List every bundle and class it crosses.
- Where is data persistence? (DICOM network, local file, embedded DB, remote service?)

**Per module — record as facts:**
\`\`\`
<module>/  — role: [describe] · key exports: [packages] · DS components: [N] · BundleActivator: [yes/no] · tests: [yes/no]
\`\`\`` : `
For each significant directory under \`${sourceDir}\`, read 15–25 \`.java\` files and answer:

**Build system**
- Is this Maven or Gradle? Multi-module or single module?
- What Java version is configured? Are preview features enabled?

**Framework detection**
- Is this Spring Boot, Quarkus, Micronaut, plain Java, or desktop (Swing/JavaFX)?
- If Spring Boot: what starters are used? (web, data-jpa, security, webflux?)

**Layer structure**
- What layers actually exist? (controller/, service/, repository/, model/, or flat packages?)
- Is there a DTO layer separate from entities?
- Are interfaces used for service/repository contracts?

**Data access**
- What ORM/data approach is used? (JPA/Hibernate, MyBatis, jOOQ, Spring Data, JDBC?)
- Where are queries defined? (Repository interfaces, @Query annotations, XML mappers?)

**Dependency injection**
- What DI approach? (Spring @Autowired/@Inject, constructor injection, Guice?)
- Is field injection used anywhere? (anti-pattern — should be constructor injection)

**Data flow**
- Trace one real request from Controller to database. List every class it passes through.

**Per directory — record as facts:**
\`\`\`
.../controller/  [N] files — patterns: [describe]
.../service/     [N] files — patterns: [describe]
.../repository/  [N] files — patterns: [describe]
.../model/       [N] files — patterns: [describe]
.../config/      [N] files — patterns: [describe]
\`\`\``;

    default: return `
For each significant directory under \`${sourceDir}\`, read 15-20 source files and answer:

**Layer structure**: What directories exist? Is there clear separation of concerns?
**Data access**: Where and how is data accessed? What libraries?
**Business logic**: Where does business logic live?
**Data flow**: Trace one real request from entry point to data source.
**Naming and conventions**: File naming, class naming, folder structure patterns.

Record as facts — what you actually observe, not what should be there.`;
  }
}

export function getDeadCodeSignals(c: GovernanceConfig): string {
  const { profile } = c;
  const sourceDir = profile.sourceDir || 'src/';
  const featuresDir = profile.featuresDir || sourceDir;

  switch (c.stack) {
    case 'flutter':
      return `- Files with \`_old\`, \`_backup\`, \`_copy\`, \`_v1\`, \`_deprecated\`, \`_unused\` in filename
- Empty \`lib/\` subdirectories (no .dart files inside)
- \`.dart\` files with no class declarations and no imports (orphaned stubs)
- Files named \`example_\`, \`todo_\`, \`placeholder_\` outside of \`test/\`
- \`_test.dart\` files in \`test/\` whose corresponding source no longer exists in \`lib/\`
- \`built_*.dart\` / \`*.g.dart\` / \`*.freezed.dart\` files whose source \`.dart\` no longer exists
- Chopper service files (\`*.chopper.dart\`) if the project has migrated to Dio
- \`lib/data/\` BuiltValue converter files if Chopper/BuiltValue is being retired
- Feature folders in \`${featuresDir}\` with only a README and no code files`;

    case 'react':
      return `- Files with \`_old\`, \`_backup\`, \`_deprecated\`, \`Old\`, \`Backup\`, \`_unused\` in filename
- Barrel \`index.ts\` files that re-export types or components whose source files no longer exist
- Unused Redux slices: \`createSlice()\` definitions not imported by any component, hook, or store
- Unused Zustand stores: \`create()\` calls not imported anywhere in the codebase
- Empty directories under \`${sourceDir}\` (no .ts/.tsx files inside)
- \`.test.ts/.spec.ts\` files whose corresponding source file no longer exists
- Feature folders with only a \`types.ts\` or \`index.ts\` but no components or hooks
- If Next.js Pages Router: spot-check \`pages/\` files — flag obvious orphans not referenced by \`<Link href=\` or \`router.push(\``;

    case 'angular':
      return `- Files with \`-old\`, \`-backup\`, \`-deprecated\`, \`-unused\`, \`Old\`, \`Deprecated\` in filename
- Standalone components: not present in any other component's \`imports:\` array and not referenced in any route definition
- NgModule-declared components: any component not listed in any NgModule is orphaned
- Empty \`src/app/\` subdirectories (no .ts files inside)
- \`.spec.ts\` files whose corresponding \`.component.ts\` or \`.service.ts\` file no longer exists
- Services with \`@Injectable()\` but no \`providedIn\` and not listed in any \`providers\` array
- If Nx: libraries in \`libs/\` with no \`import\` from any app or other library`;

    case 'nodejs':
      return `- Files with \`_old\`, \`_backup\`, \`_deprecated\`, \`_unused\`, \`Old\`, \`Backup\` in filename
- Service files whose exported class or function is not imported by any controller, handler, or other service
- Middleware files not referenced in \`app.ts\`/\`server.ts\` or any module's middleware registration
- Empty \`${sourceDir}\` subdirectories (no .ts files inside)
- \`.test.ts/.spec.ts\` files whose corresponding source file no longer exists
- If NestJS: \`@Module()\` decorated files with empty \`imports\`, \`controllers\`, and \`providers\` arrays`;

    case 'python':
      return `- Files with \`_old\`, \`_backup\`, \`_deprecated\`, \`_unused\`, \`_v1\`, \`_copy\` in filename
- Router files (\`APIRouter\`) not referenced by \`include_router()\` **anywhere in the codebase** —
  check ALL .py files, not just \`main.py\`/\`app.py\` (nested router chains are valid:
  a router included by any other router at any level is considered active)
- If Django: \`urls.py\` files not referenced by \`include()\` **anywhere in the codebase** —
  check ALL \`urls.py\` files at all nesting levels, not only from the root \`urls.py\`
- Service or repository files with no reference anywhere in the codebase —
  check all .py files including \`dependencies.py\`, \`deps.py\`, any DI container file,
  Celery/background task files, AND function signatures using \`Depends()\` — these all count as active use
- Empty directories under \`${sourceDir}\`
- \`test_\` files whose corresponding source module file no longer exists
- Pydantic schema files not referenced as: import statement, \`response_model=\`,
  type annotation, or base class in any .py file`;

    case 'kotlin':
      return `- Classes with \`Old\`, \`Backup\`, \`Deprecated\`, \`Unused\`, \`V1\`, \`Legacy\` in class name or filename
- UseCase classes not imported by any ViewModel
- Empty feature packages (folder exists, no .kt files inside)
- \`*Test.kt\` / \`*Tests.kt\` files whose source class file no longer exists
- If migrating from XML to Compose: XML layout files in \`res/layout/\` not referenced by any Fragment or Activity
- If Hilt: \`@HiltViewModel\` annotated ViewModels not injected anywhere via \`hiltViewModel()\` or \`viewModels()\``;

    case 'swiftui':
      return `- Files with \`Old\`, \`Backup\`, \`Deprecated\`, \`Unused\`, \`V1\`, \`Legacy\` in filename
- View files not referenced by any NavigationLink, TabView, or coordinator
- ViewModel classes with no View using them
- \`*Tests.swift\` files whose source type no longer exists
- Singleton managers with no callers`;

    case 'java':
      return `- Classes with \`Old\`, \`Backup\`, \`Deprecated\`, \`Unused\`, \`V1\`, \`Legacy\` in class name or filename
- \`@Service\` or \`@Component\` annotated classes not injected anywhere
- \`@Repository\` interfaces not referenced by any service class
- \`@Controller\`/\`@RestController\` classes with no mapped endpoints being called
- Empty packages under \`${sourceDir}\` (no .java files inside)
- \`*Test.java\` / \`*Tests.java\` files whose source class no longer exists
- JPA entities not referenced by any repository or query
- Configuration classes (\`@Configuration\`) with empty \`@Bean\` methods or no beans used elsewhere
- If multi-module: modules with no dependents (not listed as dependency in any other module's pom.xml)`;

    default:
      return `- Files with \`_old\`, \`_backup\`, \`_deprecated\`, \`Old\`, \`Backup\` in filename
- Empty directories under \`${sourceDir}\`
- Source files not referenced or imported by anything
- Test files whose source no longer exists`;
  }
}

export function getTestCoverageInstructions(c: GovernanceConfig): string {
  const { profile, scan } = c;
  const featuresDir = profile.featuresDir || profile.sourceDir || 'src/features/';
  const testFramework = scan.detectedTestFramework || 'not detected';
  const testCmd = profile.testCmd || 'run tests';

  switch (c.stack) {
    case 'flutter': return `
**First — determine which scenario applies:**

**SCENARIO A — No test directory:**
If \`test/\` is absent or completely empty:
- Note: Test infrastructure not configured
- Add to coding-standards: "Tests not yet set up — run \`${testCmd}\` once configured"
- Score: 0/100

**SCENARIO B — Tests exist, check completeness:**
For each feature in \`${featuresDir}\`, check if \`test/features/<feature>/\` exists and contains test files.

| Expected test | Checks |
|---|---|
| Cubit/BLoC | \`test/features/<feature>/presentation/\` — does it exist and have test files? |
| UseCase | \`test/features/<feature>/domain/\` — does it exist? |
| Repository | \`test/features/<feature>/data/\` — does it exist? |

Per feature: TESTED (all layers) · PARTIAL (some layers — note which missing) · UNTESTED (no folder)
Score: (tested features / total features) × 100. PARTIAL = 50%.

**SCENARIO C — Tests exist everywhere:**
Spot-check 5 test files. Do they have real assertions or just empty \`expect(true, true)\` stubs?
Flag scaffold-only tests as UNTESTED (scaffold).`;

    case 'react': return `
**First — determine which scenario applies:**

**SCENARIO A — No test files anywhere:**
If no \`.test.tsx\`, \`.test.ts\`, \`.spec.ts\` files exist AND no Jest/Vitest config:
- Note: "No test infrastructure. Add ${testFramework !== 'not detected' ? testFramework : 'Jest or Vitest'}"
- Score: 0/100

**SCENARIO B — Some tests exist:**
For each feature in \`${featuresDir}\`, check for test files (sibling or \`__tests__/\`).
Score: (features with tests / total features) × 100. PARTIAL (only hooks or only components) = 50%.

**SCENARIO C — Tests exist everywhere:**
Spot-check 5 test files. Real assertions or just \`expect(wrapper).toBeTruthy()\` scaffold?
Flag render-only tests as UNTESTED (scaffold).`;

    case 'angular': return `
**First — determine which scenario applies:**

**SCENARIO A — No spec files:**
If no \`.spec.ts\` files exist AND no karma/jest config:
- Note: "Angular CLI generates specs by default — they may have been deleted"
- Score: 0/100

**SCENARIO B — Specs exist, check coverage:**
For each \`.component.ts\` and \`.service.ts\`, check if a sibling \`.spec.ts\` exists.
Score: (files with spec / total components+services) × 100.

**SCENARIO C — Specs exist everywhere:**
Open 3-5 spec files. Are they real tests or just Angular CLI scaffold (TestBed with no expect)?
Flag scaffold-only specs as UNTESTED (scaffold).`;

    case 'nodejs': return `
**First — determine which scenario applies:**

**SCENARIO A — No test files:**
If no \`tests/\`, \`__tests__/\`, \`*.test.ts\`, \`*.spec.ts\` exist:
- Score: 0/100

**SCENARIO B — Some tests exist:**
For each service file, check if a corresponding test file exists.
Score: (services with tests / total services) × 100.

**SCENARIO C — Tests exist for everything:**
Spot-check 3-5 test files. Unit tests (mocked deps) or integration tests (real DB)?
Note which approach is used — both are valid, but note if tests hit real DB in CI.`;

    case 'python': return `
**First — determine which scenario applies:**

**SCENARIO A — No test files anywhere:**
Apply SCENARIO A ONLY if ALL of the following are absent:
- No \`tests/\` directory at the project root containing test files
- No \`test_*.py\` files at the project root
- If Django: no \`tests.py\` or \`tests/\` directory inside ANY app directory (check each app under \`apps/\` or project root apps)
- No \`conftest.py\` at any level
→ Only then: Score 0/100. Note: "No test infrastructure detected."

**SCENARIO B — Some tests exist:**
- FastAPI/Flask: for each router/blueprint file, check if a corresponding \`tests/test_<resource>.py\` exists.
- Django: for each app, check EITHER \`<app>/tests.py\` with at least one TestCase class OR \`<app>/tests/test_*.py\` files.
Score: (modules/apps with tests / total modules/apps) × 100. PARTIAL = 50%.

**SCENARIO C — Tests exist for everything:**
Spot-check 3-5 test files:
- FastAPI: are they using \`TestClient\` or \`AsyncClient\`?
- Django: are they using \`TestCase\` or \`APIClient\` (DRF)?
- Are services/repositories tested with mocked ORM sessions?`;

    case 'kotlin': return `
**First — determine which scenario applies:**

**SCENARIO A — No test files:**
- Single-module: if \`app/src/test/\` is absent or empty → Score: 0/100
- Multi-module: apply SCENARIO A ONLY IF \`src/test/\` is absent or empty in EVERY module. DO NOT score SCENARIO A from the root \`app/\` alone. Check each module directory (e.g. \`:core\`, \`:features:auth\`) for its own \`src/test/\`.

**SCENARIO B — Some tests exist:**
For each module or feature, check that module's \`src/test/\` (e.g. \`app/src/test/\`, \`core/src/test/\`, \`features/auth/src/test/\`) for ViewModel, UseCase, and Repository test files.
Score: (features/modules with all three layers tested / total) × 100. PARTIAL (some layers missing) = 50%.

**SCENARIO C — Tests exist everywhere:**
Spot-check 3-5 ViewModel test files:
- Do they use \`StandardTestDispatcher\` or \`UnconfinedTestDispatcher\`?
- Are coroutines advanced with \`advanceUntilIdle()\` or \`runTest {}\` blocks?
- Are repositories mocked/faked, or do tests hit real Room/network?`;

    case 'swiftui': return `
**SCENARIO A — No test targets:**
If \`*Tests/\` targets are empty or absent:
- Score: 0/100

**SCENARIO B — Some tests exist:**
For each ViewModel and Service, check if a test class exists.
Score: (ViewModels + Services with tests / total) × 100.

**SCENARIO C — Tests exist everywhere:**
Check ViewModel tests inject dependencies (no singletons used directly).`;

    case 'java': return c.scan.detectedOSGi ? `
**First — determine which scenario applies:**

> ⚠️ This is an OSGi multi-module project. DO NOT check only the root \`src/test/java/\`.
> Root-level \`src/test/java/\` does not exist in multi-module OSGi projects.
> You MUST scan every module's test directory before applying any scenario.

**How to find test files (OSGi multi-module):**
For each directory that contains its own \`pom.xml\` or \`build.gradle\`, check:
- \`<module>/src/test/java/\` — JUnit/integration tests
- \`<module>/src/test/resources/\` — test fixtures

List each module separately:

\`\`\`
MODULE TEST INVENTORY
  <module>/  — source files: [N] · test files: [N] · status: TESTED/PARTIAL/UNTESTED
  <module>/  — source files: [N] · test files: [N] · status: TESTED/PARTIAL/UNTESTED
  ...
\`\`\`

**SCENARIO A — No test files anywhere:**
Apply SCENARIO A ONLY IF every module shows 0 test files in the inventory above AND no \`*Test.java\` or \`*Tests.java\` exists anywhere in the repository tree.
→ Score: 0/100. Add to developer-actions.md: "Set up JUnit 5 test infrastructure in each OSGi bundle."

**SCENARIO B — Some modules have tests:**
Score = round((modules with ≥1 test file / total modules with source files) × 100).
PARTIAL (tests exist in a module but cover <25% of its public classes) = 50% credit for that module.

**SCENARIO C — Most modules have tests:**
Spot-check 3–5 test files across different modules:
- Are DS components tested by instantiating the class directly and calling \`activate()\`/\`deactivate()\` manually? (correct — no Spring container in OSGi)
- Are dependencies injected via setter or constructor in tests? (correct OSGi pattern)
- Is Mockito used (\`@ExtendWith(MockitoExtension.class)\`)? (positive signal)
- Are any OSGi integration frameworks used (PAX Exam, Felix SCR test runner)? (advanced — note if found)
- Are tests using \`@SpringBootTest\`, \`@MockBean\`, or \`MockMvc\`? (WRONG in OSGi — flag as mismatched if found)
→ Score: 95 if all spot-checked tests have real assertions and follow OSGi patterns.
` : `
**First — determine which scenario applies:**

**SCENARIO A — No test files:**
- Single-module: if \`src/test/java/\` is absent or empty → Score: 0/100
- Multi-module: apply SCENARIO A ONLY IF \`src/test/java/\` is absent or empty in EVERY module. DO NOT score SCENARIO A from the root directory alone.

**SCENARIO B — Some tests exist:**
For each module directory (or root if single-module), check \`<module>/src/test/java/\` for a corresponding \`*Test.java\` or \`*Tests.java\` per service class.
${c.scan.detectedSubtype === 'spring-boot'
  ? `For each controller, check if integration tests exist (using \`@WebMvcTest\` or \`@SpringBootTest\`).`
  : `For each significant class, check if a unit test exists.`}
Score: (classes with tests / total service+controller classes) × 100. PARTIAL = 50%.

**SCENARIO C — Tests exist everywhere:**
Spot-check 3–5 test files:
${c.scan.detectedSubtype === 'spring-boot'
  ? `- Are services tested with mocked repositories (\`@Mock\` + \`@InjectMocks\` or \`@MockBean\`)?
- Are controllers tested with \`MockMvc\` or \`WebTestClient\`?
- Are integration tests using \`@SpringBootTest\` with \`@Testcontainers\` or in-memory DB?`
  : `- Are dependencies mocked with \`@Mock\` + \`@InjectMocks\`?
- Do tests use \`@ExtendWith(MockitoExtension.class)\`?
- Are tests isolated (no real DB, no real network calls)?`}
`;

    default: return `
**SCENARIO A — No tests:** If no test files or test directory found → Score 0/100.
**SCENARIO B — Partial:** Count features/modules with tests vs without. Score = (tested / total) × 100.
**SCENARIO C — Comprehensive:** Spot-check 5 test files for real assertions vs boilerplate scaffold.`;
  }
}
