import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, Dices, ExternalLink, Play, RefreshCw, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

type MediaType = 'movie' | 'tv'

interface Recommendation {
  id: number
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  vote_average: number
  vote_count: number
  release_date?: string
  first_air_date?: string
  genre_ids?: number[]
}

const profiles: { type: MediaType; sortBy: string; genreId?: number; yearFrom?: number; yearTo?: number }[] = [
  { type: 'movie', sortBy: 'popularity.desc' },
  { type: 'movie', sortBy: 'vote_average.desc' },
  { type: 'movie', sortBy: 'popularity.desc', genreId: 28 },
  { type: 'movie', sortBy: 'popularity.desc', genreId: 35 },
  { type: 'movie', sortBy: 'popularity.desc', genreId: 27 },
  { type: 'movie', sortBy: 'popularity.desc', genreId: 878 },
  { type: 'movie', sortBy: 'popularity.desc', genreId: 53 },
  { type: 'movie', sortBy: 'popularity.desc', yearFrom: 2020 },
  { type: 'movie', sortBy: 'popularity.desc', yearTo: 1999 },
  { type: 'tv', sortBy: 'popularity.desc' },
  { type: 'tv', sortBy: 'vote_average.desc' },
  { type: 'tv', sortBy: 'popularity.desc', genreId: 10765 },
  { type: 'tv', sortBy: 'popularity.desc', genreId: 10759 },
  { type: 'tv', sortBy: 'popularity.desc', genreId: 35 },
]

export default function Surprise() {
  const navigate = useNavigate()
  const seenIds = useRef(new Set<string>())
  const [recommendation, setRecommendation] = useState<{ item: Recommendation; type: MediaType; genres: string[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const findRecommendation = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCopied(false)

    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const profile = profiles[Math.floor(Math.random() * profiles.length)]
        const [items, genres] = await Promise.all([
          api.tmdb.discover(profile.type, {
            page: Math.floor(Math.random() * 100) + 1,
            sortBy: profile.sortBy,
            genreId: profile.genreId || null,
            yearFrom: profile.yearFrom || '',
            yearTo: profile.yearTo || '',
          }) as Promise<Recommendation[]>,
          api.tmdb.genres(profile.type),
        ])
        const candidates = items.filter((item) => !seenIds.current.has(`${profile.type}:${item.id}`))
        const item = candidates[Math.floor(Math.random() * candidates.length)] || items[Math.floor(Math.random() * items.length)]

        if (item) {
          seenIds.current.add(`${profile.type}:${item.id}`)
          const genreNames = new Map(genres.map((genre) => [genre.id, genre.name]))
          setRecommendation({
            item,
            type: profile.type,
            genres: (item.genre_ids || []).map((id) => genreNames.get(id)).filter((name): name is string => Boolean(name)),
          })
          return
        }
      }
      setError('No recommendations were available. Try again for a new roll.')
    } catch {
      setError('Unable to get a recommendation right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void findRecommendation()
  }, [findRecommendation])

  const copyId = async () => {
    if (!recommendation) return
    try {
      await navigator.clipboard.writeText(String(recommendation.item.id))
      setCopied(true)
    } catch {
      setError('Could not copy the ID. Please copy it manually.')
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Dices className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Surprise Me</h1>
        <p className="mt-2 text-sm text-muted-foreground">A genuinely random movie or series, picked from a broad range of genres and eras.</p>
      </div>

      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-border bg-card shadow-2xl">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Finding you something to watch…</p>
        </div>
      ) : error ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
          <p className="text-muted-foreground">{error}</p>
          <button onClick={() => void findRecommendation()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : recommendation && (
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:flex">
          {recommendation.item.poster_path ? (
            <img src={getImageUrl(recommendation.item.poster_path, 'w500')!} alt="" className="h-[340px] w-full object-cover md:h-auto md:min-h-[440px] md:w-72" />
          ) : (
            <div className="flex h-[340px] w-full items-center justify-center bg-muted text-sm text-muted-foreground md:h-auto md:min-h-[440px] md:w-72">No poster available</div>
          )}
          <div className="flex flex-1 flex-col p-6 sm:p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">{recommendation.type === 'movie' ? 'Movie' : 'TV series'} pick</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight">{recommendation.item.title || recommendation.item.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span>{(recommendation.item.release_date || recommendation.item.first_air_date || 'Unknown').slice(0, 4)}</span>
              <span className="inline-flex items-center gap-1 text-yellow-400"><Star className="h-4 w-4 fill-current" />{recommendation.item.vote_average.toFixed(1)} / 10</span>
              <span>{recommendation.item.vote_count.toLocaleString()} votes</span>
            </div>
            {recommendation.genres.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{recommendation.genres.map((genre) => <span key={genre} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{genre}</span>)}</div>}
            <p className="mt-6 max-w-2xl text-sm leading-7 text-muted-foreground">{recommendation.item.overview || 'No description is available for this title.'}</p>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              <button onClick={() => navigate(`/watch/${recommendation.type}/${recommendation.item.id}${recommendation.type === 'tv' ? '?s=1&e=1' : ''}`)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Play className="h-4 w-4 fill-current" /> Watch now
              </button>
              <button onClick={() => void findRecommendation()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium hover:bg-muted/80">
                <Dices className="h-4 w-4" /> Another one
              </button>
              <a href={`https://www.themoviedb.org/${recommendation.type}/${recommendation.item.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium hover:bg-muted/80">
                <ExternalLink className="h-4 w-4" /> TMDB
              </a>
              {/* letterboxd.com/tmdb/<id> redirects to the film's page; Letterboxd is films-only, so hide for TV */}
              {recommendation.type === 'movie' && (
                <a href={`https://letterboxd.com/tmdb/${recommendation.item.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium hover:bg-muted/80">
                  <ExternalLink className="h-4 w-4" /> Letterboxd
                </a>
              )}
              <button onClick={() => void copyId()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-muted px-4 py-3 text-sm font-medium hover:bg-muted/80">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          </div>
        </article>
      )}
      <button onClick={() => navigate('/discover')} className="mx-auto mt-6 text-sm text-muted-foreground hover:text-foreground">Back to Discover</button>
    </div>
  )
}
