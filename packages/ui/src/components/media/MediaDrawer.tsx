import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { X, Play, Star, Plus, Check, ThumbsUp, Share2, Video, Users } from 'lucide-react'
import { TrailerDialog } from './TrailerDialog'
import { ErrorState } from '@/components/ui/ErrorState'
import { api } from '@/lib/api'
import { getImageUrl, cn } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'
import { useHistory } from '@/app/providers/history-provider'
import { useSavedList } from '@/app/providers/saved-list-provider'
import { useProfiles } from '@/app/providers/profiles-provider'
import { usePersistentState } from '@/hooks/useLocalStorage'

interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

interface CrewMember {
  id: number
  name: string
  job: string
}

interface Episode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  still_path: string | null
  air_date: string
  runtime?: number | null
}

interface Season {
  id: number
  name: string
  season_number: number
  episode_count: number
}

interface MediaData {
  id: number
  title: string
  overview: string
  backdrop_path: string | null
  poster_path: string | null
  vote_average: number
  release_date: string
  genres: { id: number; name: string }[]
  runtime: number
  number_of_seasons?: number
  original_language?: string
  status?: string
  credits: { cast: CastMember[]; crew?: CrewMember[] }
  created_by?: { id: number; name: string }[]
  production_companies?: { id: number; name: string }[]
  production_countries?: { iso_3166_1: string; name: string }[]
  recommendations: { results: any[] }
  videos: { results: { key: string; site: string; type: string }[] }
  external_ids?: { imdb_id?: string | null }
  seasons?: Season[]
  type: 'movie' | 'tv'
}

type Tab = 'overview' | 'episodes' | 'similar'

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}

export function MediaDrawer() {
  const { t } = useTranslation()
  const { payload, close, open: openDrawer } = useDrawer()
  const { items: historyItems } = useHistory()
  const { isSaved, toggle: toggleSaved } = useSavedList()
  const { activeProfileId } = useProfiles()
  const navigate = useNavigate()
  const [data, setData] = useState<MediaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [trailerOpen, setTrailerOpen] = useState(false)
  // Per-profile "liked" set — the heart button is a real, persisted toggle
  // rather than decoration. Keyed by profile so switching profiles switches likes.
  const [liked, setLiked] = usePersistentState<Record<string, true>>(`spiflix-liked-${activeProfileId}`, {})
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Read through a ref so this effect does NOT depend on trailerOpen —
  // re-running it when the trailer opens used to steal focus back to the
  // drawer's close button and trap Tab away from the trailer entirely.
  const trailerOpenRef = useRef(trailerOpen)
  trailerOpenRef.current = trailerOpen

  useEffect(() => {
    if (!payload) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      // While the trailer is up, its own dialog handles Escape and Tab.
      if (trailerOpenRef.current) return
      if (event.key === 'Escape') close()
      if (event.key !== 'Tab' || !drawerRef.current) return
      const focusable = drawerRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], select, input, [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      returnFocusRef.current?.focus()
    }
  }, [payload, close])

  // Lock background scroll while the drawer is open, and start each newly
  // opened title at the top (payload can change in place via recommendations).
  useEffect(() => {
    if (!payload) return
    drawerRef.current?.scrollTo({ top: 0 })
    setTab('overview')
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [payload])

  useEffect(() => {
    if (!payload) { setData(null); return }
    let cancelled = false
    setLoading(true)
    setLoadError(false)
    api.tmdb.details(payload.type, payload.id)
      .then((d: any) => {
        if (cancelled) return
        const mediaType = payload.type
        setData({
          ...d,
          // TMDB uses different field names per media type: TV details carry
          // `name`/`first_air_date` where movies carry `title`/`release_date`.
          title: d.title || d.name || '',
          release_date: d.release_date || d.first_air_date || '',
          seasons: d.seasons?.filter((s: Season) => s.episode_count > 0),
          type: mediaType,
        })
        if (mediaType === 'tv' && d.seasons?.length > 0) {
          // Prefer the first *real* season (season_number >= 1) over "Specials"
          // (season 0), which TMDB lists first and would otherwise open by
          // default. Fall back to Specials only if that's all a show has.
          const withEps = d.seasons.filter((s: Season) => s.episode_count > 0)
          const first = withEps.find((s: Season) => s.season_number >= 1) ?? withEps[0]
          if (first) setSelectedSeason(first.season_number)
        }
      })
      .catch(() => { if (!cancelled) { setData(null); setLoadError(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [payload, retryToken])

  useEffect(() => {
    // Wait until details for THIS payload have landed — otherwise switching
    // from show A to show B briefly fetches show B with show A's season.
    if (!payload || payload.type !== 'tv' || !data || data.id !== payload.id) return
    let cancelled = false
    setEpisodesLoading(true)
    api.tmdb.season(payload.id, selectedSeason)
      .then((d: any) => { if (!cancelled) setEpisodes(d.episodes || []) })
      .catch(() => { if (!cancelled) setEpisodes([]) })
      .finally(() => { if (!cancelled) setEpisodesLoading(false) })
    return () => { cancelled = true }
  }, [payload, data, selectedSeason])

  if (!payload) return null

  const isTv = data?.type === 'tv'
  const saved = data ? isSaved(data.id, data.type) : false
  const likeKey = data ? `${data.type}:${data.id}` : ''
  const isLiked = !!liked[likeKey]

  const runtimeStr = (() => {
    if (!data) return ''
    if (isTv) {
      const n = data.number_of_seasons || data.seasons?.length || 0
      return n > 0 ? t('media.seasons', { count: n }) : ''
    }
    if (!data.runtime) return ''
    const h = Math.floor(data.runtime / 60)
    const m = data.runtime % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  })()

  const director = isTv
    ? data?.created_by?.[0]?.name
    : data?.credits?.crew?.find(c => c.job === 'Director')?.name

  const handlePlay = () => {
    if (!data) return
    close()
    requestAnimationFrame(() => {
      if (data.type === 'movie') {
        navigate(`/watch/movie/${data.id}`)
      } else {
        // Resume the last-watched episode when we have one, not always S1E1.
        const last = historyItems.find(i => i.type === 'tv' && i.id === data.id)
        navigate(`/watch/tv/${data.id}?s=${last?.season ?? 1}&e=${last?.episode ?? 1}`)
      }
    })
  }

  const handleEpisodeClick = (ep: Episode) => {
    close()
    requestAnimationFrame(() => {
      navigate(`/watch/tv/${payload.id}?s=${ep.season_number}&e=${ep.episode_number}`)
    })
  }

  const handleToggleSaved = () => {
    if (!data) return
    toggleSaved({
      id: data.id,
      type: data.type,
      title: data.title,
      posterPath: data.poster_path,
      rating: data.vote_average,
      releaseDate: data.release_date,
    })
  }

  const handleToggleLike = () => {
    if (!likeKey) return
    setLiked(prev => {
      const next = { ...prev }
      if (next[likeKey]) delete next[likeKey]
      else next[likeKey] = true
      return next
    })
  }

  const handleShare = async () => {
    if (!data) return
    const url = `${window.location.origin}/?media=${data.type}:${data.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: data.title, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success(t('detail.linkCopied'))
      }
    } catch (err) {
      // A user dismissing the native share sheet throws AbortError — that's
      // not a failure, so only surface real copy problems.
      if ((err as Error)?.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(url)
          toast.success(t('detail.linkCopied'))
        } catch {
          toast.error(t('detail.linkCopyFailed'))
        }
      }
    }
  }

  const handleParty = () => {
    if (!data) return
    let load = `${data.type}:${data.id}`
    if (data.type === 'tv') {
      const last = historyItems.find(i => i.type === 'tv' && i.id === data.id)
      load += `:${last?.season ?? 1}:${last?.episode ?? 1}`
    }
    close()
    requestAnimationFrame(() => navigate(`/party/new?load=${load}`))
  }

  const trailer = data?.videos?.results?.find(
    (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  )

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: t('detail.tabs.overview'), show: true },
    { key: 'episodes', label: t('detail.tabs.episodes'), show: isTv },
    { key: 'similar', label: t('detail.tabs.similar'), show: (data?.recommendations?.results?.length ?? 0) > 0 },
  ]

  const facts: { label: string; value: string }[] = data ? [
    { label: t('detail.facts.genre'), value: data.genres?.map(g => g.name).join(', ') || '' },
    { label: t('detail.facts.release'), value: data.release_date ? data.release_date.slice(0, 4) : '' },
    { label: t('detail.facts.runtime'), value: runtimeStr },
    { label: t('detail.facts.rating'), value: data.vote_average > 0 ? `${data.vote_average.toFixed(1)} / 10` : '' },
    { label: t('detail.facts.type'), value: isTv ? t('detail.typeTv') : t('detail.typeMovie') },
    { label: t('detail.facts.language'), value: data.original_language ? data.original_language.toUpperCase() : '' },
    { label: t('detail.facts.status'), value: data.status || '' },
  ].filter(f => f.value) : []

  const sideMeta: { label: string; value: string }[] = data ? [
    { label: isTv ? t('detail.creator') : t('detail.director'), value: director || '' },
    { label: t('detail.studio'), value: data.production_companies?.[0]?.name || '' },
    { label: t('detail.country'), value: data.production_countries?.[0]?.name || '' },
  ].filter(m => m.value) : []

  const iconBtn = 'flex h-12 w-12 items-center justify-center rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.06] text-foreground transition-colors hover:bg-foreground/[0.12]'

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-3 sm:p-5"
      onClick={close}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <div
        ref={drawerRef}
        className="sfx-pop relative z-10 my-auto w-full max-w-5xl max-h-[92vh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-[22px] bg-[var(--surface)] shadow-[0_40px_100px_rgba(0,0,0,0.7)] ring-1 ring-[var(--hairline)]"
        data-lenis-prevent
        role="dialog"
        aria-modal="true"
        aria-label={data?.title || 'Media details'}
        onClick={e => e.stopPropagation()}
      >
        {/* Always rendered (not just once data loads) so it exists as soon as the
            dialog opens — the focus-trap effect above focuses this on mount, and
            it also gives the loading/error states a visible way to close. */}
        <button ref={closeRef} onClick={close} aria-label="Close media details" className="absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/80">
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : loadError ? (
          <div className="h-72">
            <ErrorState message={t('drawer.loadError')} onRetry={() => setRetryToken(n => n + 1)} />
          </div>
        ) : data ? (
          <>
            {/* Cinematic hero */}
            <div className="relative h-[300px] overflow-hidden rounded-t-[22px] sm:h-[380px] lg:h-[420px]">
              {data.backdrop_path ? (
                <img src={getImageUrl(data.backdrop_path, 'w1280')!} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-[var(--surface)]/25 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--surface)]/85 via-[var(--surface)]/25 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 lg:p-10">
                <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                  <span className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-primary-foreground">
                    {isTv ? t('detail.series') : t('detail.film')}
                  </span>
                  {data.genres?.[0] && (
                    <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/85">
                      {data.genres[0].name}
                    </span>
                  )}
                </div>
                <h2 className="mb-4 max-w-[80%] text-3xl font-extrabold leading-[0.98] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {data.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                  {data.vote_average > 0 && (
                    <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--star)' }}>
                      <Star className="h-4 w-4 fill-current" />
                      {data.vote_average.toFixed(1)}
                      <span className="font-medium text-white/50">/ 10</span>
                    </span>
                  )}
                  {data.release_date && <span className="text-white/80">{data.release_date.slice(0, 4)}</span>}
                  {runtimeStr && <span className="text-white/80">{runtimeStr}</span>}
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 lg:px-10 lg:pb-11 lg:pt-8">
              <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_288px]">
                {/* Main column */}
                <div className="min-w-0">
                  {/* Actions */}
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handlePlay}
                      className="flex items-center gap-2 rounded-full bg-primary px-8 py-3 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:scale-[1.03] hover:brightness-110"
                    >
                      <Play className="h-[18px] w-[18px] fill-current" />
                      {t('detail.play')}
                    </button>
                    {trailer && (
                      <button
                        onClick={() => setTrailerOpen(true)}
                        className="flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.06] px-6 py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.12]"
                      >
                        <Video className="h-4 w-4" />
                        {t('detail.trailer')}
                      </button>
                    )}
                    <button
                      onClick={handleToggleSaved}
                      className={iconBtn}
                      aria-label={saved ? t('detail.inList') : t('detail.myList')}
                      title={saved ? t('detail.inList') : t('detail.myList')}
                      aria-pressed={saved}
                    >
                      {saved
                        ? <Check className="h-5 w-5" style={{ color: 'var(--accent)' }} strokeWidth={2.6} />
                        : <Plus className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={handleToggleLike}
                      className={iconBtn}
                      aria-label={isLiked ? t('detail.liked') : t('detail.like')}
                      title={isLiked ? t('detail.liked') : t('detail.like')}
                      aria-pressed={isLiked}
                    >
                      <ThumbsUp
                        className={cn('h-[18px] w-[18px]', isLiked && 'fill-current')}
                        style={isLiked ? { color: 'var(--accent)' } : undefined}
                      />
                    </button>
                    <button onClick={handleShare} className={iconBtn} aria-label={t('detail.share')} title={t('detail.share')}>
                      <Share2 className="h-[18px] w-[18px]" />
                    </button>
                    <button onClick={handleParty} className={iconBtn} aria-label={t('party.watchTogether')} title={t('party.watchTogether')}>
                      <Users className="h-[18px] w-[18px]" />
                    </button>
                  </div>

                  {/* Synopsis */}
                  <p className="mb-7 max-w-[620px] text-[15px] leading-relaxed text-muted-foreground">
                    {data.overview || t('detail.noOverview')}
                  </p>

                  {/* Tabs */}
                  <div className="mb-6 flex gap-7 border-b border-[var(--hairline)]">
                    {tabs.filter(tb => tb.show).map(tb => (
                      <button
                        key={tb.key}
                        onClick={() => setTab(tb.key)}
                        className={cn(
                          'relative pb-3 text-sm font-bold transition-colors',
                          tab === tb.key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {tb.label}
                        {tab === tb.key && (
                          <span className="absolute inset-x-0 -bottom-px h-0.5 rounded bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Overview tab */}
                  {tab === 'overview' && (
                    <div className="grid gap-x-7 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(min(140px,100%),1fr))]">
                      {facts.map(f => (
                        <div key={f.label}>
                          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.label}</p>
                          <p className="text-sm text-foreground">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Episodes tab (TV) */}
                  {tab === 'episodes' && isTv && data.seasons && (
                    <div>
                      {data.seasons.length > 1 && (
                        <div className="mb-4">
                          <select
                            value={selectedSeason}
                            onChange={e => setSelectedSeason(Number(e.target.value))}
                            className="rounded-lg border border-[var(--hairline)] bg-foreground/[0.04] px-3 py-1.5 text-sm outline-none"
                            aria-label={t('detail.season')}
                          >
                            {data.seasons.map(sn => (
                              <option key={sn.id} value={sn.season_number}>{sn.name || `Season ${sn.season_number}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {episodesLoading ? (
                        <div className="flex h-32 items-center justify-center">
                          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {episodes.map(ep => (
                            <button
                              key={ep.id}
                              onClick={() => handleEpisodeClick(ep)}
                              className="group flex gap-4 rounded-xl p-3 text-left transition-colors hover:bg-foreground/[0.05]"
                            >
                              <div className="relative h-[84px] w-[150px] flex-none overflow-hidden rounded-lg bg-muted">
                                {ep.still_path ? (
                                  <img src={getImageUrl(ep.still_path, 'w300')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{t('drawer.noImage')}</div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60">
                                    <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline justify-between gap-3">
                                  <p className="mb-1 truncate text-sm font-bold text-foreground">{ep.episode_number}. {ep.name}</p>
                                  {ep.runtime ? <span className="flex-none text-xs text-muted-foreground">{ep.runtime}m</span> : null}
                                </div>
                                <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{ep.overview || t('drawer.noOverview')}</p>
                              </div>
                            </button>
                          ))}
                          {episodes.length === 0 && (
                            <p className="py-6 text-center text-sm text-muted-foreground">{t('episodes.none')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* More Like This tab */}
                  {tab === 'similar' && (
                    <div className="grid gap-x-4 gap-y-5 [grid-template-columns:repeat(auto-fill,minmax(min(120px,100%),1fr))]">
                      {data.recommendations.results.slice(0, 12).map((rec: any) => (
                        <button
                          key={rec.id}
                          // Open the rec's details like every other card in the app
                          // instead of jumping straight into playback.
                          onClick={() => openDrawer({ id: rec.id, type: rec.media_type === 'tv' || rec.media_type === 'movie' ? rec.media_type : data.type })}
                          className="group text-left"
                        >
                          <div className="relative aspect-[2/3] overflow-hidden rounded-[9px] bg-muted transition-transform group-hover:scale-[1.04]">
                            {rec.poster_path ? (
                              <img src={getImageUrl(rec.poster_path, 'w342')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center px-2 text-center text-xs text-muted-foreground">{rec.title || rec.name}</div>
                            )}
                          </div>
                          <p className="mt-2 truncate text-xs font-semibold text-foreground">{rec.title || rec.name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sidebar: cast + metadata */}
                <aside className="min-w-0">
                  {data.credits?.cast?.length > 0 && (
                    <>
                      <h3 className="mb-3.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">{t('detail.cast')}</h3>
                      <div className="mb-6 flex flex-col gap-3">
                        {data.credits.cast.slice(0, 6).map(person => (
                          <div key={person.id} className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold text-muted-foreground">
                              {person.profile_path
                                ? <img src={getImageUrl(person.profile_path, 'w185')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                                : initials(person.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-foreground">{person.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{person.character}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {sideMeta.length > 0 && (
                    <>
                      {data.credits?.cast?.length > 0 && <div className="mb-5 h-px bg-[var(--hairline)]" />}
                      <div className="flex flex-col gap-3.5">
                        {sideMeta.map(m => (
                          <div key={m.label}>
                            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.label}</p>
                            <p className="text-[13px] leading-snug text-foreground">{m.value}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </aside>
              </div>
            </div>
          </>
        ) : null}
      </div>
      {trailer && (
        <TrailerDialog videoKey={trailer.key} open={trailerOpen} onClose={() => setTrailerOpen(false)} />
      )}
    </div>
  )
}
