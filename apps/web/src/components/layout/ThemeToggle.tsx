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
    <div className="flex items-center bg-surface-elevated rounded-lg p-0.5">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setTheme(mode.value)}
          title={mode.title}
          className={`px-2 py-1 rounded-md text-sm transition-colors ${
            theme === mode.value
              ? 'bg-surface-card shadow-sm text-[var(--text-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
