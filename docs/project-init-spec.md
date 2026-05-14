# `ai-gov project init` — Implementation Spec

> **Status:** Pre-implementation design document  
> **Covers:** All four phases, file-by-file breakdown, every test case  
> **Before starting any code:** Read this top-to-bottom once.

---

## Table of Contents

1. [What We're Building](#1-what-were-building)
2. [Final Directory Structure](#2-final-directory-structure)
3. [New Dependency](#3-new-dependency)
4. [Types Extension](#4-types-extension)
5. [Phase 1 — Adapter Interface & Registry](#5-phase-1--adapter-interface--registry)
6. [Phase 4 — Orchestrator (wired with dummy adapter)](#6-phase-4--orchestrator-wired-with-dummy-adapter)
7. [Phase 2 — Flutter Adapter](#7-phase-2--flutter-adapter)
8. [Phase 3 — Next.js Adapter](#8-phase-3--nextjs-adapter)
9. [CLI Registration](#9-cli-registration)
10. [Test Suite](#10-test-suite)
11. [Build & Verify Checklist](#11-build--verify-checklist)

---

## 1. What We're Building

A new top-level CLI command:

```
ai-gov project init
```

**What it does — in order:**

1. Interactive wizard collects all inputs (stack, name, IDs, services, governance choices)
2. Adapter scaffolds the project (files, folders, config)
3. Post-setup runs (pub get / npm install / git init)
4. Governance engine runs (`runGovernance`) — same function `ai-gov init` uses today, zero changes
5. Prints next steps

**What stays unchanged:**

- `ai-gov init` — governance on an existing project
- `ai-gov onboard` — developer joining an already-governed project
- All generators, scanners, governance config — untouched

---

## 2. Final Directory Structure

```
src/
  commands/
    project-init.ts          ← NEW Phase 4: orchestrator
    ...existing commands...
  stacks/                    ← NEW Phase 1
    adapter.ts               ← StackAdapter interface + ScaffoldContext type
    registry.ts              ← maps stack IDs to adapter instances
    common-prompts.ts        ← shared wizard questions (name, dir, agent, CI)
    dummy/
      adapter.ts             ← test-only dummy adapter (wires Phase 4 skeleton)
    flutter/
      adapter.ts             ← Phase 2: FlutterAdapter
      prompts.ts             ← Flutter-specific questions
      scaffold.ts            ← all Dart file generation
      templates/
        pubspec.ts           ← pubspec.yaml template function
        dart-core.ts         ← AppConfig, AppEnv, ApiEndpoints, ServiceHeaders
        dart-network.ts      ← DioFactory, AppInterceptors, NetworkInfo
        dart-framework.ts    ← ServerError, ApiRequestModel, ApiResponseModel
        dart-utils.ts        ← AppStrings, AppLogger, ScreenSecurity, etc.
        dart-connectivity.ts ← ConnectivityCubit, ConnectivityState
        dart-di.ts           ← injection.dart
        dart-main.ts         ← main.dart, app.dart
        dart-bricks.ts       ← Mason brick templates
        dart-android.ts      ← Android Gradle files (declarative format, pinned versions)
    next/
      adapter.ts             ← Phase 3: NextAdapter
      prompts.ts             ← Next.js-specific questions
      scaffold.ts            ← TS/TSX file generation
      templates/
        package-json.ts
        tsconfig.ts
        next-config.ts
        tailwind-config.ts
        source-files.ts      ← app layout, page, clean arch folders
        api-route.ts         ← full-stack only: app/api/health/route.ts
        env-files.ts         ← .env.local, .env.example

tests/
  project-init.test.ts                    ← NEW: orchestrator + registry + buildGovernanceConfig
  project-init.property.test.ts           ← NEW: Property 18 (fast-check)
  stacks/
    flutter-adapter.test.ts               ← NEW: Flutter scaffold, scanHints, postSetup
    flutter-adapter.property.test.ts      ← NEW: Properties 7, 8, 10–14 (fast-check)
    next-adapter.test.ts                  ← NEW: Next.js scaffold, scanHints, postSetup
    next-adapter.property.test.ts         ← NEW: Properties 9, 15–17 (fast-check)
    registry.property.test.ts             ← NEW: Properties 1–4 (fast-check)
    common-prompts.property.test.ts       ← NEW: Properties 5–6 (fast-check)
```

---

## 3. New Dependency

Two packages. No others needed.

```bash
npm install @inquirer/prompts
npm install --save-dev fast-check
```

`@inquirer/prompts` — official modular Inquirer v9+. ESM-native. Zero transitive deps.
Exports used: `select`, `input`, `confirm`.

`fast-check` — TypeScript-native property-based testing. ESM-compatible. Used only in `*.property.test.ts` files.

**Do not use the legacy `inquirer` package.**

---

## 4. Types Extension

### 4.1 Extend `Stack` type in `src/types.ts`

The existing `Stack` type does not include `'next'`. Next.js uses `'react'` stack internally
(governance steering is React-flavoured) but we need a separate entry for the project init
wizard so adapters are unambiguous.

**Change in `src/types.ts` line 1:**

```typescript
// Before
export type Stack = 'flutter' | 'kotlin' | 'nodejs' | 'react' | 'angular' | 'swiftui' | 'python' | 'java';

// After
export type Stack = 'flutter' | 'kotlin' | 'nodejs' | 'react' | 'next' | 'angular' | 'swiftui' | 'python' | 'java';
```

### 4.2 Add `'next'` profile in `src/profiles.ts`

When `loadBaseProfile('next')` is called, it must return a valid `BaseProfile`.
The Next.js profile is identical to `'react'` with these overrides:

```
stackDisplay: 'Next.js'
buildCmd:     'npm run build'
runCmd:       'npm run dev'
```

Look at how other profiles are structured in `profiles.ts` and follow the same pattern.

---

## 5. Phase 1 — Adapter Interface & Registry

### 5.1 `src/stacks/adapter.ts`

```typescript
import type { Stack, Agent, ScanResult } from '../types.js';

/** Everything the wizard collects — passed to scaffold() and postSetup(). */
export interface ScaffoldContext {
  // Common — always present
  appName:     string;   // snake_case (flutter) or kebab-case (next/react/node)
  displayName: string;   // Human-readable, e.g. "AccuShield"
  outputDir:   string;   // Absolute path to parent directory
  projectDir:  string;   // outputDir + '/' + appName (set by orchestrator)

  // Governance — always present
  agent:       Agent;
  gitHooks:    boolean;
  ci:          'github' | 'gitlab' | 'bitbucket' | 'none';

  // Stack-specific — each adapter adds its own keys
  [key: string]: unknown;
}

/** Pre-populated ScanResult fields derived from wizard answers.
 *  Avoids post-scaffold filesystem scanning for newly created projects. */
export interface ScaffoldScanHints extends Partial<ScanResult> {}

/** Every stack adapter must implement this interface. */
export interface StackAdapter {
  /** Unique ID — must match a value in the Stack type. */
  readonly id: Stack;

  /** Human-readable name shown in the stack selection list. */
  readonly displayName: string;

  /** Naming convention hint shown during app name prompt (e.g. 'snake_case', 'kebab-case'). */
  readonly nameHint: string;

  /**
   * Runs the adapter's own interactive prompts (stack-specific questions only).
   * Receives the common context already collected by the orchestrator.
   * Returns a completed ScaffoldContext with stack-specific fields merged in.
   */
  runPrompts(base: ScaffoldContext): Promise<ScaffoldContext>;

  /**
   * Creates all project files and directories.
   * projectDir is guaranteed to not exist yet when this is called.
   */
  scaffold(ctx: ScaffoldContext): Promise<void>;

  /**
   * Returns ScanResult field overrides derived from wizard answers.
   * Called by the orchestrator to pre-populate governance config
   * without running the filesystem scanner.
   */
  scanHints(ctx: ScaffoldContext): ScaffoldScanHints;

  /**
   * Runs post-scaffold commands: package manager install, git init, initial commit.
   * Called AFTER scaffold() and BEFORE governance.
   */
  postSetup(ctx: ScaffoldContext): Promise<void>;
}
```

**Rules:**
- `runPrompts` receives the base context (common fields already filled), mutates nothing,
  returns a new object with stack-specific fields merged in.
- `scaffold` must not run shell commands — only write files and create directories.
- `postSetup` runs shell commands (fvm flutter pub get, npm install, git init).
- `scanHints` is pure — no I/O, derives everything from `ctx`.

---

### 5.2 `src/stacks/registry.ts`

```typescript
import type { StackAdapter } from './adapter.js';
import type { Stack } from '../types.js';

// Adapters registered here
// (Phase 2 and 3 will uncomment the real ones)

const _adapters: Map<Stack, StackAdapter> = new Map();

export function registerAdapter(adapter: StackAdapter): void {
  if (_adapters.has(adapter.id))
    throw new Error(`Adapter already registered for stack: ${adapter.id}`);
  _adapters.set(adapter.id, adapter);
}

export function getAdapter(id: Stack): StackAdapter {
  const adapter = _adapters.get(id);
  if (!adapter) throw new Error(`No adapter registered for stack: ${id}`);
  return adapter;
}

export function getAllAdapters(): StackAdapter[] {
  return Array.from(_adapters.values());
}

export function getSupportedStackIds(): Stack[] {
  return Array.from(_adapters.keys());
}
```

Adapters register themselves by importing registry and calling `registerAdapter(new XAdapter())`.
The CLI entry point imports each adapter file which triggers self-registration on import.

---

### 5.3 `src/stacks/common-prompts.ts`

```typescript
import { input, confirm, select } from '@inquirer/prompts';
import type { Agent } from '../types.js';

export interface CommonAnswers {
  appName:     string;
  displayName: string;
  outputDir:   string;
  agent:       Agent;
  gitHooks:    boolean;
  ci:          'github' | 'gitlab' | 'bitbucket' | 'none';
}

export async function collectCommonAnswers(
  nameHint: string,    // 'snake_case' or 'kebab-case' — set by adapter
  nameValidator: (name: string) => string | true,  // adapter-specific naming validation
): Promise<CommonAnswers> {
  const appName = await input({
    message: `App name (${nameHint}):`,
    validate: (v) => {
      if (v.trim().length === 0) return 'Required';
      return nameValidator(v.trim());
    },
  });

  const displayName = await input({
    message: 'Display name:',
    default: toDisplayName(appName),
  });

  const useCwd = await confirm({
    message: 'Create in current directory?',
    default: false,
  });

  const outputDir = useCwd
    ? process.cwd()
    : await input({
        message: 'Output directory:',
        default: process.cwd(),
      });

  const agent = await select<Agent>({
    message: 'AI agent:',
    choices: [
      { name: 'Claude Code', value: 'claude-code' },
      { name: 'Kiro',        value: 'kiro' },
    ],
  });

  const gitHooks = await confirm({ message: 'Install git hooks?', default: true });

  const ci = await select<CommonAnswers['ci']>({
    message: 'CI platform:',
    choices: [
      { name: 'GitHub Actions', value: 'github' },
      { name: 'GitLab CI',      value: 'gitlab' },
      { name: 'Bitbucket',      value: 'bitbucket' },
      { name: 'None',           value: 'none' },
    ],
  });

  return { appName: appName.trim(), displayName: displayName.trim(), outputDir, agent, gitHooks, ci };
}

export function toDisplayName(name: string): string {
  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```

---

### 5.4 `src/stacks/dummy/adapter.ts` (test only)

```typescript
import { registerAdapter } from '../registry.js';
import type { StackAdapter, ScaffoldContext, ScaffoldScanHints } from '../adapter.js';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export class DummyAdapter implements StackAdapter {
  readonly id = 'react' as const;   // reuse an existing Stack value for typing
  readonly displayName = 'Dummy (test)';

  async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> {
    return { ...base, dummyFlag: true };
  }

  async scaffold(ctx: ScaffoldContext): Promise<void> {
    mkdirSync(ctx.projectDir, { recursive: true });
    writeFileSync(join(ctx.projectDir, 'README.md'), `# ${ctx.displayName}\n`);
    writeFileSync(join(ctx.projectDir, 'package.json'),
      JSON.stringify({ name: ctx.appName, version: '0.0.1' }, null, 2));
  }

  scanHints(_ctx: ScaffoldContext): ScaffoldScanHints {
    return { detectedPackageManager: 'npm', detectedSSR: false };
  }

  async postSetup(ctx: ScaffoldContext): Promise<void> {
    // No-op in tests — avoids calling npm install
  }
}

registerAdapter(new DummyAdapter());
```

This exists solely to test Phase 4 (orchestrator) without needing Flutter or Next.js installed.
**Not shipped in production build** — only used in tests.

---

## 6. Phase 4 — Orchestrator (wired with dummy adapter)

### 6.1 `src/commands/project-init.ts`

Full logic — to be implemented exactly as described here:

```
INPUTS (from CLI flags or interactive wizard):
  --type  <stack>     skip stack selection prompt
  --name  <name>      skip name prompt
  --yes               skip confirmation summary
  --dry-run           scaffold only, skip governance
  --dir   <path>      override output directory

FLOW:
  1. Select stack (prompt or --type flag)
  2. Get adapter from registry
  3. Collect common answers (collectCommonAnswers with adapter's nameHint)
  4. Build base ScaffoldContext from common answers
  5. adapter.runPrompts(baseCtx) → full ScaffoldContext
  6. Confirm summary (skip if --yes)
  7. Check projectDir does not already exist
  8. adapter.scaffold(ctx)
  9. adapter.postSetup(ctx)
  10. Build GovernanceConfig:
      a. profile   = loadBaseProfile(adapter.id)
      b. scan      = { ...createDefaultScanResult(), ...adapter.scanHints(ctx) }
      c. project   = { appName: ctx.displayName, packageName: ctx.appName, ... }
      d. blocks    = computeContentBlocks(adapter.id, profile, scan)
  11. runGovernance(config)   [skip if --dry-run]
  12. If ctx.gitHooks:  generateGitHooks + installGitHookWrappers
  13. If ctx.ci !== 'none': generateCIConfig(config, ctx.ci)
  14. Print success + next steps
```

**`buildGovernanceConfig` — exported pure function (testable without I/O):**

```typescript
export function buildGovernanceConfig(
  ctx: ScaffoldContext,
  adapter: StackAdapter,
  options: { dryRun?: boolean; overwrite?: boolean; updateHooks?: boolean },
): GovernanceConfig
```

This function is exported and unit-tested. The `runProjectInit` action calls it internally.

---

### 6.2 CLI registration in `src/cli.ts`

```typescript
// Add after existing imports
import { runProjectInit } from './commands/project-init.js';

// Register under 'project' subcommand group
const project = program.command('project').description('Project lifecycle commands');

project
  .command('init')
  .description('Create a new project with governance applied from day one')
  .option('--type <stack>',  'Stack type (flutter|next|react|node) — skip selection prompt')
  .option('--name <name>',   'App name — skip name prompt')
  .option('--yes',           'Skip confirmation summary', false)
  .option('--dry-run',       'Scaffold only, skip governance write', false)
  .option('--dir <path>',    'Parent directory for the new project', process.cwd())
  .action(async (options) => {
    await runProjectInit(options);
  });
```

---

## 7. Phase 2 — Flutter Adapter

### 7.1 `src/stacks/flutter/prompts.ts`

Questions to ask after common answers are collected. Returns merged context.

```typescript
export interface FlutterContext extends ScaffoldContext {
  androidPackage:  string;   // com.techvedika.accushield
  iosBundle:       string;   // com.techvedika.accushield
  flutterVersion:  string;   // 3.41.6
  services:        FlutterService[];
}

export interface FlutterService {
  name:      string;            // snake_case, e.g. 'node'
  envUrls:   Record<string, string>;  // { local, dev, qa, staging, prod }
  headers:   Record<string, string>;  // custom static headers
  endpoints: FlutterEndpoint[];
}

export interface FlutterEndpoint {
  method: string;   // POST, GET, etc.
  path:   string;   // /auth/login
}
```

**Prompt sequence:**

```
1. Android package ID:    input  (default: com.<snake_to_domain(appName)>.<appName>)
2. iOS bundle ID:         input  (default: same as android package)
3. Flutter version (FVM): input  (default: '3.29.0')

── API Services (optional) ──
4. Add a backend service? confirm (default: false)
   LOOP while yes:
     4a. Service name (snake_case):  input
     4b. Per-env URLs:               input × 5  (local/dev/qa/staging/prod)
     4c. Custom headers (key:value): input (optional, comma-separated)
     4d. Add endpoints now?          confirm (default: false)
         LOOP while yes:
           4d-i.  Method + path:     input (e.g. "POST /auth/login")
     4e. Add another service?        confirm (default: false)
```

---

### 7.2 `src/stacks/flutter/scaffold.ts`

**Creates this directory tree inside `ctx.projectDir`:**

```
lib/
  core/
    config/
      app_env.dart
      app_config.dart          ← generated from ctx.services
      api_endpoints.dart       ← generated from ctx.services[].endpoints
      service_headers.dart     ← generated from ctx.services[].headers
    di/
      injection.dart
    framework/
      server_error.dart
      api_response_model.dart
      api_request_model.dart
    network/
      dio_factory.dart
      app_interceptors.dart
      network_info.dart
    connectivity/
      connectivity_state.dart
      connectivity_cubit.dart
    router/
      app_router.dart
    theme/
      app_theme.dart
    logger/
      app_logger.dart
    utils/
      app_strings.dart
      screen_security.dart
      secure_screen_mixin.dart
      ios_background_blur.dart
    services/
    pagination/
  features/
assets/
  images/
  icons/
  fonts/
bricks/
  clean_feature/__brick__/
  clean_form_feature/__brick__/
test/
  architecture/
  core/
    connectivity/
    network/
    pagination/
  helpers/
integration_test/
android/
  app/
    build.gradle             ← declarative plugins block (no imperative apply)
    src/
      main/
        AndroidManifest.xml
        kotlin/<package/path>/
          MainActivity.kt
  gradle/
    wrapper/
      gradle-wrapper.properties  ← Gradle 8.10.2 pinned
  build.gradle               ← allprojects block only (no buildscript/classpath)
  settings.gradle            ← declarative pluginManagement + plugins block
.github/workflows/
.vscode/settings.json
pubspec.yaml
analysis_options.yaml
mason.yaml
.gitignore
```

**Android version constants (defined in `dart-android.ts`, exported for tests):**

```typescript
export const ANDROID_VERSIONS = {
  gradle:      '8.10.2',
  agp:         '8.6.1',   // Android Gradle Plugin
  kotlin:      '2.1.0',
  compileSdk:  35,
  minSdk:      23,
  targetSdk:   35,
  java:        'VERSION_17',
} as const;
```

These constants are the **only place** version numbers live. Both template generation and tests import from here — changing a version in one place updates everything.

**`settings.gradle` generation rules:**

- Use declarative `pluginManagement {}` block — reads `flutter.sdk` from `local.properties`
- `includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")` instead of `apply from:`
- Declare three plugins: `dev.flutter.flutter-plugin-loader`, `com.android.application` (AGP version from constants), `org.jetbrains.kotlin.android` (Kotlin version from constants)
- `apply false` on the last two — they are applied per-module in `app/build.gradle`
- No `buildscript {}` block at all

Generated output:
```gradle
pluginManagement {
    def flutterSdkPath = {
        def properties = new Properties()
        file("local.properties").withInputStream { properties.load(it) }
        def flutterSdkPath = properties.getProperty("flutter.sdk")
        assert flutterSdkPath != null, "flutter.sdk not set in local.properties"
        flutterSdkPath
    }()
    settings.ext.flutterSdkPath = flutterSdkPath

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id "dev.flutter.flutter-plugin-loader" version "1.0.0"
    id "com.android.application" version "8.6.1" apply false
    id "org.jetbrains.kotlin.android" version "2.1.0" apply false
}

include ":app"
```

**Root `build.gradle` generation rules:**

- `allprojects` block with `google()` and `mavenCentral()` repositories only
- No `buildscript {}`, no `classpath` dependencies — AGP is declared in `settings.gradle`

Generated output:
```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.buildDir = "../build"
subprojects {
    project.buildDir = "${rootProject.buildDir}/${project.name}"
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register("clean", Delete) {
    delete rootProject.buildDir
}
```

**`app/build.gradle` generation rules:**

- Starts with declarative `plugins {}` block — three plugin IDs, no `apply plugin:` calls
- `android {}` block uses `flutter.compileSdkVersion`, `flutter.ndkVersion` — not hardcoded
- `compileOptions` and `kotlinOptions` both set to Java 17 (from `ANDROID_VERSIONS.java`)
- `defaultConfig.applicationId` = `ctx.androidPackage`
- `defaultConfig.minSdk`, `targetSdk` from `ANDROID_VERSIONS` constants
- `versionCode` and `versionName` read from `flutter.versionCode` / `flutter.versionName` locals
- No `def localProperties` block, no `def flutterRoot` block — those are imperative and removed

Generated output:
```gradle
plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

android {
    namespace "<ctx.androidPackage>"
    compileSdk flutter.compileSdkVersion
    ndkVersion flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    defaultConfig {
        applicationId "<ctx.androidPackage>"
        minSdk flutter.minSdkVersion
        targetSdk flutter.targetSdkVersion
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}

flutter {
    source "../.."
}
```

**`gradle-wrapper.properties` generation rules:**

- `distributionUrl` pinned to Gradle version from `ANDROID_VERSIONS.gradle`
- All other fields are standard defaults

Generated output:
```properties
distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
distributionUrl=https\://services.gradle.org/distributions/gradle-8.10.2-all.zip
```

**`AndroidManifest.xml` generation rules:**

- Minimal manifest — `package` attribute set to `ctx.androidPackage`
- `FlutterActivity` intent filter, `INTERNET` permission, `VIBRATE` permission
- No hardcoded activities beyond `MainActivity`

**`MainActivity.kt` generation rules:**

- Package matches `ctx.androidPackage`
- Extends `FlutterActivity()` — single-line class body
- File path derived from package: `com.techvedika.axelo` → `com/techvedika/axelo/MainActivity.kt`

**`AppConfig` generation rules:**
- One static getter per service: `static String get <camelCase(service.name)>BaseUrl`
- `_urls` map: `AppEnv.local → { 'service': 'url' }` for all envs × all services
- If no services provided, generate two default services: `api` and `node`

**`ApiEndpoints` generation rules:**
- One class section per service (comment header)
- Endpoint path `/auth/login` → const name `authLogin`
- Parameterised segment `{id}` → `ById` suffix
- Duplicate names get method prefix (`postAuthLogin`)

**`ServiceHeaders` generation rules:**
- One getter per service: `static Map<String, String> get <camelCase(name)>`
- Empty map if no headers configured for that service

---

### 7.3 `src/stacks/flutter/adapter.ts`

```typescript
export class FlutterAdapter implements StackAdapter {
  readonly id = 'flutter' as const;
  readonly displayName = 'Flutter';
  readonly nameHint = 'snake_case';

  async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> { ... }
  async scaffold(ctx: ScaffoldContext): Promise<void> { ... }
  scanHints(ctx: ScaffoldContext): ScaffoldScanHints { ... }
  async postSetup(ctx: ScaffoldContext): Promise<void> { ... }
}
```

**`scanHints` returns:**

```typescript
{
  detectedState:          'BLoC',
  detectedDI:             'GetIt',
  detectedNetwork:        'Dio',
  detectedRouter:         'GoRouter',
  detectedPackageManager: 'pub',
  detectedMason:          true,
  detectedFVM:            true,
  detectedUISystem:       'Material',
  scaffoldTool:           'mason',
}
```

**`postSetup` does (in order):**

1. `git init` in `ctx.projectDir`
2. `git config user.email` + `user.name` (inherits from global config)
3. Write `.fvm/flutter_sdk` symlink via `fvm use <version> --force`
4. `fvm flutter pub get`
5. `git add -A && git commit -m "chore: initial project scaffold"`

If `fvm` is not installed: print warning, skip steps 3–4, continue.

---

## 8. Phase 3 — Next.js Adapter

### 8.1 `src/stacks/next/prompts.ts`

```typescript
export interface NextContext extends ScaffoldContext {
  projectType:    'frontend' | 'fullstack';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
  router:         'app' | 'pages';
  styling:        'tailwind' | 'css-modules' | 'styled-components';
  serverState:    'tanstack-query' | 'swr' | 'none';
  clientState:    'zustand' | 'redux-toolkit' | 'none';
  auth:           'nextauth' | 'clerk' | 'none';     // fullstack only
  database:       'prisma' | 'drizzle' | 'none';     // fullstack only
  apiStyle:       'rest' | 'trpc' | 'none';          // fullstack only
}
```

**Prompt sequence:**

```
1. Project type:     select  → Frontend only | Full-stack
2. Package manager:  select  → npm | yarn | pnpm | bun  (default: npm)
3. Router:           select  → App Router (recommended) | Pages Router  (default: app)
4. Styling:          select  → Tailwind CSS | CSS Modules | styled-components  (default: tailwind)
5. Server state:     select  → TanStack Query | SWR | None  (default: tanstack-query)
6. Client state:     select  → Zustand | Redux Toolkit | None  (default: zustand)

[Only if fullstack:]
7. Auth:             select  → NextAuth | Clerk | None  (default: nextauth)
8. Database:         select  → Prisma | Drizzle | None  (default: prisma)
9. API style:        select  → REST | tRPC | None  (default: rest)
```

---

### 8.2 `src/stacks/next/scaffold.ts`

**Clean architecture folder structure (App Router, always):**

```
src/
  app/
    layout.tsx
    page.tsx
    globals.css             (if tailwind)
    api/                    (fullstack only)
      health/
        route.ts
  features/
    .gitkeep
  core/
    api/
      client.ts             ← axios or fetch config
      index.ts
    config/
      env.ts                ← typed env variables via zod
      index.ts
    errors/
      app-error.ts
      index.ts
    types/
      index.ts
    utils/
      index.ts
  shared/
    components/
      .gitkeep
    hooks/
      .gitkeep
    types/
      index.ts
  lib/                      (fullstack only)
    db.ts                   ← prisma client or drizzle instance
    auth.ts                 ← nextauth or clerk config
  middleware.ts             (fullstack only)
package.json
tsconfig.json
next.config.ts
tailwind.config.ts          (if tailwind)
postcss.config.js           (if tailwind)
.env.local
.env.example
.gitignore
```

**`package.json` generation rules:**

Always included:
- `next`, `react`, `react-dom`, `typescript`, `@types/react`, `@types/node`, `zod`

Conditional:
- tailwind → `tailwindcss`, `postcss`, `autoprefixer`
- tanstack-query → `@tanstack/react-query`
- zustand → `zustand`
- nextauth → `next-auth`
- clerk → `@clerk/nextjs`
- prisma → `prisma`, `@prisma/client`
- drizzle → `drizzle-orm`, `drizzle-kit`
- trpc → `@trpc/server`, `@trpc/client`, `@trpc/react-query`

Dev always: `eslint`, `eslint-config-next`, `@types/react-dom`

**`scanHints` returns:**

```typescript
{
  detectedSSR:            true,
  detectedNextRouter:     ctx.router,           // 'app' | 'pages'
  detectedRSC:            ctx.router === 'app',
  detectedCSSApproach:    ctx.styling,
  detectedState:          ctx.clientState !== 'none' ? ctx.clientState : '',
  detectedHTTPClient:     'axios',
  detectedAuth:           ctx.auth !== 'none' ? ctx.auth : '',
  detectedORM:            ctx.database !== 'none' ? ctx.database : '',
  detectedPackageManager: ctx.packageManager,
  detectedAPIType:        ctx.apiStyle !== 'none' ? ctx.apiStyle.toUpperCase() : 'REST',
  detectedSubtype:        ctx.projectType === 'fullstack' ? 'fullstack' : 'frontend',
}
```

**`postSetup` does:**

1. `git init`
2. `<packageManager> install`
3. If prisma: `npx prisma init --datasource-provider sqlite` (dev default)
4. `git add -A && git commit -m "chore: initial project scaffold"`

---

## 9. CLI Registration

In `src/cli.ts`, add after the existing imports block:

```typescript
import { runProjectInit } from './commands/project-init.js';

// Self-registering adapters — importing them triggers registerAdapter()
import './stacks/flutter/adapter.js';
import './stacks/next/adapter.js';
```

Add command group after the existing `uninstall` command:

```typescript
const project = program.command('project')
  .description('Project lifecycle commands');

project
  .command('init')
  .description('Scaffold a new project and apply governance from day one')
  .option('--type <stack>',  'Stack: flutter | next | react | node')
  .option('--name <name>',   'App name (skips name prompt)')
  .option('--yes',           'Skip confirmation', false)
  .option('--dry-run',       'Scaffold only — skip governance write', false)
  .option('--dir <path>',    'Parent directory', process.cwd())
  .action(async (options) => {
    await runProjectInit(options);
  });
```

---

## 10. Test Suite

### 10.1 `tests/project-init.test.ts`

**Registry tests:**

| Test | Assertion |
|------|-----------|
| `getAdapter('flutter')` — after importing Flutter adapter | Returns instance of FlutterAdapter |
| `getAdapter('next')` — after importing Next adapter | Returns instance of NextAdapter |
| `getAdapter('unknown' as any)` | Throws `Error: No adapter registered for stack: unknown` |
| `getAllAdapters()` returns array | Length ≥ 2 after both adapters imported |
| `getSupportedStackIds()` | Includes `'flutter'` and `'next'` |
| `getAllAdapters()` preserves registration order | Flutter registered first appears at index 0 |
| `registerAdapter` called twice with same id | Throws `Error: Adapter already registered for stack: flutter` |

**`buildGovernanceConfig` unit tests (pure function, no I/O):**

```typescript
describe('buildGovernanceConfig', () => {
  const dummyCtx: ScaffoldContext = {
    appName: 'test_app', displayName: 'Test App',
    outputDir: '/tmp', projectDir: '/tmp/test_app',
    agent: 'claude-code', gitHooks: true, ci: 'github',
  };

  it('sets stack to adapter.id', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.stack).toBe('react');   // DummyAdapter uses 'react'
  });

  it('merges scanHints into ScanResult', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.scan.detectedPackageManager).toBe('npm');  // from DummyAdapter.scanHints
  });

  it('sets project.appName to displayName', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.project.appName).toBe('Test App');
  });

  it('sets project.packageName to appName', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.project.packageName).toBe('test_app');
  });

  it('sets agent from ctx.agent', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.agent).toBe('claude-code');
  });

  it('sets projectDir from ctx.projectDir', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.projectDir).toBe('/tmp/test_app');
  });

  it('sets conflictMode to keep', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    expect(cfg.conflictMode).toBe('keep');
  });

  it('unset scanHints fields retain createDefaultScanResult defaults', () => {
    const cfg = buildGovernanceConfig(dummyCtx, new DummyAdapter(), {});
    // DummyAdapter only sets detectedPackageManager and detectedSSR
    // All other fields must equal createDefaultScanResult() values
    expect(cfg.scan.detectedState).toBe('');
  });
});
```

**Orchestrator integration test (uses DummyAdapter, real filesystem):**

```typescript
describe('runProjectInit — DummyAdapter end-to-end', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-proj-init-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('scaffold creates projectDir with files', async () => {
    const ctx: ScaffoldContext = {
      appName: 'my_app', displayName: 'My App',
      outputDir: tmpDir, projectDir: join(tmpDir, 'my_app'),
      agent: 'claude-code', gitHooks: false, ci: 'none',
    };

    const adapter = new DummyAdapter();
    await adapter.scaffold(ctx);

    expect(existsSync(join(tmpDir, 'my_app'))).toBe(true);
    expect(existsSync(join(tmpDir, 'my_app', 'README.md'))).toBe(true);
    expect(existsSync(join(tmpDir, 'my_app', 'package.json'))).toBe(true);
  });

  it('scaffold README contains displayName', async () => {
    const ctx: ScaffoldContext = {
      appName: 'my_app', displayName: 'My App',
      outputDir: tmpDir, projectDir: join(tmpDir, 'my_app'),
      agent: 'claude-code', gitHooks: false, ci: 'none',
    };
    await new DummyAdapter().scaffold(ctx);
    const content = readFileSync(join(tmpDir, 'my_app', 'README.md'), 'utf-8');
    expect(content).toContain('My App');
  });

  it('scaffold throws if projectDir already exists', async () => {
    const ctx: ScaffoldContext = {
      appName: 'my_app', displayName: 'My App',
      outputDir: tmpDir, projectDir: join(tmpDir, 'my_app'),
      agent: 'claude-code', gitHooks: false, ci: 'none',
    };
    mkdirSync(ctx.projectDir, { recursive: true });  // pre-create it
    // orchestrator checks existence before calling scaffold — test the guard logic
    expect(existsSync(ctx.projectDir)).toBe(true);
    // Implementation must abort with: "Directory already exists: <path>"
  });
});
```

**CLI flag validation tests:**

| Test | Assertion |
|------|-----------|
| `--type invalidstack` | Process exits with error containing "invalid stack" and lists valid identifiers |
| `--name "invalid name"` (spaces) for Flutter | Aborts with message indicating snake_case required |
| `--name "InvalidCase"` for Next.js | Aborts with message indicating kebab-case required |
| `--name` value > 214 characters | Aborts with length error |
| `--dir /nonexistent/path` | Aborts with "path does not exist" error message |

**Adapter self-registration tests:**

| Test | Assertion |
|------|-----------|
| Importing `flutter/adapter.ts` registers Flutter adapter | `getAdapter('flutter')` succeeds after import |
| Importing `next/adapter.ts` registers Next adapter | `getAdapter('next')` succeeds after import |
| Registering same adapter twice | Throws `Error: Adapter already registered for stack: flutter` |

**Workspace safety tests:**

| Test | Assertion |
|------|-----------|
| `buildGovernanceConfig` always sets `conflictMode: 'keep'` | `cfg.conflictMode === 'keep'` regardless of options |
| `buildGovernanceConfig` with `overwrite: true` in options | `conflictMode` still `'keep'` — project init never overwrites |

---

### 10.2 `tests/stacks/flutter-adapter.test.ts`

All tests create a real temp directory and verify actual file contents.

**Setup / teardown:**

```typescript
let tmpDir: string;
let projectDir: string;
let adapter: FlutterAdapter;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'ai-gov-flutter-'));
  projectDir = join(tmpDir, 'accu_shield');
  adapter = new FlutterAdapter();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});
```

**Context factory:**

```typescript
function makeFlutterCtx(overrides: Partial<FlutterContext> = {}): FlutterContext {
  return {
    appName: 'accu_shield',
    displayName: 'AccuShield',
    outputDir: tmpDir,
    projectDir,
    agent: 'claude-code',
    gitHooks: false,
    ci: 'none',
    androidPackage: 'com.techvedika.accushield',
    iosBundle: 'com.techvedika.accushield',
    flutterVersion: '3.29.0',
    services: [],
    ...overrides,
  };
}
```

**Folder structure tests:**

| Test | Assertion |
|------|-----------|
| `scaffold()` creates `lib/core/config/` | `existsSync(join(projectDir, 'lib/core/config'))` |
| `scaffold()` creates `lib/core/network/` | dir exists |
| `scaffold()` creates `lib/core/di/` | dir exists |
| `scaffold()` creates `lib/features/` | dir exists |
| `scaffold()` creates `assets/images/` | dir exists |
| `scaffold()` creates `bricks/clean_feature/__brick__/` | dir exists |
| `scaffold()` creates `test/architecture/` | dir exists |

**`pubspec.yaml` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync(join(projectDir, 'pubspec.yaml'))` |
| Contains correct app name | content includes `name: accu_shield` |
| Contains flutter_bloc | content includes `flutter_bloc` |
| Contains dio | content includes `dio:` |
| Contains get_it | content includes `get_it:` |
| Contains go_router | content includes `go_router:` |
| Does not contain placeholder `APPNAME` | `!content.includes('APPNAME')` |
| Does not contain placeholder `PASCAL` | `!content.includes('PASCAL')` |

**`app_config.dart` tests (single service):**

```typescript
describe('AppConfig — single service', () => {
  const ctx = makeFlutterCtx({
    services: [{
      name: 'api',
      envUrls: {
        local: 'http://localhost:3000',
        dev: 'https://dev-api.example.com',
        qa: 'https://qa-api.example.com',
        staging: 'https://staging-api.example.com',
        prod: 'https://api.example.com',
      },
      headers: {},
      endpoints: [],
    }],
  });

  beforeEach(async () => { await adapter.scaffold(ctx); });

  it('file exists', () => {
    expect(existsSync(join(projectDir, 'lib/core/config/app_config.dart'))).toBe(true);
  });

  it('contains apiBaseUrl getter', () => {
    const c = readFileSync(join(projectDir, 'lib/core/config/app_config.dart'), 'utf-8');
    expect(c).toContain('static String get apiBaseUrl');
  });

  it('contains local URL', () => {
    const c = readFileSync(join(projectDir, 'lib/core/config/app_config.dart'), 'utf-8');
    expect(c).toContain('http://localhost:3000');
  });

  it('contains prod URL', () => {
    const c = readFileSync(join(projectDir, 'lib/core/config/app_config.dart'), 'utf-8');
    expect(c).toContain('https://api.example.com');
  });

  it('contains all 5 AppEnv values in _urls map', () => {
    const c = readFileSync(join(projectDir, 'lib/core/config/app_config.dart'), 'utf-8');
    ['local', 'dev', 'qa', 'staging', 'prod'].forEach(env => {
      expect(c).toContain(`AppEnv.${env}`);
    });
  });
});
```

**`app_config.dart` tests (multi-service):**

| Test | Assertion |
|------|-----------|
| Two getters generated | content includes `apiBaseUrl` AND `nodeBaseUrl` |
| Both services in `_urls` map | content has `'api':` and `'node':` inside each AppEnv block |

**`api_endpoints.dart` tests:**

```typescript
describe('ApiEndpoints', () => {
  it('generates const for POST /auth/login', async () => {
    const ctx = makeFlutterCtx({
      services: [{
        name: 'auth',
        envUrls: { local: 'http://localhost:3000', dev: '', qa: '', staging: '', prod: '' },
        headers: {},
        endpoints: [{ method: 'POST', path: '/auth/login' }],
      }],
    });
    await adapter.scaffold(ctx);
    const c = readFileSync(join(projectDir, 'lib/core/config/api_endpoints.dart'), 'utf-8');
    expect(c).toContain("static const authLogin = '/auth/login'");
  });

  it('handles parameterised path /users/{id}', async () => {
    const ctx = makeFlutterCtx({
      services: [{
        name: 'user',
        envUrls: { local: 'http://localhost:3000', dev: '', qa: '', staging: '', prod: '' },
        headers: {},
        endpoints: [{ method: 'GET', path: '/users/{id}' }],
      }],
    });
    await adapter.scaffold(ctx);
    const c = readFileSync(join(projectDir, 'lib/core/config/api_endpoints.dart'), 'utf-8');
    expect(c).toContain('usersById');
  });

  it('generates TODO comment when no endpoints configured', async () => {
    const ctx = makeFlutterCtx({ services: [{ name: 'api', envUrls: { local:'', dev:'', qa:'', staging:'', prod:'' }, headers: {}, endpoints: [] }] });
    await adapter.scaffold(ctx);
    const c = readFileSync(join(projectDir, 'lib/core/config/api_endpoints.dart'), 'utf-8');
    expect(c).toContain('// TODO: add api endpoints');
  });
});
```

**`service_headers.dart` tests:**

| Test | Assertion |
|------|-----------|
| Empty headers → empty map `{}` | content includes `static Map<String, String> get api => {};` |
| Single header `x-app-version:1.0` | content includes `'x-app-version': '1.0'` |
| Multiple headers | both key-value pairs present |

**`dio_factory.dart` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync` |
| Contains `class DioFactory` | string match |
| Contains `ConnectivityCubit` | string match |
| Contains `PrettyDioLogger` | string match |
| Uses package import with correct app name | `import 'package:accu_shield/` |

**`analysis_options.yaml` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync` |
| Contains `avoid_print: true` | string match |
| Contains `always_use_package_imports: true` | string match |

**`scanHints` tests (pure, no filesystem):**

```typescript
describe('FlutterAdapter.scanHints', () => {
  it('returns BLoC for detectedState', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedState).toBe('BLoC');
  });
  it('returns GetIt for detectedDI', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedDI).toBe('GetIt');
  });
  it('returns Dio for detectedNetwork', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedNetwork).toBe('Dio');
  });
  it('returns true for detectedMason', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedMason).toBe(true);
  });
  it('returns true for detectedFVM', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedFVM).toBe(true);
  });
  it('returns mason for scaffoldTool', () => {
    expect(adapter.scanHints(makeFlutterCtx()).scaffoldTool).toBe('mason');
  });
  it('returns pub for detectedPackageManager', () => {
    expect(adapter.scanHints(makeFlutterCtx()).detectedPackageManager).toBe('pub');
  });
});
```

**Android Gradle file tests (`dart-android.ts` output):**

```typescript
describe('Android Gradle files — declarative format', () => {
  beforeEach(async () => {
    await adapter.scaffold(makeFlutterCtx({
      androidPackage: 'com.techvedika.axelo',
    }));
  });

  // gradle-wrapper.properties
  it('gradle-wrapper.properties exists', () => {
    expect(existsSync(join(projectDir, 'android/gradle/wrapper/gradle-wrapper.properties'))).toBe(true);
  });
  it('gradle-wrapper.properties pins Gradle 8.10.2', () => {
    const c = readFileSync(join(projectDir, 'android/gradle/wrapper/gradle-wrapper.properties'), 'utf-8');
    expect(c).toContain('gradle-8.10.2-all.zip');
  });
  it('gradle-wrapper.properties does NOT contain 8.4 or older', () => {
    const c = readFileSync(join(projectDir, 'android/gradle/wrapper/gradle-wrapper.properties'), 'utf-8');
    expect(c).not.toMatch(/gradle-[0-7]\.|gradle-8\.[0-6]\./);
  });

  // settings.gradle
  it('settings.gradle exists', () => {
    expect(existsSync(join(projectDir, 'android/settings.gradle'))).toBe(true);
  });
  it('settings.gradle uses pluginManagement block', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).toContain('pluginManagement {');
  });
  it('settings.gradle uses includeBuild (not apply from)', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).toContain('includeBuild(');
    expect(c).not.toContain('apply from:');
  });
  it('settings.gradle declares AGP via plugins block with apply false', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).toContain('id "com.android.application" version');
    expect(c).toContain('apply false');
  });
  it('settings.gradle declares Kotlin plugin', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).toContain('id "org.jetbrains.kotlin.android"');
  });
  it('settings.gradle does NOT contain buildscript block', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).not.toContain('buildscript');
  });
  it('settings.gradle does NOT contain classpath', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).not.toContain('classpath');
  });
  it('settings.gradle AGP version matches ANDROID_VERSIONS.agp constant', () => {
    const c = readFileSync(join(projectDir, 'android/settings.gradle'), 'utf-8');
    expect(c).toContain(`version "${ANDROID_VERSIONS.agp}"`);
  });

  // root build.gradle
  it('root build.gradle exists', () => {
    expect(existsSync(join(projectDir, 'android/build.gradle'))).toBe(true);
  });
  it('root build.gradle does NOT contain buildscript or classpath', () => {
    const c = readFileSync(join(projectDir, 'android/build.gradle'), 'utf-8');
    expect(c).not.toContain('buildscript');
    expect(c).not.toContain('classpath');
  });
  it('root build.gradle contains allprojects with google() and mavenCentral()', () => {
    const c = readFileSync(join(projectDir, 'android/build.gradle'), 'utf-8');
    expect(c).toContain('allprojects {');
    expect(c).toContain('google()');
    expect(c).toContain('mavenCentral()');
  });

  // app/build.gradle
  it('app/build.gradle exists', () => {
    expect(existsSync(join(projectDir, 'android/app/build.gradle'))).toBe(true);
  });
  it('app/build.gradle starts with plugins block', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c.trimStart()).toMatch(/^plugins\s*\{/);
  });
  it('app/build.gradle declares dev.flutter.flutter-gradle-plugin', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).toContain('id "dev.flutter.flutter-gradle-plugin"');
  });
  it('app/build.gradle does NOT contain imperative apply plugin', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).not.toContain('apply plugin:');
    expect(c).not.toContain('apply from:');
  });
  it('app/build.gradle does NOT contain localProperties or flutterRoot blocks', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).not.toContain('def localProperties');
    expect(c).not.toContain('def flutterRoot');
    expect(c).not.toContain('def flutterSdkPath');
  });
  it('app/build.gradle sets namespace to androidPackage', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).toContain('namespace "com.techvedika.axelo"');
  });
  it('app/build.gradle sets applicationId to androidPackage', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).toContain('applicationId "com.techvedika.axelo"');
  });
  it('app/build.gradle sets Java 17 compatibility', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).toContain('sourceCompatibility JavaVersion.VERSION_17');
    expect(c).toContain('targetCompatibility JavaVersion.VERSION_17');
    expect(c).toContain('jvmTarget = "17"');
  });
  it('app/build.gradle uses flutter.compileSdkVersion (not hardcoded)', () => {
    const c = readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf-8');
    expect(c).toContain('compileSdk flutter.compileSdkVersion');
    expect(c).not.toMatch(/compileSdk\s+\d+/);
  });

  // MainActivity.kt
  it('MainActivity.kt exists at correct package path', () => {
    expect(existsSync(join(
      projectDir, 'android/app/src/main/kotlin/com/techvedika/axelo/MainActivity.kt'
    ))).toBe(true);
  });
  it('MainActivity.kt has correct package declaration', () => {
    const c = readFileSync(
      join(projectDir, 'android/app/src/main/kotlin/com/techvedika/axelo/MainActivity.kt'), 'utf-8'
    );
    expect(c).toContain('package com.techvedika.axelo');
  });
  it('MainActivity.kt extends FlutterActivity', () => {
    const c = readFileSync(
      join(projectDir, 'android/app/src/main/kotlin/com/techvedika/axelo/MainActivity.kt'), 'utf-8'
    );
    expect(c).toContain('FlutterActivity()');
  });

  // AndroidManifest.xml
  it('AndroidManifest.xml exists', () => {
    expect(existsSync(join(projectDir, 'android/app/src/main/AndroidManifest.xml'))).toBe(true);
  });
  it('AndroidManifest.xml has correct package', () => {
    const c = readFileSync(join(projectDir, 'android/app/src/main/AndroidManifest.xml'), 'utf-8');
    expect(c).toContain('com.techvedika.axelo');
  });
  it('AndroidManifest.xml includes INTERNET permission', () => {
    const c = readFileSync(join(projectDir, 'android/app/src/main/AndroidManifest.xml'), 'utf-8');
    expect(c).toContain('android.permission.INTERNET');
  });
});
```

**Version constant tests (pure — no filesystem):**

```typescript
import { ANDROID_VERSIONS } from '../../src/stacks/flutter/templates/dart-android.js';

describe('ANDROID_VERSIONS constants', () => {
  it('gradle >= 8.7.0 (Flutter minimum requirement)', () => {
    const [major, minor] = ANDROID_VERSIONS.gradle.split('.').map(Number);
    expect(major > 8 || (major === 8 && minor >= 7)).toBe(true);
  });
  it('agp >= 8.1.1 (Flutter minimum requirement)', () => {
    const parts = ANDROID_VERSIONS.agp.split('.').map(Number);
    const [major, minor, patch] = parts;
    const meetsMin = major > 8 || (major === 8 && (minor > 1 || (minor === 1 && patch >= 1)));
    expect(meetsMin).toBe(true);
  });
  it('java is VERSION_17', () => {
    expect(ANDROID_VERSIONS.java).toBe('VERSION_17');
  });
});
```

**`postSetup` resilience tests (mock execSync to simulate failures):**

| Test | Assertion |
|------|-----------|
| `fvm` not in PATH | Prints warning containing "FVM not found", continues to git commit |
| `fvm flutter pub get` exits non-zero | Prints warning containing "dependency resolution failed", continues to git commit |
| Both FVM and pub get succeed | `git commit` is called with message `"chore: initial project scaffold"` |

**Default services test (no services provided):**

| Test | Assertion |
|------|-----------|
| Two default services generated | `AppConfig` contains both `apiBaseUrl` and `nodeBaseUrl` getters |
| Default local URL for api | content contains `http://localhost:3000` |
| Default local URL for node | content contains `http://localhost:3001` |

---

### 10.3 `tests/stacks/next-adapter.test.ts`

**Context factory:**

```typescript
function makeNextCtx(overrides: Partial<NextContext> = {}): NextContext {
  return {
    appName: 'accu-shield',
    displayName: 'AccuShield',
    outputDir: tmpDir,
    projectDir,
    agent: 'claude-code',
    gitHooks: false,
    ci: 'none',
    projectType: 'frontend',
    packageManager: 'npm',
    router: 'app',
    styling: 'tailwind',
    serverState: 'tanstack-query',
    clientState: 'zustand',
    auth: 'none',
    database: 'none',
    apiStyle: 'none',
    ...overrides,
  };
}
```

**Folder structure tests (frontend):**

| Test | Assertion |
|------|-----------|
| `src/app/` exists | `existsSync` |
| `src/features/` exists | `existsSync` |
| `src/core/api/` exists | `existsSync` |
| `src/core/config/` exists | `existsSync` |
| `src/core/errors/` exists | `existsSync` |
| `src/shared/components/` exists | `existsSync` |
| `src/app/api/` does NOT exist for frontend | `!existsSync` |
| `src/lib/` does NOT exist for frontend | `!existsSync` |
| `src/middleware.ts` does NOT exist for frontend | `!existsSync` |

**Folder structure tests (fullstack):**

| Test | Assertion |
|------|-----------|
| `src/app/api/health/route.ts` exists | `existsSync` |
| `src/lib/` exists | `existsSync` |
| `src/middleware.ts` exists | `existsSync` |

**`package.json` tests:**

```typescript
describe('package.json', () => {
  it('name matches appName', async () => {
    await adapter.scaffold(makeNextCtx());
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('accu-shield');
  });

  it('includes next and react', async () => {
    await adapter.scaffold(makeNextCtx());
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('next');
    expect(pkg.dependencies).toHaveProperty('react');
  });

  it('includes tailwindcss when styling=tailwind', async () => {
    await adapter.scaffold(makeNextCtx({ styling: 'tailwind' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.devDependencies ?? pkg.dependencies).toHaveProperty('tailwindcss');
  });

  it('excludes tailwindcss when styling=css-modules', async () => {
    await adapter.scaffold(makeNextCtx({ styling: 'css-modules' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(allDeps).not.toHaveProperty('tailwindcss');
  });

  it('includes @tanstack/react-query when serverState=tanstack-query', async () => {
    await adapter.scaffold(makeNextCtx({ serverState: 'tanstack-query' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('@tanstack/react-query');
  });

  it('includes next-auth when auth=nextauth and fullstack', async () => {
    await adapter.scaffold(makeNextCtx({ projectType: 'fullstack', auth: 'nextauth' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('next-auth');
  });

  it('includes prisma when database=prisma and fullstack', async () => {
    await adapter.scaffold(makeNextCtx({ projectType: 'fullstack', database: 'prisma' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('@prisma/client');
  });

  it('excludes prisma for frontend-only project', async () => {
    await adapter.scaffold(makeNextCtx({ projectType: 'frontend', database: 'prisma' }));
    const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    expect(allDeps).not.toHaveProperty('prisma');
  });
});
```

**`tsconfig.json` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync` |
| `strict: true` | parsed JSON has `compilerOptions.strict === true` |
| `paths` has `@/*` alias | parsed JSON has `compilerOptions.paths['@/*']` |

**`next.config.ts` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync` |
| Is valid TypeScript (no syntax check, just non-empty) | `content.length > 10` |

**`tailwind.config.ts` tests:**

| Test | Assertion |
|------|-----------|
| Exists when styling=tailwind | `existsSync` |
| Does NOT exist when styling=css-modules | `!existsSync` |

**`.env.local` and `.env.example` tests:**

| Test | Assertion |
|------|-----------|
| `.env.local` exists | `existsSync` |
| `.env.example` exists | `existsSync` |
| `.env.local` in `.gitignore` | `.gitignore` content includes `.env.local` |

**`src/core/config/env.ts` tests:**

| Test | Assertion |
|------|-----------|
| File exists | `existsSync` |
| Uses zod for validation | content includes `z.object` or `import.*zod` |
| Exports `env` object | content includes `export const env` |
| Throws at startup if validation fails | content includes `process.exit` or `throw` after `.parse(` or `.safeParse(` |

**`globals.css` tests (Tailwind only):**

| Test | Assertion |
|------|-----------|
| Exists when styling=tailwind | `existsSync(join(projectDir, 'src/app/globals.css'))` |
| Contains `@tailwind base` directive | content includes `@tailwind base` |
| Contains `@tailwind components` directive | content includes `@tailwind components` |
| Contains `@tailwind utilities` directive | content includes `@tailwind utilities` |
| Does NOT exist when styling=css-modules | `!existsSync` |

**Health route (fullstack only):**

| Test | Assertion |
|------|-----------|
| `route.ts` exists | `existsSync` |
| Returns HTTP 200 with `status: 'ok'` | content includes `status: 'ok'` and (`status: 200` or `NextResponse.json`) |

**`postSetup` abort-on-failure tests (mock execSync):**

| Test | Assertion |
|------|-----------|
| `npm install` exits non-zero | Error thrown with message indicating which command failed; `git commit` is NOT called |
| `git init` exits non-zero | Error thrown; no further commands run |

**`scanHints` tests (pure):**

```typescript
describe('NextAdapter.scanHints', () => {
  it('detectedSSR is true', () => {
    expect(adapter.scanHints(makeNextCtx()).detectedSSR).toBe(true);
  });
  it('detectedNextRouter reflects choice', () => {
    expect(adapter.scanHints(makeNextCtx({ router: 'app' })).detectedNextRouter).toBe('app');
    expect(adapter.scanHints(makeNextCtx({ router: 'pages' })).detectedNextRouter).toBe('pages');
  });
  it('detectedCSSApproach reflects styling', () => {
    expect(adapter.scanHints(makeNextCtx({ styling: 'tailwind' })).detectedCSSApproach).toBe('tailwind');
  });
  it('detectedSubtype is fullstack for fullstack project', () => {
    expect(adapter.scanHints(makeNextCtx({ projectType: 'fullstack' })).detectedSubtype).toBe('fullstack');
  });
  it('detectedSubtype is frontend for frontend project', () => {
    expect(adapter.scanHints(makeNextCtx({ projectType: 'frontend' })).detectedSubtype).toBe('frontend');
  });
  it('detectedAuth is empty string for none', () => {
    expect(adapter.scanHints(makeNextCtx({ auth: 'none' })).detectedAuth).toBe('');
  });
  it('detectedORM is empty string for no database', () => {
    expect(adapter.scanHints(makeNextCtx({ database: 'none' })).detectedORM).toBe('');
  });
  it('detectedORM is prisma when database=prisma', () => {
    expect(adapter.scanHints(makeNextCtx({ database: 'prisma' })).detectedORM).toBe('prisma');
  });
  it('detectedRSC is true for app router', () => {
    expect(adapter.scanHints(makeNextCtx({ router: 'app' })).detectedRSC).toBe(true);
  });
  it('detectedRSC is false for pages router', () => {
    expect(adapter.scanHints(makeNextCtx({ router: 'pages' })).detectedRSC).toBe(false);
  });
  it('detectedPackageManager reflects choice', () => {
    expect(adapter.scanHints(makeNextCtx({ packageManager: 'pnpm' })).detectedPackageManager).toBe('pnpm');
  });
  it('detectedAPIType is REST when apiStyle=none (default)', () => {
    expect(adapter.scanHints(makeNextCtx({ apiStyle: 'none' })).detectedAPIType).toBe('REST');
  });
  it('detectedAPIType is TRPC when apiStyle=trpc', () => {
    expect(adapter.scanHints(makeNextCtx({ projectType: 'fullstack', apiStyle: 'trpc' })).detectedAPIType).toBe('TRPC');
  });
});
```

**Success message tests (orchestrator — mock runGovernance):**

| Test | Assertion |
|------|-----------|
| Success output includes project directory path | stdout/output contains `ctx.projectDir` |
| Flutter success output includes `cd <appName>` | output contains `cd accu_shield` |
| Flutter success output includes stack-specific next step | output contains `fvm flutter run` or `flutter run` |
| Next.js success output includes `npm run dev` | output contains `npm run dev` or the chosen package manager's dev command |

---

## 10.5 Property-Based Tests (fast-check)

**DevDependency:** `fast-check` (TypeScript-native, ESM-compatible)

Install: `npm install -D fast-check`

**Minimum iterations:** 100 per property test

### Test Files

| File | Properties Covered |
|------|--------------------|
| `tests/stacks/registry.property.test.ts` | Properties 1–4 |
| `tests/stacks/common-prompts.property.test.ts` | Properties 5–6 |
| `tests/project-init.property.test.ts` | Property 18 |
| `tests/stacks/flutter-adapter.property.test.ts` | Properties 7, 8, 10–14 |
| `tests/stacks/next-adapter.property.test.ts` | Properties 9, 15–17 |

### Property Definitions

| # | Property | What it verifies |
|---|----------|------------------|
| 1 | Registry Lookup Invariant | Registered adapter retrievable by id, in getAllAdapters, id in getSupportedStackIds |
| 2 | Registry Error on Unknown Identifier | getAdapter throws for any unregistered string |
| 3 | Registry Preserves Registration Order | getAllAdapters returns adapters in registration order |
| 4 | Duplicate Registration Error | Re-registering same id throws with correct message |
| 5 | Whitespace App Name Rejection | All-whitespace strings rejected by name validator |
| 6 | Display Name Transformation | Hyphens/underscores → spaces, words capitalized |
| 7 | runPrompts Preserves Base Context | Returned context contains all original base fields unchanged |
| 8 | Flutter Naming Convention Validation | Accepts iff matches `^[a-z][a-z0-9_]*$` |
| 9 | Next.js Naming Convention Validation | Accepts iff matches `^[a-z][a-z0-9-]*$` |
| 10 | Flutter Scaffold Directory Completeness | All required directories exist after scaffold |
| 11 | Flutter Endpoint Name Derivation | Transformation rules produce correct constant names |
| 12 | Flutter AppConfig Getter-Per-Service | One getter per service with correct naming |
| 13 | Flutter pubspec.yaml Correctness | Name matches appName, required deps present |
| 14 | Flutter Package Import Prefix | All generated Dart files use `package:<appName>/` |
| 15 | Next.js Conditional Directory Structure | Frontend excludes api/lib/middleware; fullstack includes them |
| 16 | Next.js Conditional Dependency Inclusion | Always-present deps + conditional deps based on choices |
| 17 | Next.js scanHints Derivation | All scanHints fields correctly derived from context |
| 18 | buildGovernanceConfig Pure Function Correctness | All output fields match expected mappings from inputs |

### Example Property Test (Property 8 — Flutter Naming)

```typescript
import fc from 'fast-check';
import { describe, it, expect } from '@jest/globals';

const FLUTTER_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

function isValidFlutterName(name: string): boolean {
  return FLUTTER_NAME_REGEX.test(name);
}

describe('Property 8: Flutter Naming Convention Validation', () => {
  it('accepts all valid snake_case names', () => {
    const validName = fc.stringOf(
      fc.oneof(fc.constant('_'), fc.char().filter(c => /[a-z0-9]/.test(c))),
      { minLength: 1, maxLength: 50 }
    ).filter(s => /^[a-z]/.test(s));

    fc.assert(fc.property(validName, (name) => {
      expect(isValidFlutterName(name)).toBe(true);
    }), { numRuns: 100 });
  });

  it('rejects names starting with uppercase, digit, or underscore', () => {
    const invalidStart = fc.oneof(
      fc.char().filter(c => /[A-Z0-9_]/.test(c))
    );
    const rest = fc.stringOf(fc.char().filter(c => /[a-z0-9_]/.test(c)));

    fc.assert(fc.property(invalidStart, rest, (start, tail) => {
      expect(isValidFlutterName(start + tail)).toBe(false);
    }), { numRuns: 100 });
  });

  it('rejects names containing hyphens or special characters', () => {
    const nameWithSpecial = fc.stringOf(fc.char(), { minLength: 2 })
      .filter(s => /^[a-z]/.test(s) && /[^a-z0-9_]/.test(s));

    fc.assert(fc.property(nameWithSpecial, (name) => {
      expect(isValidFlutterName(name)).toBe(false);
    }), { numRuns: 100 });
  });
});
```

---

## 11. Build & Verify Checklist

Run these in order before each phase is declared done:

```bash
# Type-check (no build errors)
npm run typecheck

# Run only new tests
npx jest --testPathPattern="project-init|flutter-adapter|next-adapter"

# Run full suite (no regressions)
npm test

# Build dist
npm run build

# Smoke test the compiled CLI
node dist/bin/ai-gov.js project init --help

# Manual end-to-end (Flutter)
node dist/bin/ai-gov.js project init --type flutter --name smoke_test --yes --dry-run --dir /tmp

# Manual end-to-end (Next.js)
node dist/bin/ai-gov.js project init --type next --name smoke-test --yes --dry-run --dir /tmp
```

**Phase gates:**

| Phase | Gate before moving on |
|-------|----------------------|
| Phase 1 | `getAdapter` tests pass, interface compiles |
| Phase 4 | DummyAdapter scaffold tests pass, `buildGovernanceConfig` tests pass |
| Phase 2 | All Flutter adapter tests pass, `--type flutter` smoke works |
| Phase 3 | All Next.js adapter tests pass, `--type next` smoke works |
| Done | Full test suite green, no TypeScript errors, both smoke tests produce valid output |

---

*End of spec. Start with Phase 1 (`adapter.ts`, `registry.ts`, `common-prompts.ts`) + Phase 4 skeleton (`project-init.ts` with DummyAdapter wired in).*
