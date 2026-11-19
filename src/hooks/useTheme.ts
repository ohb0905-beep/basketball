'use client';

import { useCallback, useSyncExternalStore } from 'react';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'bench_to_mvp_theme';
const THEME_EVENT = 'bench_to_mvp_theme_change';

function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
    root.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  }
}

function getClientThemeSnapshot(): ThemeMode {
  if (typeof document !== 'undefined') {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
  }
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      return 'light';
    }
  }
  return 'light';
}

function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

function subscribeTheme(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onChange = () => callback();
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener('storage', onChange);
  mq.addEventListener('change', onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener('storage', onChange);
    mq.removeEventListener('change', onChange);
  };
}

function subscribeMounted(): () => void {
  return () => {};
}

export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getClientThemeSnapshot,
    getServerThemeSnapshot
  );
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false
  );

  const toggleTheme = useCallback(() => {
    const current = getClientThemeSnapshot();
    const next: ThemeMode = current === 'dark' ? 'light' : 'dark';
    applyThemeToDom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(THEME_EVENT));
    }
  }, []);

  return { theme, mounted, toggleTheme };
}
