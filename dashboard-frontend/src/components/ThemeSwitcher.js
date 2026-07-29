import React from 'react';
import { useTheme } from '../hooks/useTheme';

/**
 * ThemeSwitcher - Simple Light/Dark toggle
 * 
 * Toggles between Light and Dark modes only
 * Shows sun icon in dark mode, moon icon in light mode
 * All icons are inline SVGs (no emojis)
 */
const ThemeSwitcher = () => {
  const { theme, toggleTheme, THEMES } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-white/5 dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-200 border border-black/10 dark:border-white/10"
      aria-label={`Switch to ${theme === THEMES.LIGHT ? 'dark' : 'light'} mode`}
      title={`Current: ${theme} mode`}
    >
      {theme === THEMES.DARK ? (
        <svg
          className="w-5 h-5 text-black dark:text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          {/* Sun icon - click to switch to light */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5 text-black dark:text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          {/* Moon icon - click to switch to dark */}
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeSwitcher;
