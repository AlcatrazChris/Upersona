import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--ui-canvas)',
        surface: 'var(--ui-surface)',
        ink: 'var(--ui-ink)',
        'ink-secondary': 'var(--ui-ink-secondary)',
        'ink-muted': 'var(--ui-ink-muted)',
        'ui-border': 'var(--ui-border)',
        brand: 'var(--ui-brand)',
      },
      borderRadius: {
        report: '0.5rem',
        control: '0.75rem',
      },
    },
  },
  plugins: [],
};
export default config;
