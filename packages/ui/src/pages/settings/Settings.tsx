import { useState, useEffect } from 'react'
import { useTheme } from '@/app/providers/theme-provider'
import { usePersistentState } from '@/hooks/useLocalStorage'
import {
  Monitor, Moon, Sun, Palette, Play, Trash2, ExternalLink,
  History, ChevronLeft, Server, Globe, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

const themes = [
  { id: 'dark' as const, label: 'Dark', icon: Moon },
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'system' as const, label: 'System', icon: Monitor },
]

const colorThemes = [
  { id: 'default' as const, label: 'Red', color: 'bg-red-500' },
  { id: 'blue' as const, label: 'Blue', color: 'bg-blue-500' },
  { id: 'green' as const, label: 'Green', color: 'bg-green-500' },
  { id: 'purple' as const, label: 'Purple', color: 'bg-purple-500' },
  { id: 'amber' as const, label: 'Amber', color: 'bg-amber-500' },
  { id: 'sky' as const, label: 'Sky', color: 'bg-sky-500' },
  { id: 'rose' as const, label: 'Rose', color: 'bg-rose-500' },
]

const locales = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
]

const regions = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
]

type Tab = 'appearance' | 'playback' | 'history' | 'backend' | 'tmdb'

export default function Settings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('appearance')
  const { theme, colorTheme, setTheme, setColorTheme } = useTheme()
  const [autoplayNext, setAutoplayNext] = usePersistentState('spiflix-autoplay-next', true)
  const [omssUrl, setOmssUrl] = usePersistentState('spiflix-omss-url', '')
  const [locale, setLocale] = usePersistentState('spiflix-locale', 'en')
  const [region, setRegion] = usePersistentState('spiflix-region', 'US')
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)

  useEffect(() => {
    api.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
  }, [])

  const watchHistory = typeof window !== 'undefined'
    ? Object.keys(localStorage)
        .filter(k => k.startsWith('playback_'))
        .map(k => {
          try {
            const data = JSON.parse(localStorage.getItem(k) || '{}')
            const [, type, id] = k.split('_')
            return { key: k, type, id, title: data.title || id, progress: data.currentTime || 0, duration: data.duration || 0, updated: data.updated || 0 }
          } catch { return null }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (b.updated || 0) - (a.updated || 0))
        .slice(0, 50)
    : []

  const clearWatchHistory = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('playback_'))
    keys.forEach(k => localStorage.removeItem(k))
  }

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'playback', label: 'Playback', icon: Play },
    { id: 'history', label: 'History', icon: History },
    { id: 'backend', label: 'Backend', icon: ExternalLink },
    { id: 'tmdb', label: 'TMDB', icon: Globe },
  ]

  return (
    <div className="mx-auto max-w-4xl py-8 px-4 sm:px-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="flex gap-1 border-b border-border mb-6 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'appearance' && (
        <div className="space-y-8">
          <section>
            <p className="text-sm text-muted-foreground mb-3">Theme</p>
            <div className="flex gap-2 flex-wrap">
              {themes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTheme(id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    theme === id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-sm text-muted-foreground mb-3">Accent Color</p>
            <div className="flex gap-2 flex-wrap">
              {colorThemes.map(({ id, label, color }) => (
                <button
                  key={id}
                  onClick={() => setColorTheme(id)}
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full transition-all',
                    colorTheme === id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                  title={label}
                >
                  <div className={cn('h-5 w-5 rounded-full', color)} />
                  {colorTheme === id && (
                    <Check className="absolute h-3 w-3 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'playback' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium">Autoplay Next Episode</p>
              <p className="text-xs text-muted-foreground">Automatically play the next episode after a 5s countdown</p>
            </div>
            <button
              onClick={() => setAutoplayNext(!autoplayNext)}
              className={cn('relative h-6 w-11 rounded-full transition-colors', autoplayNext ? 'bg-primary' : 'bg-muted')}
            >
              <div className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform', autoplayNext ? 'translate-x-5' : 'translate-x-0.5')} />
            </button>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{watchHistory.length} items</p>
            {watchHistory.length > 0 && (
              <button
                onClick={clearWatchHistory}
                className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </button>
            )}
          </div>

          {watchHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No watch history yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {watchHistory.map((item: any) => {
                const pct = item.duration > 0 ? Math.round((item.progress / item.duration) * 100) : 0
                return (
                  <div
                    key={item.key}
                    onClick={() => {
                      const path = item.type === 'movie'
                        ? `/watch/movie/${item.id}`
                        : `/watch/tv/${item.id}?s=1&e=1`
                      navigate(path)
                    }}
                    className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.type === 'movie' ? 'Movie' : 'TV'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'backend' && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-2">Backend URL</p>
            <input
              type="url"
              value={omssUrl}
              onChange={(e) => setOmssUrl(e.target.value)}
              placeholder="Leave empty for default"
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Custom backend URL. Leave empty to use the default.
            </p>
          </div>

          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium mb-3 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Connection Status
            </p>
            {backendOnline === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                Checking...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <div className={cn('h-2 w-2 rounded-full', backendOnline ? 'bg-green-500' : 'bg-red-500')} />
                <span className={backendOnline ? 'text-green-500' : 'text-red-500'}>
                  {backendOnline ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'tmdb' && (
        <div className="space-y-6">
          <div className="rounded-lg border border-border/50 bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground mb-1">TMDB API Key</p>
            <p className="text-sm font-mono">0573•••••••••••••••••••••03b9</p>
            <p className="text-xs text-muted-foreground mt-1">Configured server-side</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Language</p>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              {locales.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              UI language and TMDB content language
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Region</p>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              {regions.map(r => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Affects TMDB content availability
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
