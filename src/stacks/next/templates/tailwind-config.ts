export function tailwindConfigTs(): string {
    return `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
`;
}

export function postcssConfigJs(): string {
    return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

export function globalsCss(): string {
    return `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
}
