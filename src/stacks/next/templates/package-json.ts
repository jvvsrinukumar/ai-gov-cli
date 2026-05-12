import type { NextContext } from '../prompts.js';

export function packageJson(ctx: NextContext): string {
    const deps: Record<string, string> = {
        next: '^15.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        zod: '^3.23.8',
    };

    const devDeps: Record<string, string> = {
        typescript: '^5.5.4',
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        '@types/node': '^22.8.0',
        eslint: '^9.0.0',
        'eslint-config-next': '^15.0.0',
    };

    // Styling
    if (ctx.styling === 'tailwind') {
        devDeps['tailwindcss'] = '^3.4.0';
        devDeps['postcss'] = '^8.4.0';
        devDeps['autoprefixer'] = '^10.4.0';
    } else if (ctx.styling === 'styled-components') {
        deps['styled-components'] = '^6.1.0';
        devDeps['@types/styled-components'] = '^5.1.34';
    }

    // Server state
    if (ctx.serverState === 'tanstack-query') {
        deps['@tanstack/react-query'] = '^5.59.0';
    } else if (ctx.serverState === 'swr') {
        deps['swr'] = '^2.2.5';
    }

    // Client state
    if (ctx.clientState === 'zustand') {
        deps['zustand'] = '^5.0.0';
    } else if (ctx.clientState === 'redux-toolkit') {
        deps['@reduxjs/toolkit'] = '^2.3.0';
        deps['react-redux'] = '^9.1.0';
    }

    // Fullstack-only
    if (ctx.projectType === 'fullstack') {
        if (ctx.auth === 'nextauth') {
            deps['next-auth'] = '^5.0.0-beta.20';
        } else if (ctx.auth === 'clerk') {
            deps['@clerk/nextjs'] = '^5.7.0';
        }

        if (ctx.database === 'prisma') {
            deps['@prisma/client'] = '^5.20.0';
            devDeps['prisma'] = '^5.20.0';
        } else if (ctx.database === 'drizzle') {
            deps['drizzle-orm'] = '^0.36.0';
            devDeps['drizzle-kit'] = '^0.28.0';
        }

        if (ctx.apiStyle === 'trpc') {
            deps['@trpc/server'] = '^11.0.0';
            deps['@trpc/client'] = '^11.0.0';
            deps['@trpc/react-query'] = '^11.0.0';
            // trpc requires tanstack-query
            deps['@tanstack/react-query'] = deps['@tanstack/react-query'] ?? '^5.59.0';
        }
    }

    const scripts: Record<string, string> = {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
    };

    const obj = {
        name: ctx.appName,
        version: '0.1.0',
        private: true,
        scripts,
        dependencies: sortKeys(deps),
        devDependencies: sortKeys(devDeps),
    };

    return JSON.stringify(obj, null, 2) + '\n';
}

function sortKeys(obj: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}
