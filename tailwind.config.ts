import type { Config } from 'tailwindcss';

/** rgb(var(--token) / <alpha>) helper so Tailwind opacity modifiers work.
 *  Tokens are space-separated RGB triplets, mirroring the marketing site. */
const hsl = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index-local.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: hsl('--color-bg'),
        surface: hsl('--color-surface'),
        'surface-raised': hsl('--color-surface-raised'),
        foreground: hsl('--color-text'),
        muted: hsl('--color-muted'),
        'muted-foreground': hsl('--color-muted-text'),
        faint: hsl('--color-faint-text'),
        border: hsl('--color-border'),
        'border-strong': hsl('--color-border-strong'),
        accent: hsl('--color-accent'),
        'accent-strong': hsl('--color-accent-strong'),
        'accent-foreground': hsl('--color-accent-text'),
        destructive: hsl('--color-destructive'),
        ring: hsl('--color-ring'),
        // Semantic status hues
        success: hsl('--color-success'),
        idle: hsl('--color-idle'),
        warning: hsl('--color-warning'),
        danger: hsl('--color-danger'),
        neutral: hsl('--color-neutral'),
        info: hsl('--color-info'),
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius)',
        lg: 'var(--radius-lg)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        glow: 'var(--shadow-glow)',
      },
    },
  },
} satisfies Config;
