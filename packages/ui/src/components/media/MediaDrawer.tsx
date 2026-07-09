import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { X, Play, Star, Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import { TrailerDialog } from './TrailerDialog'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'

interface CastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
}

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
  credits: { cast: CastMember[] }
  recommendations: { results: any[] }
  videos: { results: { key: string; site: string; type: string }[] }
  seasons?: Season[]
  type: 'movie' | 'tv'
}

export function MediaDrawer() {
  const { t } = useTranslation()
  const { payload, close } = useDrawer()
  const navigate = useNavigate()
  const [data, setData] = useState<MediaData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [episodeView, setEpisodeView] = useState<'grid' | 'list'>('grid')
  const [trailerOpen, setTrailerOpen] = useState(false)

  useEffect(() => {
    if (!payload) { setData(null); return }
    setLoading(true)
    api.tmdb.details(payload.type, payload.id)
      .then((d: any) => {
        const mediaType = payload.type
        setData({
          ...d,
          seasons: d.seasons?.filter((s: Season) => s.episode_count > 0),
          type: mediaType,
        })
        if (mediaType === 'tv' && d.seasons?.length > 0) {
          const first = d.seasons.find((s: Season) => s.episode_count > 0)
          if (first) setSelectedSeason(first.season_number)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [payload])

  useEffect(() => {
    if (!payload || payload.type !== 'tv') return
    setEpisodesLoading(true)
    api.tmdb.season(payload.id, selectedSeason)
      .then((d: any) => setEpisodes(d.episodes || []))
      .catch(() => setEpisodes([]))
      .finally(() => setEpisodesLoading(false))
  }, [payload, selectedSeason])

  if (!payload) return null

  const handlePlay = () => {
    if (!data) return
    close()
    requestAnimationFrame(() => {
      if (data.type === 'movie') navigate(`/watch/movie/${data.id}`)
      else navigate(`/watch/tv/${data.id}?s=1&e=1`)
    })
  }

  const handleEpisodeClick = (ep: Episode) => {
    close()
    requestAnimationFrame(() => {
      navigate(`/watch/tv/${payload.id}?s=${ep.season_number}&e=${ep.episode_number}`)
    })
  }

  const trailer = data?.videos?.results?.find(
    (v: any) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-4xl max-h-[95vh] overflow-y-auto rounded-t-2xl bg-background shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : data ? (
          <>
            {/* Hero */}
            <div className="relative h-[40vh] sm:h-[50vh] overflow-hidden rounded-t-2xl">
              {data.backdrop_path && (
                <img src={getImageUrl(data.backdrop_path, 'original')!} alt="" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />

              <button onClick={close} className="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white backdrop-blur-sm hover:bg-black/70">
                <X className="h-5 w-5" />
              </button>

              <div className="absolute bottom-0 left-0 right-0 p-6">
                <h2 className="text-2xl sm:text-4xl font-bold mb-2">{data.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="flex items-center gap-1 text-yellow-400">
                    <Star className="h-4 w-4 fill-current" />
                    {data.vote_average.toFixed(1)}
                  </span>
                  {data.release_date && <span>{data.release_date.slice(0, 4)}</span>}
                  {data.runtime > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {data.runtime}m
                    </span>
                  )}
                  {data.genres?.slice(0, 3).map(g => (
                    <span key={g.id} className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs text-primary">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={handlePlay} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                  <Play className="h-4 w-4 fill-current" />
                    {t('drawer.play')}
                  </button>
                {trailer && (
                  <button
                    onClick={() => setTrailerOpen(true)}
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                  >
                    {t('drawer.trailer')}
                  </button>
                )}
              </div>

              {/* Overview */}
              <p className="text-sm leading-relaxed text-muted-foreground">{data.overview}</p>

              {/* TV Episodes */}
              {data.type === 'tv' && data.seasons && (
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Episodes</h3>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedSeason}
                        onChange={e => setSelectedSeason(Number(e.target.value))}
                        className="rounded-md bg-muted px-2 py-1 text-sm outline-none"
                      >
                        {data.seasons.map(s => (
                          <option key={s.id} value={s.season_number}>{s.name || `Season ${s.season_number}`}</option>
                        ))}
                      </select>
                      <button onClick={() => setEpisodeView(p => p === 'grid' ? 'list' : 'grid')} className="rounded-md bg-muted p-1.5 text-muted-foreground hover:text-foreground">
                        {episodeView === 'grid' ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {episodesLoading ? (
                    <div className="flex h-32 items-center justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : episodeView === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {episodes.map(ep => (
                        <button key={ep.id} onClick={() => handleEpisodeClick(ep)} className="group space-y-2 text-left">
                          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                            {ep.still_path ? (
                              <img src={getImageUrl(ep.still_path, 'w300')!} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                            )}
                            <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
                              Ep {ep.episode_number}
                            </div>
                          </div>
                          <p className="text-sm font-medium line-clamp-1">{ep.name}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {episodes.map(ep => (
                        <button key={ep.id} onClick={() => handleEpisodeClick(ep)} className="flex w-full gap-3 text-left group">
                          <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-muted">
                            {ep.still_path ? (
                              <img src={getImageUrl(ep.still_path, 'w300')!} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">{ep.episode_number}. {ep.name}</p>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{ep.overview || 'No overview'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Cast */}
              {data.credits?.cast?.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-3">Cast</h3>
                  <div className="flex gap-4 overflow-x-auto pb-2">
                    {data.credits.cast.slice(0, 15).map(person => (
                      <div key={person.id} className="flex-shrink-0 w-20 text-center">
                        <div className="h-20 w-20 overflow-hidden rounded-full bg-muted mx-auto mb-1">
                          {person.profile_path ? (
                            <img src={getImageUrl(person.profile_path, 'w185')!} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">?</div>
                          )}
                        </div>
                        <p className="text-xs font-medium line-clamp-1">{person.name}</p>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{person.character}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recommendations */}
              {data.recommendations?.results?.length > 0 && (
                <section>
                  <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {data.recommendations.results.slice(0, 10).map((rec: any) => (
                      <button
                        key={rec.id}
                        onClick={() => payload && navigate(`/watch/${rec.media_type || data.type}/${rec.id}`)}
                        className="flex-shrink-0 w-[120px] text-left group"
                      >
                        <div className="aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                          {rec.poster_path ? (
                            <img src={getImageUrl(rec.poster_path, 'w342')!} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">No image</div>
                          )}
                        </div>
                        <p className="mt-1 text-xs font-medium line-clamp-1">{rec.title || rec.name}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
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
