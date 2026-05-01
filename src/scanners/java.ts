import { existsSync } from 'fs';
import { join } from 'path';
import type { BaseProfile, ScanResult } from '../types.js';
import { pomHas, readPom, gradleHas, fileExists, readFileSafe, findFilesRecursive } from '../utils/file-helpers.js';
import { log } from '../utils/logger.js';

export function scanJava(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    log.scanning('Java project details');

    // --- Build system ---
    const hasPom = existsSync(join(projectDir, 'pom.xml'));
    const hasGradle = existsSync(join(projectDir, 'build.gradle')) || existsSync(join(projectDir, 'build.gradle.kts'));

    if (hasPom) {
        scan.detectedBuildSystem = 'Maven';
        log.detected('Build: Maven');
    } else if (hasGradle) {
        scan.detectedBuildSystem = 'Gradle';
        profile.manifestFile = existsSync(join(projectDir, 'build.gradle.kts')) ? 'build.gradle.kts' : 'build.gradle';
        profile.formatCmd = './gradlew spotlessApply';
        profile.formatCmdFull = './gradlew spotlessApply';
        profile.analyzeCmd = './gradlew checkstyleMain';
        profile.testCmd = './gradlew test';
        profile.buildCmd = './gradlew build';
        profile.installCmd = './gradlew dependencies';
        profile.cleanCmd = './gradlew clean';
        profile.runCmd = './gradlew bootRun';
        log.detected('Build: Gradle');
    }

    // --- Source directory ---
    if (existsSync(join(projectDir, 'src/main/java'))) {
        profile.sourceDir = 'src/main/java/';
    } else if (existsSync(join(projectDir, 'app/src/main/java'))) {
        profile.sourceDir = 'app/src/main/java/';
    }

    // --- Java version ---
    detectJavaVersion(projectDir, scan, hasPom);

    // --- Web framework / subtype ---
    detectWebFramework(projectDir, profile, scan, hasPom);

    // --- DI framework ---
    detectDI(projectDir, profile, scan, hasPom);

    // --- UI framework (desktop) ---
    detectUI(projectDir, profile, scan);

    // --- ORM / Database ---
    detectORM(projectDir, scan, hasPom);

    // --- Testing ---
    detectTesting(projectDir, scan, hasPom);

    // --- Linter / Formatter ---
    detectLinterFormatter(projectDir, profile, scan, hasPom);

    // --- OSGi ---
    detectOSGi(projectDir, profile, scan, hasPom);

    // --- Multi-module ---
    detectMultiModule(projectDir, scan, hasPom);

    // --- Logging ---
    detectLogging(projectDir, scan, hasPom);

    // --- API docs ---
    detectApiDocs(projectDir, scan, hasPom);

    // --- Lombok / MapStruct ---
    detectCodegenLibs(projectDir, scan, hasPom);

    // --- High-risk files ---
    addHighRiskFiles(projectDir, scan);
}

function detectJavaVersion(projectDir: string, scan: ScanResult, hasPom: boolean): void {
    if (hasPom) {
        const pom = readPom(projectDir);
        // Try <maven.compiler.release> or <maven.compiler.source> in properties
        const release = pom.match(/<maven\.compiler\.release>(\d+)<\//);
        const source = pom.match(/<maven\.compiler\.source>(\d+)<\//);
        const javaVersion = release?.[1] || source?.[1] || '';
        if (javaVersion) {
            scan.detectedJavaVersion = javaVersion;
            log.detected(`Java: ${javaVersion}`);
        }
        // Check for --enable-preview
        if (pom.includes('--enable-preview')) {
            scan.detectedPreviewFeatures = true;
            log.detected('Java preview features: enabled');
        }
    } else {
        // Gradle
        const gradleFile = existsSync(join(projectDir, 'build.gradle.kts'))
            ? join(projectDir, 'build.gradle.kts')
            : join(projectDir, 'build.gradle');
        if (existsSync(gradleFile)) {
            const content = readFileSafe(gradleFile);
            const srcCompat = content.match(/sourceCompatibility\s*[=:]\s*['"]?(?:JavaVersion\.VERSION_)?(\d+)/);
            if (srcCompat) {
                scan.detectedJavaVersion = srcCompat[1];
                log.detected(`Java: ${srcCompat[1]}`);
            }
            if (content.includes('--enable-preview')) {
                scan.detectedPreviewFeatures = true;
                log.detected('Java preview features: enabled');
            }
        }
    }
}

function detectWebFramework(
    projectDir: string, profile: BaseProfile, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('spring-boot-starter-webflux')) {
        scan.detectedSubtype = 'spring-webflux';
        profile.runCmd = hasPom ? 'mvn spring-boot:run' : './gradlew bootRun';
        log.detected('Framework: Spring WebFlux');
    } else if (has('spring-boot-starter-web') || has('spring-boot-starter')) {
        scan.detectedSubtype = 'spring-boot';
        profile.runCmd = hasPom ? 'mvn spring-boot:run' : './gradlew bootRun';
        log.detected('Framework: Spring Boot');
    } else if (has('quarkus-')) {
        scan.detectedSubtype = 'quarkus';
        profile.runCmd = hasPom ? 'mvn quarkus:dev' : './gradlew quarkusDev';
        log.detected('Framework: Quarkus');
    } else if (has('micronaut-')) {
        scan.detectedSubtype = 'micronaut';
        profile.runCmd = hasPom ? 'mvn mn:run' : './gradlew run';
        log.detected('Framework: Micronaut');
    } else if (has('javax\\.ws\\.rs') || has('jakarta\\.ws\\.rs')) {
        scan.detectedSubtype = 'jaxrs';
        log.detected('Framework: JAX-RS');
    } else if (has('spark-core') || has('com\\.sparkjava')) {
        scan.detectedSubtype = 'spark';
        log.detected('Framework: Spark Java');
    } else if (has('javalin')) {
        scan.detectedSubtype = 'javalin';
        log.detected('Framework: Javalin');
    }
}

function detectDI(
    projectDir: string, profile: BaseProfile, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('spring-context') || has('spring-boot-starter')) {
        scan.detectedDI = 'Spring DI';
        profile.diFramework = 'Spring DI';
        log.detected('DI: Spring DI');
    } else if (has('com\\.google\\.inject') || has('guice')) {
        scan.detectedDI = 'Guice';
        profile.diFramework = 'Guice';
        log.detected('DI: Guice');
    } else if (has('org\\.osgi\\.service\\.component\\.annotations') || has('org\\.apache\\.felix\\.scr')) {
        scan.detectedDI = 'OSGi SCR';
        profile.diFramework = 'OSGi SCR';
        log.detected('DI: OSGi SCR');
    } else if (has('jakarta\\.inject') || has('javax\\.inject')) {
        scan.detectedDI = 'CDI';
        profile.diFramework = 'CDI';
        log.detected('DI: CDI');
    } else if (has('com\\.google\\.dagger') || has('dagger')) {
        scan.detectedDI = 'Dagger';
        profile.diFramework = 'Dagger';
        log.detected('DI: Dagger');
    }
}

function detectUI(
    projectDir: string, profile: BaseProfile, scan: ScanResult
): void {
    const srcDir = join(projectDir, profile.sourceDir);
    if (!existsSync(srcDir)) return;

    const javaFiles = findFilesRecursive(srcDir, 6, f => f.endsWith('.java'));
    let swingCount = 0;
    let fxCount = 0;

    for (const f of javaFiles.slice(0, 200)) {
        const content = readFileSafe(f);
        if (/extends\s+(JFrame|JPanel|JDialog|JComponent)|import\s+javax\.swing/.test(content)) swingCount++;
        if (/extends\s+Application|import\s+javafx\./.test(content)) fxCount++;
    }

    if (swingCount > 0 || fxCount > 0) {
        if (swingCount >= fxCount) {
            scan.detectedUISystem = 'swing';
            profile.layerUI = 'View';
            profile.layerFlow = 'View → Controller → Service → Model';
            profile.layerNames = ['View', 'Controller', 'Service', 'Model'];
            profile.namingUISuffix = 'View';
            profile.statePattern = 'Event-driven (listeners + observers)';
            profile.runCmd = 'mvn exec:java';
            log.detected(`UI: Swing (${swingCount} files)`);
        } else {
            scan.detectedUISystem = 'javafx';
            profile.layerUI = 'View';
            profile.layerFlow = 'View → Controller → Service → Model';
            profile.layerNames = ['View', 'Controller', 'Service', 'Model'];
            profile.namingUISuffix = 'View';
            profile.statePattern = 'Observable properties + FXML bindings';
            profile.runCmd = 'mvn javafx:run';
            log.detected(`UI: JavaFX (${fxCount} files)`);
        }
    }
}

function detectORM(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('spring-boot-starter-data-jpa') || has('hibernate-core')) {
        scan.detectedORM = 'JPA/Hibernate';
        log.detected('ORM: JPA/Hibernate');
    } else if (has('mybatis')) {
        scan.detectedORM = 'MyBatis';
        log.detected('ORM: MyBatis');
    } else if (has('jooq')) {
        scan.detectedORM = 'jOOQ';
        log.detected('ORM: jOOQ');
    } else if (has('spring-boot-starter-jdbc') || has('spring-jdbc')) {
        scan.detectedORM = 'Spring JDBC';
        log.detected('DB: Spring JDBC');
    }

    if (has('spring-data-mongodb')) {
        scan.detectedLocalDB = 'MongoDB';
        log.detected('DB: MongoDB (Spring Data)');
    } else if (has('spring-data-redis') || has('jedis') || has('lettuce-core')) {
        scan.detectedLocalDB = 'Redis';
        log.detected('DB: Redis');
    }
}

function detectTesting(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    const parts: string[] = [];

    if (has('junit-jupiter') || has('junit-jupiter-api')) {
        parts.push('JUnit 5');
    } else if (has('junit<') || has('junit:junit')) {
        parts.push('JUnit 4');
    } else if (has('testng')) {
        parts.push('TestNG');
    }

    if (has('mockito-core') || has('mockito-junit-jupiter')) parts.push('Mockito');
    if (has('assertj-core')) parts.push('AssertJ');
    if (has('testcontainers')) parts.push('Testcontainers');
    if (has('wiremock') || has('WireMock')) parts.push('WireMock');
    if (has('archunit')) parts.push('ArchUnit');

    if (parts.length) {
        scan.detectedTestFramework = parts.join(' + ');
        log.detected(`Tests: ${scan.detectedTestFramework}`);
    }

    // Check if test directory exists
    scan.detectedHasTests = existsSync(join(projectDir, 'src/test/java'));
}

function detectLinterFormatter(
    projectDir: string, profile: BaseProfile, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    // Formatter
    if (has('spotless-maven-plugin') || has('spotless')) {
        scan.detectedFormatter = 'Spotless';
        profile.formatCmd = hasPom ? 'mvn spotless:apply' : './gradlew spotlessApply';
        profile.formatCmdFull = profile.formatCmd;
        log.detected('Formatter: Spotless');
    } else if (has('google-java-format')) {
        scan.detectedFormatter = 'Google Java Format';
        log.detected('Formatter: Google Java Format');
    }

    // Linter
    const linters: string[] = [];
    if (has('maven-checkstyle-plugin') || has('checkstyle')) {
        linters.push('Checkstyle');
        profile.analyzeCmd = hasPom ? 'mvn checkstyle:check' : './gradlew checkstyleMain';
    }
    if (has('spotbugs-maven-plugin') || has('spotbugs')) {
        linters.push('SpotBugs');
        if (!linters.includes('Checkstyle')) {
            profile.analyzeCmd = hasPom ? 'mvn spotbugs:check' : './gradlew spotbugsMain';
        }
    }
    if (has('maven-pmd-plugin') || has('pmd')) {
        linters.push('PMD');
    }
    if (has('error_prone') || has('error-prone')) {
        linters.push('Error Prone');
    }

    if (linters.length) {
        scan.detectedLinter = linters.join(' + ');
        log.detected(`Linter: ${scan.detectedLinter}`);
    }
}

function detectOSGi(
    projectDir: string, profile: BaseProfile, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('org\\.osgi') || has('org\\.apache\\.felix') || has('bnd-maven-plugin') || has('biz\\.aQute\\.bnd')) {
        scan.detectedOSGi = true;
        profile.layerFlow = 'Bundle UI → Bundle Service → Bundle API → OSGi Registry';
        profile.layerNames = ['Bundle UI', 'Bundle Service', 'Bundle API', 'OSGi Registry'];
        profile.layerUI = 'Bundle UI';
        profile.layerState = 'Bundle Service';
        profile.layerLogic = 'Bundle Service';
        profile.layerAdapter = 'Bundle API';
        profile.layerData = 'OSGi Registry';
        profile.diFramework = 'OSGi SCR';
        profile.statePattern = 'OSGi service registry + event listeners';
        profile.errorPattern = 'Bundle lifecycle exceptions + service tracker error handling';
        log.detected('OSGi: detected (Felix/Equinox/bnd)');
    }
}

function detectMultiModule(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    if (hasPom) {
        const pom = readPom(projectDir);
        const moduleMatch = pom.match(/<modules>([\s\S]*?)<\/modules>/);
        if (moduleMatch) {
            const modules = moduleMatch[1].match(/<module>/g);
            const count = modules?.length ?? 0;
            if (count > 1) {
                scan.detectedMultimodule = true;
                log.detected(`Multi-module: Maven (${count} modules)`);
            }
        }
    } else {
        const settingsFile = existsSync(join(projectDir, 'settings.gradle.kts'))
            ? join(projectDir, 'settings.gradle.kts')
            : join(projectDir, 'settings.gradle');
        if (existsSync(settingsFile)) {
            const content = readFileSafe(settingsFile);
            const includes = content.match(/include\s*\(/g);
            if (includes && includes.length >= 1) {
                scan.detectedMultimodule = true;
                log.detected(`Multi-module: Gradle (${includes.length} includes)`);
            }
        }
    }
}

function detectLogging(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    const loggers: string[] = [];
    if (has('slf4j-api') || has('slf4j')) loggers.push('SLF4J');
    if (has('logback-classic') || has('logback')) loggers.push('Logback');
    if (has('log4j-core') || has('log4j-api')) loggers.push('Log4j2');

    if (loggers.length) {
        scan.detectedLogger = loggers.join(' + ');
        log.detected(`Logging: ${scan.detectedLogger}`);
    }
}

function detectApiDocs(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('springdoc-openapi') || has('springfox')) {
        scan.detectedSwagger = true;
        scan.detectedSwaggerStyle = has('springdoc-openapi') ? 'springdoc' : 'springfox';
        log.detected(`API docs: ${scan.detectedSwaggerStyle}`);
    }
}

function detectCodegenLibs(
    projectDir: string, scan: ScanResult, hasPom: boolean
): void {
    const has = hasPom
        ? (p: string) => pomHas(projectDir, p)
        : (p: string) => gradleHas(projectDir, p);

    if (has('lombok')) {
        scan.detectedLombok = true;
        log.detected('Lombok: detected');
    }
    if (has('mapstruct')) {
        scan.detectedMapStruct = true;
        log.detected('MapStruct: detected');
    }
}

function addHighRiskFiles(projectDir: string, scan: ScanResult): void {
    if (fileExists(projectDir, 'pom.xml')) scan.highRiskFiles.push('pom.xml');
    if (fileExists(projectDir, 'build.gradle')) scan.highRiskFiles.push('build.gradle');
    if (fileExists(projectDir, 'build.gradle.kts')) scan.highRiskFiles.push('build.gradle.kts');

    // Spring config files
    const resourcesDir = join(projectDir, 'src/main/resources');
    if (fileExists(resourcesDir, 'application.properties')) scan.highRiskFiles.push('application.properties');
    if (fileExists(resourcesDir, 'application.yml')) scan.highRiskFiles.push('application.yml');
    if (fileExists(resourcesDir, 'application.yaml')) scan.highRiskFiles.push('application.yaml');

    // Module info
    if (existsSync(join(projectDir, 'src/main/java'))) {
        const moduleInfoFiles = findFilesRecursive(join(projectDir, 'src/main/java'), 2, f => f.endsWith('module-info.java'));
        if (moduleInfoFiles.length) scan.highRiskFiles.push('module-info.java');
    }
}
