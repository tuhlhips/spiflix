import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light' | 'system'
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
    // Keep the installed-PWA status bar / tab colour in sync with the accent
    // instead of leaving it hardcoded red in index.html.
    const THEME_COLORS: Record<ColorTheme, string> = {
      default: '#e92a34', blue: '#4a7bf7', green: '#12b981', purple: '#a13ef0',
      amber: '#eda000', sky: '#33b6e6', rose: '#ee3d6e',
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[colorTheme])
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
