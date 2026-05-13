export function envTs(): string {
    return `import { z } from 'zod';

const envSchema = z.object({
  MODE: z.enum(['development', 'production', 'test']).default('development'),
  BASE_URL: z.string().default('/'),
  PROD: z.boolean(),
  DEV: z.boolean(),
});

// Vite exposes env vars on import.meta.env — validated at startup.
export const env = envSchema.parse(import.meta.env);
`;
}

export function envLocal(): string {
    return `# Local development overrides (not committed to git)
# Add VITE_ prefixed variables here to expose them to the browser.
`;
}

export function envExample(): string {
    return `# Copy to .env.local and fill in values.
# Prefix browser-accessible vars with VITE_
# VITE_API_URL=http://localhost:8080
`;
}

export function reactGitignore(): string {
    return `# dependencies
/node_modules

# build output
/dist

# testing
/coverage

# local env files
.env.local
.env.development.local
.env.test.local
.env.production.local

# misc
.DS_Store
*.pem

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# typescript
*.tsbuildinfo

# vite
vite.config.ts.timestamp-*
`;
}
