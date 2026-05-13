import type { ReactContext } from '../prompts.js';

function escSQ(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export function indexHtml(ctx: ReactContext): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escSQ(ctx.displayName)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function mainTsx(ctx: ReactContext): string {
    const hasQueryProvider = ctx.serverState === 'tanstack-query';
    const hasRedux = ctx.clientState === 'redux-toolkit';
    const hasCss = ctx.styling === 'tailwind';

    const imports: string[] = ["import { StrictMode } from 'react';", "import { createRoot } from 'react-dom/client';", "import { RouterProvider } from 'react-router-dom';", "import { router } from './app/router.js';"];
    if (hasCss) imports.push("import './index.css';");
    if (hasQueryProvider) {
        imports.push("import { QueryClient, QueryClientProvider } from '@tanstack/react-query';");
    }
    if (hasRedux) {
        imports.push("import { Provider } from 'react-redux';", "import { store } from './app/store.js';");
    }

    const queryClientInit = hasQueryProvider
        ? '\nconst queryClient = new QueryClient();\n'
        : '';

    let app = '<RouterProvider router={router} />';
    if (hasQueryProvider) {
        app = `<QueryClientProvider client={queryClient}>\n      ${app}\n    </QueryClientProvider>`;
    }
    if (hasRedux) {
        app = `<Provider store={store}>\n      ${app}\n    </Provider>`;
    }

    return `${imports.join('\n')}
${queryClientInit}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    ${app}
  </StrictMode>,
);
`;
}

export function appRouterTsx(_ctx: ReactContext): string {
    return `import { createBrowserRouter } from 'react-router-dom';
import { HomePage } from '../pages/home/HomePage.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
]);
`;
}

export function reduxStoreTsx(): string {
    return `import { configureStore } from '@reduxjs/toolkit';
import type { TypedUseSelectorHook } from 'react-redux';
import { useDispatch, useSelector } from 'react-redux';

export const store = configureStore({
  reducer: {},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
`;
}

export function homePageTsx(ctx: ReactContext): string {
    const title = escSQ(ctx.displayName);
    return `export function HomePage() {
  return (
    <main>
      <h1>${title}</h1>
    </main>
  );
}
`;
}

export function coreApiIndexTs(): string {
    return `// Core API utilities — add shared fetch wrappers, interceptors, and error handlers here.

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) throw new Error(\`API error \${res.status}: \${res.statusText}\`);
  return res.json() as Promise<T>;
}
`;
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

export function testSetupTs(): string {
    return `import '@testing-library/jest-dom';
`;
}

export function globalsCss(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
}
