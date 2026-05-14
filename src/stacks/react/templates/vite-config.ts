import type { ReactContext } from '../prompts.js';

export function viteConfigTs(_ctx: ReactContext): string {
    const hasVitest = true;
    const vitestConfig = hasVitest
        ? `
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },`
        : '';

    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },${vitestConfig}
});
`;
}

export function eslintConfigJs(): string {
    return `import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
`;
}

export function tailwindConfigTs(): string {
    return `import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
`;
}

export function postcssConfigJs(): string {
    return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}
