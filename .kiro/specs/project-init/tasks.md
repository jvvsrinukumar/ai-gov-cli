# Implementation Plan: project-init

## Overview

Implement the `ai-gov project init` command using an adapter pattern with self-registration. The implementation follows four phases: (1) core interfaces and registry, (4) orchestrator with DummyAdapter, (2) Flutter adapter, (3) Next.js adapter — ordered for correct dependency management. Each phase builds on the previous, ending with full CLI wiring.

## Tasks

- [x] 1. Phase 1 — Adapter Interface, Registry, and Common Prompts
  - [x] 1.1 Install `@inquirer/prompts` dependency and extend type system
    - Run `npm install @inquirer/prompts`
    - Add `'next'` to the `Stack` type union in `src/types.ts`
    - Add `'next'` profile case in `src/profiles.ts` inheriting from React with overrides: `stackDisplay: 'Next.js'`, `buildCmd: 'npm run build'`, `runCmd: 'npm run dev'`
    - _Requirements: 16.1, 16.2, 16.3, 18.1_

  - [x] 1.2 Create `src/stacks/adapter.ts` — StackAdapter interface and ScaffoldContext type
    - Define `ScaffoldContext` interface with common fields (`appName`, `displayName`, `outputDir`, `projectDir`, `agent`, `gitHooks`, `ci`) and index signature for stack-specific keys
    - Define `StackAdapter` interface with readonly properties (`id`, `displayName`, `nameHint`) and methods (`runPrompts`, `scaffold`, `scanHints`, `postSetup`)
    - Export `ScaffoldScanHints` type alias for `Partial<ScanResult>`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 1.3 Create `src/stacks/registry.ts` — Adapter registry with self-registration
    - Implement `registerAdapter(adapter)` that throws on duplicate `id`
    - Implement `getAdapter(id)` that throws on unknown `id`
    - Implement `getAllAdapters()` returning adapters in registration order
    - Implement `getSupportedStackIds()` returning registered stack IDs
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 3.8, 3.9_

  - [x] 1.4 Create `src/stacks/common-prompts.ts` — Shared wizard prompts
    - Implement `collectCommonAnswers(nameHint, nameValidator)` using `@inquirer/prompts` (`input`, `confirm`, `select`)
    - Collect: app name (with validation), display name (default from `toDisplayName`), output directory, agent, git hooks, CI platform
    - Export `toDisplayName(name)` that replaces hyphens/underscores with spaces and capitalizes words
    - Export `CommonAnswers` interface
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 18.3_

  - [x] 1.5 Write property tests for registry (Properties 1–4)
    - **Property 1: Registry Lookup Invariant** — registered adapter is retrievable by id, included in getAllAdapters, id in getSupportedStackIds
    - **Property 2: Registry Error on Unknown Identifier** — getAdapter throws for any unregistered string
    - **Property 3: Registry Preserves Registration Order** — getAllAdapters returns adapters in registration order
    - **Property 4: Duplicate Registration Error** — re-registering same id throws with correct message
    - Install `fast-check` as devDependency; create `tests/stacks/registry.property.test.ts`
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 3.8, 3.9**

  - [x] 1.6 Write property tests for common-prompts (Properties 5–6)
    - **Property 5: Whitespace App Name Rejection** — all-whitespace strings are rejected by name validator
    - **Property 6: Display Name Transformation** — hyphens/underscores replaced with spaces, words capitalized
    - Create `tests/stacks/common-prompts.property.test.ts`
    - **Validates: Requirements 2.2, 2.3**

- [x] 2. Checkpoint — Phase 1 verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 4 — Orchestrator and CLI Registration (with DummyAdapter)
  - [x] 3.1 Create `src/stacks/dummy/adapter.ts` — Test-only DummyAdapter
    - Implement `DummyAdapter` class using `'react'` as stack id
    - `runPrompts` returns base context with `dummyFlag: true` added
    - `scaffold` creates `projectDir` with `README.md` and `package.json`
    - `scanHints` returns `{ detectedPackageManager: 'npm', detectedSSR: false }`
    - `postSetup` is a no-op
    - Call `registerAdapter(new DummyAdapter())` at module level
    - _Requirements: 17.1, 17.2_

  - [x] 3.2 Create `src/commands/project-init.ts` — Orchestrator with `buildGovernanceConfig`
    - Implement `runProjectInit(options: ProjectInitOptions)` with full flow: stack selection → adapter lookup → common prompts → adapter prompts → confirmation → directory check → scaffold → postSetup → governance → git hooks → CI config → success message
    - Export `buildGovernanceConfig(ctx, adapter, opts)` as a pure function: sets `stack`, `profile`, `scan` (merged defaults + scanHints), `project` fields, `agent`, `projectDir`, `conflictMode: 'keep'`
    - Handle `--yes` (skip confirmation), `--dry-run` (skip governance), `--type` (skip stack prompt), `--name` (skip name prompt), `--dir` (override output directory)
    - Abort with error if projectDir already exists
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.9, 13.10, 13.11, 13.12, 14.1, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10_

  - [x] 3.3 Register `project init` CLI command in `src/cli.ts`
    - Add `project` command group with `init` subcommand
    - Register flags: `--type <stack>`, `--name <name>`, `--yes`, `--dry-run`, `--dir <path>`
    - Validate `--type` against `getSupportedStackIds()`, abort with error listing valid stacks if invalid
    - Validate `--name` against adapter's naming convention, abort if invalid
    - Validate `--dir` exists and is a directory, abort if not
    - Import adapter modules to trigger self-registration
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9, 17.3, 17.4_

  - [x] 3.4 Write unit tests for orchestrator and buildGovernanceConfig
    - Create `tests/project-init.test.ts`
    - Test registry lookup (getAdapter, getAllAdapters, getSupportedStackIds, duplicate registration error)
    - Test `buildGovernanceConfig` pure function: stack field, scan merge, project fields, agent, projectDir, conflictMode always 'keep'
    - Test DummyAdapter scaffold creates files in temp directory
    - Test directory-already-exists guard
    - Test CLI flag validation (invalid --type, invalid --name, invalid --dir)
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.6, 1.7, 3.9, 13.4, 14.1, 15.7, 15.8, 15.9, 19.3–19.10**

  - [x] 3.5 Write property test for buildGovernanceConfig (Property 18)
    - **Property 18: buildGovernanceConfig Pure Function Correctness** — for any valid ScaffoldContext and StackAdapter, output fields match: `config.stack === adapter.id`, `config.agent === ctx.agent`, `config.projectDir === ctx.projectDir`, `config.project.appName === ctx.displayName`, `config.project.packageName === ctx.appName`, `config.conflictMode === 'keep'`, `config.scan` equals merge of defaults with scanHints
    - Add to `tests/project-init.test.ts` or create separate property test file
    - **Validates: Requirements 14.1, 19.1, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10**

- [x] 4. Checkpoint — Phase 4 verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 2 — Flutter Adapter
  - [x] 5.1 Create `src/stacks/flutter/prompts.ts` — Flutter-specific prompts
    - Define `FlutterContext`, `FlutterService`, `FlutterEndpoint` interfaces
    - Implement prompt sequence: Android package ID, iOS bundle ID, Flutter version, service loop (name, env URLs, headers, endpoints)
    - Validate Android package ID follows reverse-domain notation
    - Use `@inquirer/prompts` for all interactive input
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 18.3, 18.4_

  - [x] 5.2 Create `src/stacks/flutter/scaffold.ts` — Flutter file generation
    - Create full directory structure: `lib/core/config/`, `lib/core/di/`, `lib/core/framework/`, `lib/core/network/`, `lib/core/connectivity/`, `lib/core/router/`, `lib/core/theme/`, `lib/core/logger/`, `lib/core/utils/`, `lib/features/`, `assets/`, `bricks/`, `test/`, `integration_test/`
    - Generate `app_config.dart` with one getter per service, `_urls` map with all 5 environments; default to `api` + `node` services if none provided
    - Generate `api_endpoints.dart` with camelCase constants derived from paths; handle parameterised segments (`{id}` → `ById` suffix); disambiguate duplicates with method prefix
    - Generate `service_headers.dart` with one getter per service
    - Generate `pubspec.yaml` with correct `name` field and required dependencies (`flutter_bloc`, `dio`, `get_it`, `go_router`)
    - Generate `dio_factory.dart` with `ConnectivityCubit` parameter and `PrettyDioLogger`
    - Generate `analysis_options.yaml` with `avoid_print: true` and `always_use_package_imports: true`
    - All Dart imports use `package:<appName>/` prefix
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11_

  - [x] 5.3 Create `src/stacks/flutter/templates/` — Template functions for generated files
    - Create `pubspec.ts`, `dart-core.ts`, `dart-network.ts`, `dart-framework.ts`, `dart-utils.ts`, `dart-connectivity.ts`, `dart-di.ts`, `dart-main.ts`, `dart-bricks.ts`
    - Each template function accepts context and returns file content as string
    - _Requirements: 5.1, 5.2, 5.4, 5.7, 5.8, 5.9, 5.10_

  - [x] 5.4 Create `src/stacks/flutter/adapter.ts` — FlutterAdapter class with self-registration
    - Implement `FlutterAdapter` with `id: 'flutter'`, `displayName: 'Flutter'`, `nameHint: 'snake_case'`
    - `runPrompts` delegates to `prompts.ts`, validates name matches `^[a-z][a-z0-9_]*$`
    - `scaffold` delegates to `scaffold.ts`
    - `scanHints` returns: `detectedState: 'BLoC'`, `detectedDI: 'GetIt'`, `detectedNetwork: 'Dio'`, `detectedRouter: 'GoRouter'`, `detectedPackageManager: 'pub'`, `detectedMason: true`, `detectedFVM: true`, `scaffoldTool: 'mason'`
    - `postSetup`: git init → fvm use → fvm flutter pub get → git add -A → git commit (warn-and-continue for FVM failures)
    - Call `registerAdapter(new FlutterAdapter())` at module level
    - _Requirements: 4.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.1–8.9, 17.1_

  - [x] 5.5 Write unit tests for Flutter adapter
    - Create `tests/stacks/flutter-adapter.test.ts`
    - Test directory structure creation (all required dirs exist)
    - Test `pubspec.yaml` content (name, dependencies)
    - Test `app_config.dart` generation (single service, multi-service, default services)
    - Test `api_endpoints.dart` (camelCase derivation, parameterised paths, TODO for empty endpoints, duplicate disambiguation)
    - Test `service_headers.dart` (empty headers, single header, multiple headers)
    - Test `dio_factory.dart` (class exists, ConnectivityCubit, PrettyDioLogger, package import)
    - Test `analysis_options.yaml` rules
    - Test `scanHints` returns correct static values
    - Test `postSetup` resilience (FVM not found → warning, pub get failure → warning, success → git commit)
    - **Validates: Requirements 4.1, 5.1–5.11, 7.1–7.6, 8.1–8.9**

  - [x] 5.6 Write property tests for Flutter adapter (Properties 7–8, 10–14)
    - **Property 7: runPrompts Preserves Base Context** — returned context contains all original base fields unchanged
    - **Property 8: Flutter Naming Convention Validation** — accepts iff matches `^[a-z][a-z0-9_]*$`
    - **Property 10: Flutter Scaffold Directory Completeness** — all required directories exist after scaffold
    - **Property 11: Flutter Endpoint Name Derivation** — transformation rules produce correct constant names
    - **Property 12: Flutter AppConfig Getter-Per-Service** — one getter per service with correct naming
    - **Property 13: Flutter pubspec.yaml Correctness** — name matches appName, required deps present
    - **Property 14: Flutter Package Import Prefix** — all generated Dart files use `package:<appName>/` for internal imports
    - Create `tests/stacks/flutter-adapter.property.test.ts`
    - **Validates: Requirements 3.1, 4.1, 5.1, 5.2, 5.4, 5.5, 5.7, 5.10, 5.11**

- [x] 6. Checkpoint — Phase 2 verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phase 3 — Next.js Adapter
  - [x] 7.1 Create `src/stacks/next/prompts.ts` — Next.js-specific prompts
    - Define `NextContext` interface extending `ScaffoldContext` with: `projectType`, `packageManager`, `router`, `styling`, `serverState`, `clientState`, `auth`, `database`, `apiStyle`
    - Implement prompt sequence: project type → package manager → router → styling → server state → client state → (fullstack only: auth, database, API style)
    - Use `@inquirer/prompts` for all interactive input
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 18.3, 18.4_

  - [x] 7.2 Create `src/stacks/next/scaffold.ts` — Next.js file generation
    - Create clean architecture folder structure: `src/app/`, `src/features/`, `src/core/` (api, config, errors, types, utils), `src/shared/` (components, hooks, types)
    - Conditionally create fullstack directories: `src/app/api/health/route.ts`, `src/lib/`, `src/middleware.ts`
    - Do NOT create `src/app/api/`, `src/lib/`, or `src/middleware.ts` for frontend-only projects
    - Generate `package.json` with conditional dependencies based on context choices
    - Generate `tsconfig.json` with `strict: true` and `@/*` path alias
    - Generate `next.config.ts`
    - Conditionally generate `tailwind.config.ts`, `postcss.config.js`, `src/app/globals.css` (only when styling=tailwind)
    - Generate `src/core/config/env.ts` using zod validation with typed `env` export
    - Generate `.env.local`, `.env.example`, `.gitignore`
    - Generate health route returning `{ status: 'ok' }` with HTTP 200 (fullstack only)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14, 9.15_

  - [x] 7.3 Create `src/stacks/next/templates/` — Template functions for generated files
    - Create `package-json.ts`, `tsconfig.ts`, `next-config.ts`, `tailwind-config.ts`, `source-files.ts`, `api-route.ts`, `env-files.ts`
    - Each template function accepts context and returns file content as string
    - _Requirements: 9.4, 9.5, 9.11, 9.12, 9.13, 9.14, 9.15_

  - [x] 7.4 Create `src/stacks/next/adapter.ts` — NextAdapter class with self-registration
    - Implement `NextAdapter` with `id: 'next'`, `displayName: 'Next.js'`, `nameHint: 'kebab-case'`
    - `runPrompts` delegates to `prompts.ts`, validates name matches `^[a-z][a-z0-9-]*$`
    - `scaffold` delegates to `scaffold.ts`
    - `scanHints` returns: `detectedSSR: true`, `detectedNextRouter`, `detectedRSC`, `detectedCSSApproach`, `detectedSubtype`, `detectedORM`, `detectedAuth`, `detectedPackageManager` — all derived from context
    - `postSetup`: git init → package manager install → (prisma init if applicable) → git add -A → git commit (abort on failure)
    - Call `registerAdapter(new NextAdapter())` at module level
    - _Requirements: 4.2, 11.1, 11.2, 11.3, 11.4, 11.5, 12.1–12.9, 17.2_

  - [x] 7.5 Write unit tests for Next.js adapter
    - Create `tests/stacks/next-adapter.test.ts`
    - Test frontend directory structure (required dirs exist, api/lib/middleware do NOT exist)
    - Test fullstack directory structure (api/health/route.ts, lib/, middleware.ts exist)
    - Test `package.json` (name, always-included deps, conditional deps: tailwind, tanstack-query, next-auth, prisma)
    - Test frontend excludes auth/database deps regardless of context values
    - Test `tsconfig.json` (strict, path alias)
    - Test `tailwind.config.ts` exists/not-exists based on styling choice
    - Test `.env.local` and `.env.example` exist, `.env.local` in `.gitignore`
    - Test `env.ts` uses zod and exports typed `env`
    - Test `globals.css` with Tailwind directives (only when styling=tailwind)
    - Test health route returns `{ status: 'ok' }` (fullstack only)
    - Test `scanHints` returns correct values for all context combinations
    - Test `postSetup` abort-on-failure behavior
    - **Validates: Requirements 4.2, 9.1–9.15, 11.1–11.5, 12.1–12.9**

  - [x] 7.6 Write property tests for Next.js adapter (Properties 9, 15–17)
    - **Property 9: Next.js Naming Convention Validation** — accepts iff matches `^[a-z][a-z0-9-]*$`
    - **Property 15: Next.js Conditional Directory Structure** — frontend excludes api/lib/middleware; fullstack includes them
    - **Property 16: Next.js Conditional Dependency Inclusion** — always-present deps, conditional deps based on styling/serverState/auth/database/projectType
    - **Property 17: Next.js scanHints Derivation** — all scanHints fields correctly derived from context
    - Create `tests/stacks/next-adapter.property.test.ts`
    - **Validates: Requirements 4.2, 9.1–9.10, 12.1–12.9**

- [x] 8. Checkpoint — Phase 3 verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final wiring and integration
  - [x] 9.1 Update `src/cli.ts` imports to trigger adapter self-registration
    - Add `import './stacks/flutter/adapter.js';` and `import './stacks/next/adapter.js';`
    - Ensure import order is deterministic (Flutter first, then Next.js)
    - Verify adapter import failure logs warning and continues (try/catch around imports)
    - _Requirements: 17.3, 17.4_

  - [x] 9.2 Verify full build and type-check passes
    - Run `npm run typecheck` — no TypeScript errors
    - Run `npm run build` — dist output generated
    - Run `node dist/bin/ai-gov.js project init --help` — command registered correctly
    - _Requirements: 15.1_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between phases
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The phasing order (1 → 4 → 2 → 3) ensures each phase has its dependencies available
- `fast-check` library is used for property-based testing (TypeScript-native, ESM-compatible)
- DummyAdapter is test-only and not shipped in production builds
- All prompts use `@inquirer/prompts` — never legacy `inquirer`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "1.6"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5"] },
    { "id": 6, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 7, "tasks": ["5.4"] },
    { "id": 8, "tasks": ["5.5", "5.6"] },
    { "id": 9, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 10, "tasks": ["7.4"] },
    { "id": 11, "tasks": ["7.5", "7.6"] },
    { "id": 12, "tasks": ["9.1"] },
    { "id": 13, "tasks": ["9.2"] }
  ]
}
```
