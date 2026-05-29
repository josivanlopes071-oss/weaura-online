import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('app-theme');
      return (saved as Theme) || 'dark';
    } catch {
      return 'dark';
    }
  });

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (e) {
      console.warn("Could not write theme to localStorage:", e);
    }
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light-theme-active');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.remove('light-theme-active');
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
