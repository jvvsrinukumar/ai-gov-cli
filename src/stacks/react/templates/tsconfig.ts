export function tsconfigJson(): string {
    const config = {
        files: [],
        references: [
            { path: './tsconfig.app.json' },
            { path: './tsconfig.node.json' },
        ],
    };
    return JSON.stringify(config, null, 2) + '\n';
}

export function tsconfigAppJson(): string {
    const config = {
        compilerOptions: {
            tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: 'force',
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedSideEffectImports: true,
            baseUrl: '.',
            paths: {
                '@/*': ['./src/*'],
            },
        },
        include: ['src'],
    };
    return JSON.stringify(config, null, 2) + '\n';
}

export function tsconfigNodeJson(): string {
    const config = {
        compilerOptions: {
            tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
            target: 'ES2022',
            lib: ['ES2023'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: 'force',
            noEmit: true,
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            noUncheckedSideEffectImports: true,
        },
        include: ['vite.config.ts'],
    };
    return JSON.stringify(config, null, 2) + '\n';
}
