import type { FlutterContext } from '../prompts.js';
import { toCamel, endpointConstName } from '../helpers.js';

const ENVS = ['local', 'dev', 'qa', 'staging', 'prod'] as const;

export function appEnvDart(): string {
    return 'enum AppEnv { local, dev, qa, staging, prod }\n';
}

export function appConfigDart(ctx: FlutterContext): string {
    const pkg = `package:${ctx.appName}`;
    const lines: string[] = [
        `import 'package:flutter/foundation.dart';`,
        `import '${pkg}/core/config/app_env.dart';`,
        '',
        'class AppConfig {',
        '  AppConfig._();',
        '',
        "  static const _envStr = String.fromEnvironment('ENV', defaultValue: 'dev');",
        '  static AppEnv get env => AppEnv.values.firstWhere(',
        "    (e) => e.name == _envStr, orElse: () => AppEnv.dev);",
        '',
        '  static bool get isProduction => env == AppEnv.prod;',
        '  static bool get enableLogging => env != AppEnv.prod;',
        '',
    ];

    for (const svc of ctx.services) {
        const getter = `${toCamel(svc.name)}BaseUrl`;
        lines.push(`  static String get ${getter} => _urls[env]!['${svc.name}']!;`);
    }

    lines.push('');
    lines.push('  static const _urls = {');
    for (const env of ENVS) {
        lines.push(`    AppEnv.${env}: {`);
        for (const svc of ctx.services) {
            lines.push(`      '${svc.name}': '${svc.urls[env]}',`);
        }
        lines.push('    },');
    }
    lines.push('  };');
    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

export function apiEndpointsDart(ctx: FlutterContext): string {
    const lines: string[] = [
        '/// Centralised endpoint paths grouped by service.',
        '/// Never use raw strings in service classes.',
        'class ApiEndpoints {',
        '  ApiEndpoints._();',
        '',
    ];

    const usedNames = new Set<string>();

    for (const svc of ctx.services) {
        lines.push(`  // ── ${svc.name} ──`);
        if (svc.endpoints.length > 0) {
            for (const ep of svc.endpoints) {
                const constName = endpointConstName(ep.method, ep.path, usedNames, svc.name);
                lines.push(`  static const ${constName} = '${ep.path}';`);
            }
        } else {
            lines.push(`  // TODO: add ${svc.name} endpoints`);
        }
        lines.push('');
    }

    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

export function serviceHeadersDart(ctx: FlutterContext): string {
    const lines: string[] = [
        '/// Per-service custom headers.',
        '/// Static headers set at build time.',
        '/// For dynamic headers (tokens, session IDs), override in AppInterceptors.',
        'class ServiceHeaders {',
        '  ServiceHeaders._();',
        '',
    ];

    for (const svc of ctx.services) {
        const method = toCamel(svc.name);
        lines.push(`  static Map<String, String> get ${method} => {`);
        if (svc.headers) {
            for (const pair of svc.headers.split(',')) {
                const idx = pair.indexOf(':');
                if (idx !== -1) {
                    const k = pair.slice(0, idx).trim();
                    const v = pair.slice(idx + 1).trim();
                    lines.push(`    '${k}': '${v}',`);
                }
            }
        }
        lines.push('  };');
        lines.push('');
    }

    lines.push('}');
    lines.push('');

    return lines.join('\n');
}

export function appRoutesDart(): string {
    return `/// Single source of truth for all route paths.
/// Never use raw strings in context.push() / context.go()
class AppRoutes {
  AppRoutes._();

  static const home     = '/';
  static const login    = '/login';
  static const register = '/register';

  // Parameterised helpers
  static String userProfile(String id) => '/user-profile/$id';
  static String orderDetail(String id)  => '/orders/$id';
}
`;
}

export function appRouterDart(appName: string): string {
    const pkg = `package:${appName}`;
    return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '${pkg}/core/router/app_routes.dart';

class AppRouter {
  static final router = GoRouter(
    initialLocation: AppRoutes.home,
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: AppRoutes.home,
        builder: (_, __) => const Scaffold(
          body: Center(
            child: Text('Ready — run: mason make clean_feature'),
          ),
        ),
      ),
    ],
  );
}
`;
}
