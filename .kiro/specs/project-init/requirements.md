# Requirements Document

## Introduction

The `ai-gov project init` command scaffolds new software projects with governance built-in from day one. It provides an interactive wizard that collects project configuration (stack, name, agent, CI platform), delegates scaffolding to stack-specific adapters, and automatically applies governance (steering files, hooks, CI config) after project creation. Current scope covers Flutter and Next.js adapters, with an extensible adapter interface for future stacks.

## Glossary

- **Orchestrator**: The top-level command handler (`project-init.ts`) that coordinates the wizard flow, adapter delegation, and governance application.
- **StackAdapter**: An interface that each supported stack implements to provide stack-specific prompts, scaffolding, scan hints, and post-setup commands.
- **Adapter_Registry**: A module that maps Stack identifiers to StackAdapter instances and provides lookup functions.
- **ScaffoldContext**: A data object containing all wizard-collected inputs (common and stack-specific) passed to adapter methods.
- **Common_Prompts**: Shared interactive questions collected by the Orchestrator before delegating to a stack adapter (app name, display name, output directory, agent, git hooks, CI platform).
- **Flutter_Adapter**: The StackAdapter implementation for Flutter projects using clean architecture, FVM, and BLoC/Cubit state management.
- **Next_Adapter**: The StackAdapter implementation for Next.js projects supporting frontend-only and full-stack modes.
- **Governance_Engine**: The existing `runGovernance` function that generates steering files, hooks, and agent configuration for a project.
- **Scan_Hints**: Pre-populated ScanResult fields derived from wizard answers, avoiding post-scaffold filesystem scanning.
- **Naming_Convention**: Stack-specific project name format rules (snake_case for Flutter, kebab-case for Next.js/npm).
- **Workspace_Safety**: Protection mechanism ensuring projects created via `project init` use `conflictMode: 'keep'` to prevent workspace commands from overwriting governance files.

## Requirements

### Requirement 1: Stack Selection and Adapter Lookup

**User Story:** As a developer, I want to select my target stack from a list of supported options, so that the correct adapter handles my project scaffolding.

#### Acceptance Criteria

1. WHEN the user runs `ai-gov project init` without a `--type` flag, THE Orchestrator SHALL present an interactive selection prompt listing all registered stack adapters by display name.
2. WHEN the user provides a `--type <stack>` flag, THE Orchestrator SHALL skip the stack selection prompt and pass the specified stack identifier directly to the Adapter_Registry for lookup.
3. WHEN the Adapter_Registry receives a valid Stack identifier, THE Adapter_Registry SHALL return the corresponding StackAdapter instance.
4. IF the Adapter_Registry receives an unregistered Stack identifier, THEN THE Adapter_Registry SHALL throw an error with the message "No adapter registered for stack: {id}" where `{id}` is the exact identifier that was attempted.
5. THE Adapter_Registry SHALL expose a `getAllAdapters()` function that returns all registered StackAdapter instances as an array.
6. THE Adapter_Registry SHALL expose a `getSupportedStackIds()` function that returns all registered Stack identifiers.
7. THE selection prompt SHALL display adapters in their registration order, ensuring deterministic behavior.

### Requirement 2: Common Prompt Collection

**User Story:** As a developer, I want to provide project-wide configuration through a consistent set of prompts, so that all stacks share the same governance and identity inputs.

#### Acceptance Criteria

1. THE Common_Prompts module SHALL collect the following inputs in order: app name, display name, output directory, AI agent choice, git hooks preference (boolean confirm), and CI platform.
2. WHEN collecting the app name, THE Common_Prompts module SHALL display the stack-specific naming hint (e.g., "snake_case" or "kebab-case") provided by the adapter and SHALL reject empty or whitespace-only input.
3. WHEN collecting the display name, THE Common_Prompts module SHALL default to a human-readable transformation of the app name (replacing hyphens and underscores with spaces, capitalizing the first letter of each word).
4. WHEN the user confirms "Create in current directory?", THE Common_Prompts module SHALL use `process.cwd()` as the output directory without prompting for a path.
5. IF the user declines "Create in current directory?", THEN THE Common_Prompts module SHALL prompt for an output directory path with a default of `process.cwd()`.
6. THE Common_Prompts module SHALL offer agent choices of "Claude Code" (value: `claude-code`) and "Kiro" (value: `kiro`).
7. THE Common_Prompts module SHALL offer CI platform choices of "GitHub Actions" (value: `github`), "GitLab CI" (value: `gitlab`), "Bitbucket" (value: `bitbucket`), and "None" (value: `none`).
8. WHEN the user provides a `--name` flag, THE Orchestrator SHALL skip the app name prompt and use the provided value after trimming whitespace.
9. WHEN the user provides a `--dir` flag, THE Orchestrator SHALL skip the output directory prompt and use the provided path as the output directory.

### Requirement 3: Adapter Interface Contract

**User Story:** As a framework maintainer, I want a well-defined adapter interface, so that new stacks can be added without modifying the orchestrator.

#### Acceptance Criteria

1. THE StackAdapter interface SHALL define a `runPrompts(base: ScaffoldContext): Promise<ScaffoldContext>` method that receives the common context and returns a completed ScaffoldContext with stack-specific fields merged in, preserving all existing base fields.
2. THE StackAdapter interface SHALL define a `scaffold(ctx: ScaffoldContext): Promise<void>` method that creates all project files and directories without executing shell commands.
3. THE StackAdapter interface SHALL define a `scanHints(ctx: ScaffoldContext): Partial<ScanResult>` method that returns ScanResult field overrides derived purely from wizard answers without performing I/O.
4. THE StackAdapter interface SHALL define a `postSetup(ctx: ScaffoldContext): Promise<void>` method that executes post-scaffold shell commands (package install, git init, initial commit).
5. THE StackAdapter interface SHALL define a readonly `id` property matching a value in the Stack type.
6. THE StackAdapter interface SHALL define a readonly `displayName` property for user-facing stack labels.
7. THE StackAdapter interface SHALL define a readonly `nameHint` property containing the naming convention description string (e.g., "snake_case" or "kebab-case") displayed during the app name prompt.
8. WHEN an adapter calls `registerAdapter(instance)`, THE Adapter_Registry SHALL store the adapter keyed by its `id` property.
9. IF `registerAdapter` is called with an adapter whose `id` matches an already-registered adapter, THEN THE Adapter_Registry SHALL throw an error with the message "Adapter already registered for stack: {id}".

### Requirement 4: Naming Convention Enforcement

**User Story:** As a developer, I want my project name to follow the correct convention for my chosen stack, so that it is compatible with the stack's package ecosystem.

#### Acceptance Criteria

1. WHEN the Flutter stack is selected, THE Flutter_Adapter SHALL validate that the app name matches the regex `^[a-z][a-z0-9_]*$` (snake_case, compatible with pub.dev).
2. WHEN the Next.js stack is selected, THE Next_Adapter SHALL validate that the app name matches the regex `^[a-z][a-z0-9-]*$` (kebab-case, compatible with npm).
3. WHEN the app name prompt is displayed, THE Common_Prompts module SHALL show the naming hint string provided by the selected adapter's `nameHint` property.
4. IF the user enters an app name that does not match the adapter's naming convention during interactive prompting, THEN THE Common_Prompts module SHALL display an error message indicating the required format and re-prompt.
5. IF the `--name` flag value does not match the selected adapter's naming convention, THEN THE CLI SHALL display an error message indicating the naming rule violation and abort without prompting.

### Requirement 5: Flutter Adapter Scaffolding

**User Story:** As a Flutter developer, I want `project init` to scaffold a complete clean-architecture Flutter project, so that I can start development with proper structure and configuration.

#### Acceptance Criteria

1. WHEN the Flutter_Adapter scaffold method is called, THE Flutter_Adapter SHALL create the following directory structure: `lib/core/config/`, `lib/core/di/`, `lib/core/framework/`, `lib/core/network/`, `lib/core/connectivity/`, `lib/core/router/`, `lib/core/theme/`, `lib/core/logger/`, `lib/core/utils/`, `lib/features/`, `assets/images/`, `assets/icons/`, `assets/fonts/`, `bricks/clean_feature/__brick__/`, `test/architecture/`, `test/core/`, and `integration_test/`.
2. WHEN services are provided in the Flutter context, THE Flutter_Adapter SHALL generate `app_config.dart` in `lib/core/config/` with one static getter per service returning the base URL for the current environment, where environments are: local, dev, qa, staging, and prod.
3. WHEN no services are provided, THE Flutter_Adapter SHALL generate `app_config.dart` with two default services: `api` (localhost:3000) and `node` (localhost:3001).
4. WHEN service endpoints are provided, THE Flutter_Adapter SHALL generate `api_endpoints.dart` with a string constant for each endpoint path, using camelCase naming derived by stripping the leading slash, splitting on `/`, and joining segments in camelCase (e.g., `/auth/login` becomes `authLogin`).
5. WHEN an endpoint path contains one or more parameterised segments (e.g., `{id}`), THE Flutter_Adapter SHALL strip the parameterised segments from the name derivation and append a single `ById` suffix to the generated constant name (e.g., `/users/{userId}/posts/{postId}` becomes `usersPostsById`).
6. WHEN no endpoints are configured for a service, THE Flutter_Adapter SHALL generate a TODO comment in `api_endpoints.dart` for that service.
7. THE Flutter_Adapter SHALL generate a `pubspec.yaml` containing the app name matching the ScaffoldContext `appName` field and dependencies including at minimum `flutter_bloc`, `dio`, `get_it`, and `go_router`.
8. THE Flutter_Adapter SHALL generate `dio_factory.dart` containing a `DioFactory` class that accepts a `ConnectivityCubit` parameter and adds a `PrettyDioLogger` interceptor to the Dio instance.
9. THE Flutter_Adapter SHALL generate `analysis_options.yaml` with `avoid_print: true` and `always_use_package_imports: true` rules enabled.
10. THE Flutter_Adapter SHALL generate all Dart file imports using the package name `package:<appName>/` where `<appName>` is the snake_case app name from the ScaffoldContext.
11. IF two endpoints within the same service produce identical camelCase constant names, THEN THE Flutter_Adapter SHALL prefix the constant name with the lowercase HTTP method to disambiguate (e.g., `postAuthLogin`, `getAuthLogin`).

### Requirement 6: Flutter Adapter Prompts

**User Story:** As a Flutter developer, I want to configure Android/iOS identifiers, Flutter version, and backend services during project init, so that the scaffold is production-ready.

#### Acceptance Criteria

1. THE Flutter_Adapter SHALL prompt for Android package ID with a default of `com.<appName>.<appName>` (where `<appName>` is the snake_case app name with underscores removed for domain segments), and validate that the input follows reverse-domain notation containing only lowercase letters, digits, and dots with a maximum length of 255 characters.
2. THE Flutter_Adapter SHALL prompt for iOS bundle ID with a default matching the Android package ID value.
3. THE Flutter_Adapter SHALL prompt for Flutter version (FVM) with a default of "3.29.0".
4. WHEN the user confirms the "Add a backend service?" prompt, THE Flutter_Adapter SHALL collect in a loop: a snake_case service name, per-environment base URLs (local, dev, qa, staging, prod), optional custom headers as key-value pairs, and endpoints each specified as a method and path (e.g., "POST /auth/login").
5. WHEN the user declines to add services, THE Flutter_Adapter SHALL proceed without service configuration and use two default services during scaffolding: `api` (localhost:3000) and `node` (localhost:3001).
6. WHEN the user has finished adding endpoints for a service, THE Flutter_Adapter SHALL prompt "Add another service?" to allow adding additional services or exiting the loop.

### Requirement 7: Flutter Adapter Post-Setup

**User Story:** As a Flutter developer, I want the project to be initialized with git, FVM, and dependencies resolved after scaffolding, so that I can immediately start coding.

#### Acceptance Criteria

1. WHEN postSetup is called, THE Flutter_Adapter SHALL run `git init` in the project directory.
2. WHEN postSetup is called, THE Flutter_Adapter SHALL check whether the `fvm` binary is found in the system PATH to determine FVM availability.
3. IF FVM is available on the system, THEN THE Flutter_Adapter SHALL run `fvm use <flutterVersion> --force` (where `<flutterVersion>` is the version collected during prompts) followed by `fvm flutter pub get`.
4. IF FVM is not found in the system PATH, THEN THE Flutter_Adapter SHALL print a warning message indicating that FVM was not found and FVM-related steps will be skipped, and SHALL continue with the remaining postSetup steps.
5. IF `fvm flutter pub get` fails with a non-zero exit code, THEN THE Flutter_Adapter SHALL print a warning message indicating dependency resolution failed and SHALL continue with the remaining postSetup steps.
6. WHEN git init and all applicable preceding steps complete without error, THE Flutter_Adapter SHALL run `git add -A` followed by `git commit -m "chore: initial project scaffold"` to create the initial commit.

### Requirement 8: Flutter Adapter Scan Hints

**User Story:** As the governance engine, I want pre-populated scan results from the Flutter adapter, so that governance files are generated correctly without filesystem scanning.

#### Acceptance Criteria

1. THE Flutter_Adapter scanHints method SHALL return a partial ScanResult object containing only the fields specified in criteria 2–9, suitable for merging into a default ScanResult.
2. THE Flutter_Adapter scanHints method SHALL return `detectedState: 'BLoC'`.
3. THE Flutter_Adapter scanHints method SHALL return `detectedDI: 'GetIt'`.
4. THE Flutter_Adapter scanHints method SHALL return `detectedNetwork: 'Dio'`.
5. THE Flutter_Adapter scanHints method SHALL return `detectedRouter: 'GoRouter'`.
6. THE Flutter_Adapter scanHints method SHALL return `detectedMason: true`.
7. THE Flutter_Adapter scanHints method SHALL return `detectedFVM: true`.
8. THE Flutter_Adapter scanHints method SHALL return `detectedPackageManager: 'pub'`.
9. THE Flutter_Adapter scanHints method SHALL return `scaffoldTool: 'mason'`.

### Requirement 9: Next.js Adapter Scaffolding

**User Story:** As a Next.js developer, I want `project init` to scaffold a clean-architecture Next.js project with my chosen configuration, so that I have a production-ready starting point.

#### Acceptance Criteria

1. WHEN the Next_Adapter scaffold method is called in frontend mode, THE Next_Adapter SHALL create: `src/app/`, `src/features/`, `src/core/api/`, `src/core/config/`, `src/core/errors/`, `src/core/types/`, `src/core/utils/`, `src/shared/components/`, and `src/shared/hooks/`.
2. WHEN the Next_Adapter scaffold method is called in fullstack mode, THE Next_Adapter SHALL additionally create: `src/app/api/health/route.ts`, `src/lib/db.ts`, `src/lib/auth.ts`, and `src/middleware.ts`.
3. WHEN the project type is frontend-only, THE Next_Adapter SHALL NOT create `src/app/api/`, `src/lib/`, or `src/middleware.ts`.
4. THE Next_Adapter SHALL generate a `package.json` with the `name` field set to the app name from ScaffoldContext and SHALL always include `next`, `react`, `react-dom`, `typescript`, `@types/react`, `@types/node`, and `zod` as dependencies.
5. WHEN styling is set to "tailwind", THE Next_Adapter SHALL include `tailwindcss`, `postcss`, and `autoprefixer` in dependencies and generate `tailwind.config.ts` and `postcss.config.js`.
6. WHEN styling is NOT set to "tailwind", THE Next_Adapter SHALL NOT include Tailwind-related dependencies or configuration files.
7. WHEN serverState is set to "tanstack-query", THE Next_Adapter SHALL include `@tanstack/react-query` in dependencies.
8. WHEN auth is set to "nextauth" and project type is fullstack, THE Next_Adapter SHALL include `next-auth` in dependencies. WHEN auth is set to "clerk" and project type is fullstack, THE Next_Adapter SHALL include `@clerk/nextjs` in dependencies.
9. WHEN database is set to "prisma" and project type is fullstack, THE Next_Adapter SHALL include `prisma` and `@prisma/client` in dependencies.
10. WHEN project type is frontend-only, THE Next_Adapter SHALL NOT include auth or database dependencies regardless of context values.
11. THE Next_Adapter SHALL generate a `tsconfig.json` with `strict: true` and a `@/*` path alias pointing to `src/*`.
12. THE Next_Adapter SHALL generate `src/core/config/env.ts` using zod to validate environment variables and exporting a typed `env` object, such that IF validation fails at application startup, THEN the process SHALL throw an error indicating which variables are missing or invalid.
13. THE Next_Adapter SHALL generate `.env.local` and `.env.example` files containing placeholder entries for all environment variables referenced in `env.ts`, and SHALL include `.env.local` in `.gitignore`.
14. WHEN project type is fullstack, THE Next_Adapter SHALL generate a health check API route at `src/app/api/health/route.ts` that returns a JSON response with HTTP status 200 and a body containing a `status` field set to "ok".
15. WHEN styling is set to "tailwind", THE Next_Adapter SHALL generate a `src/app/globals.css` file containing the Tailwind CSS directives.

### Requirement 10: Next.js Adapter Prompts

**User Story:** As a Next.js developer, I want to choose my project type, package manager, styling, state management, and full-stack options, so that the scaffold matches my preferred toolchain.

#### Acceptance Criteria

1. THE Next_Adapter SHALL prompt for project type with choices "Frontend only" and "Full-stack" (default: Frontend only), presented as the first stack-specific prompt.
2. THE Next_Adapter SHALL prompt for package manager with choices npm, yarn, pnpm, and bun (default: npm).
3. THE Next_Adapter SHALL prompt for router with choices "App Router" and "Pages Router" (default: App Router).
4. THE Next_Adapter SHALL prompt for styling with choices "Tailwind CSS", "CSS Modules", and "styled-components" (default: Tailwind CSS).
5. THE Next_Adapter SHALL prompt for server state management with choices "TanStack Query", "SWR", and "None" (default: TanStack Query).
6. THE Next_Adapter SHALL prompt for client state management with choices "Zustand", "Redux Toolkit", and "None" (default: Zustand).
7. IF the project type is "Full-stack", THEN THE Next_Adapter SHALL additionally prompt for auth provider with choices "NextAuth", "Clerk", "None" (default: NextAuth), database ORM with choices "Prisma", "Drizzle", "None" (default: Prisma), and API style with choices "REST", "tRPC", "None" (default: REST).
8. IF the project type is "Frontend only", THEN THE Next_Adapter SHALL NOT prompt for auth provider, database ORM, or API style.

### Requirement 11: Next.js Adapter Post-Setup

**User Story:** As a Next.js developer, I want the project initialized with git and dependencies installed after scaffolding, so that I can immediately start development.

#### Acceptance Criteria

1. WHEN postSetup is called, THE Next_Adapter SHALL execute the following steps in order: run `git init` in the project directory, run the package manager install command, conditionally run prisma init, stage all files with `git add -A`, and create the initial commit.
2. WHEN postSetup is called, THE Next_Adapter SHALL run the install command corresponding to the selected package manager: `npm install` for npm, `yarn install` for yarn, `pnpm install` for pnpm, or `bun install` for bun.
3. WHEN postSetup is called, IF database is set to "prisma" and project type is "fullstack", THEN THE Next_Adapter SHALL run `npx prisma init --datasource-provider sqlite` after the package manager install completes.
4. WHEN all preceding postSetup steps complete without error, THE Next_Adapter SHALL stage all files with `git add -A` and create a commit with the message "chore: initial project scaffold".
5. IF any shell command executed during postSetup exits with a non-zero status, THEN THE Next_Adapter SHALL abort the remaining postSetup steps and display an error message indicating which command failed.

### Requirement 12: Next.js Adapter Scan Hints

**User Story:** As the governance engine, I want pre-populated scan results from the Next.js adapter, so that governance files reflect the chosen configuration.

#### Acceptance Criteria

1. THE Next_Adapter scanHints method SHALL return a partial ScanResult object containing only the fields specified in criteria 2–9, suitable for merging into a default ScanResult.
2. THE Next_Adapter scanHints method SHALL return `detectedSSR: true`.
3. THE Next_Adapter scanHints method SHALL return `detectedNextRouter` as `'app'` when the user selects "App Router" or `'pages'` when the user selects "Pages Router".
4. THE Next_Adapter scanHints method SHALL return `detectedRSC: true` when the router is "app", and `detectedRSC: false` when the router is "pages".
5. THE Next_Adapter scanHints method SHALL return `detectedCSSApproach` as `'tailwind'`, `'css-modules'`, or `'styled-components'` matching the user's styling choice.
6. THE Next_Adapter scanHints method SHALL return `detectedSubtype` as `'fullstack'` for full-stack projects and `'frontend'` for frontend-only projects.
7. THE Next_Adapter scanHints method SHALL return `detectedORM` as `'prisma'`, `'drizzle'`, or `''` (empty string) matching the database choice.
8. THE Next_Adapter scanHints method SHALL return `detectedAuth` as `'nextauth'`, `'clerk'`, or `''` (empty string) matching the auth choice.
9. THE Next_Adapter scanHints method SHALL return `detectedPackageManager` as `'npm'`, `'yarn'`, `'pnpm'`, or `'bun'` matching the user's package manager choice.

### Requirement 13: Orchestrator Flow and Governance Integration

**User Story:** As a developer, I want the orchestrator to coordinate the full init flow from prompts through scaffolding to governance, so that I get a fully governed project in one command.

#### Acceptance Criteria

1. THE Orchestrator SHALL execute the following steps in order: stack selection, adapter lookup, common prompt collection, adapter-specific prompts, confirmation summary, directory existence check, scaffold, post-setup, governance config build, governance application, git hooks installation, CI config generation, and success output.
2. WHEN the `--yes` flag is provided, THE Orchestrator SHALL skip the confirmation summary prompt and proceed directly to the directory existence check.
3. WHEN the `--dry-run` flag is provided, THE Orchestrator SHALL execute scaffold and post-setup but skip governance application, git hooks installation, and CI config generation.
4. IF the target project directory already exists, THEN THE Orchestrator SHALL display an error message indicating the directory path that conflicts and abort without modifying the filesystem.
5. THE Orchestrator SHALL build a GovernanceConfig by loading the base profile for the adapter's stack, merging adapter scan hints into a default ScanResult, and setting `conflictMode` to "keep".
6. WHEN governance is applied, THE Orchestrator SHALL call the existing `runGovernance` function with the built GovernanceConfig — no modifications to the governance engine.
7. WHEN the agent is "claude-code", THE Governance_Engine SHALL generate `.claude/` directory, `CLAUDE.md`, and agent-specific hooks.
8. WHEN the agent is "kiro", THE Governance_Engine SHALL generate `.kiro/` directory, steering files, and agent-specific hooks.
9. WHEN git hooks are enabled, THE Orchestrator SHALL call `generateGitHooks` and `installGitHookWrappers` after governance application.
10. WHEN CI platform is not "none", THE Orchestrator SHALL call `generateCIConfig` with the selected platform.
11. IF scaffold, post-setup, or governance application fails with an error, THEN THE Orchestrator SHALL display an error message indicating which step failed and abort without continuing to subsequent steps.
12. WHEN all steps complete successfully, THE Orchestrator SHALL display a success message including the project directory path and a list of next-step commands relevant to the selected stack.

### Requirement 14: Workspace Safety

**User Story:** As a developer, I want projects created via `project init` to be protected from accidental governance overwrites, so that workspace-level commands do not clobber my project's configuration.

#### Acceptance Criteria

1. THE Orchestrator SHALL set `conflictMode: 'keep'` in the GovernanceConfig for all projects created via `project init`.
2. WHILE `conflictMode` is set to `'keep'` for a project, THE Governance_Engine SHALL skip writing any governance file (steering files, hook scripts, and agent configuration files) that already exists in the project directory.
3. WHEN the Governance_Engine skips a file due to `conflictMode: 'keep'`, THE Governance_Engine SHALL log a skipped-file message identifying the relative path of the preserved file.
4. IF a workspace-level command (e.g., `workspace init`) runs without the `--overwrite` flag on a project that already contains governance files, THEN THE Governance_Engine SHALL default to `conflictMode: 'keep'` and preserve all existing governance files.

### Requirement 15: CLI Registration and Flags

**User Story:** As a developer, I want `ai-gov project init` to be a properly registered CLI subcommand with useful flags, so that I can use it interactively or in scripts.

#### Acceptance Criteria

1. THE CLI SHALL register `project init` as a subcommand under the `project` command group.
2. THE CLI SHALL accept a `--type <stack>` option that takes a registered stack identifier to skip the stack selection prompt.
3. THE CLI SHALL accept a `--name <name>` option with a maximum length of 214 characters to skip the app name prompt.
4. THE CLI SHALL accept a `--yes` flag to skip the confirmation summary.
5. THE CLI SHALL accept a `--dry-run` flag to scaffold without applying governance.
6. THE CLI SHALL accept a `--dir <path>` option to override the parent directory (default: current working directory).
7. IF the `--type` value does not match a registered stack identifier, THEN THE CLI SHALL display an error message indicating the invalid stack and list the valid stack identifiers, and abort without prompting.
8. IF the `--name` value does not conform to the selected adapter's naming convention, THEN THE CLI SHALL display an error message indicating the naming rule violation and abort without prompting.
9. IF the `--dir` path does not exist or is not a directory, THEN THE CLI SHALL display an error message indicating the invalid path and abort without prompting.

### Requirement 16: Type System Extension

**User Story:** As a framework maintainer, I want the Stack type to include "next" as a distinct value, so that the Next.js adapter has an unambiguous identifier separate from the generic React stack.

#### Acceptance Criteria

1. THE Stack type in `src/types.ts` SHALL include `'next'` as a valid value alongside existing stack values.
2. WHEN `loadBaseProfile('next')` is called, THE profiles module SHALL return a BaseProfile with `stackDisplay` set to "Next.js", `buildCmd` set to "npm run build", and `runCmd` set to "npm run dev".
3. THE `'next'` profile SHALL inherit all other fields from the existing React profile (naming conventions, lint rules, etc.) unless explicitly overridden.

### Requirement 17: Adapter Self-Registration

**User Story:** As a framework maintainer, I want adapters to self-register on import, so that adding a new stack requires only creating an adapter file and importing it — no orchestrator changes.

#### Acceptance Criteria

1. WHEN the Flutter adapter module is imported, THE Flutter_Adapter SHALL call `registerAdapter` with its own instance at module load time (top-level side effect).
2. WHEN the Next.js adapter module is imported, THE Next_Adapter SHALL call `registerAdapter` with its own instance at module load time (top-level side effect).
3. THE CLI entry point SHALL import all adapter modules to trigger self-registration before command execution.
4. IF an adapter module fails to import (e.g., missing dependency), THEN THE CLI SHALL log a warning indicating which adapter failed to load and continue with the remaining adapters.

### Requirement 18: Dependency Management

**User Story:** As a developer, I want the project to use `@inquirer/prompts` for interactive input, so that the wizard has a modern, ESM-native prompt library.

#### Acceptance Criteria

1. THE project SHALL list `@inquirer/prompts` as a runtime dependency in `package.json` under `dependencies`.
2. THE project SHALL NOT list the `inquirer` package (non-scoped) in `dependencies` or `devDependencies` of `package.json`, and no source file SHALL import from `inquirer`.
3. THE Common_Prompts and adapter prompt modules SHALL import `select`, `input`, `confirm`, and `password` from `@inquirer/prompts` for all interactive user input.
4. WHEN a prompt module requires user input, THE prompt module SHALL use only functions exported by `@inquirer/prompts` and SHALL NOT use any other interactive prompt library.

### Requirement 19: BuildGovernanceConfig Pure Function

**User Story:** As a test author, I want the governance config construction to be a pure, exported function, so that it can be unit-tested without I/O or mocking.

#### Acceptance Criteria

1. THE Orchestrator module SHALL export a `buildGovernanceConfig` function that accepts a ScaffoldContext, a StackAdapter, and an options object containing optional boolean fields `dryRun`, `overwrite`, and `updateHooks`, and SHALL return a complete GovernanceConfig object.
2. THE `buildGovernanceConfig` function SHALL perform no I/O, no filesystem access, and no network calls, producing its output solely from its input arguments.
3. THE `buildGovernanceConfig` function SHALL set `config.stack` to the adapter's `id` property.
4. THE `buildGovernanceConfig` function SHALL set `config.profile` to the BaseProfile returned by `loadBaseProfile` for the adapter's `id`.
5. THE `buildGovernanceConfig` function SHALL construct `config.scan` by spreading the adapter's `scanHints(ctx)` return value over a default ScanResult (created via `createDefaultScanResult`), so that adapter-provided fields override defaults and unset fields retain default values.
6. THE `buildGovernanceConfig` function SHALL set `config.project.appName` to `ctx.displayName`.
7. THE `buildGovernanceConfig` function SHALL set `config.project.packageName` to `ctx.appName`.
8. THE `buildGovernanceConfig` function SHALL set `config.agent` to `ctx.agent`.
9. THE `buildGovernanceConfig` function SHALL set `config.projectDir` to `ctx.projectDir`.
10. THE `buildGovernanceConfig` function SHALL set `config.conflictMode` to `'keep'`.
