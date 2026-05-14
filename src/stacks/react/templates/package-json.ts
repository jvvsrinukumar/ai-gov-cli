import type { ReactContext } from '../prompts.js';

export function packageJson(ctx: ReactContext): string {
    const deps: Record<string, string> = {
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        'react-router-dom': '^7.0.0',
        zod: '^3.23.8',
    };

    const devDeps: Record<string, string> = {
        typescript: '^5.5.4',
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        vite: '^6.0.0',
        '@vitejs/plugin-react': '^4.3.0',
        eslint: '^9.0.0',
        '@eslint/js': '^9.0.0',
        'typescript-eslint': '^8.0.0',
        'eslint-plugin-react-hooks': '^5.0.0',
        vitest: '^2.0.0',
        '@vitest/ui': '^2.0.0',
        jsdom: '^25.0.0',
        '@testing-library/react': '^16.0.0',
        '@testing-library/jest-dom': '^6.5.0',
    };

    if (ctx.styling === 'tailwind') {
        devDeps['tailwindcss'] = '^3.4.0';
        devDeps['postcss'] = '^8.4.0';
        devDeps['autoprefixer'] = '^10.4.0';
    } else if (ctx.styling === 'styled-components') {
        deps['styled-components'] = '^6.1.0';
        devDeps['@types/styled-components'] = '^5.1.34';
    }

    if (ctx.serverState === 'tanstack-query') {
        deps['@tanstack/react-query'] = '^5.59.0';
    } else if (ctx.serverState === 'swr') {
        deps['swr'] = '^2.2.5';
    }

    if (ctx.clientState === 'zustand') {
        deps['zustand'] = '^5.0.0';
    } else if (ctx.clientState === 'redux-toolkit') {
        deps['@reduxjs/toolkit'] = '^2.3.0';
        deps['react-redux'] = '^9.1.0';
    }

    const scripts: Record<string, string> = {
        dev: 'vite',
        build: 'tsc -b && vite build',
        preview: 'vite preview',
        lint: 'eslint .',
        test: 'vitest run',
        'test:ui': 'vitest --ui',
        'test:watch': 'vitest',
    };

    const obj = {
        name: ctx.appName,
        version: '0.1.0',
        private: true,
        type: 'module',
        scripts,
        dependencies: sortKeys(deps),
        devDependencies: sortKeys(devDeps),
    };

    return JSON.stringify(obj, null, 2) + '\n';
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
