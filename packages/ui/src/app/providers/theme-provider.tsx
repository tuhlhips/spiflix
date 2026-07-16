import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light' | 'system'
type ColorTheme = 'default' | 'blue' | 'green' | 'purple' | 'amber' | 'sky' | 'rose'

interface ThemeContextValue {
  theme: Theme
  colorTheme: ColorTheme
  setTheme: (t: Theme) => void
  setColorTheme: (t: ColorTheme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme<T extends string>(key: string, fallback: T): T {
  try { return (localStorage.getItem(key) as T) || fallback } catch { return fallback }
}

function storeTheme(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch {}
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return readStoredTheme<Theme>('spiflix-theme', 'dark')
  })
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(() => {
    return readStoredTheme<ColorTheme>('spiflix-color-theme', 'default')
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    storeTheme('spiflix-theme', t)
  }

  const setColorTheme = (t: ColorTheme) => {
    setColorThemeState(t)
    storeTheme('spiflix-color-theme', t)
  }

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      root.classList.add(sys)
    } else {
      root.classList.add(theme)
    }
  }, [theme])

  useEffect(() => {
    const root = document.documentElement
    if (colorTheme === 'default') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', colorTheme)
    }
  }, [colorTheme])

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const root = document.documentElement
      root.classList.remove('light', 'dark')
      root.classList.add(mq.matches ? 'dark' : 'light')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, colorTheme, setTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
