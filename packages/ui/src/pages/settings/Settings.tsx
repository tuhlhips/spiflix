import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme, type Theme } from '@/app/providers/theme-provider'
import { usePersistentState } from '@/hooks/useLocalStorage'
import {
  Palette, Play, Trash2, History, Server, Globe, Check, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useHistory } from '@/app/providers/history-provider'
import { getRegionOptions } from '@/utils/regions'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Switch } from '@/components/ui/Switch'
import { Segmented } from '@/components/ui/Segmented'
import { useAppSettings } from '@/app/providers/settings-provider'

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

const regions = getRegionOptions()

const TABS = ['appearance', 'playback', 'history', 'backend', 'tmdb'] as const
type Tab = (typeof TABS)[number]

/** One settings row — label + description on the left, a control on the right.
 * `stacked` drops the control below the label (used for the full-width URL input). */
function Row({ label, desc, children, stacked }: { label: string; desc?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cn('border-b border-[var(--hairline)] px-6 py-5 last:border-b-0', stacked ? 'space-y-3' : 'flex items-center justify-between gap-6')}>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-foreground">{label}</p>
        {desc && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{desc}</p>}
      </div>
      <div className={stacked ? '' : 'flex-none'}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation('settings')
  const navigate = useNavigate()

  // Deep-linkable tabs: the active tab lives in the URL (?tab=backend) so a tab
  // can be linked to directly (e.g. from the player's "server unreachable" CTA)
  // and survives refresh / back-forward.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const activeTab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'appearance'
  const setActiveTab = (tab: Tab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'appearance') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const { theme, colorTheme, setTheme, setColorTheme } = useTheme()
  const [autoplayNext, setAutoplayNext] = usePersistentState('spiflix-autoplay-next', true)
  const [autoSkipIntro, setAutoSkipIntro] = usePersistentState('spiflix-auto-skip-intro', false)
  const [omssUrl, setOmssUrl] = usePersistentState('spiflix-omss-url', '')
  // One selector drives both the UI language (i18next) and the TMDB content
  // language (titles/overviews). i18next's LanguageDetector persists the choice
  // to 'spiflix-locale', which lib/api.ts also reads for the TMDB `language`
  // param. A reload re-fetches already-mounted TMDB data in the new language.
  const locale = i18n.resolvedLanguage?.split('-')[0] || 'en'
  const setLocale = (code: string) => {
    if (code === locale) return
    void i18n.changeLanguage(code)
    try { localStorage.setItem('spiflix-locale', code) } catch {}
    location.reload()
  }
  const [region, setRegion] = usePersistentState('spiflix-region', 'US')
  const { settings, setSetting } = useAppSettings()
  const { items: watchHistory, clear: clearWatchHistory } = useHistory()
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [confirm, setConfirm] = useState<null | 'clear-history' | 'reset-all'>(null)

  const resetAll = () => {
    try { localStorage.clear() } catch {}
    location.href = '/'
  }

  // Re-test the connection whenever the custom backend URL changes (debounced),
  // not just once on mount — otherwise the "Connected" badge reflects the
  // default backend while the user edits a custom one. api.health() reads the
  // override through getApiBase() at call time.
  useEffect(() => {
    setBackendOnline(null)
    const timer = setTimeout(() => {
      api.health().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
    }, 600)
    return () => clearTimeout(timer)
  }, [omssUrl])

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'appearance', label: t('tabs.appearance'), icon: Palette },
    { id: 'playback', label: t('tabs.playback'), icon: Play },
    { id: 'history', label: t('tabs.history'), icon: History },
    { id: 'backend', label: t('tabs.backend'), icon: Server },
    { id: 'tmdb', label: t('tabs.tmdb'), icon: Globe },
  ]

  const selectClass = 'rounded-lg border border-[var(--hairline-strong)] bg-foreground/[0.04] px-3 py-2 text-sm font-medium outline-none focus:border-primary'

  return (
    <main className="sfx-fade mx-auto max-w-[1080px] px-4 pb-20 pt-24 sm:px-8 lg:px-12">
      <h1 className="mb-7 text-4xl font-extrabold tracking-tight">{t('title')}</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sidebar */}
        <nav className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-24 lg:mx-0 lg:h-fit lg:flex-col lg:overflow-visible lg:px-0">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition-colors',
                activeTab === id
                  ? 'bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-current={activeTab === id ? 'page' : undefined}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </button>
          ))}
        </nav>

        {/* Panel */}
        <div className="sfx-up min-w-0">
          <div className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-foreground/[0.025]">
            <div className="border-b border-[var(--hairline)] px-6 py-5">
              <h2 className="text-lg font-bold">{t(`tabs.${activeTab}`)}</h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{t(`panel.${activeTab}`)}</p>
            </div>

            {activeTab === 'appearance' && (
              <div>
                <Row label={t('appearance.theme')} desc={t('appearance.theme_desc')}>
                  <Segmented<Theme>
                    value={theme}
                    onChange={setTheme}
                    aria-label={t('appearance.theme')}
                    options={[
                      { value: 'dark', label: t('appearance.dark') },
                      { value: 'light', label: t('appearance.light') },
                      { value: 'system', label: t('appearance.system') },
                    ]}
                  />
                </Row>
                <Row label={t('appearance.accent_color')} desc={t('appearance.accent_desc')}>
                  <div className="flex flex-wrap gap-2.5">
                    {colorThemes.map(({ id, label, color }) => (
                      <button
                        key={id}
                        onClick={() => setColorTheme(id)}
                        title={label}
                        aria-label={label}
                        aria-pressed={colorTheme === id}
                        className={cn(
                          'relative flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110',
                          color,
                          colorTheme === id && 'ring-2 ring-white ring-offset-2 ring-offset-[var(--surface)]',
                        )}
                      >
                        {colorTheme === id && <Check className="h-3.5 w-3.5 text-white drop-shadow" strokeWidth={3} />}
                      </button>
                    ))}
                  </div>
                </Row>
              </div>
            )}

            {activeTab === 'playback' && (
              <div>
                <Row label={t('playback.autoplay')} desc={t('playback.autoplay_desc')}>
                  <Switch checked={autoplayNext} onChange={setAutoplayNext} label={t('playback.autoplay')} />
                </Row>
                <Row label={t('playback.auto_skip_intro')} desc={t('playback.auto_skip_intro_desc')}>
                  <Switch checked={autoSkipIntro} onChange={setAutoSkipIntro} label={t('playback.auto_skip_intro')} />
                </Row>
                <Row label={t('playback.reduce_motion')} desc={t('playback.reduce_motion_desc')}>
                  <Switch checked={settings.reduceMotion} onChange={v => setSetting('reduceMotion', v)} label={t('playback.reduce_motion')} />
                </Row>
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <div className="flex items-center justify-between gap-4 border-b border-[var(--hairline)] px-6 py-4">
                  <p className="text-[13px] text-muted-foreground">{watchHistory.length} {t('history.items')}</p>
                  {watchHistory.length > 0 && (
                    <button
                      onClick={() => setConfirm('clear-history')}
                      className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t('history.clear_all')}
                    </button>
                  )}
                </div>
                {watchHistory.length === 0 ? (
                  <p className="px-6 py-12 text-center text-sm text-muted-foreground">{t('history.empty')}</p>
                ) : (
                  <div className="max-h-[28rem] overflow-y-auto">
                    {watchHistory.map((item) => {
                      const pct = item.duration > 0 ? Math.round((item.currentTime / item.duration) * 100) : 0
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => navigate(item.type === 'movie' ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}?s=${item.season ?? 1}&e=${item.episode ?? 1}`)}
                          className="flex w-full items-center justify-between gap-4 border-b border-[var(--hairline)] px-6 py-4 text-left transition-colors last:border-b-0 hover:bg-foreground/[0.04]"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{item.title || `#${item.id}`}</p>
                            <p className="text-xs text-muted-foreground">{item.type === 'movie' ? t('history.movie') : t('history.tv')}</p>
                          </div>
                          <div className="flex flex-none items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'backend' && (
              <div>
                <Row label={t('backend.url')} desc={t('backend.url_desc')} stacked>
                  <input
                    type="url"
                    value={omssUrl}
                    onChange={(e) => setOmssUrl(e.target.value)}
                    placeholder={t('backend.url_placeholder')}
                    className="w-full rounded-lg border border-[var(--hairline-strong)] bg-foreground/[0.04] px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                </Row>
                <Row label={t('backend.connection_status')}>
                  {backendOnline === null ? (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                      {t('backend.checking')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={cn('h-2 w-2 rounded-full', backendOnline ? 'bg-green-500' : 'bg-red-500')} />
                      <span className={backendOnline ? 'text-green-500' : 'text-red-500'}>
                        {backendOnline ? t('backend.connected') : t('backend.disconnected')}
                      </span>
                    </span>
                  )}
                </Row>
              </div>
            )}

            {activeTab === 'tmdb' && (
              <div>
                <Row label={t('tmdb.api_key')} desc={t('tmdb.configured')}>
                  <span className="font-mono text-sm text-muted-foreground">0573••••••03b9</span>
                </Row>
                <Row label={t('tmdb.language')} desc={t('tmdb.language_desc')}>
                  <select value={locale} onChange={(e) => setLocale(e.target.value)} className={selectClass}>
                    {locales.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Row>
                <Row label={t('tmdb.region')} desc={t('tmdb.region_desc')}>
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={selectClass}>
                    {regions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Row>
              </div>
            )}
          </div>

          {/* Danger zone — always visible, tab-independent */}
          <div className="mt-5 flex items-center justify-between gap-4 rounded-[18px] border border-destructive/30 bg-destructive/5 px-6 py-5">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{t('reset.title')}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{t('reset.desc')}</p>
            </div>
            <button
              onClick={() => setConfirm('reset-all')}
              className="flex shrink-0 items-center gap-2 rounded-full border border-destructive/50 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <RotateCcw className="h-4 w-4" />
              {t('reset.button')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'clear-history'}
        title={t('history.clear_confirm_title')}
        description={t('history.clear_confirm_desc')}
        confirmLabel={t('history.clear_all')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => { clearWatchHistory(); setConfirm(null) }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'reset-all'}
        title={t('reset.confirm_title')}
        description={t('reset.confirm_desc')}
        confirmLabel={t('reset.button')}
        cancelLabel={t('common.cancel')}
        onConfirm={resetAll}
        onCancel={() => setConfirm(null)}
      />
    </main>
  )
}
