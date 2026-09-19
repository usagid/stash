export type ThemeName = 'light' | 'dark'

const STORAGE_KEY = 'stash-theme'

function readStoredTheme(): ThemeName {
  if (import.meta.client) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // localStorage unavailable (e.g. private mode) - fall through to default
    }
  }
  return 'dark'
}

export function useTheme() {
  // Nuxt hydrates useState from the SSR payload (always 'dark', since the
  // server can't see localStorage), so the client must reconcile explicitly
  // rather than relying on the useState initializer, which is skipped once
  // a payload value already exists.
  const theme = useState<ThemeName>('theme', () => 'dark')

  function syncFromStorage() {
    if (import.meta.client) {
      theme.value = readStoredTheme()
    }
  }

  function apply(value: ThemeName) {
    theme.value = value
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, value)
      } catch {
        // ignore
      }
    }
  }

  function toggle() {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, toggle, apply, syncFromStorage }
}
