import { useEffect } from 'react'
import { useSettingsStore, type ThemePreference } from '../stores/settingsStore'

/**
 * Hook that syncs theme preference to the document.
 * Applies or removes the 'dark' class on <html> based on user preference or system setting.
 */
export function useTheme() {
  const theme = useSettingsStore((state) => state.theme)

  useEffect(() => {
    const applyTheme = (preference: ThemePreference) => {
      const root = document.documentElement

      if (preference === 'dark') {
        root.classList.add('dark')
      } else if (preference === 'light') {
        root.classList.remove('dark')
      } else {
        // System preference
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (systemPrefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      }
    }

    // Apply theme immediately
    applyTheme(theme)

    // Listen for system preference changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])
}
