import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Film, Tv, Loader2 } from 'lucide-react'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandItem } from 'cmdk'
import { api } from '@/lib/api'
import { getImageUrl, cn } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'
import { StarRating } from '@/components/ui/StarRating'

interface SearchResult {
  id: number
  media_type: 'movie' | 'tv'
  title?: string
  name?: string
  poster_path: string | null
  vote_average: number
  release_date?: string
  first_air_date?: string
}

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MediaFilter = 'all' | 'movie' | 'tv'

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<MediaFilter>('all')
  const { open: openDrawer } = useDrawer()

  useEffect(() => {
    let cancelled = false
    if (query.length < 2) { setResults([]); setLoading(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await api.tmdb.search(query)
        if (cancelled) return
        setResults([
          ...data.movies.map((m: any) => ({ ...m, media_type: 'movie' as const })),
          ...data.tv.map((t: any) => ({ ...t, media_type: 'tv' as const })),
        ])
      } catch {
        if (!cancelled) setResults([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]); setFilter('all') }
  }, [open])

  const displayResults = results.filter(r => filter === 'all' || r.media_type === filter)

  const handleSelect = (item: SearchResult) => {
    onOpenChange(false)
    openDrawer({ id: item.id, type: item.media_type })
  }

  const filters: { key: MediaFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'movie', label: 'Movies' },
    { key: 'tv', label: 'TV' },
  ]

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} label="Search">
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

        <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-background shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={t('search.placeholder')}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-mono text-muted-foreground">
              ESC
            </kbd>
          </div>

          <div className="flex gap-1 px-3 pt-2 pb-1 border-b border-border">
            {filters.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                {label}
              </button>
            ))}
            {results.length > 0 && (
              <span className="ml-auto text-[10px] text-muted-foreground self-center">
                {displayResults.length} results
              </span>
            )}
          </div>

          <CommandList className="max-h-[50vh] overflow-y-auto p-2">
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              {query.length < 2 ? 'Type at least 2 characters to search' : 'No results found'}
            </CommandEmpty>

            {displayResults.map((item) => (
              <CommandItem
                key={`${item.media_type}-${item.id}`}
                value={`${item.title || item.name} ${item.media_type}`}
                onSelect={() => handleSelect(item)}
                className="flex items-center gap-3 rounded-lg p-2 text-left transition-colors aria-selected:bg-muted cursor-pointer"
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
                    {item.vote_average > 0 && <StarRating rating={item.vote_average} />}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </div>
      </div>
    </CommandDialog>
  )
}
