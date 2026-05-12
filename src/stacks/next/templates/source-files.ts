import type { NextContext } from '../prompts.js';

/** Escape backslashes and single quotes for use inside a single-quoted string literal in generated code. */
function escSQ(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function appLayoutTsx(ctx: NextContext): string {
    const hasGlobalCss = ctx.styling === 'tailwind';
    const cssImport = hasGlobalCss ? "import './globals.css';\n" : '';
    const title = escSQ(ctx.displayName);

    return `import type { Metadata } from 'next';
${cssImport}
export const metadata: Metadata = {
  title: '${title}',
  description: '${title} App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;
}

export function appPageTsx(ctx: NextContext): string {
    return `export default function Home() {
  return (
    <main>
      <h1>${ctx.displayName}</h1>
    </main>
  );
}
`;
}

export function pagesAppTsx(ctx: NextContext): string {
    const hasGlobalCss = ctx.styling === 'tailwind';
    const cssImport = hasGlobalCss ? "import '../app/globals.css';\n" : '';

    return `import type { AppProps } from 'next/app';
${cssImport}
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
`;
}

export function pagesIndexTsx(ctx: NextContext): string {
    return `export default function Home() {
  return (
    <main>
      <h1>${ctx.displayName}</h1>
    </main>
  );
}
`;
}

export function middlewareTs(): string {
    return `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
`;
}

export function libDbTs(ctx: NextContext): string {
    if (ctx.database === 'prisma') {
        return `import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
`;
    }

    if (ctx.database === 'drizzle') {
        return `import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database(process.env.DATABASE_URL ?? 'dev.db');
export const db = drizzle(sqlite);
`;
    }

    // no db
    return `// Database connection — configure your preferred database client here.\n`;
}

export function libAuthTs(ctx: NextContext): string {
    if (ctx.auth === 'nextauth') {
        return `import NextAuth from 'next-auth';
// import GithubProvider from 'next-auth/providers/github';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // GithubProvider({
    //   clientId: process.env.AUTH_GITHUB_ID ?? '',
    //   clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    // }),
  ],
});
`;
    }

    if (ctx.auth === 'clerk') {
        return `export { auth, currentUser } from '@clerk/nextjs/server';
`;
    }

    return `// Auth — configure your preferred auth provider here.\n`;
}

export function coreApiIndexTs(): string {
    return `// Core API utilities — add shared fetch wrappers, interceptors, and error handlers here.\n`;
}

export function coreErrorsTs(): string {
    return `export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(\`\${resource} not found\`, 'NOT_FOUND', 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 'UNAUTHORIZED', 401);
  }
}
`;
}
