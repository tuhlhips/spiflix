import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

interface Episode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  still_path: string | null
  air_date: string
}

interface Season {
  id: number
  name: string
  season_number: number
  episode_count: number
}

interface EpisodeSidebarProps {
  tmdbId: number
  currentSeason: number
  currentEpisode: number
  seasons: Season[]
  onClose: () => void
}

export function EpisodeSidebar({ tmdbId, currentSeason, currentEpisode, seasons, onClose }: EpisodeSidebarProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [selectedSeason, setSelectedSeason] = useState(currentSeason)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.tmdb.season(tmdbId, selectedSeason)
      .then(data => { if (!cancelled) setEpisodes(data.episodes || []) })
      .catch(() => { if (!cancelled) setEpisodes([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tmdbId, selectedSeason])

  // Escape closes the sidebar.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Bring the currently-playing episode into view once its season loads —
  // without this, long seasons mean scroll-hunting for where you are.
  const activeEpisodeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeEpisodeRef.current?.scrollIntoView({ block: 'center' })
  }, [episodes, order])

  const selectEpisode = (ep: Episode) => {
    navigate(`/watch/tv/${tmdbId}?s=${ep.season_number}&e=${ep.episode_number}`)
  }

  const validSeasons = seasons.filter(s => s.episode_count > 0)

  return (
    <>
      {/* Click-away backdrop — transparent, sits over the player. */}
      <div className="absolute inset-0 z-20" onClick={onClose} />
      <div className="absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col bg-background/95 backdrop-blur-xl border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">{t('episodes.title')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {order === 'asc' ? t('episodes.newestFirst') : t('episodes.oldestFirst')}
          </button>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Season selector */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <button
          onClick={() => {
            const idx = validSeasons.findIndex(s => s.season_number === selectedSeason)
            if (idx > 0) setSelectedSeason(validSeasons[idx - 1].season_number)
          }}
          disabled={validSeasons.findIndex(s => s.season_number === selectedSeason) <= 0}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          value={selectedSeason}
          onChange={e => setSelectedSeason(Number(e.target.value))}
          className="flex-1 rounded-md bg-muted px-2 py-1.5 text-sm font-medium outline-none"
        >
          {validSeasons.map(s => (
            <option key={s.id} value={s.season_number}>{s.name || `Season ${s.season_number}`}</option>
          ))}
        </select>
        <button
          onClick={() => {
            const idx = validSeasons.findIndex(s => s.season_number === selectedSeason)
            if (idx < validSeasons.length - 1) setSelectedSeason(validSeasons[idx + 1].season_number)
          }}
          disabled={validSeasons.findIndex(s => s.season_number === selectedSeason) >= validSeasons.length - 1}
          className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Episode list */}
      <div className="flex-1 overflow-y-auto" data-lenis-prevent>
        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : episodes.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {t('episodes.none')}
          </div>
        ) : (
          <div className="space-y-1 p-3">
            {(order === 'desc' ? [...episodes].reverse() : episodes).map(ep => {
              const isActive = ep.season_number === currentSeason && ep.episode_number === currentEpisode
              return (
                <button
                  key={ep.id}
                  ref={isActive ? activeEpisodeRef : undefined}
                  onClick={() => selectEpisode(ep)}
                  className={`flex w-full gap-3 rounded-lg p-2 text-left transition-colors ${
                    isActive
                      ? 'bg-primary/10 ring-1 ring-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                    {ep.still_path ? (
                      <img src={getImageUrl(ep.still_path, 'w300')!} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                        {t('drawer.noImage')}
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-xs text-white">
                      {ep.episode_number}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium truncate ${isActive ? 'text-primary' : ''}`}>
                      {ep.episode_number}. {ep.name}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {ep.overview || t('drawer.noOverview')}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
      </div>
    </>
  )
}
