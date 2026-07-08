import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { MediaCard } from '@/components/media/MediaCard'
import { Film, Tv } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Discover() {
  const [type, setType] = useState<'movie' | 'tv'>('movie')
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.tmdb.genres(type).then(setGenres).catch(() => {})
    setSelectedGenre(null)
    setPage(1)
  }, [type])

  useEffect(() => {
    setLoading(true)
    const fetcher = selectedGenre
      ? () => api.tmdb.popular(type, page) // genre filtering done client-side for simplicity
      : () => api.tmdb.popular(type, page)

    fetcher()
      .then(items => {
        if (selectedGenre) {
          setResults(items.filter((m: any) => m.genre_ids?.includes(selectedGenre)))
        } else {
          setResults(items)
        }
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [type, selectedGenre, page])

  return (
    <div className="py-6 px-4 sm:px-6">
      <h1 className="text-2xl font-bold mb-4">Discover</h1>

      {/* Type toggle */}
      <div className="flex gap-2 mb-4">
        {(['movie', 'tv'] as const).map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              type === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {t === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
            {t === 'movie' ? 'Movies' : 'TV Shows'}
          </button>
        ))}
      </div>

      {/* Genre filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedGenre(null)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            !selectedGenre ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          All
        </button>
        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => setSelectedGenre(g.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              selectedGenre === g.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* Results grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {results.map(item => (
            <MediaCard
              key={item.id}
              id={item.id}
              type={type}
              title={item.title || item.name}
              posterPath={item.poster_path}
              rating={item.vote_average}
              releaseDate={item.release_date || item.first_air_date}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2 mt-8">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-lg bg-muted px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted/80"
        >
          Previous
        </button>
        <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          className="rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          Next
        </button>
      </div>
    </div>
  )
}
