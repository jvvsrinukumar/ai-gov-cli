import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { FlutterContext } from './prompts.js';
import { pubspecYaml, analysisOptionsYaml, masonYaml, gitignoreAdditions } from './templates/pubspec.js';
import { appEnvDart, appConfigDart, apiEndpointsDart, serviceHeadersDart, appRoutesDart, appRouterDart } from './templates/dart-core.js';
import { dioFactoryDart, appInterceptorsDart, dioClientDart, apiRequestServiceDart } from './templates/dart-network.js';
import { serverErrorDart, apiResponseModelDart, apiRequestModelDart } from './templates/dart-framework.js';
import { appThemeDart, appStringsDart, appLoggerDart, screenSecurityDart, secureScreenMixinDart, iosBackgroundBlurDart } from './templates/dart-utils.js';
import { connectivityStateDart, connectivityCubitDart } from './templates/dart-connectivity.js';
import { injectionDart, paginationStateDart, paginationCubitDart, featureFlagServiceDart, analyticsServiceDart } from './templates/dart-di.js';
import { mainDart, testHelpersDart, widgetTestHelperDart, archTestDart, integrationTestDart, vscodeLaunchJson, githubCiYml } from './templates/dart-main.js';
import { brickFiles } from './templates/dart-bricks.js';

const EXTRA_DIRS = [
    'lib/core/config',
    'lib/core/di',
    'lib/core/framework',
    'lib/core/network',
    'lib/core/connectivity',
    'lib/core/router',
    'lib/core/theme',
    'lib/core/logger',
    'lib/core/utils',
    'lib/core/pagination',
    'lib/core/services',
    'lib/features',
    'assets/images',
    'assets/icons',
    'assets/fonts',
    'bricks/clean_feature/__brick__',
    'bricks/clean_form_feature/__brick__',
    'test/architecture',
    'test/core/connectivity',
    'test/core/network',
    'test/core/pagination',
    'test/helpers',
    'integration_test',
    '.github/workflows',
    '.vscode',
];

function runCmd(cmd: string, cwd: string): void {
    execSync(cmd, { cwd, stdio: 'inherit' });
}

export async function scaffoldFlutter(ctx: FlutterContext): Promise<void> {
    const { appName, outputDir, projectDir, androidPackageId } = ctx;

    // org = everything before the last dot-segment (e.g. com.techvedika.myapp → com.techvedika)
    const orgParts = androidPackageId.split('.');
    const org = orgParts.length > 1 ? orgParts.slice(0, -1).join('.') : androidPackageId;

    // 1. flutter create (fvm preferred, plain flutter as fallback)
    const createArgs = `create --org ${org} --project-name ${appName} --platforms android,ios ${appName}`;
    let created = false;
    for (const bin of ['fvm flutter', 'flutter']) {
        try {
            runCmd(`${bin} ${createArgs}`, outputDir);
            created = true;
            break;
        } catch {
            // try next
        }
    }
    if (!created) {
        throw new Error(
            'Flutter project creation failed.\n' +
            'Ensure Flutter SDK (or FVM) is installed and on your PATH, then retry.',
        );
    }

    // 2. Remove default test file
    const defaultTest = path.join(projectDir, 'test', 'widget_test.dart');
    if (fs.existsSync(defaultTest)) fs.rmSync(defaultTest);

    // 3. Create additional directory structure
    for (const dir of EXTRA_DIRS) {
        fs.mkdirSync(path.join(projectDir, dir), { recursive: true });
    }

    // Helper
    const write = (rel: string, content: string): void => {
        const abs = path.join(projectDir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
    };

    // 4. Write all generated files
    write('pubspec.yaml', pubspecYaml(ctx));
    write('analysis_options.yaml', analysisOptionsYaml());
    write('mason.yaml', masonYaml());

    // Append governance additions to .gitignore (preserves existing content)
    fs.appendFileSync(path.join(projectDir, '.gitignore'), gitignoreAdditions(), 'utf8');

    // Config
    write('lib/core/config/app_env.dart', appEnvDart());
    write('lib/core/config/app_config.dart', appConfigDart(ctx));
    write('lib/core/config/api_endpoints.dart', apiEndpointsDart(ctx));
    write('lib/core/config/service_headers.dart', serviceHeadersDart(ctx));

    // Router
    write('lib/core/router/app_routes.dart', appRoutesDart());
    write('lib/core/router/app_router.dart', appRouterDart(appName));

    // Network
    write('lib/core/network/dio_factory.dart', dioFactoryDart(appName));
    write('lib/core/network/app_interceptors.dart', appInterceptorsDart(appName));
    write('lib/core/network/dio_client.dart', dioClientDart(ctx));
    write('lib/core/network/api_request_service.dart', apiRequestServiceDart(appName));

    // Framework
    write('lib/core/framework/server_error.dart', serverErrorDart());
    write('lib/core/framework/api_response_model.dart', apiResponseModelDart());
    write('lib/core/framework/api_request_model.dart', apiRequestModelDart());

    // Theme, utils, logger
    write('lib/core/theme/app_theme.dart', appThemeDart());
    write('lib/core/utils/app_strings.dart', appStringsDart());
    write('lib/core/logger/app_logger.dart', appLoggerDart());
    write('lib/core/utils/screen_security.dart', screenSecurityDart(appName, androidPackageId));
    write('lib/core/utils/secure_screen_mixin.dart', secureScreenMixinDart(appName));
    write('lib/core/utils/ios_background_blur.dart', iosBackgroundBlurDart());

    // Connectivity
    write('lib/core/connectivity/connectivity_state.dart', connectivityStateDart());
    write('lib/core/connectivity/connectivity_cubit.dart', connectivityCubitDart(appName));

    // DI + pagination + services
    write('lib/core/di/injection.dart', injectionDart(ctx));
    write('lib/core/pagination/pagination_state.dart', paginationStateDart());
    write('lib/core/pagination/pagination_cubit.dart', paginationCubitDart(appName));
    write('lib/core/services/feature_flag_service.dart', featureFlagServiceDart());
    write('lib/core/services/analytics_service.dart', analyticsServiceDart());

    // Main entry point
    write('lib/main.dart', mainDart(appName, ctx.displayName));

    // Tests
    write('test/helpers/test_helpers.dart', testHelpersDart());
    write('test/helpers/widget_test_helper.dart', widgetTestHelperDart());
    write('test/architecture/arch_test.dart', archTestDart());
    write('integration_test/app_test.dart', integrationTestDart());

    // IDE + CI
    write('.vscode/launch.json', vscodeLaunchJson());
    if (ctx.ci === 'github') {
        write('.github/workflows/ci.yml', githubCiYml());
    }

    // Mason bricks
    for (const [relPath, content] of Object.entries(brickFiles())) {
        write(relPath, content);
    }
}
