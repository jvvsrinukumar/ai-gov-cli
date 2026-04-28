# Requirements — Java Stack Support

| Field | Value |
|-------|-------|
| **Feature** | Add Java as a supported stack in ai-gov CLI |
| **Branch** | `feature/java-stack-support` |
| **Author** | Developer |
| **Status** | Draft |

## Summary

Add first-class Java stack support to ai-gov, enabling the CLI to auto-detect Java projects (Maven and Gradle), scan their ecosystem (build system, DI framework, UI framework, ORM, testing, linting, module structure), and generate tailored governance files — steering, hooks, commands, spec templates, git hooks, and CI configs.

## User Stories

### US-1 — Auto-detect Java projects `[P1]`
**As a** Java developer, **I want** `ai-gov init` to automatically detect my Java project, **so that** I don't need to manually specify `--stack java`.

```
Scenario 1: Maven project
  Given  a project with pom.xml at root
  When   I run `npx ai-gov init`
  Then   the CLI detects "Java" and proceeds with Java-specific governance

Scenario 2: Gradle project (Java, not Kotlin)
  Given  a project with build.gradle containing `apply plugin: 'java'` (no Kotlin)
  When   I run `npx ai-gov init`
  Then   the CLI detects "Java" and proceeds with Java-specific governance

Scenario 3: Explicit stack override
  Given  any project
  When   I run `npx ai-gov init --stack java`
  Then   the CLI uses the Java stack regardless of auto-detection
```

### US-2 — Deep scan Java ecosystem `[P1]`
**As a** Java developer, **I want** the CLI to detect my specific libraries and frameworks, **so that** the generated governance files match my actual project.

```
Scenario 1: Maven multi-module project (e.g., Weasis)
  Given  a Maven project with parent POM and <modules> section
  When   the scanner runs
  Then   it detects multi-module structure, Java version, build plugins, and all dependencies

Scenario 2: Spring Boot project
  Given  a Maven/Gradle project with spring-boot-starter dependencies
  When   the scanner runs
  Then   it detects Spring Boot, Spring DI, JPA/Hibernate, Spring Security, etc.

Scenario 3: OSGi project (e.g., Weasis)
  Given  a Maven project with Felix/Equinox/OSGi dependencies
  When   the scanner runs
  Then   it detects OSGi framework, SCR annotations, bundle structure
```

### US-3 — Generate Java-tailored governance files `[P1]`
**As a** Java developer, **I want** the generated steering files, hooks, and commands to use Java conventions, **so that** Claude Code follows my project's actual patterns.

```
Scenario 1: Architecture steering
  Given  a detected Java/Maven/Spring project
  When   governance files are generated
  Then   architecture.md shows Java layer flow, project structure, and naming conventions

Scenario 2: Hooks use Java tooling
  Given  a detected Java project with Spotless formatter
  When   hooks are generated
  Then   format-code.sh runs `mvn spotless:apply` (not prettier or dart format)
  And    analyze-code.sh runs the detected linter (SpotBugs, Checkstyle, etc.)

Scenario 3: Commands use Java phases
  Given  a Java project
  When   /new-feature command is generated
  Then   phases follow Java conventions: Domain → Repository → Service → Controller → Tests
```

### US-4 — Java-specific debug pattern detection `[P2]`
**As a** team lead, **I want** git hooks to catch Java-specific debug statements, **so that** `System.out.println` and similar debug code doesn't get committed.

```
Scenario 1: Debug statement in staged file
  Given  a staged .java file containing System.out.println
  When   developer runs git commit
  Then   the no-debug check warns about the debug statement
```

### US-5 — Java project info extraction `[P2]`
**As a** Java developer, **I want** the CLI to read my project name from pom.xml or build.gradle, **so that** generated files reference the correct project name.

```
Scenario 1: Maven project
  Given  pom.xml with <artifactId>weasis-parent</artifactId>
  When   ai-gov init runs
  Then   project name is extracted as "weasis-parent"
```

## Detected Ecosystem — What the Scanner Must Identify

| Category | Examples to detect |
|----------|--------------------|
| Build system | Maven, Gradle, Gradle (Kotlin DSL) |
| Java version | 8, 11, 17, 21 (from compiler source/target or release) |
| Preview features | `--enable-preview` flag |
| DI framework | Spring DI, Guice, OSGi SCR, CDI (Jakarta/javax.inject), Dagger, HK2 |
| Web framework | Spring MVC, Spring WebFlux, JAX-RS (Jersey/RESTEasy), Spark, Javalin, Micronaut, Quarkus |
| UI framework | Swing, JavaFX, SWT, Vaadin, none (headless/server) |
| ORM / DB | Hibernate/JPA, MyBatis, JDBC, jOOQ, Spring Data |
| Testing | JUnit 4, JUnit 5, TestNG, Mockito, AssertJ, Hamcrest, WireMock, Testcontainers |
| Linter/formatter | Checkstyle, SpotBugs, PMD, Error Prone, Spotless, Google Java Format |
| Build plugins | maven-compiler-plugin, maven-surefire-plugin, bnd-maven-plugin (OSGi), shade, assembly |
| Logging | SLF4J, Log4j2, java.util.logging, Logback |
| Serialization | Jackson, Gson, JAXB, Protocol Buffers |
| Module system | Java 9+ modules (module-info.java), OSGi bundles, Maven multi-module |
| Native bindings | JNI, JNA, Panama FFI |
| API docs | Swagger/OpenAPI (springdoc, springfox), none |
| Cloud | AWS SDK, GCP, Azure SDK |

## Out of Scope
- Kotlin detection changes — existing Kotlin stack remains as-is; disambiguation only needed for Gradle projects
- Android Java — the Kotlin stack already handles Android; this is for server-side / desktop Java
- Scala, Groovy, Clojure — other JVM languages are separate future work
- Runtime integration — ai-gov remains a dev-time CLI tool, not a Java dependency

## Open Questions
1. `[RESOLVED]` Should Java be treated as backend-only? **No** — Java has desktop (Swing/JavaFX) and server (Spring) variants. The `isBackend` flag should be set based on detected framework (Spring/JAX-RS = backend, Swing/JavaFX = frontend/desktop).
2. `[RESOLVED]` How to disambiguate Java vs Kotlin for Gradle projects? Check for `kotlin` plugin in `build.gradle`. If present → Kotlin. If only `java` plugin → Java.
3. `[NEEDS CLARIFICATION]` Should we support Ant build system? Likely no — Ant is legacy and rare in modern Java projects.
