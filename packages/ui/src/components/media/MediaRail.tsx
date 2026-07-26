import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useEmblaCarousel from 'embla-carousel-react'
import { MediaCard } from './MediaCard'

interface MediaRailProps {
  title: string
  fetcher: () => Promise<any[]>
  isLoading?: boolean
  mapper?: (item: any) => {
    id: number
    type: 'movie' | 'tv'
    title: string
    posterPath: string | null
    rating: number
    releaseDate?: string
    badge?: string
  }
}

const defaultMapper = (item: any) => ({
  id: item.id,
  type: (item.media_type || 'movie') as 'movie' | 'tv',
  title: item.title || item.name || 'Untitled',
  posterPath: item.poster_path,
  rating: item.vote_average || 0,
  releaseDate: item.release_date || item.first_air_date,
})

export function MediaRail({ title, fetcher, isLoading: externalLoading, mapper = defaultMapper }: MediaRailProps) {
  const [items, setItems] = useState<any[]>([])
  const [internalLoading, setInternalLoading] = useState(true)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    dragFree: true,
    containScroll: 'trimSnaps',
  })
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(true)

  useEffect(() => {
    setInternalLoading(true)
    fetcher().then(items => { setItems(items); setInternalLoading(false) }).catch(() => { setInternalLoading(false) })
  }, [fetcher])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  const onSelect = useCallback(() => {
    if (!emblaApi) return
    setCanScrollPrev(emblaApi.canScrollPrev())
    setCanScrollNext(emblaApi.canScrollNext())
  }, [emblaApi])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', onSelect)
    emblaApi.on('reInit', onSelect)
    onSelect()
    return () => {
      emblaApi.off('select', onSelect)
      emblaApi.off('reInit', onSelect)
    }
  }, [emblaApi, onSelect])

  const loading = externalLoading ?? internalLoading
  if (!loading && items.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-4 overflow-hidden px-4 sm:px-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="w-[140px] sm:w-[160px] lg:w-[176px] shrink-0">
              <div className="aspect-[2/3] rounded-[10px] bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        // -my-4 py-4: give the overflow-hidden embla viewport vertical room so
        // the cards' hover-scale isn't clipped, without adding layout height.
        <div className="-my-4 overflow-hidden px-4 py-4 sm:px-6" ref={emblaRef}>
          <div className="flex gap-4" style={{ backfaceVisibility: 'hidden' }}>
            {items.map((item) => {
              const mapped = mapper(item)
              return (
                <div key={`${mapped.type}-${mapped.id}`} className="w-[140px] shrink-0 sm:w-[160px] lg:w-[176px]">
                  <MediaCard
                    id={mapped.id}
                    type={mapped.type}
                    title={mapped.title}
                    posterPath={mapped.posterPath}
                    rating={mapped.rating}
                    releaseDate={mapped.releaseDate}
                    badge={mapped.badge}
                    variant="rail"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
