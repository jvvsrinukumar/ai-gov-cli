# Design — Java Stack Support

## Hard Rules Compliance
| # | Rule | Compliant? | Justification |
|---|------|:----------:|---------------|
| 1 | Follow existing stack-addition pattern (profile + scanner + detection) | Yes | Mirrors Kotlin/Python/Flutter pattern exactly |
| 2 | No breaking changes to existing stacks | Yes | Additive only — new union member, new profile, new scanner |
| 3 | All generators produce valid output for Java | Yes | Every stack-specific branch gets a Java case |
| 4 | Scanner reads build files without executing build | Yes | Parses pom.xml/build.gradle as text, no `mvn` or `gradle` execution |
| 5 | Every new code path has corresponding test coverage | Yes | Unit tests for profile, scanner, detection, and content blocks |

## Architecture — How a Stack Plugs In

The existing architecture has 4 extension points per stack. Java follows the same pattern:

```
cli.ts
  │
  ├── detectStack()          ← Add 'java' detection (pom.xml / build.gradle with java plugin)
  │     └── detect-stack.ts  ← MODIFY: add Java detection before Kotlin (both use Gradle)
  │
  ├── loadBaseProfile()      ← Add javaProfile()
  │     └── profiles.ts      ← MODIFY: add case 'java' + javaProfile() function
  │
  ├── scanProject()          ← Add scanJava()
  │     ├── scanners/index.ts  ← MODIFY: add case 'java' dispatch
  │     └── scanners/java.ts   ← NEW: Java ecosystem scanner
  │
  ├── computeContentBlocks() ← Mostly profile-driven, minor Java branches
  │     └── content-blocks.ts  ← MODIFY: add isBackend logic for Java (conditional)
  │
  └── runGovernance()        ← Generators consume config — most are stack-agnostic
        ├── generators/architecture.ts        ← MODIFY: add Java project structure
        ├── generators/hooks/format-code.ts   ← MODIFY: add Java format command
        ├── generators/hooks/analyze-code.ts  ← MODIFY: add Java analyze command
        ├── generators/hooks/check-file-size.ts ← MODIFY: add Java to backend check
        ├── generators/git-hooks/checks/no-debug.ts ← MODIFY: add Java debug patterns
        ├── generators/commands/audit.ts      ← MODIFY: add Java audit template
        └── generators/commands/new-feature.ts ← MODIFY: add Java phases + examples
```

## Layer Mapping — Java Variants

Java projects have two distinct architectural patterns depending on whether they're backend (server) or desktop:

### Backend Java (Spring Boot, Quarkus, Micronaut, JAX-RS)
```
Controller → Service → Repository → Entity/Model
```
| Layer | Responsibility |
|-------|---------------|
| Controller | HTTP request handling, validation, response mapping |
| Service | Business logic, transaction management |
| Repository | Data access, queries |
| Entity/Model | Domain objects, JPA entities |

### Desktop Java (Swing, JavaFX, OSGi)
```
View → Controller/Service → Model → Data
```
| Layer | Responsibility |
|-------|---------------|
| View | UI components (Swing panels, JavaFX scenes) |
| Controller/Service | Event handling, business logic |
| Model | Domain objects |
| Data | Persistence, file I/O, network |

### OSGi Java (Weasis-style)
```
Bundle UI → Bundle Service → Bundle API → OSGi Registry
```
| Layer | Responsibility |
|-------|---------------|
| UI Bundle | Swing/JavaFX views registered as OSGi services |
| Service Bundle | Business logic exposed via service registry |
| API Bundle | Interfaces and DTOs shared across bundles |
| OSGi Registry | Service discovery, lifecycle management |

The scanner determines which variant to use based on detected dependencies.

## File List

### New Files
| File | Purpose |
|------|---------|
| `src/scanners/java.ts` | Java ecosystem scanner — parses pom.xml/build.gradle, detects frameworks |

### Modified Files
| File | Change |
|------|--------|
| `src/types.ts` | Add `'java'` to `Stack` union type; add Java-specific ScanResult fields |
| `src/detect-stack.ts` | Add Java detection logic (pom.xml, build.gradle with java plugin) |
| `src/profiles.ts` | Add `case 'java'` + `javaProfile()` function (backend + desktop variants) |
| `src/scanners/index.ts` | Add `case 'java': scanJava(...)` dispatch + Java srcRoot in high-risk scan |
| `src/content-blocks.ts` | Add Java to `isBackend` conditional (when Spring/JAX-RS detected) |
| `src/cli.ts` | Add `'java'` to valid stacks list; add Java project info extraction from pom.xml |
| `src/generators/architecture.ts` | Add Java project structure block (backend + desktop variants) |
| `src/generators/hooks/format-code.ts` | Add `case 'java'` for format command |
| `src/generators/hooks/analyze-code.ts` | Add Java analyze tool handling |
| `src/generators/hooks/check-file-size.ts` | Add `'java'` to backend stack check (when applicable) |
| `src/generators/git-hooks/checks/no-debug.ts` | Add Java debug patterns (`System.out.println`, `e.printStackTrace`) |
| `src/generators/commands/audit.ts` | Add Java audit template (3 switch blocks) |
| `src/generators/commands/new-feature.ts` | Add Java phases, example feature, file list template |
| `src/utils/file-helpers.ts` | Add `pomHas()` helper (analogous to existing `gradleHas()`) |
| `README.md` | Add Java to supported stacks list |

### Files That Need NO Changes (already stack-agnostic via profile/blocks)
| File | Why no change needed |
|------|---------------------|
| `src/generators/coding-standards.ts` | Fully driven by `profile` fields |
| `src/generators/constitution.ts` | Stack-agnostic |
| `src/generators/workflow.ts` | Stack-agnostic |
| `src/generators/spec-first-workflow.ts` | Stack-agnostic |
| `src/generators/feature-readme.ts` | Stack-agnostic |
| `src/generators/prompt-templates.ts` | Stack-agnostic |
| `src/generators/claude-md.ts` | Uses profile fields |
| `src/generators/settings-json.ts` | Stack-agnostic |
| `src/generators/extensions.ts` | Stack-agnostic |
| `src/generators/spec-templates.ts` | Stack-agnostic |
| `src/generators/hooks/protect-files.ts` | Uses profile fields |
| `src/generators/hooks/check-secrets.ts` | Stack-agnostic |
| `src/generators/hooks/block-dangerous.ts` | Stack-agnostic |
| `src/generators/hooks/check-spec-exists.ts` | Stack-agnostic |
| `src/generators/hooks/session-continuity.ts` | Stack-agnostic |
| `src/generators/hooks/check-feature-readme.ts` | Stack-agnostic |
| `src/generators/hooks/check-consistency.ts` | Stack-agnostic |
| `src/generators/hooks/check-file-size.ts` | Uses profile fields (minor isBackend check) |
| `src/generators/hooks/post-task-checklist.ts` | Stack-agnostic |
| `src/generators/git-hooks/*` (except no-debug) | Stack-agnostic |
| `src/pr-check/*` | Stack-agnostic |
| `src/commands/init-ci.ts` | Stack-agnostic |
| `src/commands/init-git-hooks.ts` | Stack-agnostic |

## Java Profile — Default Values

```typescript
function javaProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Java',
        fileExt: '.java',
        layerFlow: 'Controller → Service → Repository → Entity',
        layerNames: ['Controller', 'Service', 'Repository', 'Entity'],
        layerUI: 'Controller',
        layerState: 'Service',
        layerLogic: 'Service',
        layerAdapter: 'Repository',
        layerData: 'Entity',
        formatCmd: 'mvn spotless:apply',
        formatCmdFull: 'mvn spotless:apply',
        analyzeCmd: 'mvn checkstyle:check',
        analyzeCmdFile: '',
        testCmd: 'mvn test',
        buildCmd: 'mvn clean install',
        installCmd: 'mvn dependency:resolve',
        cleanCmd: 'mvn clean',
        runCmd: 'mvn spring-boot:run',
        sourceDir: 'src/main/java/',
        manifestFile: 'pom.xml',
        diFramework: 'Spring DI',
        stateFramework: 'N/A',
        namingFiles: 'PascalCase',
        namingConstants: 'UPPER_SNAKE_CASE',
        namingUISuffix: 'Controller',
        importStyle: 'java.* → javax.*/jakarta.* → third-party → project internal',
        statePattern: 'N/A (server-side — stateless request/response)',
        errorPattern: 'Exception hierarchy + @ControllerAdvice global handler',
        localStorageName: 'PostgreSQL / MySQL',
        formatExtensions: '.java',
        analyzeFileLevel: false,
        pkgAddBlockPattern: '',
        rmBlockDirs: 'src/',
        generatedExts: '.java',
        generatedPatterns: '*.generated.java *_.java',
    };
}
```

The scanner overrides these defaults based on what it actually finds (e.g., Gradle → `./gradlew` commands, OSGi → different layer flow, JavaFX → desktop layer names).

## Scanner Design — `src/scanners/java.ts`

### Detection Strategy

The scanner reads build files as text (no Maven/Gradle execution required):

```
1. Determine build system: Maven (pom.xml) vs Gradle (build.gradle / build.gradle.kts)
2. Read dependency declarations:
   - Maven: <dependency><groupId>...<artifactId>... in pom.xml
   - Gradle: implementation/compile/api 'group:artifact:version' in build.gradle
3. Match dependency patterns against known frameworks
4. Read plugin declarations for build tooling
5. Detect Java version from compiler config
6. Scan source files for pattern confirmation (annotations, imports)
```

### What Gets Detected

| Detection | Maven signal | Gradle signal | Source signal |
|-----------|-------------|---------------|--------------|
| Spring Boot | `spring-boot-starter` | `org.springframework.boot` | `@SpringBootApplication` |
| Spring MVC | `spring-boot-starter-web` | same | `@RestController` |
| Spring WebFlux | `spring-boot-starter-webflux` | same | `@RouterFunction` |
| JPA/Hibernate | `spring-boot-starter-data-jpa` or `hibernate-core` | same | `@Entity` |
| OSGi | `org.osgi.*` or `org.apache.felix` | same | `@Component` (SCR) |
| Swing | N/A (JDK built-in) | N/A | `extends JFrame\|JPanel` |
| JavaFX | `javafx-controls` | `org.openjfx` | `extends Application` |
| JUnit 5 | `junit-jupiter` | same | `@Test` (org.junit.jupiter) |
| Mockito | `mockito-core` | same | `@Mock` |
| Checkstyle | `maven-checkstyle-plugin` | `checkstyle` plugin | N/A |
| Spotless | `spotless-maven-plugin` | `spotless` plugin | N/A |
| SpotBugs | `spotbugs-maven-plugin` | `spotbugs` plugin | N/A |
| Multi-module | `<modules>` in pom.xml | `include` in settings.gradle | N/A |
| Java version | `maven.compiler.source/release` | `sourceCompatibility` | N/A |
| Lombok | `lombok` dependency | same | `@Data`, `@Getter` |
| MapStruct | `mapstruct` dependency | same | `@Mapper` |

### Helper Function — `pomHas()`

Analogous to the existing `gradleHas()` in `file-helpers.ts`:

```typescript
export function pomHas(projectDir: string, pattern: string): boolean {
    // Reads pom.xml (and optionally parent/child POMs) and tests regex against content
}
```

## Integration Points
| System | Purpose | Direction |
|--------|---------|-----------|
| Maven/Gradle build files | Read dependency and plugin declarations | Input (read-only) |
| Java source files | Scan for annotation/import patterns | Input (read-only) |
| `.claude/` directory | Write generated governance files | Output |

## isBackend Logic for Java

Java is unique among supported stacks because it can be either backend or desktop:

```typescript
// In content-blocks.ts and cli.ts:
const isBackend = stack === 'nodejs' || stack === 'python' 
    || (stack === 'java' && isJavaBackend(scan));

function isJavaBackend(scan: ScanResult): boolean {
    // True if Spring MVC, Spring WebFlux, JAX-RS, Micronaut, Quarkus, Spark, Javalin detected
    // False if Swing, JavaFX, SWT, OSGi-only (desktop) detected
    // Default: true (most Java projects are server-side)
}
```

## Detection Order — Avoiding Conflicts with Kotlin

Current detection order in `detect-stack.ts`:
1. Flutter (pubspec.yaml)
2. SwiftUI (Package.swift)
3. **Kotlin** (build.gradle.kts or build.gradle)  ← Problem: Java also uses Gradle
4. Python (pyproject.toml, requirements.txt)
5. JS-based (package.json → Angular/React/Node.js)

New detection order:
1. Flutter (pubspec.yaml)
2. SwiftUI (Package.swift)
3. **Java — Maven** (pom.xml without kotlin-maven-plugin) ← NEW
4. **Kotlin** (build.gradle.kts or build.gradle with kotlin plugin)
5. **Java — Gradle** (build.gradle with java plugin, no kotlin plugin) ← NEW
6. Python (pyproject.toml, requirements.txt)
7. JS-based (package.json → Angular/React/Node.js)

The key disambiguation: if `build.gradle` contains `kotlin` → Kotlin stack. If it contains `java` plugin but no `kotlin` → Java stack. If `pom.xml` exists and doesn't contain `kotlin-maven-plugin` → Java stack.
