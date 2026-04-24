export type Stack = 'flutter' | 'kotlin' | 'nodejs' | 'react' | 'angular' | 'swiftui' | 'python';

export interface BaseProfile {
    stackDisplay: string;
    fileExt: string;
    layerFlow: string;
    layerNames: string[];
    layerUI: string;
    layerState: string;
    layerLogic: string;
    layerAdapter: string;
    layerData: string;
    formatCmd: string;
    formatCmdFull: string;
    analyzeCmd: string;
    analyzeCmdFile: string;
    testCmd: string;
    buildCmd: string;
    installCmd: string;
    cleanCmd: string;
    runCmd: string;
    codegenCmd: string;
    sourceDir: string;
    featuresDir: string;
    manifestFile: string;
    diFramework: string;
    stateFramework: string;
    namingClasses: string;
    namingMethods: string;
    namingFiles: string;
    namingConstants: string;
    namingUISuffix: string;
    importStyle: string;
    statePattern: string;
    errorPattern: string;
    localStorageName: string;
    formatExtensions: string;
    analyzeFileLevel: boolean;
    pkgAddBlockPattern: string;
    rmBlockDirs: string;
    generatedExts: string;
    generatedPatterns: string;
    archSimple: boolean;
}

export interface ScanResult {
    detectedState: string;
    detectedDI: string;
    detectedNetwork: string;
    detectedRouter: string;
    detectedORM: string;
    detectedLocalDB: string;
    detectedTestFramework: string;
    detectedLinter: string;
    detectedFormatter: string;
    detectedPackageManager: string;
    detectedI18N: string;
    detectedCodegen: boolean;
    detectedCodegenCmd: string;
    detectedFlavors: string;
    detectedUISystem: string;
    detectedSubtype: string;
    detectedAuth: string;
    detectedSwagger: boolean;
    detectedSwaggerStyle: string;
    detectedMicroservices: boolean;
    detectedAPIType: string;
    detectedQueue: string;
    detectedValidator: boolean;
    detectedCSSApproach: string;
    detectedBuildTool: string;
    detectedSSR: boolean;
    detectedHTTPClient: string;
    detectedMonorepo: string;
    detectedArchPattern: string;
    detectedServiceStyle: string;
    detectedHasTests: boolean;
    detectedFormLib: string;
    detectedNextRouter: string;
    detectedRSC: boolean;
    detectedUILibs: string;
    detectedAngularVersion: string;
    detectedAngularSignalState: boolean;
    detectedFirebase: string;
    detectedWorkmanager: boolean;
    detectedSDKVersions: string;
    detectedMultimodule: boolean;
    detectedTCA: boolean;
    detectedSwiftAsync: boolean;
    detectedNetworkSwift: string;
    detectedLocalDBSwift: string;
    detectedDepManagerSwift: string;
    detectedSwiftMinIOS: string;
    detectedMainActor: boolean;
    detectedMason: boolean;
    detectedFVM: boolean;
    // Node.js specific
    detectedLang: string;
    detectedModuleSystem: string;
    detectedNodeVersion: string;
    detectedDBDriver: string;
    detectedCloudProvider: string;
    detectedCloudServices: string;
    detectedRealtime: string;
    detectedScheduler: string;
    detectedUpload: string;
    detectedMedia: string;
    detectedEmail: string;
    detectedTemplateEngine: string;
    detectedLogger: string;
    detectedSecurityMiddleware: string;
    detectedValidationLib: string;
    detectedInfra: string;
    detectedHasLinterConfig: boolean;
    detectedHasFormatterConfig: boolean;
    detectedDotenv: boolean;
    // Computed
    highRiskFiles: string[];
    mixedArch: boolean;
    mixedArchNote: string;
    scaffoldTool: string;
    scaffoldCmdFeature: string;
}

export interface ProjectInfo {
    packageName: string;
    appName: string;
    appDescription: string;
    ticketSystem: string;
    ticketPrefix: string;
    legacyDescription: string;
}

export interface ContentBlocks {
    keyPackages: string;
    highRiskDisplay: string;
    hardRules: string;
    layerResps: string;
    diText: string;
    typeNaming: string;
    testLayerList: string;
    testLayers: string;
    designFiles: string;
    designLayerTable: string;
    hardRulesCompliance: string;
    taskDataPhase: string;
    taskLogicPhase: string;
    taskStatePhase: string;
    taskUIPhase: string;
    taskTestPhase: string;
    layerExecOrder: string;
}

export interface GovernanceConfig {
    stack: Stack;
    profile: BaseProfile;
    scan: ScanResult;
    project: ProjectInfo;
    blocks: ContentBlocks;
    isBackend: boolean;
    hookVersion: string;
    projectDir: string;
    specFirstEnabled: boolean;
    overwrite: boolean;
    dryRun: boolean;
    updateHooks: boolean;
}

export function createDefaultScanResult(): ScanResult {
    return {
        detectedState: '', detectedDI: '', detectedNetwork: '', detectedRouter: '',
        detectedORM: '', detectedLocalDB: '', detectedTestFramework: '',
        detectedLinter: '', detectedFormatter: '', detectedPackageManager: '',
        detectedI18N: '', detectedCodegen: false, detectedCodegenCmd: '',
        detectedFlavors: '', detectedUISystem: '', detectedSubtype: '',
        detectedAuth: '', detectedSwagger: false, detectedSwaggerStyle: '',
        detectedMicroservices: false,
        detectedAPIType: 'REST', detectedQueue: '', detectedValidator: false,
        detectedCSSApproach: '', detectedBuildTool: '', detectedSSR: false,
        detectedHTTPClient: '', detectedMonorepo: '', detectedArchPattern: '',
        detectedServiceStyle: 'class', detectedHasTests: true,
        detectedFormLib: '', detectedNextRouter: '', detectedRSC: false,
        detectedUILibs: '', detectedAngularVersion: '',
        detectedAngularSignalState: false, detectedFirebase: '',
        detectedWorkmanager: false, detectedSDKVersions: '',
        detectedMultimodule: false, detectedTCA: false, detectedSwiftAsync: false,
        detectedNetworkSwift: '', detectedLocalDBSwift: '',
        detectedDepManagerSwift: '', detectedSwiftMinIOS: '',
        detectedMainActor: false, detectedMason: false, detectedFVM: false,
        detectedLang: '', detectedModuleSystem: '', detectedNodeVersion: '',
        detectedDBDriver: '', detectedCloudProvider: '', detectedCloudServices: '',
        detectedRealtime: '', detectedScheduler: '', detectedUpload: '',
        detectedMedia: '', detectedEmail: '', detectedTemplateEngine: '',
        detectedLogger: '', detectedSecurityMiddleware: '',
        detectedValidationLib: '', detectedInfra: '',
        detectedHasLinterConfig: false, detectedHasFormatterConfig: false,
        detectedDotenv: false,
        highRiskFiles: [], mixedArch: false, mixedArchNote: '',
        scaffoldTool: '', scaffoldCmdFeature: '',
    };
}
