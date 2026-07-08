import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Film, Tv, X } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl, cn } from '@/lib/utils'

interface SearchResult {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  overview: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const data = await api.tmdb.search(q)
      const all = [
        ...data.movies.map((m: any) => ({ ...m, media_type: 'movie' as const })),
        ...data.tv.map((t: any) => ({ ...t, media_type: 'tv' as const })),
      ]
      setResults(all.slice(0, 10))
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 400)
    return () => clearTimeout(timer)
  }, [query, search])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  const handleSelect = (item: SearchResult) => {
    onOpenChange(false)
    if (item.media_type === 'movie') {
      navigate(`/watch/movie/${item.id}`)
    } else {
      navigate(`/watch/tv/${item.id}?s=1&e=1`)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => onOpenChange(false)} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-background shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and TV shows..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No results found</p>
          )}

          {!loading && results.map((item) => (
            <button
              key={`${item.media_type}-${item.id}`}
              onClick={() => handleSelect(item)}
              className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
            >
              {item.poster_path ? (
                <img
                  src={getImageUrl(item.poster_path, 'w92')!}
                  alt=""
                  className="h-14 w-10 rounded object-cover"
                />
              ) : (
                <div className="flex h-14 w-10 items-center justify-center rounded bg-muted">
                  {item.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.title || item.name}
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium',
                    item.media_type === 'movie' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400',
                  )}>
                    {item.media_type === 'movie' ? 'Movie' : 'TV'}
                  </span>
                  <span>{(item.release_date || item.first_air_date || '').slice(0, 4)}</span>
                  {item.vote_average > 0 && <span>★ {item.vote_average.toFixed(1)}</span>}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
