import { select } from '@inquirer/prompts';
import type { ScaffoldContext } from '../adapter.js';

export type ProjectType = 'frontend' | 'fullstack';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type Router = 'app' | 'pages';
export type Styling = 'tailwind' | 'css-modules' | 'styled-components';
export type ServerState = 'tanstack-query' | 'swr' | 'none';
export type ClientState = 'zustand' | 'redux-toolkit' | 'none';
export type Auth = 'nextauth' | 'clerk' | 'none';
export type Database = 'prisma' | 'drizzle' | 'none';
export type ApiStyle = 'rest' | 'trpc' | 'none';

export interface NextContext extends ScaffoldContext {
    projectType: ProjectType;
    packageManager: PackageManager;
    router: Router;
    styling: Styling;
    serverState: ServerState;
    clientState: ClientState;
    auth: Auth;
    database: Database;
    apiStyle: ApiStyle;
}

export function validateNextName(name: string): string | true {
    return /^[a-z][a-z0-9-]*$/.test(name)
        ? true
        : 'App name must be kebab-case (lowercase letters, digits, hyphens; must start with a letter).';
}

export async function collectNextPrompts(base: ScaffoldContext): Promise<NextContext> {
    const projectType = await select<ProjectType>({
        message: 'Project type:',
        choices: [
            { name: 'Frontend only', value: 'frontend' },
            { name: 'Full-stack', value: 'fullstack' },
        ],
        default: 'frontend',
    });

    const packageManager = await select<PackageManager>({
        message: 'Package manager:',
        choices: [
            { name: 'npm', value: 'npm' },
            { name: 'yarn', value: 'yarn' },
            { name: 'pnpm', value: 'pnpm' },
            { name: 'bun', value: 'bun' },
        ],
        default: 'npm',
    });

    const router = await select<Router>({
        message: 'Router:',
        choices: [
            { name: 'App Router', value: 'app' },
            { name: 'Pages Router', value: 'pages' },
        ],
        default: 'app',
    });

    const styling = await select<Styling>({
        message: 'Styling:',
        choices: [
            { name: 'Tailwind CSS', value: 'tailwind' },
            { name: 'CSS Modules', value: 'css-modules' },
            { name: 'styled-components', value: 'styled-components' },
        ],
        default: 'tailwind',
    });

    const serverState = await select<ServerState>({
        message: 'Server state management:',
        choices: [
            { name: 'TanStack Query', value: 'tanstack-query' },
            { name: 'SWR', value: 'swr' },
            { name: 'None', value: 'none' },
        ],
        default: 'tanstack-query',
    });

    const clientState = await select<ClientState>({
        message: 'Client state management:',
        choices: [
            { name: 'Zustand', value: 'zustand' },
            { name: 'Redux Toolkit', value: 'redux-toolkit' },
            { name: 'None', value: 'none' },
        ],
        default: 'zustand',
    });

    let auth: Auth = 'none';
    let database: Database = 'none';
    let apiStyle: ApiStyle = 'none';

    if (projectType === 'fullstack') {
        auth = await select<Auth>({
            message: 'Auth provider:',
            choices: [
                { name: 'NextAuth', value: 'nextauth' },
                { name: 'Clerk', value: 'clerk' },
                { name: 'None', value: 'none' },
            ],
            default: 'nextauth',
        });

        database = await select<Database>({
            message: 'Database ORM:',
            choices: [
                { name: 'Prisma', value: 'prisma' },
                { name: 'Drizzle', value: 'drizzle' },
                { name: 'None', value: 'none' },
            ],
            default: 'prisma',
        });

        apiStyle = await select<ApiStyle>({
            message: 'API style:',
            choices: [
                { name: 'REST', value: 'rest' },
                { name: 'tRPC', value: 'trpc' },
                { name: 'None', value: 'none' },
            ],
            default: 'rest',
        });
    }

    return {
        ...base,
        projectType,
        packageManager,
        router,
        styling,
        serverState,
        clientState,
        auth,
        database,
        apiStyle,
    };
}
