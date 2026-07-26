import { createContext, useContext, useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '@/hooks/useLocalStorage'

/**
 * App-wide preference toggles from the design's Settings screen. Kept separate
 * from the two existing keys (spiflix-autoplay-next, spiflix-auto-skip-intro),
 * which already have consumers; Phase 6 (Settings redesign) unifies the UI over
 * both. `autoplayNext`/`autoSkipIntro` intentionally live outside this object.
 */
export interface AppSettings {
  autoplayPreviews: boolean
  dataSaver: boolean
  hdDownloads: boolean
  notifyNew: boolean
  notifyList: boolean
  mature: boolean
  reduceMotion: boolean
  quality: 'auto' | 'high' | 'medium' | 'low'
}

const DEFAULTS: AppSettings = {
  autoplayPreviews: true,
  dataSaver: false,
  hdDownloads: true,
  notifyNew: true,
  notifyList: false,
  mature: false,
  reduceMotion: false,
  quality: 'auto',
}

interface SettingsContextType {
  settings: AppSettings
  setSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<Partial<AppSettings>>('spiflix-app-settings', {})
  // Merge over defaults so a newly-added key is never undefined for old users.
  const settings = useMemo(() => ({ ...DEFAULTS, ...stored }), [stored])

  const setSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setStored(prev => ({ ...prev, [key]: value })),
    [setStored],
  )

  // Reduce Motion → drives the app-wide CSS kill-switch in index.css.
  useEffect(() => {
    const root = document.documentElement
    if (settings.reduceMotion) root.setAttribute('data-reduce-motion', 'true')
    else root.removeAttribute('data-reduce-motion')
  }, [settings.reduceMotion])

  const value = useMemo(() => ({ settings, setSetting }), [settings, setSetting])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useAppSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useAppSettings must be used within SettingsProvider')
  return ctx
}
