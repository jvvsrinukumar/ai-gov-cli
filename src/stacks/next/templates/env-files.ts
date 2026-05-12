import type { NextContext } from '../prompts.js';

function buildEnvVars(ctx: NextContext): string[] {
    const vars: string[] = ['NODE_ENV'];
    if (ctx.projectType === 'fullstack') {
        if (ctx.auth === 'nextauth') {
            vars.push('NEXTAUTH_SECRET', 'NEXTAUTH_URL');
        } else if (ctx.auth === 'clerk') {
            vars.push('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY');
        }
        if (ctx.database === 'prisma' || ctx.database === 'drizzle') {
            vars.push('DATABASE_URL');
        }
    }
    return vars;
}

export function envTs(ctx: NextContext): string {
    const vars = buildEnvVars(ctx);

    const schemaFields = vars.map(v => {
        if (v === 'NODE_ENV') {
            return `  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),`;
        }
        if (v === 'NEXTAUTH_URL') {
            return `  NEXTAUTH_URL: z.string().url(),`;
        }
        if (v === 'DATABASE_URL') {
            return `  DATABASE_URL: z.string().url(),`;
        }
        return `  ${v}: z.string().min(1),`;
    });

    return `import { z } from 'zod';

const envSchema = z.object({
${schemaFields.join('\n')}
});

// Throws at startup if any required env var is missing or invalid.
export const env = envSchema.parse(process.env);
`;
}

export function envLocal(ctx: NextContext): string {
    const vars = buildEnvVars(ctx);
    const lines = vars.map(v => {
        if (v === 'NODE_ENV') return 'NODE_ENV=development';
        if (v === 'NEXTAUTH_URL') return 'NEXTAUTH_URL=http://localhost:3000';
        if (v === 'DATABASE_URL') return 'DATABASE_URL=file:./dev.db';
        return `${v}=`;
    });
    return lines.join('\n') + '\n';
}

export function envExample(ctx: NextContext): string {
    const vars = buildEnvVars(ctx);
    const lines = vars.map(v => {
        if (v === 'NODE_ENV') return 'NODE_ENV=development';
        if (v === 'NEXTAUTH_URL') return 'NEXTAUTH_URL=http://localhost:3000';
        if (v === 'DATABASE_URL') return 'DATABASE_URL=file:./dev.db';
        return `${v}=`;
    });
    return lines.join('\n') + '\n';
}

export function nextGitignore(): string {
    return `# dependencies
/node_modules
/.pnp
.pnp.js

# testing
/coverage

# next.js
/.next/
/out/

# production
/build

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# local env files
.env.local
.env.development.local
.env.test.local
.env.production.local

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
`;
}
