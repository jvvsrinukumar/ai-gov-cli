import { execSync } from 'node:child_process';
import type { StackAdapter, ScaffoldContext } from '../adapter.js';
import type { ScanResult } from '../../types.js';
import { registerAdapter } from '../registry.js';
import { collectFlutterPrompts, validateFlutterName, type FlutterContext } from './prompts.js';
import { scaffoldFlutter } from './scaffold.js';

export class FlutterAdapter implements StackAdapter {
    readonly id = 'flutter' as const;
    readonly displayName = 'Flutter';
    readonly nameHint = 'snake_case (e.g. my_app)';

    validateName(name: string): string | true {
        return validateFlutterName(name);
    }

    async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> {
        return collectFlutterPrompts({
            ...base,
            projectDir: `${base.outputDir}/${base.appName}`,
        });
    }

    async scaffold(ctx: ScaffoldContext): Promise<void> {
        await scaffoldFlutter(ctx as FlutterContext);
    }

    scanHints(_ctx: ScaffoldContext): Partial<ScanResult> {
        return {
            detectedState: 'BLoC',
            detectedDI: 'GetIt',
            detectedNetwork: 'Dio',
            detectedRouter: 'go_router',
            detectedPackageManager: 'pub',
            detectedMason: true,
            detectedFVM: true,
            scaffoldTool: 'Mason',
            scaffoldCmdFeature: 'mason make clean_feature',
            detectedTestFramework: 'flutter_test',
            detectedHasTests: true,
            detectedLinter: 'flutter_lints',
            detectedHasLinterConfig: true,
            detectedFormatter: 'dart format',
            detectedHasFormatterConfig: true,
        };
    }

    async postSetup(ctx: ScaffoldContext): Promise<void> {
        const dir = ctx.projectDir as string;
        const flutter = ctx as FlutterContext;

        const run = (cmd: string, warn?: string): void => {
            try {
                execSync(cmd, { cwd: dir, stdio: 'inherit' });
            } catch (err) {
                const msg = warn ?? `Command failed: ${cmd}`;
                console.warn(`⚠  ${msg} — continuing.`);
                if (process.env['AI_GOV_DEBUG']) console.warn(err);
            }
        };

        // git init (idempotent — safe to run inside an existing repo)
        run('git init');

        // fvm use --force (warn-and-continue so non-FVM setups still work)
        run(
            `fvm use ${flutter.flutterVersion} --force`,
            `FVM not available or version ${flutter.flutterVersion} not installed — skipping fvm use`,
        );

        // fvm flutter pub get (warn-and-continue; requires network + valid pubspec)
        run(
            'fvm flutter pub get',
            'fvm flutter pub get failed — run manually after resolving dependencies',
        );

        // Stage and commit everything
        run('git add -A');
        run('git commit -m "chore: initial project scaffold"');
    }
}

registerAdapter(new FlutterAdapter());
