import { useLayoutEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTaskStore } from '../stores/taskStore';
import { shadeHex } from '../utils/projectColors';

// Keep the native window background in sync with the app background
// (#FEFEFE / #1A1A1A), so the strip the webview exposes while it lags
// behind a live resize is invisible instead of OS-default grey.
function syncWindowBackground(isDark: boolean) {
  getCurrentWindow()
    .setBackgroundColor(isDark ? [26, 26, 26] : [254, 254, 254])
    .catch(() => {}); // no-op outside Tauri (vitest, plain browser)
}

export function useTheme() {
  const theme = useTaskStore((s) => s.theme);
  const accentColor = useTaskStore((s) => s.accentColor);

  // Override the accent tokens from App.css when a custom color is set.
  // All primary-* Tailwind utilities resolve var(--color-primary…), so this
  // restyles the whole app live.
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    if (accentColor) {
      style.setProperty('--color-primary', accentColor);
      style.setProperty('--color-primary-dark', shadeHex(accentColor, -12));
      style.setProperty('--color-primary-light', shadeHex(accentColor, 15));
    } else {
      style.removeProperty('--color-primary');
      style.removeProperty('--color-primary-dark');
      style.removeProperty('--color-primary-light');
    }
  }, [accentColor]);

  useLayoutEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      syncWindowBackground(isDark);
    };

    if (theme === 'light') {
      applyTheme(false);
      return;
    }

    if (theme === 'dark') {
      applyTheme(true);
      return;
    }

    // System mode: follow OS preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    applyTheme(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);
}
