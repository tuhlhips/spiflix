import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { MediaCard } from '@/components/media/MediaCard'
import { Film, Tv, Shuffle, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type SortOption = 'popularity.desc' | 'vote_average.desc' | 'primary_release_date.desc' | 'primary_release_date.asc' | 'original_title.asc'

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'popularity.desc', label: 'Popularity' },
  { value: 'vote_average.desc', label: 'Rating' },
  { value: 'primary_release_date.desc', label: 'Newest' },
  { value: 'primary_release_date.asc', label: 'Oldest' },
  { value: 'original_title.asc', label: 'A-Z' },
]

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 50 }, (_, i) => currentYear - i)

export default function Discover() {
  const [type, setType] = useState<'movie' | 'tv'>('movie')
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<SortOption>('popularity.desc')
  const [yearFrom, setYearFrom] = useState<number | ''>('')
  const [yearTo, setYearTo] = useState<number | ''>('')

  useEffect(() => {
    api.tmdb.genres(type).then(setGenres).catch(() => {})
    setSelectedGenre(null)
    setPage(1)
  }, [type])

  useEffect(() => {
    setLoading(true)
    const fetcher = selectedGenre
      ? () => api.tmdb.popular(type, page)
      : () => api.tmdb.popular(type, page)

    fetcher()
      .then(items => {
        let filtered = selectedGenre
          ? items.filter((m: any) => m.genre_ids?.includes(selectedGenre))
          : items

        if (yearFrom) filtered = filtered.filter((m: any) => {
          const d = m.release_date || m.first_air_date || ''
          return d.startsWith(String(yearFrom))
        })
        if (yearTo) filtered = filtered.filter((m: any) => {
          const d = m.release_date || m.first_air_date || ''
          return d.startsWith(String(yearTo)) || d <= `${yearTo}-12-31`
        })

        setResults(filtered)
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false))
  }, [type, selectedGenre, page, sort, yearFrom, yearTo])

  const surpriseMe = useCallback(() => {
    setLoading(true)
    const randomPage = Math.floor(Math.random() * 20) + 1
    api.tmdb.popular(type, randomPage)
      .then(items => {
        if (items.length > 0) {
          const pick = items[Math.floor(Math.random() * items.length)]
          setResults([pick])
          toast.success(`Surprise! ${pick.title || pick.name}`)
        }
      })
      .catch(() => toast.error('Failed to find something'))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <div className="py-6 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Discover</h1>
        <button
          onClick={surpriseMe}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Shuffle className="h-4 w-4" />
          Surprise Me
        </button>
      </div>

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

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        {/* Sort */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Sort by</p>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortOption)}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            {sortOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Year range */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Year from</p>
          <select
            value={yearFrom}
            onChange={e => setYearFrom(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Any</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Year to</p>
          <select
            value={yearTo}
            onChange={e => setYearTo(e.target.value ? Number(e.target.value) : '')}
            className="rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Any</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
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
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">No results found</p>
          <p className="text-xs text-muted-foreground/60">Try adjusting your filters</p>
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
          className="flex items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium disabled:opacity-50 hover:bg-muted/80"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>
        <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          className="flex items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
