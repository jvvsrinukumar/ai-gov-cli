import { execSync } from 'node:child_process';
import type { StackAdapter, ScaffoldContext } from '../adapter.js';
import type { ScanResult } from '../../types.js';
import { registerAdapter } from '../registry.js';
import { collectNextPrompts, validateNextName, type NextContext } from './prompts.js';
import { scaffoldNext } from './scaffold.js';

export class NextAdapter implements StackAdapter {
    readonly id = 'next' as const;
    readonly displayName = 'Next.js';
    readonly nameHint = 'kebab-case (e.g. my-app)';

    validateName(name: string): string | true {
        return validateNextName(name);
    }

    async runPrompts(base: ScaffoldContext): Promise<ScaffoldContext> {
        return collectNextPrompts({
            ...base,
            projectDir: `${base.outputDir}/${base.appName}`,
        });
    }

    async scaffold(ctx: ScaffoldContext): Promise<void> {
        await scaffoldNext(ctx as NextContext);
    }

    scanHints(ctx: ScaffoldContext): Partial<ScanResult> {
        const next = ctx as NextContext;
        const isFullstack = next.projectType === 'fullstack';

        const routerLabel: Record<string, string> = { app: 'App Router', pages: 'Pages Router' };
        const cssLabel: Record<string, string> = { tailwind: 'Tailwind CSS' };
        const ormLabel: Record<string, string> = { prisma: 'Prisma', drizzle: 'Drizzle' };
        const authLabel: Record<string, string> = { nextauth: 'NextAuth.js', clerk: 'Clerk' };
        const apiLabel: Record<string, string> = { trpc: 'tRPC' };

        return {
            detectedSSR: true,
            detectedNextRouter: routerLabel[next.router] ?? next.router,
            detectedRSC: next.router === 'app',
            detectedBuildTool: next.router === 'app' ? 'next-app' : 'next-pages',
            detectedCSSApproach: cssLabel[next.styling] ?? next.styling,
            detectedSubtype: next.projectType,
            detectedORM: isFullstack ? (ormLabel[next.database] ?? (next.database === 'none' ? '' : next.database)) : '',
            detectedAuth: isFullstack ? (authLabel[next.auth] ?? (next.auth === 'none' ? '' : next.auth)) : '',
            detectedAPIType: isFullstack ? (apiLabel[next.apiStyle] ?? '') : '',
            detectedPackageManager: next.packageManager,
            detectedLinter: 'eslint',
            detectedHasLinterConfig: true,
        };
    }

    async postSetup(ctx: ScaffoldContext): Promise<void> {
        const next = ctx as NextContext;
        const dir = ctx.projectDir as string;

        const run = (cmd: string): void => {
            try {
                execSync(cmd, { cwd: dir, stdio: 'inherit' });
            } catch (err) {
                throw new Error(`postSetup failed at: ${cmd}\n${String(err)}`);
            }
        };

        // 1. git init
        run('git init');

        // 2. Package manager install
        const installCmd: Record<string, string> = {
            npm: 'npm install',
            yarn: 'yarn install',
            pnpm: 'pnpm install',
            bun: 'bun install',
        };
        run(installCmd[next.packageManager]);

        // 3. Prisma init (fullstack + prisma only)
        if (next.projectType === 'fullstack' && next.database === 'prisma') {
            run('npx prisma init --datasource-provider sqlite');
        }

        // 4. Initial commit
        run('git add -A');
        run('git commit -m "chore: initial project scaffold"');
    }
}

registerAdapter(new NextAdapter());
