import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; isDark: boolean };

const ThemeCtx = createContext<Ctx>({ theme: 'system', setTheme: () => {}, isDark: false });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'system');

  const isDark = useMemo(() => {
    if (theme === 'system') return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return theme === 'dark';
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [isDark, theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') document.documentElement.classList.toggle('dark', mq.matches); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return <ThemeCtx.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeCtx.Provider>;
};

export const useTheme = () => useContext(ThemeCtx);
