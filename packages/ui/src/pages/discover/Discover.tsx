import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { MediaCard } from '@/components/media/MediaCard'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Film, Tv, Shuffle, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react'
import { Segmented } from '@/components/ui/Segmented'
import { Chip } from '@/components/ui/Chip'

// Sort field and direction are chosen separately: the field picks *what* to
// order by, the toggle picks the direction. They combine into TMDB's
// "<field>.<dir>" sort_by string.
type SortField = 'popularity' | 'vote_average' | 'primary_release_date' | 'original_title'
type SortDir = 'asc' | 'desc'

const sortFields: { value: SortField; labelKey: string }[] = [
  { value: 'popularity', labelKey: 'discover.sort.popularity' },
  { value: 'vote_average', labelKey: 'discover.sort.rating' },
  { value: 'primary_release_date', labelKey: 'discover.sort.releaseDate' },
  { value: 'original_title', labelKey: 'discover.sort.title' },
]

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
  const { t } = useTranslation()
  // A direction means different things per field, so label it in context.
  const directionLabel = (field: SortField, dir: SortDir): string => {
    if (field === 'original_title') return dir === 'asc' ? t('discover.dir.az') : t('discover.dir.za')
    if (field === 'primary_release_date') return dir === 'desc' ? t('discover.dir.newest') : t('discover.dir.oldest')
    return dir === 'desc' ? t('discover.dir.highest') : t('discover.dir.lowest')
  }
  // Deep-link support: genre quick-tiles route here as ?type=tv&genre=Drama.
  const [searchParams] = useSearchParams()
  const genreParam = searchParams.get('genre')
  const appliedGenre = useRef(false)
  const [type, setType] = useState<'movie' | 'tv'>(searchParams.get('type') === 'tv' ? 'tv' : 'movie')
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
    api.tmdb.genres(type)
      .then(list => {
        setGenres(list)
        // Apply a ?genre=<name> deep-link once, after the list is available to
        // resolve the name to an id. Later type/genre changes won't re-apply it.
        if (genreParam && !appliedGenre.current) {
          const match = list.find(g => g.name.toLowerCase() === genreParam.toLowerCase())
          if (match) setSelectedGenre(match.id)
          appliedGenre.current = true
        }
      })
      .catch(() => {})
  }, [type, genreParam])

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
  // Type/genre/page reset happens in ONE handler (not a type-effect) so the
  // switch renders once and fetches once, instead of firing a throwaway fetch
  // with the previous type's genre/page first.
  const changeType = (value: 'movie' | 'tv') => {
    if (value === type) return
    setType(value)
    setSelectedGenre(null)
    setPage(1)
  }
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
    <div className="px-4 sm:px-6 pb-6 pt-20 sm:pt-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-bold tracking-tight">{t('discover.title')}</h1>
        <button
          onClick={() => navigate('/surprise')}
          className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
        >
          <Shuffle className="h-4 w-4" />
          <span className="hidden sm:inline">{t('discover.surpriseMe')}</span>
        </button>
      </div>

      {/* Sticky filter bar */}
      <div className="sticky top-[72px] z-30 mb-7 space-y-3 rounded-2xl border border-border bg-background/85 p-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            aria-label={t('discover.title')}
            value={type}
            onChange={changeType}
            options={[
              { value: 'movie', label: t('discover.movies'), icon: <Film className="h-4 w-4" /> },
              { value: 'tv', label: t('discover.tvShows'), icon: <Tv className="h-4 w-4" /> },
            ]}
          />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select
              value={sortField}
              onChange={e => changeSortField(e.target.value as SortField)}
              aria-label={t('discover.sortBy')}
              className="appearance-auto rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              {sortFields.map(o => (
                <option key={o.value} value={o.value} className="bg-background text-foreground">{t(o.labelKey)}</option>
              ))}
            </select>
            <button
              onClick={toggleSortDir}
              aria-label={directionLabel(sortField, sortDir)}
              title={directionLabel(sortField, sortDir)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {sortDir === 'desc' ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              <span className="hidden md:inline">{directionLabel(sortField, sortDir)}</span>
            </button>
            <select
              value={yearFrom}
              onChange={e => changeYearFrom(e.target.value ? Number(e.target.value) : '')}
              aria-label={t('discover.yearFrom')}
              className="appearance-auto rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" className="bg-background text-foreground">{t('discover.yearFrom')}</option>
              {yearOptions.map(y => (
                <option key={y} value={y} disabled={yearTo !== '' && y > yearTo} className="bg-background text-foreground">{y}</option>
              ))}
            </select>
            <select
              value={yearTo}
              onChange={e => changeYearTo(e.target.value ? Number(e.target.value) : '')}
              aria-label={t('discover.yearTo')}
              className="appearance-auto rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="" className="bg-background text-foreground">{t('discover.yearTo')}</option>
              {yearOptions.map(y => (
                <option key={y} value={y} disabled={yearFrom !== '' && y < yearFrom} className="bg-background text-foreground">{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Genre chips — horizontal scroll */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={selectedGenre === null} onClick={() => changeGenre(null)}>{t('discover.all')}</Chip>
          {genres.map(g => (
            <Chip key={g.id} active={selectedGenre === g.id} onClick={() => changeGenre(g.id)}>{g.name}</Chip>
          ))}
        </div>
      </div>

      {/* Results grid */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          message={t('discover.loadError')}
          onRetry={() => setReloadKey(k => k + 1)}
        />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-2">{t('discover.noResults')}</p>
          <p className="text-xs text-muted-foreground/60">{t('discover.noResultsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-x-5 gap-y-7">
          {results.map(item => (
            <MediaCard
              key={item.id}
              id={item.id}
              type={type}
              title={item.title || item.name}
              posterPath={item.poster_path}
              rating={item.vote_average}
              releaseDate={item.release_date || item.first_air_date}
              variant="grid"
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
              {t('discover.previous')}
            </button>
            <span className="flex items-center px-4 text-sm text-muted-foreground">{t('discover.page')} {page}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={loading || results.length < PAGE_SIZE}
              className="flex items-center gap-1 rounded-lg bg-muted px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted/80"
            >
              {t('discover.next')}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Jump to page */}
          <form
            onSubmit={e => { e.preventDefault(); goToPage() }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <label htmlFor="discover-goto" className="text-xs">{t('discover.goToPage')}</label>
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
              {t('discover.go')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
