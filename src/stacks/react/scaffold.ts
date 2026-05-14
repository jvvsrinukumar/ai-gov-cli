import fs from 'node:fs';
import path from 'node:path';
import type { ReactContext } from './prompts.js';
import { packageJson } from './templates/package-json.js';
import { tsconfigJson, tsconfigAppJson, tsconfigNodeJson } from './templates/tsconfig.js';
import { viteConfigTs, eslintConfigJs, tailwindConfigTs, postcssConfigJs } from './templates/vite-config.js';
import { envTs, envLocal, envExample, reactGitignore } from './templates/env-files.js';
import {
    indexHtml,
    mainTsx,
    appRouterTsx,
    reduxStoreTsx,
    homePageTsx,
    coreApiIndexTs,
    coreErrorsTs,
    testSetupTs,
    globalsCss,
} from './templates/source-files.js';

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
    'src/pages/home',
    'src/app',
    'src/test',
    'public',
];

export async function scaffoldReact(ctx: ReactContext): Promise<void> {
    const dir = ctx.projectDir;

    fs.mkdirSync(dir, { recursive: true });

    const write = (rel: string, content: string): void => {
        const abs = path.join(dir, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content, 'utf8');
    };

    for (const d of BASE_DIRS) {
        fs.mkdirSync(path.join(dir, d), { recursive: true });
    }

    write('package.json', packageJson(ctx));
    write('tsconfig.json', tsconfigJson());
    write('tsconfig.app.json', tsconfigAppJson());
    write('tsconfig.node.json', tsconfigNodeJson());
    write('vite.config.ts', viteConfigTs(ctx));
    write('eslint.config.js', eslintConfigJs());
    write('.gitignore', reactGitignore());
    write('index.html', indexHtml(ctx));

    if (ctx.styling === 'tailwind') {
        write('tailwind.config.ts', tailwindConfigTs());
        write('postcss.config.js', postcssConfigJs());
        write('src/index.css', globalsCss());
    }

    write('src/core/config/env.ts', envTs());
    write('.env.local', envLocal());
    write('.env.example', envExample());

    write('src/main.tsx', mainTsx(ctx));
    write('src/app/router.tsx', appRouterTsx(ctx));
    if (ctx.clientState === 'redux-toolkit') {
        write('src/app/store.ts', reduxStoreTsx());
    }
    write('src/pages/home/HomePage.tsx', homePageTsx(ctx));
    write('src/core/api/index.ts', coreApiIndexTs());
    write('src/core/errors/index.ts', coreErrorsTs());
    write('src/test/setup.ts', testSetupTs());

    if (ctx.ci === 'github') {
        write('.github/workflows/ci.yml', githubCiYml(ctx));
    }
}

function githubCiYml(ctx: ReactContext): string {
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
    name: Lint + Test + Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: '${ctx.packageManager === 'npm' ? 'npm' : ctx.packageManager}'
      - run: ${installCmd}
      - run: ${runPrefix} lint
      - run: ${runPrefix} test
      - run: ${runPrefix} build
`;
}
