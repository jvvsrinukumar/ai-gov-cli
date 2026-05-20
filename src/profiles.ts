import type { BaseProfile, Stack } from './types.js';

export function loadBaseProfile(stack: Stack): BaseProfile {
    const base: BaseProfile = {
        stackDisplay: '', fileExt: '', layerFlow: '', layerNames: [],
        layerUI: '', layerState: '', layerLogic: '', layerAdapter: '', layerData: '',
        formatCmd: '', formatCmdFull: '', analyzeCmd: '', analyzeCmdFile: '',
        testCmd: '', buildCmd: '', installCmd: '', cleanCmd: '', runCmd: '',
        codegenCmd: '', sourceDir: '', featuresDir: '', manifestFile: '',
        diFramework: '', stateFramework: '',
        namingClasses: 'PascalCase', namingMethods: 'camelCase',
        namingFiles: '', namingConstants: '', namingUISuffix: '', importStyle: '',
        statePattern: '', errorPattern: '', localStorageName: '',
        formatExtensions: '', analyzeFileLevel: false,
        pkgAddBlockPattern: '', rmBlockDirs: '',
        generatedExts: '', generatedPatterns: '', archSimple: false,
    };

    switch (stack) {
        case 'flutter': return { ...base, ...flutterProfile() };
        case 'kotlin': return { ...base, ...kotlinProfile() };
        case 'nodejs': return { ...base, ...nodejsProfile() };
        case 'react': return { ...base, ...reactProfile() };
        case 'next': return { ...base, ...reactProfile(), ...nextProfileOverrides() };
        case 'angular': return { ...base, ...angularProfile() };
        case 'swiftui': return { ...base, ...swiftuiProfile() };
        case 'python': return { ...base, ...pythonProfile() };
        case 'java': return { ...base, ...javaProfile() };
    }
}

function flutterProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Flutter', fileExt: '.dart',
        layerFlow: 'Widget → Cubit → UseCase → Repository → Service',
        layerNames: ['Widget', 'Cubit', 'UseCase', 'Repository', 'Service'],
        layerUI: 'Widget', layerState: 'Cubit', layerLogic: 'UseCase',
        layerAdapter: 'Repository', layerData: 'Service',
        formatCmd: 'dart format', formatCmdFull: 'dart format lib/',
        analyzeCmd: 'dart analyze', analyzeCmdFile: 'dart analyze',
        testCmd: 'flutter test', buildCmd: 'flutter build apk',
        installCmd: 'flutter pub get', cleanCmd: 'flutter clean', runCmd: 'flutter run',
        sourceDir: 'lib/features/', manifestFile: 'pubspec.yaml',
        diFramework: 'get_it', stateFramework: 'flutter_bloc / Cubit',
        namingFiles: 'snake_case', namingConstants: 'lowerCamelCase',
        namingUISuffix: 'Widget',
        importStyle: 'dart: → package: (external) → package:app/ → relative',
        statePattern: 'Sealed class: Initial | Loading | Success(data) | Error(failure)',
        errorPattern: 'ApiResult<T> sealed class (Success / Failure)',
        localStorageName: 'SharedPreferences',
        formatExtensions: '.dart', analyzeFileLevel: true,
        pkgAddBlockPattern: 'flutter\\s+pub\\s+add|fvm\\s+flutter\\s+pub\\s+add',
        rmBlockDirs: 'lib/ android/ ios/',
    };
}

function kotlinProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Kotlin (Android)', fileExt: '.kt',
        layerFlow: 'Screen → ViewModel → UseCase → Repository → DataSource',
        layerNames: ['Screen', 'ViewModel', 'UseCase', 'Repository', 'DataSource'],
        layerUI: 'Screen', layerState: 'ViewModel', layerLogic: 'UseCase',
        layerAdapter: 'Repository', layerData: 'DataSource',
        formatCmd: './gradlew lintFix', formatCmdFull: './gradlew lintFix',
        analyzeCmd: './gradlew lint', analyzeCmdFile: '',
        testCmd: './gradlew test', buildCmd: './gradlew assembleDebug',
        installCmd: './gradlew dependencies', cleanCmd: './gradlew clean',
        runCmd: './gradlew installDebug',
        sourceDir: 'app/src/main/kotlin/', manifestFile: 'build.gradle.kts',
        diFramework: 'Hilt', stateFramework: 'ViewModel + StateFlow',
        namingFiles: 'PascalCase', namingConstants: 'UPPER_SNAKE_CASE',
        namingUISuffix: 'Screen',
        importStyle: 'kotlin stdlib → third-party → project internal',
        statePattern: 'Sealed class: Idle | Loading | Success(data) | Error(message)',
        errorPattern: 'Result<T> sealed interface — AppException hierarchy',
        localStorageName: 'DataStore',
        formatExtensions: '.kt', analyzeFileLevel: false,
        rmBlockDirs: 'app/ gradle/',
        generatedExts: '.kt', generatedPatterns: '*.hilt.kt *.kapt.kt',
    };
}

function nodejsProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Node.js', fileExt: '.js',
        layerFlow: 'Route → Model', layerNames: ['Route', 'Model'],
        layerUI: 'Route', layerState: 'Model', layerLogic: 'Model',
        layerAdapter: 'Model', layerData: 'Model',
        testCmd: 'npm test', buildCmd: 'npm run build', installCmd: 'npm install',
        cleanCmd: 'rm -rf node_modules && npm install', runCmd: 'node src/app.js',
        sourceDir: 'src/', manifestFile: 'package.json',
        diFramework: 'N/A', stateFramework: 'N/A',
        namingFiles: 'camelCase', namingConstants: 'UPPER_SNAKE_CASE',
        namingUISuffix: 'Route',
        importStyle: 'node builtins → third-party → project local',
        statePattern: 'N/A (server-side)',
        errorPattern: 'try/catch + error middleware',
        localStorageName: 'Database',
        formatExtensions: '.js', analyzeFileLevel: true,
        pkgAddBlockPattern: 'npm\\s+install\\s+[^-]|yarn\\s+add|pnpm\\s+add',
        rmBlockDirs: 'src/',
        generatedExts: '.ts .js', generatedPatterns: '*.generated.ts *.generated.js',
    };
}

function reactProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'React', fileExt: '.tsx',
        layerFlow: 'Component → Hook → Service → API',
        layerNames: ['Component', 'Hook', 'Service', 'API'],
        layerUI: 'Component', layerState: 'Hook', layerLogic: 'Hook',
        layerAdapter: 'Service', layerData: 'API',
        formatCmd: 'npx prettier --write', formatCmdFull: 'npx prettier --write .',
        analyzeCmd: 'npx eslint .', analyzeCmdFile: 'npx eslint',
        testCmd: 'npx jest', buildCmd: 'npm run build',
        installCmd: 'npm install',
        cleanCmd: 'rm -rf .next node_modules && npm install', runCmd: 'npm run dev',
        sourceDir: 'src/', manifestFile: 'package.json',
        diFramework: 'N/A', stateFramework: 'React hooks',
        namingFiles: 'PascalCase (components), camelCase (hooks/utils)',
        namingConstants: 'UPPER_SNAKE_CASE', namingUISuffix: 'Page',
        importStyle: 'react → third-party → @/ aliases → relative',
        statePattern: 'useState/useReducer with typed state',
        errorPattern: 'ErrorBoundary for UI errors; try/catch in service functions; typed error responses from API client',
        localStorageName: 'LocalStorage',
        formatExtensions: '.ts .tsx .js .jsx', analyzeFileLevel: false,
        pkgAddBlockPattern: 'npm\\s+install\\s+[^-]|yarn\\s+add|pnpm\\s+add',
        rmBlockDirs: 'src/ public/',
        generatedExts: '.tsx .ts', generatedPatterns: '*.generated.tsx *.generated.ts',
    };
}

function angularProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Angular', fileExt: '.ts',
        layerFlow: 'Component → Service → DataSource',
        layerNames: ['Component', 'Service', 'DataSource'],
        layerUI: 'Component', layerState: 'Service', layerLogic: 'Service',
        layerAdapter: 'Service', layerData: 'DataSource',
        formatCmd: 'npx prettier --write',
        formatCmdFull: "npx prettier --write 'src/**/*.ts'",
        analyzeCmd: 'npx ng lint', analyzeCmdFile: 'npx ng lint',
        testCmd: 'npx ng test --watch=false', buildCmd: 'npx ng build',
        installCmd: 'npm install',
        cleanCmd: 'rm -rf dist node_modules && npm install', runCmd: 'npx ng serve',
        sourceDir: 'src/app/', manifestFile: 'package.json',
        diFramework: 'Angular DI', stateFramework: 'RxJS BehaviorSubjects',
        namingFiles: 'kebab-case', namingConstants: 'UPPER_SNAKE_CASE',
        namingUISuffix: 'Component',
        importStyle: '@angular/ → third-party → @app/ → relative',
        statePattern: 'BehaviorSubject<T> in services',
        errorPattern: 'GlobalErrorHandler + errorInterceptor',
        localStorageName: 'LocalStorage',
        formatExtensions: '.ts .html .scss', analyzeFileLevel: false,
        pkgAddBlockPattern: 'npm\\s+install\\s+[^-]|yarn\\s+add|pnpm\\s+add|ng\\s+add',
        rmBlockDirs: 'src/ dist/', archSimple: true,
        generatedExts: '.ts', generatedPatterns: '*.generated.ts',
    };
}

function swiftuiProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'SwiftUI', fileExt: '.swift',
        layerFlow: 'View → ViewModel → UseCase → Repository → DataSource',
        layerNames: ['View', 'ViewModel', 'UseCase', 'Repository', 'DataSource'],
        layerUI: 'View', layerState: 'ViewModel', layerLogic: 'UseCase',
        layerAdapter: 'Repository', layerData: 'DataSource',
        formatCmd: 'swiftformat', formatCmdFull: 'swiftformat Sources/',
        analyzeCmd: 'swiftlint', analyzeCmdFile: 'swiftlint',
        testCmd: 'swift test', buildCmd: 'swift build',
        installCmd: 'swift package resolve', cleanCmd: 'swift package clean',
        runCmd: 'swift run',
        sourceDir: 'Sources/', manifestFile: 'Package.swift',
        diFramework: 'Resolver', stateFramework: 'Combine / @Observable',
        namingFiles: 'PascalCase', namingConstants: 'camelCase',
        namingUISuffix: 'View',
        importStyle: 'Foundation/SwiftUI → third-party → project internal',
        statePattern: '@Observable ViewModel — enum ViewState<T>',
        errorPattern: 'Result<T, AppError> — AppError enum hierarchy',
        localStorageName: 'UserDefaults',
        formatExtensions: '.swift', analyzeFileLevel: true,
        pkgAddBlockPattern: 'swift\\s+package\\s+add',
        rmBlockDirs: 'Sources/ Tests/',
        generatedExts: '.swift', generatedPatterns: '*.generated.swift',
    };
}

function pythonProfile(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Python (FastAPI)', fileExt: '.py',
        layerFlow: 'Router → Service → Model → DB',
        layerNames: ['Router', 'Service', 'Model', 'DB'],
        layerUI: 'Router', layerState: 'Service', layerLogic: 'Service',
        layerAdapter: 'Model', layerData: 'DB',
        formatCmd: 'ruff format', formatCmdFull: 'ruff format app/ tests/',
        analyzeCmd: 'ruff check app/', analyzeCmdFile: 'ruff check',
        testCmd: 'pytest',
        buildCmd: 'docker build -f docker/Dockerfile -t app .',
        installCmd: "pip install -e '.[dev]'",
        cleanCmd: 'find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; rm -rf .pytest_cache',
        runCmd: 'uvicorn app.main:app --reload',
        sourceDir: 'app/', featuresDir: 'app/api/',
        manifestFile: 'pyproject.toml',
        diFramework: 'FastAPI Depends()', stateFramework: 'N/A',
        namingMethods: 'snake_case', namingFiles: 'snake_case',
        namingConstants: 'UPPER_SNAKE_CASE', namingUISuffix: 'Router',
        importStyle: 'stdlib → third-party → app.core → app.models → app.services → relative',
        statePattern: 'N/A (server-side — stateless request/response)',
        errorPattern: 'AppError hierarchy (NotFoundError, ForbiddenError, ValidationError) + global exception handlers',
        localStorageName: 'PostgreSQL / Redis',
        formatExtensions: '.py', analyzeFileLevel: true,
        pkgAddBlockPattern: 'pip\\s+install\\s+[^-]|poetry\\s+add|uv\\s+add',
        rmBlockDirs: 'app/ tests/ alembic/',
        generatedExts: '.py', generatedPatterns: '*_pb2.py *_pb2_grpc.py',
    };
}

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

function nextProfileOverrides(): Partial<BaseProfile> {
    return {
        stackDisplay: 'Next.js',
        buildCmd: 'npm run build',
        runCmd: 'npm run dev',
    };
}
