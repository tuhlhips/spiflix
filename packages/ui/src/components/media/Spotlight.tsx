import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Play, Info, Star, List } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'

interface Featured {
  id: number
  title: string
  overview: string
  backdropPath: string | null
  rating: number
  year: string
}

/**
 * Single featured "spotlight" hero for the Movies / TV pages (the design uses a
 * static spotlight here, distinct from Home's rotating carousel). Picks the top
 * trending title, then enriches it with details (genre, season count) — the
 * season count is free here since we fetch the details anyway.
 */
export function Spotlight({ type }: { type: 'movie' | 'tv' }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { open: openDrawer } = useDrawer()
  const [item, setItem] = useState<Featured | null>(null)
  const [genre, setGenre] = useState<string | null>(null)
  const [seasons, setSeasons] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setItem(null); setGenre(null); setSeasons(null)
    api.tmdb.trending(type)
      .then(list => {
        if (cancelled) return
        const pick = (list || []).find((i: any) => i.backdrop_path) || (list || [])[0]
        if (!pick) return
        setItem({
          id: pick.id,
          title: pick.title || pick.name || '',
          overview: pick.overview || '',
          backdropPath: pick.backdrop_path,
          rating: pick.vote_average || 0,
          year: (pick.release_date || pick.first_air_date || '').slice(0, 4),
        })
        // Enrich (genre + season count) — one detail fetch for the hero only.
        api.tmdb.details(type, pick.id)
          .then((d: any) => {
            if (cancelled) return
            setGenre(d.genres?.[0]?.name ?? null)
            if (type === 'tv' && d.number_of_seasons) setSeasons(d.number_of_seasons)
          })
          .catch(() => {})
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [type])

  if (!item) return <div className="h-[70vh] md:h-[86vh] bg-gradient-to-b from-muted/40 to-background" />

  const play = () => navigate(type === 'movie' ? `/watch/movie/${item.id}` : `/watch/tv/${item.id}?s=1&e=1`)

  return (
    <section className="relative h-[70vh] md:h-[86vh] overflow-hidden">
      {item.backdropPath && (
        <img src={getImageUrl(item.backdropPath, 'w1280')!} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {/* Diagonal + bottom fades (handoff spec) */}
      <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(0,0,0,0.9)_6%,rgba(0,0,0,0.4)_48%,transparent_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-background)_2%,transparent_55%)]" />

      <div className="relative z-10 flex h-full items-end pb-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-12">
          <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <p className="mb-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-primary">
              {type === 'movie' ? t('media.featuredMovie') : t('media.featuredSeries')}
            </p>
            <h1 className="mb-3 text-4xl font-extrabold leading-[1.02] tracking-tight drop-shadow-2xl sm:text-5xl lg:text-6xl">
              {item.title}
            </h1>
            <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/80">
              {item.rating > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-yellow-400">
                  <Star className="h-4 w-4 fill-current" />{item.rating.toFixed(1)}
                </span>
              )}
              {item.year && <span>{item.year}</span>}
              {seasons && <span>{t('media.seasons', { count: seasons })}</span>}
              {genre && <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{genre}</span>}
            </div>
            <p className="mb-6 max-w-lg text-[15px] leading-relaxed text-white/75 line-clamp-3">{item.overview}</p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={play}
                className="flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:brightness-110"
              >
                <Play className="h-[17px] w-[17px] fill-current" />
                {type === 'movie' ? t('media.watchNow') : t('media.playFirst')}
              </button>
              <button
                onClick={() => type === 'tv' ? navigate(`/tv/${item.id}/episodes`) : openDrawer({ id: item.id, type })}
                className="flex items-center gap-2 rounded-full border border-white/28 bg-white/10 px-6 py-3 text-[15px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                {type === 'movie' ? <Info className="h-4 w-4" /> : <List className="h-4 w-4" />}
                {type === 'movie' ? t('media.moreInfo') : t('media.episodesInfo')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
