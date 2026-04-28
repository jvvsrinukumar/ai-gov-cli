# Tasks — Java Stack Support

## Status Guide
| Marker | Meaning |
|--------|---------|
| `- [ ]` | Pending |
| `- [x]` | Done |
| `⚠️ BLOCKED:` | Cannot proceed |
| `_(deferred)_` | Deferred |

## Size Guide: S < 30min · M 30min–2h · L 2h+

---

## Phase 1 — Type System & Detection
> Goal: `'java'` exists as a valid stack, CLI can detect and accept it.

- [x] **[S] [types.ts]** Add `'java'` to the `Stack` union type
- [x] **[S] [types.ts]** Add Java-specific fields to `ScanResult`: `detectedJavaVersion: string`, `detectedPreviewFeatures: boolean`, `detectedBuildSystem: string` (maven/gradle), `detectedOSGi: boolean`, `detectedLombok: boolean`, `detectedMapStruct: boolean`
- [x] **[M] [detect-stack.ts]** Add Java detection logic:
  - Maven: `pom.xml` exists AND does not contain `kotlin-maven-plugin` → Java
  - Gradle: `build.gradle`/`build.gradle.kts` exists AND contains `java` plugin AND does NOT contain `kotlin` plugin → Java
  - Insert Java-Maven check before Kotlin check; insert Java-Gradle check after Kotlin check
  - Add `'java'` to the `valid` array for `--stack` flag
- [x] **[S] [types.ts]** Add `'java'` to `createDefaultScanResult()` for new fields (empty defaults)

**Checkpoint:** `npx ai-gov init --stack java` should be accepted (will fail at profile loading — that's expected).

---

## Phase 2 — Profile
> Goal: Java has a complete base profile with sensible defaults.

- [x] **[M] [profiles.ts]** Create `javaProfile(): Partial<BaseProfile>` function with defaults:
  - `stackDisplay: 'Java'`, `fileExt: '.java'`
  - Layer flow: `Controller → Service → Repository → Entity` (backend default)
  - Commands: `mvn test`, `mvn clean install`, `mvn spotless:apply`, `mvn checkstyle:check`
  - Source dir: `src/main/java/`, manifest: `pom.xml`
  - DI: `Spring DI`, naming: PascalCase files, UPPER_SNAKE_CASE constants
  - Import order: `java.* → javax.*/jakarta.* → third-party → project`
  - Error pattern: `Exception hierarchy + @ControllerAdvice`
- [x] **[S] [profiles.ts]** Add `case 'java': return { ...base, ...javaProfile() };` to `loadBaseProfile()` switch

**Checkpoint:** `npx ai-gov init --stack java` should produce governance files with Java defaults (generic, not project-specific yet).

---

## Phase 3 — Scanner
> Goal: Deep project scanning detects the actual Java ecosystem.

- [x] **[S] [utils/file-helpers.ts]** Add `pomHas(projectDir: string, pattern: string): boolean` helper:
  - Reads `pom.xml` at project root
  - Also reads `<module>/pom.xml` files if parent POM has `<modules>`
  - Tests regex pattern against combined content
  - Returns false if no pom.xml exists
- [x] **[L] [scanners/java.ts]** Create Java scanner — `scanJava(projectDir, profile, scan)`:
  - Build system, Java version, preview features, source directory
  - Web framework, DI framework, UI framework (Swing/JavaFX with desktop layer override)
  - ORM/Database, Testing, Linter/Formatter, OSGi, Multi-module
  - Logging, API docs (springdoc/springfox), Lombok, MapStruct
  - High-risk files (pom.xml, build.gradle, application.properties/yml, module-info.java)
- [x] **[S] [scanners/index.ts]** Add Java dispatch:
  - `case 'java': scanJava(projectDir, profile, scan); break;`
  - Add Java srcRoot in `scanHighRiskByName`: check `src/main/java/` path
- [x] **[S] [scanners/index.ts]** In `scanHighRiskByName`, add Java source root detection

**Checkpoint:** `npx ai-gov init` on a Java project should show detected frameworks, DI, ORM, testing, etc. in the scan output.

---

## Phase 4 — Content Blocks & isBackend Logic
> Goal: Content blocks produce correct Java-specific text.

- [x] **[M] [content-blocks.ts]** Update `isBackend` computation:
  - Desktop only when Swing/JavaFX detected with no web framework and no OSGi
  - `const isBackend = stack === 'nodejs' || stack === 'python' || (stack === 'java' && isJavaBackend(scan));`
  - `isJavaBackend()`: returns false only when `detectedUISystem` is swing/javafx AND no `detectedSubtype` AND no `detectedOSGi`; defaults to true for all other cases
- [x] **[S] [content-blocks.ts]** Add Java branches where stack-specific logic exists:
  - `buildHardRules`: Java-specific rules
  - `buildTypeNaming`: Java naming patterns (Controller/Service/Repository/Entity/DTO)
  - `buildDesignFiles`: Java file templates with package structure
  - `buildTaskDataPhase`: JPA entities, repositories, Flyway migrations
  - `buildTaskStatePhase`: Spring Security filter chain
  - `buildTaskTestPhase`: JUnit 5, MockMvc integration tests
  - `buildLayerExecOrder`: Entity → Repository → Service → Security → Controller → Tests

**Checkpoint:** Generated steering files should contain Java-specific content (layer names, commands, naming conventions).

---

## Phase 5 — Generator Updates
> Goal: All generators with stack-specific branches handle Java correctly.

- [x] **[M] [generators/architecture.ts]** Add Java project structure block:
  - Backend (Spring): `controller/` `service/` `repository/` `model/` `config/` `exception/`
  - OSGi: bundle structure with `internal/` `<api>/` `OSGI-INF/`
- [x] **[S] [generators/hooks/format-code.ts]** Add `case 'java'`:
  - Uses `p.formatCmd` from profile (scanner overrides to `./gradlew spotlessApply` for Gradle, `mvn spotless:apply` for Maven)
- [x] **[S] [generators/hooks/analyze-code.ts]** Java analyze handling via profile:
  - Fully profile-driven — `p.analyzeCmd` set by scanner to detected linter command (Checkstyle/SpotBugs/PMD)
  - No explicit Java case needed; works transparently through profile
- [x] **[S] [generators/hooks/check-file-size.ts]** Update isBackend check:
  - Added `'java'` to `activeStacks`; `c.isBackend` carries Java backend flag through `GovernanceConfig`
- [x] **[S] [generators/git-hooks/checks/no-debug.ts]** Add `case 'java'`:
  - Patterns: `System\.out\.print|System\.err\.print|\.printStackTrace\(`
- [x] **[M] [generators/commands/audit.ts]** Add Java audit template (3 switch blocks):
  - Observation: scan `src/main/java/` for layer compliance, Spring annotations, build config
  - Dead code: unused `@Service`/`@Repository`/`@Component`, empty packages
  - Test coverage: check `src/test/java/` for corresponding `*Test.java` classes
- [x] **[M] [generators/commands/new-feature.ts]** Add Java support (3 functions):
  - `getPhases()`: Domain → Repository → Service → Controller → Tests
  - `getExampleFeature()`: `user-profile`
  - `getLayerFileExample()`: Java file paths with PascalCase and `<pkg>` package placeholder

**Checkpoint:** All generated files should be complete and Java-specific. No "undefined" or missing sections.

---

## Phase 6 — CLI & Project Info
> Goal: CLI correctly extracts project metadata from Java build files.

- [x] **[S] [cli.ts]** Add `case 'java'` to `collectProjectInfo()`:
  - Maven: read `<name>` then `<artifactId>` from pom.xml
  - Gradle: read `rootProject.name` from settings.gradle / settings.gradle.kts
- [x] **[S] [cli.ts]** Update `--stack` option description to include `java`
- [x] **[S] [cli.ts]** Add Java-specific summary fields in the Done output (Java version, build system, OSGi, Lombok)

**Checkpoint:** `npx ai-gov init` on a Java project shows correct project name and summary.

---

## Phase 7 — Tests
> Goal: All new code has test coverage.

- [x] **[M] [Test]** Unit test: `detect-stack.ts` — Java detection scenarios:
  - Maven project (pom.xml without Kotlin) → detects Java
  - Gradle project (build.gradle with java plugin, no kotlin) → detects Java
  - Gradle project with kotlin plugin → still detects Kotlin (not Java)
  - Maven project with kotlin-maven-plugin → still detects Kotlin (not Java)
  - `--stack java` explicit override works
  - Gradle without java plugin → does not detect Java (Issue #2 fix)
- [x] **[M] [Test]** Unit test: `profiles.ts` — Java profile returns valid BaseProfile:
  - All required fields are non-empty
  - Layer names array has correct length
  - Commands are valid
- [x] **[L] [Test]** Unit test: `scanners/java.ts` — Scanner detection:
  - Spring Boot detection from pom.xml
  - Gradle build system detection
  - Java version extraction
  - Multi-module detection (>= 1 include)
  - DI framework detection (Spring, Guice, OSGi SCR)
  - ORM detection (JPA, MyBatis)
  - Test framework detection (JUnit 5, Mockito)
  - Linter/formatter detection (Checkstyle, Spotless)
  - Desktop vs backend classification (OSGi + Swing → backend)
- [x] **[M] [Test]** Unit test: `content-blocks.ts` — `isJavaBackend()` logic:
  - Spring Boot → true
  - Pure Swing (no web, no OSGi) → false
  - Pure JavaFX (no web, no OSGi) → false
  - OSGi + Swing → true (OSGi overrides desktop)
  - Spring + Vaadin → true (detectedSubtype present)
  - Plain Maven (no subtype, no UI) → true (default)
  - CLI tool (no subtype, no UI) → true (default)
  - Quarkus → true
- [x] **[S] [Test]** Unit test: `generators/architecture.ts` — Java architecture blocks:
  - Spring backend → controller/service/repository structure
  - OSGi project → bundle structure
  - Desktop (Swing) → feature-folder structure

**Checkpoint:** `npm test` passes with all new tests green. (173 tests total, 44 new Java tests)

---

## Phase 8 — Documentation & Wrap-Up
> Goal: README and docs reflect Java support.

- [x] **[S] [README.md]** Update supported stacks list: added `Java` to the table
- [x] **[S] [README.md]** Add Java to `--stack` flag documentation
- [x] **[S] [README.md]** Add Java example in the phases table (Domain → Repository → Service → Controller → Tests)
- [x] **[S]** Update `package.json` keywords: added `"java"`, `"spring-boot"`, `"maven"`
- [ ] **[S]** Run `npx ai-gov doctor` on a test Java project — verify all checks pass
- [ ] **[S]** Run full `npx ai-gov init --stack java --dry-run` — verify output looks correct
- [ ] **[S]** Post-task checklist: verify no regressions on existing stacks (`--stack react`, `--stack python`, `--stack kotlin`)

---

## Blockers
| Blocker | Affects | Waiting On |
|---------|---------|-----------|
| _none_ | — | — |

## Estimated Total Effort
| Phase | Effort |
|-------|--------|
| Phase 1 — Types & Detection | S-M (1h) |
| Phase 2 — Profile | M (1h) |
| Phase 3 — Scanner | L (3-4h) — largest piece |
| Phase 4 — Content Blocks | M (1-2h) |
| Phase 5 — Generator Updates | M-L (2-3h) |
| Phase 6 — CLI | S (30min) |
| Phase 7 — Tests | L (3-4h) |
| Phase 8 — Docs & Wrap-Up | S (30min) |
| **Total** | **~12-16 hours** |
