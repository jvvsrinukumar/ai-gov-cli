import { select } from '@inquirer/prompts';
import type { ScaffoldContext } from '../adapter.js';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type Styling = 'tailwind' | 'css-modules' | 'styled-components';
export type ServerState = 'tanstack-query' | 'swr' | 'none';
export type ClientState = 'zustand' | 'redux-toolkit' | 'none';

export interface ReactContext extends ScaffoldContext {
    packageManager: PackageManager;
    styling: Styling;
    serverState: ServerState;
    clientState: ClientState;
}

export function validateReactName(name: string): string | true {
    return /^[a-z][a-z0-9-]*$/.test(name)
        ? true
        : 'App name must be kebab-case (lowercase letters, digits, hyphens; must start with a letter).';
}

export async function collectReactPrompts(base: ScaffoldContext): Promise<ReactContext> {
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

    return {
        ...base,
        packageManager,
        styling,
        serverState,
        clientState,
    };
}
