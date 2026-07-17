import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Tokens mirrored from index.css so components can read concrete values
// (e.g. the settings preview swatches) without touching the DOM.
const PALETTES = {
  light: {
    bg: '#FAFAF8',
    surface: '#FFFFFF',
    surface2: '#F2F0EB',
    text: '#1A1A18',
    accent: '#C45D3E',
    border: '#E2DFD8',
  },
  dark: {
    bg: '#111110',
    surface: '#1A1918',
    surface2: '#222120',
    text: '#EDEDEB',
    accent: '#E07A5A',
    border: '#2E2C28',
  },
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('atelier.theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('atelier.theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors: PALETTES[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
