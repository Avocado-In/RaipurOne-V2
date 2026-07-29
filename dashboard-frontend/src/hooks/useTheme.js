import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'r1_theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

/**
 * useTheme hook - Simple 2-mode theme switcher (Light/Dark only)
 * 
 * Uses .dark class on <html> element for instant theme application.
 * Persists user preference to localStorage.r1_theme.
 * Defaults to light mode.
 */
export const useTheme = () => {
  const getInitialTheme = () => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && Object.values(THEMES).includes(stored)) {
      return stored;
    }
    return THEMES.LIGHT;
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    
    // Apply or remove .dark class
    root.classList.remove('dark');
    if (theme === THEMES.DARK) {
      root.classList.add('dark');
    }
  }, [theme]);

  const updateTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
    updateTheme(newTheme);
  };

  return { theme, setTheme: updateTheme, toggleTheme, THEMES };
};
