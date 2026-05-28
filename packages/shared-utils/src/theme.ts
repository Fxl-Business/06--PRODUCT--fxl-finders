/**
 * Shared design tokens — consumed by Tailwind configs in all 4 apps.
 *
 *   apps/web/tailwind.config.ts     → reads colors/fonts from here
 *   apps/site/tailwind.config.ts    → same
 *   apps/mobile/tailwind.config.js  → same (via NativeWind)
 *
 * Keep this file framework-agnostic. No React, no DOM.
 */

export const colors = {
  primary: {
    DEFAULT: 'hsl(221 83% 53%)',
    foreground: 'hsl(0 0% 100%)',
  },
  secondary: {
    DEFAULT: 'hsl(210 40% 96.1%)',
    foreground: 'hsl(222.2 47.4% 11.2%)',
  },
  accent: {
    DEFAULT: 'hsl(210 40% 94%)',
    foreground: 'hsl(222.2 47.4% 11.2%)',
  },
  muted: {
    DEFAULT: 'hsl(210 40% 96.1%)',
    foreground: 'hsl(215.4 16.3% 46.9%)',
  },
  destructive: {
    DEFAULT: 'hsl(0 84.2% 60.2%)',
    foreground: 'hsl(0 0% 100%)',
  },
  border: 'hsl(214.3 31.8% 91.4%)',
  input: 'hsl(214.3 31.8% 91.4%)',
  ring: 'hsl(221 83% 53%)',
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(222.2 47.4% 11.2%)',
} as const;

export const fonts = {
  sans: 'Geist Variable, ui-sans-serif, system-ui, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
} as const;

export const radii = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
} as const;

export type ThemeColors = typeof colors;
export type ThemeFonts = typeof fonts;
