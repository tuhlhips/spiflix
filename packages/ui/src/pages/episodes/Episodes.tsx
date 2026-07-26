import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft, Star, Play, Plus, Check, Download } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'
import { ErrorState } from '@/components/ui/ErrorState'
import { useSavedList } from '@/app/providers/saved-list-provider'
import { useHistory } from '@/app/providers/history-provider'

interface Season {
  id: number
  name: string
  season_number: number
  episode_count: number
}

interface Episode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  still_path: string | null
  runtime?: number | null
}

interface Details {
  id: number
  title: string
  backdrop_path: string | null
  vote_average: number
  number_of_seasons?: number
  genres: { id: number; name: string }[]
  poster_path: string | null
  release_date: string
  seasons: Season[]
}

export default function Episodes() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const showId = Number(id)
  const { isSaved, toggle } = useSavedList()
  const { items: history } = useHistory()

  const [data, setData] = useState<Details | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [season, setSeason] = useState(1)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [epLoading, setEpLoading] = useState(false)

  useEffect(() => {
    if (!showId) return
    let cancelled = false
    setLoadError(false)
    setData(null)
    api.tmdb.details('tv', showId)
      .then((d: any) => {
        if (cancelled) return
        const seasons: Season[] = (d.seasons || []).filter((s: Season) => s.episode_count > 0)
        setData({
          ...d,
          title: d.name || d.title || '',
          release_date: d.first_air_date || d.release_date || '',
          seasons,
        })
        const first = seasons.find(s => s.season_number >= 1) ?? seasons[0]
        if (first) setSeason(first.season_number)
      })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [showId, retry])

  useEffect(() => {
    if (!data || data.id !== showId) return
    let cancelled = false
    setEpLoading(true)
    api.tmdb.season(showId, season)
      .then((d: any) => { if (!cancelled) setEpisodes(d.episodes || []) })
      .catch(() => { if (!cancelled) setEpisodes([]) })
      .finally(() => { if (!cancelled) setEpLoading(false) })
    return () => { cancelled = true }
  }, [data, showId, season])

  // Per-episode watched progress, keyed for O(1) lookup in the render loop.
  const progressByEp = useMemo(() => {
    const map = new Map<string, number>()
    for (const h of history) {
      if (h.type === 'tv' && h.id === showId && h.season != null && h.episode != null && h.duration > 0) {
        map.set(`${h.season}:${h.episode}`, Math.min(1, h.currentTime / h.duration))
      }
    }
    return map
  }, [history, showId])

  const saved = data ? isSaved(data.id, 'tv') : false
  const lastWatched = history.find(h => h.type === 'tv' && h.id === showId)

  const playLabel = lastWatched
    ? t('episodes.resume', { season: lastWatched.season ?? 1, episode: lastWatched.episode ?? 1 })
    : t('episodes.playFrom', { season })

  const handlePlay = () => {
    const s = lastWatched?.season ?? season
    const e = lastWatched?.episode ?? 1
    navigate(`/watch/tv/${showId}?s=${s}&e=${e}`)
  }

  if (loadError) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4 pt-20">
        <ErrorState message={t('episodes.loadError')} onRetry={() => setRetry(n => n + 1)} />
      </main>
    )
  }

  return (
    <main className="sfx-fade">
      {/* Banner */}
      <section className="relative min-h-[340px] overflow-hidden" style={{ height: '46vh' }}>
        {data?.backdrop_path ? (
          <img src={getImageUrl(data.backdrop_path, 'w1280')!} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />

        <div className="relative z-10 flex h-full items-end pb-9">
          <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-8 lg:px-12">
            <button
              onClick={() => navigate('/shows')}
              className="mb-3.5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/70 transition-colors hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('episodes.allSeries')}
            </button>
            <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
              {data?.title ?? ' '}
            </h1>
            <div className="mb-4 flex flex-wrap items-center gap-3.5 text-sm">
              {data && data.vote_average > 0 && (
                <span className="flex items-center gap-1.5 font-bold" style={{ color: 'var(--star)' }}>
                  <Star className="h-4 w-4 fill-current" />{data.vote_average.toFixed(1)}
                </span>
              )}
              {data?.number_of_seasons ? (
                <span className="text-white/75">{t('media.seasons', { count: data.number_of_seasons })}</span>
              ) : null}
              {data?.genres?.[0] && (
                <span className="rounded-full border border-white/25 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/85">
                  {data.genres[0].name}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handlePlay}
                disabled={!data}
                className="flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:scale-[1.03] hover:brightness-110 disabled:opacity-50"
              >
                <Play className="h-4 w-4 fill-current" />
                {playLabel}
              </button>
              <button
                onClick={() => data && toggle({ id: data.id, type: 'tv', title: data.title, posterPath: data.poster_path, rating: data.vote_average, releaseDate: data.release_date })}
                disabled={!data}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 disabled:opacity-50"
              >
                {saved
                  ? <Check className="h-4 w-4" style={{ color: 'var(--accent)' }} strokeWidth={2.6} />
                  : <Plus className="h-4 w-4" />}
                {t('episodes.myList')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Season pills + episode list */}
      <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-2 sm:px-8 lg:px-12">
        {data && data.seasons.length > 0 && (
          <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto py-1">
            {data.seasons.map(s => {
              const active = s.season_number === season
              return (
                <button
                  key={s.id}
                  onClick={() => setSeason(s.season_number)}
                  className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-foreground/[0.06] text-muted-foreground hover:text-foreground'}`}
                >
                  {s.name || `${t('episodes.season')} ${s.season_number}`}
                </button>
              )
            })}
          </div>
        )}

        {epLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : episodes.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">{t('episodes.none')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {episodes.map(ep => {
              const pct = progressByEp.get(`${ep.season_number}:${ep.episode_number}`)
              return (
                <div
                  key={ep.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/watch/tv/${showId}?s=${ep.season_number}&e=${ep.episode_number}`)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/watch/tv/${showId}?s=${ep.season_number}&e=${ep.episode_number}`) } }}
                  className="group flex cursor-pointer items-center gap-4 rounded-2xl p-3.5 transition-colors hover:bg-foreground/[0.05]"
                >
                  <span className="w-6 flex-none text-center text-[17px] font-bold text-muted-foreground/70">{ep.episode_number}</span>
                  <div className="relative h-[94px] w-[168px] flex-none overflow-hidden rounded-[9px] bg-muted">
                    {ep.still_path ? (
                      <img src={getImageUrl(ep.still_path, 'w300')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">{t('drawer.noImage')}</div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/85 bg-black/55">
                        <Play className="ml-0.5 h-4 w-4 fill-white text-white" />
                      </span>
                    </div>
                    {pct != null && (
                      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25">
                        <div className="h-full bg-primary" style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-[15px] font-bold text-foreground">{ep.name}</p>
                      {ep.runtime ? <span className="flex-none text-[13px] text-muted-foreground">{ep.runtime}m</span> : null}
                    </div>
                    <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{ep.overview || t('drawer.noOverview')}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toast.info(t('episodes.downloadUnavailable')) }}
                    aria-label={t('episodes.download')}
                    title={t('episodes.download')}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[var(--hairline)] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
