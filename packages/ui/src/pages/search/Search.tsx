import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search as SearchIcon, X, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Segmented } from '@/components/ui/Segmented'
import { MediaCard } from '@/components/media/MediaCard'

type Type = 'all' | 'movie' | 'tv'

interface Result {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
}

export default function Search() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [type, setType] = useState<Type>((params.get('type') as Type) || 'all')
  const [results, setResults] = useState<Result[]>([])
  const [suggest, setSuggest] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Keep the URL (?q=&type=) in sync so searches are shareable and survive reload.
  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (type !== 'all') next.set('type', type)
    setParams(next, { replace: true })
  }, [query, type, setParams])

  // Debounced live search.
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); setLoading(false); return }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await api.tmdb.search(q)
        if (cancelled) return
        setResults([
          ...data.movies.map((m: any) => ({ ...m, media_type: 'movie' as const })),
          ...data.tv.map((tv: any) => ({ ...tv, media_type: 'tv' as const })),
        ])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  // Suggestions for the empty / no-match states.
  useEffect(() => {
    let cancelled = false
    api.tmdb.trending('movie')
      .then((list: any[]) => { if (!cancelled) setSuggest(list.slice(0, 12).map(m => ({ ...m, media_type: 'movie' as const }))) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(
    () => (type === 'all' ? results : results.filter(r => r.media_type === type)),
    [results, type],
  )

  const q = query.trim()
  const showResults = q.length >= 2 && filtered.length > 0
  const showNoMatch = q.length >= 2 && !loading && filtered.length === 0
  const showHint = q.length < 2

  const cardFor = (r: Result) => (
    <MediaCard
      key={`${r.media_type}:${r.id}`}
      id={r.id}
      type={r.media_type}
      title={r.title || r.name || ''}
      posterPath={r.poster_path}
      rating={r.vote_average}
      releaseDate={r.release_date || r.first_air_date}
      variant="grid"
    />
  )

  return (
    <main className="sfx-fade mx-auto max-w-[1440px] px-4 pb-20 pt-24 sm:px-8 lg:px-12">
      {/* Search field */}
      <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-border bg-background/60 px-5 py-4">
        <SearchIcon className="h-6 w-6 flex-none text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchPage.placeholder')}
          className="min-w-0 flex-1 bg-transparent text-xl font-semibold outline-none placeholder:text-muted-foreground/70 sm:text-[22px]"
        />
        {loading && <Loader2 className="h-5 w-5 flex-none animate-spin text-muted-foreground" />}
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus() }}
            aria-label={t('searchPage.clear')}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-foreground/[0.08] text-muted-foreground transition-colors hover:bg-foreground/[0.16] hover:text-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* Type filter */}
      <div className="mb-8">
        <Segmented<Type>
          value={type}
          onChange={setType}
          aria-label={t('searchPage.resultsLabel')}
          options={[
            { value: 'all', label: t('searchPage.all') },
            { value: 'movie', label: t('searchPage.movies') },
            { value: 'tv', label: t('searchPage.tv') },
          ]}
        />
      </div>

      {showHint && (
        <div className="py-16 text-center">
          <h2 className="mb-2 text-[22px] font-bold">{t('searchPage.hint')}</h2>
          <p className="mb-10 text-[15px] text-muted-foreground">{t('searchPage.hintBody')}</p>
          {suggest.length > 0 && (
            <>
              <p className="mb-4 text-left text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t('searchPage.suggest')}</p>
              <div className="grid gap-x-5 gap-y-7 text-left [grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr))]">
                {suggest.map(cardFor)}
              </div>
            </>
          )}
        </div>
      )}

      {showNoMatch && (
        <div className="py-10 text-center">
          <h2 className="mb-2 text-[22px] font-bold">{t('searchPage.noMatchTitle', { query: q })}</h2>
          <p className="mb-10 text-[15px] text-muted-foreground">{t('searchPage.noMatchBody')}</p>
          {suggest.length > 0 && (
            <>
              <p className="mb-4 text-left text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{t('searchPage.suggest')}</p>
              <div className="grid gap-x-5 gap-y-7 text-left [grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr))]">
                {suggest.slice(0, 6).map(cardFor)}
              </div>
            </>
          )}
        </div>
      )}

      {showResults && (
        <div className="grid gap-x-5 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(min(160px,100%),1fr))]">
          {filtered.map(cardFor)}
        </div>
      )}
    </main>
  )
}
