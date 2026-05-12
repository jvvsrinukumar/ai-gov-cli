import type { FlutterContext } from '../prompts.js';

export function pubspecYaml(ctx: FlutterContext): string {
    return `name: ${ctx.appName}
description: ${ctx.displayName} Flutter project — clean architecture
publish_to: none
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_bloc: ^8.1.6
  equatable: ^2.0.5
  dio: ^5.4.3
  either_dart: ^1.0.0
  pretty_dio_logger: ^1.3.1
  get_it: ^7.7.0
  connectivity_plus: ^6.1.0
  go_router: ^14.2.0
  shared_preferences: ^2.3.2
  flutter_secure_storage: ^9.2.2
  logger: ^2.4.0
  intl: ^0.19.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0
  build_runner: ^2.4.12
  mocktail: ^1.0.4
  bloc_test: ^9.1.7
  integration_test:
    sdk: flutter

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
`;
}

export function analysisOptionsYaml(): string {
    return `include: package:flutter_lints/flutter.yaml
analyzer:
  exclude:
    - "**/*.g.dart"
    - "**/*.config.dart"
    - "bricks/**"
  errors:
    invalid_annotation_target: ignore
linter:
  rules:
    avoid_print: true
    prefer_single_quotes: true
    prefer_interpolation_to_compose_strings: true
    always_declare_return_types: true
    prefer_const_constructors: true
    prefer_const_declarations: true
    unawaited_futures: true
    cancel_subscriptions: true
    close_sinks: true
    always_use_package_imports: true
    avoid_dynamic_calls: true
`;
}

export function masonYaml(): string {
    return `bricks:
  clean_feature:
    path: bricks/clean_feature
  clean_form_feature:
    path: bricks/clean_form_feature
`;
}

export function gitignoreAdditions(): string {
    return '\n.env\n*.g.dart\n*.config.dart\ninjection.config.dart\n';
}
