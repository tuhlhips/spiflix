import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { MediaCard } from '@/components/media/MediaCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Film, Tv, Shuffle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Sort field and direction are chosen separately: the field picks *what* to
// order by, the toggle picks the direction. They combine into TMDB's
// "<field>.<dir>" sort_by string.
type SortField = 'popularity' | 'vote_average' | 'primary_release_date' | 'original_title'
type SortDir = 'asc' | 'desc'

const sortFields: { value: SortField; label: string }[] = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'vote_average', label: 'Rating' },
  { value: 'primary_release_date', label: 'Release Date' },
  { value: 'original_title', label: 'Title' },
]

// A direction means different things per field, so label it in context.
function directionLabel(field: SortField, dir: SortDir): string {
  if (field === 'original_title') return dir === 'asc' ? 'A–Z' : 'Z–A'
  if (field === 'primary_release_date') return dir === 'desc' ? 'Newest first' : 'Oldest first'
  return dir === 'desc' ? 'Highest first' : 'Lowest first'
}

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 50 }, (_, i) => currentYear - i)

// TMDB's discover endpoint returns 20 results per page. A short page means
// there are no further pages, which is how we bound the "Next" button below
// (the API response is a bare array with no total_pages to rely on).
const PAGE_SIZE = 20

// TMDB's discover endpoint caps at page 500; the backend rejects anything
// higher, so the jump-to-page input clamps to this.
const MAX_PAGE = 500

export default function Discover() {
  const navigate = useNavigate()
  const [type, setType] = useState<'movie' | 'tv'>('movie')
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [sortField, setSortField] = useState<SortField>('popularity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [yearFrom, setYearFrom] = useState<number | ''>('')
  const [yearTo, setYearTo] = useState<number | ''>('')
  const [pageInput, setPageInput] = useState('')

  useEffect(() => {
    api.tmdb.genres(type).then(setGenres).catch(() => {})
    setSelectedGenre(null)
    setPage(1)
  }, [type])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    api.tmdb.discover(type, { page, sortBy: `${sortField}.${sortDir}`, genreId: selectedGenre, yearFrom, yearTo })
      .then(results => { if (!cancelled) setResults(results) })
      .catch(() => { if (!cancelled) { setResults([]); setError(true) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [type, selectedGenre, page, sortField, sortDir, yearFrom, yearTo, reloadKey])

  // Any filter change resets to page 1, so narrowing a filter while deep in the
  // pages can't leave us pointing past the end of a smaller result set.
  const changeSortField = (value: SortField) => { setSortField(value); setPage(1) }
  const toggleSortDir = () => { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setPage(1) }
  const changeGenre = (id: number | null) => { setSelectedGenre(id); setPage(1) }

  const goToPage = () => {
    const target = Number(pageInput)
    if (!Number.isInteger(target) || target < 1) return
    setPage(Math.min(target, MAX_PAGE))
    setPageInput('')
  }
  const changeYearFrom = (value: number | '') => { setYearFrom(value); setPage(1) }
  const changeYearTo = (value: number | '') => { setYearTo(value); setPage(1) }

  return (
    <div className="py-6 px-4 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Discover</h1>
        <button
          onClick={() => navigate('/surprise')}
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
        {/* Sort field */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Sort by</p>
          <select
            value={sortField}
            onChange={e => changeSortField(e.target.value as SortField)}
            className="appearance-auto rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          >
            {sortFields.map(o => (
              <option key={o.value} value={o.value} className="bg-background text-foreground">{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort direction */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Order</p>
          <button
            onClick={toggleSortDir}
            aria-label={`Sort order: ${directionLabel(sortField, sortDir)}. Click to reverse.`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {sortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
            {directionLabel(sortField, sortDir)}
          </button>
        </div>

        {/* Year range */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Year from</p>
          <select
            value={yearFrom}
            onChange={e => changeYearFrom(e.target.value ? Number(e.target.value) : '')}
            className="appearance-auto rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" className="bg-background text-foreground">Any</option>
            {yearOptions.map(y => (
              // Disallow a start year later than the chosen end year.
              <option key={y} value={y} disabled={yearTo !== '' && y > yearTo} className="bg-background text-foreground">{y}</option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-1">Year to</p>
          <select
            value={yearTo}
            onChange={e => changeYearTo(e.target.value ? Number(e.target.value) : '')}
            className="appearance-auto rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" className="bg-background text-foreground">Any</option>
            {yearOptions.map(y => (
              // Disallow an end year earlier than the chosen start year.
              <option key={y} value={y} disabled={yearFrom !== '' && y < yearFrom} className="bg-background text-foreground">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Genre filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => changeGenre(null)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors',
            selectedGenre === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          All
        </button>
        {genres.map(g => (
          <button
            key={g.id}
            onClick={() => changeGenre(g.id)}
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
        <LoadingState />
      ) : error ? (
        <ErrorState
          message="Couldn't load results. This may be a temporary problem with the server or TMDB — please try again."
          onRetry={() => setReloadKey(k => k + 1)}
        />
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

      {/* Pagination — only meaningful once there are results to page through. */}
      {!error && (results.length > 0 || page > 1) && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="flex justify-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={loading || page === 1}
              className="flex items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">Page {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={loading || results.length < PAGE_SIZE}
              className="flex items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Jump to page */}
          <form
            onSubmit={e => { e.preventDefault(); goToPage() }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <label htmlFor="discover-goto" className="text-xs">Go to page</label>
            <input
              id="discover-goto"
              type="number"
              min={1}
              max={MAX_PAGE}
              inputMode="numeric"
              value={pageInput}
              onChange={e => setPageInput(e.target.value)}
              placeholder={String(page)}
              className="w-20 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={loading || pageInput === ''}
              className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
            >
              Go
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
