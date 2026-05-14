const ENVS = ['local', 'dev', 'qa', 'staging', 'prod'] as const;

/** Escape backslashes and single quotes for use inside a single-quoted string literal in generated code. */
function escSQ(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function mainDart(appName: string, displayName: string): string {
    const pkg = `package:${appName}`;
    const title = escSQ(displayName);
    return `import 'package:flutter/material.dart';
import '${pkg}/core/di/injection.dart';
import '${pkg}/core/router/app_router.dart';
import '${pkg}/core/connectivity/connectivity_cubit.dart';
import '${pkg}/core/theme/app_theme.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await configureDependencies();
  runApp(const App());
}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => sl<ConnectivityCubit>(),
      child: BlocListener<ConnectivityCubit, ConnectivityState>(
        listener: (ctx, state) {
          if (state is ConnectivityOffline) {
            ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
              content: Text('No internet connection'),
              backgroundColor: Colors.red,
              duration: Duration(days: 365),
            ));
          } else if (state is ConnectivityOnline) {
            ScaffoldMessenger.of(ctx).hideCurrentSnackBar();
          }
        },
        child: MaterialApp.router(
          title: '${title}',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          routerConfig: AppRouter.router,
        ),
      ),
    );
  }
}
`;
}

export function testHelpersDart(): string {
    return `import 'package:get_it/get_it.dart';

void setupTestLocator(void Function(GetIt sl) register) {
  GetIt.instance.reset();
  register(GetIt.instance);
}

void tearDownLocator() => GetIt.instance.reset();
`;
}

export function widgetTestHelperDart(): string {
    return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

Widget testableWidget({
  required Widget child,
  List<BlocProvider> providers = const [],
}) {
  Widget wrapped = MaterialApp(home: child);
  if (providers.isNotEmpty) {
    wrapped = MultiBlocProvider(providers: providers, child: wrapped);
  }
  return wrapped;
}
`;
}

export function archTestDart(): string {
    return `import 'dart:io';
import 'package:test/test.dart';

List<File> dartFiles(String dir) {
  final d = Directory(dir);
  if (!d.existsSync()) return [];
  return d
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();
}

List<String> lines(File f) => f.readAsLinesSync();

bool imports(File f, String pattern) => lines(f).any((l) {
      final t = l.trim();
      if (t.startsWith('//')) return false;
      return t.startsWith('import') && t.contains(pattern);
    });

List<String> get features {
  final d = Directory('lib/features');
  if (!d.existsSync()) return [];
  return d
      .listSync()
      .whereType<Directory>()
      .map((d) => d.path.split('/').last)
      .toList();
}

void main() {
  group('Rule 1 — domain must not import data/', () {
    for (final f in features) {
      for (final file in dartFiles('lib/features/$f/domain')) {
        test(file.path, () => expect(imports(file, '/data/'), isFalse,
            reason: '\${file.path} domain imports data/'));
      }
    }
  });

  group('Rule 2 — domain must not import presentation/', () {
    for (final f in features) {
      for (final file in dartFiles('lib/features/$f/domain')) {
        test(file.path, () => expect(imports(file, '/presentation/'), isFalse));
      }
    }
  });

  group('Rule 3 — domain must be pure Dart', () {
    for (final f in features) {
      for (final file in dartFiles('lib/features/$f/domain')) {
        test(file.path, () {
          final bad = lines(file).where((l) {
            final t = l.trim();
            if (t.startsWith('//')) return false;
            return t.startsWith('import') &&
                (t.contains("'package:flutter/") || t.contains("'package:dio/"));
          }).toList();
          expect(bad, isEmpty, reason: '\${file.path} domain imports flutter/dio');
        });
      }
    }
  });

  group('Rule 4 — presentation must not import data/', () {
    for (final f in features) {
      for (final file in dartFiles('lib/features/$f/presentation')) {
        test(file.path, () => expect(imports(file, '/data/'), isFalse));
      }
    }
  });

  group('Rule 5 — features must not cross-import', () {
    final fs = features;
    for (final f in fs) {
      for (final other in fs) {
        if (other == f) continue;
        for (final file in dartFiles('lib/features/$f')) {
          test('$f does not import $other', () =>
              expect(imports(file, '/features/$other/'), isFalse));
        }
      }
    }
  });

  group('Rule 6 — no print() in lib/', () {
    for (final file in dartFiles('lib')) {
      test(file.path, () {
        final bad = lines(file).where((l) {
          final t = l.trim();
          if (t.startsWith('//')) return false;
          return RegExp(r'(?<!debug)print\\(').hasMatch(t);
        }).toList();
        expect(bad, isEmpty, reason: '\${file.path} uses print()');
      });
    }
  });

  group('Rule 7 — cubits must not use BuildContext', () {
    for (final f in features) {
      for (final file
          in dartFiles('lib/features/$f/presentation/cubit')) {
        test(file.path, () {
          final bad = lines(file)
              .where((l) => !l.trim().startsWith('//') && l.contains('BuildContext'))
              .toList();
          expect(bad, isEmpty);
        });
      }
    }
  });

  group('Rule 8 — no Dio() in features', () {
    for (final f in features) {
      for (final file in dartFiles('lib/features/$f')) {
        test(file.path, () {
          final bad = lines(file)
              .where((l) => !l.trim().startsWith('//') && RegExp(r'\\bDio\\(\\)').hasMatch(l))
              .toList();
          expect(bad, isEmpty);
        });
      }
    }
  });
}
`;
}

export function integrationTestDart(): string {
    return `import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('App launch', () {
    testWidgets('placeholder — uncomment after wiring main()', (tester) async {
      // import 'package:YOUR_APP/main.dart' as app;
      // app.main();
      // await tester.pumpAndSettle();
      // expect(find.text('Ready'), findsOneWidget);
      expect(true, isTrue);
    });
  });
}
`;
}

export function vscodeLaunchJson(): string {
    const configs = ENVS.map(env => `    {
      "name": "Run (${env})",
      "request": "launch",
      "type": "dart",
      "args": ["--dart-define=ENV=${env}"]
    }`).join(',\n');

    return `{
  "version": "0.2.0",
  "configurations": [
${configs}
  ]
}
`;
}

export function githubCiYml(): string {
    return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    name: Analyze + Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Read FVM version
        id: fvm
        run: |
          if command -v python3 &>/dev/null; then
            echo "version=$(python3 -c "import json; print(json.load(open('.fvmrc'))['flutter'])")" >> $GITHUB_OUTPUT
          else
            echo "version=$(grep -oP '"flutter"\\s*:\\s*"\\K[^"]+' .fvmrc)" >> $GITHUB_OUTPUT
          fi

      - uses: subosito/flutter-action@v2
        with:
          flutter-version: \${{ steps.fvm.outputs.version }}
          channel: stable
          cache: true

      - run: flutter pub get
      - run: flutter analyze --no-fatal-infos
      - run: flutter test test/architecture/arch_test.dart --no-pub
      - run: flutter test --no-pub
`;
}
