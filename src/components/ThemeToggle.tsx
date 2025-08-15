import React from 'react';
import { useTheme } from '../theme/ThemeProvider';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const opts: Array<{label: string, value: 'light'|'dark'|'system'}> = [
    { label: 'Light', value: 'light' },
    { label: 'Dark', value: 'dark' },
    { label: 'Auto', value: 'system' },
  ];
  return (
    <div className="inline-flex rounded-xl border bg-white/60 backdrop-blur dark:bg-white/5 border-gray-200 dark:border-gray-800 overflow-hidden">
      {opts.map(o => (
        <button
          key={o.value}
          onClick={() => setTheme(o.value)}
          className={`px-3 py-1 text-sm ${theme===o.value ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-white/10'}`}
          aria-pressed={theme===o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
