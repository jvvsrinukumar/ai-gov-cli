import { execSync } from 'node:child_process';
import type { StackAdapter, ScaffoldContext } from '../adapter.js';
import type { ScanResult } from '../../types.js';
import { registerAdapter } from '../registry.js';
import { collectReactPrompts, validateReactName, type ReactContext } from './prompts.js';
import { scaffoldReact } from './scaffold.js';

export class ReactAdapter implements StackAdapter {
    readonly id = 'react' as const;
    readonly displayName = 'React (Vite SPA)';
    readonly nameHint = 'kebab-case (e.g. my-app)';

    validateName(name: string): string | true {
        return validateReactName(name);
    }

    async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> {
        return collectReactPrompts({
            ...base,
            projectDir: `${base.outputDir}/${base.appName}`,
        });
    }

    async scaffold(ctx: ScaffoldContext): Promise<void> {
        await scaffoldReact(ctx as ReactContext);
    }

    scanHints(ctx: ScaffoldContext): Partial<ScanResult> {
        const react = ctx as ReactContext;

        const cssLabel: Record<string, string> = { tailwind: 'Tailwind CSS' };
        const stateLabel: Record<string, string> = {
            zustand: 'Zustand',
            'redux-toolkit': 'Redux Toolkit',
        };
        const serverStateLabel: Record<string, string> = {
            'tanstack-query': 'TanStack Query',
            swr: 'SWR',
        };

        return {
            detectedSSR: false,
            detectedBuildTool: 'vite',
            detectedCSSApproach: cssLabel[react.styling] ?? react.styling,
            detectedState: stateLabel[react.clientState] ?? '',
            detectedHTTPClient: serverStateLabel[react.serverState] ?? '',
            detectedTestFramework: 'Vitest',
            detectedRouter: 'React Router v7',
            detectedPackageManager: react.packageManager,
            detectedLinter: 'eslint',
            detectedHasLinterConfig: true,
        };
    }

    async postSetup(ctx: ScaffoldContext): Promise<void> {
        const react = ctx as ReactContext;
        const dir = ctx.projectDir as string;

        const run = (cmd: string): void => {
            try {
                execSync(cmd, { cwd: dir, stdio: 'inherit' });
            } catch (err) {
                throw new Error(`postSetup failed at: ${cmd}\n${String(err)}`);
            }
        };

        run('git init');

        const installCmd: Record<string, string> = {
            npm: 'npm install',
            yarn: 'yarn install',
            pnpm: 'pnpm install',
            bun: 'bun install',
        };
        run(installCmd[react.packageManager]);

        run('git add -A');
        run('git commit -m "chore: initial project scaffold"');
    }
}

registerAdapter(new ReactAdapter());
