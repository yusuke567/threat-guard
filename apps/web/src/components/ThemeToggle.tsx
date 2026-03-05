'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const modes = [
  { value: 'light', label: '☀️', title: 'ライト' },
  { value: 'system', label: '💻', title: 'OS連動' },
  { value: 'dark', label: '🌙', title: 'ダーク' },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-[120px] h-8" />;
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setTheme(mode.value)}
          title={mode.title}
          className={`px-2 py-1 rounded-md text-sm transition-colors ${
            theme === mode.value
              ? 'bg-white dark:bg-gray-600 shadow-sm text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
