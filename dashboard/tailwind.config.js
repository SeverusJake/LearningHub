/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // All tokens resolve through CSS variables so the 400ms theme
        // dimmer-switch transition happens in one place (index.css).
        bg: 'var(--bg)',
        s1: 'var(--s1)',
        s2: 'var(--s2)',
        tp: 'var(--tp)',
        ts: 'var(--ts)',
        tm: 'var(--tm)',
        accent: 'var(--accent)',
        'accent-h': 'var(--accent-h)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        danger: 'var(--danger)',
        bord: 'var(--bord)',
        rule: 'var(--rule)',
      },
      fontFamily: {
        serif: ['"Fraunces"', 'serif'],
        sans: ['"Archivo"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
