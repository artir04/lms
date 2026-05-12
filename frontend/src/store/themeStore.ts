import { create } from 'zustand'

type Theme = 'dark' | 'light'

interface ThemeState {
  mode: Theme
  toggle: () => void
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem('theme') as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

function applyTheme(mode: Theme) {
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

// Apply immediately so there's no flash
const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeState>((set) => ({
  mode: initial,
  toggle: () =>
    set((state) => {
      const next = state.mode === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      applyTheme(next)
      return { mode: next }
    }),
}))
