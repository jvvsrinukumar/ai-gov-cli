import fs from 'node:fs';
import path from 'node:path';
import type { NextContext } from './prompts.js';
import { packageJson } from './templates/package-json.js';
import { tsconfigJson } from './templates/tsconfig.js';
import { nextConfigTs } from './templates/next-config.js';
import { tailwindConfigTs, postcssConfigJs, globalsCss } from './templates/tailwind-config.js';
import { healthRouteTs } from './templates/api-route.js';
import { envTs, envLocal, envExample, nextGitignore } from './templates/env-files.js';
import {
    appLayoutTsx,
    appPageTsx,
    pagesAppTsx,
    pagesIndexTsx,
    middlewareTs,
    libDbTs,
    libAuthTs,
    coreApiIndexTs,
    coreErrorsTs,
} from './templates/source-files.js';

// Common directories created for every project
const BASE_DIRS = [
    'src/features',
    'src/core/api',
    'src/core/config',
    'src/core/errors',
    'src/core/types',
    'src/core/utils',
    'src/shared/components',
    'src/shared/hooks',
    'src/shared/types',
];

export async function scaffoldNext(ctx: NextContext): Promise<void> {
    const dir = ctx.projectDir;

    // 1. Create project directory
    fs.mkdirSync(dir, { recursive: true });

    const write = (rel: string, content: string): void => {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
    };

    // 2. Create directory structure
    const appDir = ctx.router === 'app' ? 'src/app' : 'src/pages';
    const allDirs = [appDir, ...BASE_DIRS];
    if (ctx.projectType === 'fullstack') {
        allDirs.push('src/lib');
        allDirs.push('src/app/api/health');
    }
    for (const d of allDirs) {
        fs.mkdirSync(path.join(dir, d), { recursive: true });
    }

    // 3. package.json
    write('package.json', packageJson(ctx));

    // 4. tsconfig.json
    write('tsconfig.json', tsconfigJson());

    // 5. next.config.ts
    write('next.config.ts', nextConfigTs());

    // 6. .gitignore
    write('.gitignore', nextGitignore());

    // 7. Tailwind (conditional)
    if (ctx.styling === 'tailwind') {
        write('tailwind.config.ts', tailwindConfigTs());
        write('postcss.config.js', postcssConfigJs());
    }

    // 8. Environment files
    write('src/core/config/env.ts', envTs(ctx));
    write('.env.local', envLocal(ctx));
    write('.env.example', envExample(ctx));

    // 9. App layout / pages
    if (ctx.router === 'app') {
        write('src/app/layout.tsx', appLayoutTsx(ctx));
        write('src/app/page.tsx', appPageTsx(ctx));
        if (ctx.styling === 'tailwind') {
            write('src/app/globals.css', globalsCss());
        }
    } else {
        write('src/pages/_app.tsx', pagesAppTsx(ctx));
        write('src/pages/index.tsx', pagesIndexTsx(ctx));
        if (ctx.styling === 'tailwind') {
            write('src/app/globals.css', globalsCss());
        }
    }

    // 10. Core scaffolding files
    write('src/core/api/index.ts', coreApiIndexTs());
    write('src/core/errors/index.ts', coreErrorsTs());

    // 11. Fullstack-only files
    if (ctx.projectType === 'fullstack') {
        write('src/app/api/health/route.ts', healthRouteTs());
        write('src/middleware.ts', middlewareTs());
        write('src/lib/db.ts', libDbTs(ctx));
        if (ctx.auth !== 'none') {
            write('src/lib/auth.ts', libAuthTs(ctx));
        }
    }

    // 12. CI workflow
    if (ctx.ci === 'github') {
        write('.github/workflows/ci.yml', githubCiYml(ctx));
    }
}

function githubCiYml(ctx: NextContext): string {
    const installCmd = {
        npm: 'npm install',
        yarn: 'yarn install',
        pnpm: 'pnpm install',
        bun: 'bun install',
    }[ctx.packageManager];

    const runPrefix = {
        npm: 'npm run',
        yarn: 'yarn',
        pnpm: 'pnpm',
        bun: 'bun run',
    }[ctx.packageManager];

    return `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  build:
    name: Lint + Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: '${ctx.packageManager === 'npm' ? 'npm' : ctx.packageManager}'
      - run: ${installCmd}
      - run: ${runPrefix} lint
      - run: ${runPrefix} build
`;
}

